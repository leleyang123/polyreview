/**
 * Security Agent — CWE-focused vulnerability scanner.
 *
 * Integrates Semgrep rulesets + LLM reasoning for:
 *   - CWE Top 25 detection (SQLi, XSS, Path Traversal, etc.)
 *   - Sensitive data exposure (PII, secrets, tokens)
 *   - Authentication/authorization gaps
 *   - Cryptography misuse
 */

import type { ReviewTask, Finding, AgentResult } from "../types";
import { LLMClient } from "../utils/llm";
import { SemgrepRunner } from "../utils/semgrep";

const SECURITY_SYSTEM_PROMPT = `You are an application security engineer. Analyze the diff for security vulnerabilities:

1. OWASP Top 10 / CWE Top 25 coverage.
2. Injection risks: SQL, NoSQL, command, template.
3. Sensitive data exposure: PII, credentials, tokens in logs/payloads.
4. Broken access control: missing auth checks, IDOR.
5. Cryptographic failures: weak ciphers, hardcoded keys, missing signatures.

Report CVSS score where applicable. Suggest concrete mitigations.`;

export class SecurityAgent {
  private llm: LLMClient;
  private semgrep: SemgrepRunner;

  constructor(model: string) {
    this.llm = new LLMClient(model);
    this.semgrep = new SemgrepRunner();
  }

  async scan(task: ReviewTask, fileContent: string): Promise<AgentResult> {
    const startTime = Date.now();

    console.log(`[Security·${task.id}] Deep scan: ${task.file} — CWE ruleset...`);

    // Run Semgrep rules
    const semgrepFindings = await this.semgrep.scan(task.file, fileContent, {
      rulesets: ["p/cwe-top-25", "p/secrets", "p/owasp-top-ten"],
    });

    console.log(
      `[Security·${task.id}] Semgrep: ${semgrepFindings.length} matches`
    );

    // LLM-based contextual analysis (catches what static rules miss)
    const llmFindings = await this.llm.analyze(fileContent, {
      systemPrompt: SECURITY_SYSTEM_PROMPT,
      context: {
        file: task.file,
        language: task.language,
        semgrepFindings: semgrepFindings.map((f) => f.rule),
      },
    });

    const findings: Finding[] = [...semgrepFindings, ...llmFindings];

    return {
      taskId: task.id,
      agentRole: "security",
      findings,
      patches: [],
      tokensUsed: findings.length * 10000,
      elapsedMs: Date.now() - startTime,
    };
  }
}
