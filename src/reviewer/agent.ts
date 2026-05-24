/**
 * Reviewer Agent — Multi-step reasoning for code correctness & quality.
 *
 * Analyzes individual files within a PR, performing:
 *   - Logic defect detection
 *   - Cross-reference validation
 *   - Edge case identification
 *   - Style & convention adherence
 *   - Test coverage assessment
 */

import type { ReviewTask, Finding, AgentResult } from "../types";
import { LLMClient } from "../utils/llm";
import { ASTParser } from "../utils/ast";

const REVIEWER_SYSTEM_PROMPT = `You are a senior code reviewer. Analyze the provided diff with multi-step reasoning:

Step 1: Understand the change intent from the diff context.
Step 2: Identify potential logic defects: null handling, error paths, race conditions.
Step 3: Cross-reference with the file's existing patterns — does this change fit?
Step 4: Check edge cases: empty inputs, boundary values, concurrent access.
Step 5: Assess test coverage: are critical paths exercised?

For each finding, provide: severity (critical/medium/low), confidence (0.0–1.0), CWE if applicable, and a suggested fix.`;

export class ReviewerAgent {
  private llm: LLMClient;
  private ast: ASTParser;

  constructor(model: string) {
    this.llm = new LLMClient(model);
    this.ast = new ASTParser();
  }

  async review(task: ReviewTask, diff: string): Promise<AgentResult> {
    const startTime = Date.now();

    console.log(`[Reviewer·${task.id}] Multi-step reasoning on ${task.file}...`);

    // Step 1: Parse AST for structural analysis
    const astTree = await this.ast.parse(task.file, task.language);
    const codeSmells = this.ast.detectCodeSmells(astTree);

    // Step 2: LLM-based deep reasoning
    const llmFindings = await this.llm.analyze(diff, {
      systemPrompt: REVIEWER_SYSTEM_PROMPT,
      context: {
        file: task.file,
        language: task.language,
        focus: task.focus,
        codeSmells,
      },
    });

    // Step 3: Merge AST + LLM findings
    const findings: Finding[] = [
      ...codeSmells.map((smell) => ({
        id: `${task.id}_ast_${smell.type}`,
        taskId: task.id,
        file: task.file,
        line: smell.line,
        severity: smell.severity,
        category: smell.type,
        title: smell.title,
        description: smell.description,
        impact: smell.impact,
        recommendation: smell.fix,
        confidence: 0.85,
      })),
      ...llmFindings,
    ];

    const elapsedMs = Date.now() - startTime;

    return {
      taskId: task.id,
      agentRole: "reviewer",
      findings,
      patches: [],
      tokensUsed: llmFindings.length * 8000, // rough estimate
      elapsedMs,
    };
  }
}
