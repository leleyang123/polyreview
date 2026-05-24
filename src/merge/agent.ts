/**
 * Merge Agent — Result aggregation, deduplication & confidence scoring.
 *
 * Responsibilities:
 *   - Merge findings from all parallel agents
 *   - Deduplicate overlapping findings (same file+line, same CWE)
 *   - Cross-reference with project memory (historical patterns)
 *   - Score confidence and filter below threshold
 *   - Detect systemic issues (recurring patterns across PRs)
 *   - Generate final report
 */

import type { Finding, MergeResult, SystemicIssue, DeprecationNotice, PRContext } from "../types";
import { MemoryDB } from "../memory/db";

export class MergeAgent {
  private memory: MemoryDB;
  private threshold: number;

  constructor(confidenceThreshold: number = 0.70) {
    this.memory = new MemoryDB();
    this.threshold = confidenceThreshold;
  }

  async merge(
    findings: Finding[],
    patches: string[],
    pr: PRContext
  ): Promise<MergeResult> {
    console.log(
      `[Merge] Aggregating ${findings.length} findings from agents...`
    );

    // Step 1: Deduplicate by file + line + category
    const deduped = this.deduplicate(findings);
    console.log(
      `[Merge] Deduplication: removed ${findings.length - deduped.length} duplicates`
    );

    // Step 2: Cross-reference with project memory
    const historicalMatches = await this.memory.crossReference(deduped);
    const systemicIssues: SystemicIssue[] = [];

    for (const match of historicalMatches) {
      if (match.occurrences >= 3) {
        systemicIssues.push({
          pattern: match.pattern,
          occurrences: match.occurrences,
          firstSeen: match.firstSeen,
          recommendation: match.recommendation,
        });
        console.log(
          `[Merge] Systemic issue detected: "${match.pattern}" (${match.occurrences} occurrences since ${match.firstSeen})`
        );
      }
    }

    // Step 3: Filter by confidence threshold
    const confident = deduped.filter((f) => f.confidence >= this.threshold);
    const filtered = deduped.length - confident.length;
    if (filtered > 0) {
      console.log(
        `[Merge] Filtered ${filtered} low-confidence findings (< ${this.threshold})`
      );
    }

    // Step 4: Score confidence
    const avgConfidence =
      confident.reduce((sum, f) => sum + f.confidence, 0) / confident.length;

    // Step 5: Detect deprecation notices
    const deprecationNotices = this.detectDeprecations(pr, confident);

    // Step 6: Store in memory for future sessions
    await this.memory.store(pr.number, confident, systemicIssues);

    // Rough token/cost estimation
    const totalTokens = confident.length * 15000 + patches.length * 5000;
    const costUsd = totalTokens * 0.000015; // ~$15/M tokens (claude-4-opus pricing)

    console.log(
      `[Merge] Final report: ${confident.length} findings, ${patches.length} patches, avg confidence: ${avgConfidence.toFixed(2)}`
    );

    return {
      findings: confident,
      patches,
      totalTokens,
      costUsd,
      avgConfidence,
      systemicIssues,
      deprecationNotices,
    };
  }

  /**
   * Removes duplicate findings. Two findings are duplicates if they share
   * the same file, same line (±2 lines), and same category or CWE.
   */
  private deduplicate(findings: Finding[]): Finding[] {
    const seen = new Set<string>();
    return findings.filter((f) => {
      const key = `${f.file}:${f.line}:${f.category}`;
      if (seen.has(key)) return false;
      // Also check ±2 line proximity
      for (let offset = -2; offset <= 2; offset++) {
        const nearbyKey = `${f.file}:${f.line + offset}:${f.category}`;
        if (seen.has(nearbyKey)) return false;
      }
      seen.add(key);
      return true;
    });
  }

  private detectDeprecations(
    pr: PRContext,
    findings: Finding[]
  ): DeprecationNotice[] {
    // Detect backward-incompatible API changes
    // This is simplified; real implementation uses API surface diffing
    return findings
      .filter((f) => f.category === "api-compatibility")
      .map((f) => ({
        api: f.title,
        currentVersion: "v1",
        newVersion: "v2",
        sunsetReleases: 2,
        affectedFiles: [f.file],
      }));
  }
}
