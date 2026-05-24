/**
 * MemoryDB — Persistent project memory for cross-session recall.
 *
 * Stores:
 *   - Historical review findings per PR
 *   - Systemic issue patterns detected across PRs
 *   - Reviewer preferences and conventions
 *
 * Used by the Merge Agent to detect recurring architectural gaps
 * and maintain consistency across review sessions.
 *
 * Backed by SQLite (better-sqlite3).
 */

import Database from "better-sqlite3";
import type { Finding, SystemicIssue } from "../types";

interface HistoricalMatch {
  pattern: string;
  occurrences: number;
  firstSeen: string;
  recommendation: string;
}

export class MemoryDB {
  private db: Database.Database;

  constructor(dbPath: string = ".polyreview/memory.db") {
    this.db = new Database(dbPath);
    this.initialize();
  }

  private initialize(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS findings (
        id TEXT PRIMARY KEY,
        pr_number INTEGER,
        file TEXT,
        line INTEGER,
        severity TEXT,
        category TEXT,
        title TEXT,
        cwe TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS systemic_patterns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pattern TEXT UNIQUE,
        occurrences INTEGER DEFAULT 1,
        first_seen TEXT DEFAULT (datetime('now')),
        last_seen TEXT DEFAULT (datetime('now')),
        recommendation TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_findings_category ON findings(category);
      CREATE INDEX IF NOT EXISTS idx_findings_pr ON findings(pr_number);
    `);
  }

  async crossReference(findings: Finding[]): Promise<HistoricalMatch[]> {
    const matches: HistoricalMatch[] = [];

    for (const finding of findings) {
      const row = this.db
        .prepare(
          `SELECT category, COUNT(*) as cnt, MIN(created_at) as first_seen
           FROM findings
           WHERE category = ? AND title LIKE '%' || ? || '%'
           GROUP BY category`
        )
        .get(finding.category, finding.title.split(" ")[0]) as any;

      if (row && row.cnt >= 2) {
        matches.push({
          pattern: finding.title,
          occurrences: row.cnt + 1,
          firstSeen: row.first_seen,
          recommendation: finding.recommendation,
        });
      }
    }

    return matches;
  }

  async store(
    prNumber: number,
    findings: Finding[],
    systemicIssues: SystemicIssue[]
  ): Promise<void> {
    const insert = this.db.prepare(`
      INSERT OR REPLACE INTO findings (id, pr_number, file, line, severity, category, title, cwe)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const upsertPattern = this.db.prepare(`
      INSERT INTO systemic_patterns (pattern, occurrences, recommendation)
      VALUES (?, 1, ?)
      ON CONFLICT(pattern) DO UPDATE SET
        occurrences = occurrences + 1,
        last_seen = datetime('now')
    `);

    const transaction = this.db.transaction(() => {
      for (const f of findings) {
        insert.run(f.id, prNumber, f.file, f.line, f.severity, f.category, f.title, f.cwe ?? null);
      }
      for (const issue of systemicIssues) {
        upsertPattern.run(issue.pattern, issue.recommendation);
      }
    });

    transaction();
    console.log(`[Memory] Stored ${findings.length} findings for PR #${prNumber}`);
  }

  getSystemicIssues(): SystemicIssue[] {
    return this.db
      .prepare(
        `SELECT pattern, occurrences, first_seen, last_seen, recommendation
         FROM systemic_patterns
         WHERE occurrences >= 3
         ORDER BY occurrences DESC`
      )
      .all() as SystemicIssue[];
  }

  close(): void {
    this.db.close();
  }
}
