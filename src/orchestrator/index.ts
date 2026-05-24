/**
 * PolyReview — Multi-Agent Code Review Orchestrator
 *
 * Chain-of-Thought task decomposition engine.
 * Analyzes PR diffs, splits into independent review sub-tasks,
 * dispatches to parallel Reviewer/Security/Refactor agents,
 * and aggregates results through the Merge Agent.
 *
 * @module orchestrator
 */

import type { PRContext, ReviewTask, AgentRole, Finding } from "../types";
import { AgentPool } from "./pool";
import { CoTDecomposer } from "./cot";
import { DependencyAnalyzer } from "./dependency";

export interface OrchestratorConfig {
  /** Maximum parallel agents in the worker pool */
  poolSize: number;
  /** LLM model to use for orchestration reasoning */
  model: string;
  /** Enable deep security scanning (Semgrep + CWE Top 25) */
  deepSecurity: boolean;
  /** Enable patch re-review cycle to catch regressions */
  patchReReview: boolean;
  /** Confidence threshold for findings (0.0–1.0) */
  confidenceThreshold: number;
}

export interface OrchestratorResult {
  sessionId: string;
  prNumber: number;
  tasks: ReviewTask[];
  findings: Finding[];
  patches: string[];
  elapsedMs: number;
  tokensUsed: number;
  costUsd: number;
  summary: {
    critical: number;
    medium: number;
    low: number;
    avgConfidence: number;
  };
}

export class Orchestrator {
  private config: OrchestratorConfig;
  private pool: AgentPool;
  private decomposer: CoTDecomposer;
  private depAnalyzer: DependencyAnalyzer;

  constructor(config: OrchestratorConfig) {
    this.config = {
      poolSize: 8,
      deepSecurity: true,
      patchReReview: true,
      confidenceThreshold: 0.70,
      ...config,
    };
    this.pool = new AgentPool(this.config.poolSize);
    this.decomposer = new CoTDecomposer(this.config.model);
    this.depAnalyzer = new DependencyAnalyzer();
  }

  /**
   * Main entry point: review a pull request end-to-end.
   *
   * Flow:
   *   1. Analyze PR diff and dependency graph
   *   2. CoT decompose into sub-tasks
   *   3. Dispatch to parallel agent pool
   *   4. Re-review generated patches (if enabled)
   *   5. Cross-cutting analysis (API compat, bundle size)
   *   6. Merge and deduplicate findings
   *   7. Generate final report with confidence scores
   */
  async review(pr: PRContext): Promise<OrchestratorResult> {
    const startTime = Date.now();

    // Phase 1: Analyze & Decompose
    console.log(`[Orchestrator] Analyzing PR #${pr.number}: ${pr.title}`);
    const dependencyGraph = await this.depAnalyzer.buildGraph(pr.diff);
    console.log(
      `[Orchestrator] Dependency graph: ${dependencyGraph.downstreamConsumers.length} downstream consumers`
    );

    const tasks = await this.decomposer.decompose(pr, dependencyGraph);
    console.log(
      `[Orchestrator] CoT decomposition: ${tasks.length} sub-tasks generated`
    );

    // Detect task interdependencies
    const taskDeps = this.depAnalyzer.detectTaskDependencies(tasks);
    console.log(
      `[Orchestrator] Task dependencies: ${taskDeps.length} relationships`
    );

    // Phase 2: Parallel execution
    console.log(
      `[Orchestrator] Dispatching ${tasks.length} tasks to pool (size=${this.config.poolSize})`
    );
    const agentResults = await this.pool.executeAll(tasks, {
      model: this.config.model,
      deepSecurity: this.config.deepSecurity,
    });

    const allFindings: Finding[] = [];
    const allPatches: string[] = [];

    for (const result of agentResults) {
      allFindings.push(...result.findings);
      allPatches.push(...result.patches);
    }

    console.log(
      `[Orchestrator] Phase 2 complete: ${allFindings.length} findings, ${allPatches.length} patches`
    );

    // Phase 3: Patch re-review (optional)
    if (this.config.patchReReview && allPatches.length > 0) {
      console.log(
        `[Orchestrator] Patch re-review: verifying ${allPatches.length} patches`
      );
      const reReviewResults = await this.pool.reReviewPatches(
        allPatches,
        pr.diff
      );
      // Merge re-review findings and resolve conflicts
      for (const rr of reReviewResults) {
        if (rr.conflicts.length > 0) {
          console.log(
            `[Orchestrator] Auto-resolved ${rr.conflicts.length} patch conflicts`
          );
        }
        allFindings.push(...rr.regressionFindings);
      }
    }

    // Phase 4: Cross-cutting analysis
    const crossCutFindings = await this.depAnalyzer.analyzeCrossCutting(
      pr,
      dependencyGraph,
      allFindings
    );
    allFindings.push(...crossCutFindings);

    // Phase 5: Merge & Deduplicate
    const { MergeAgent } = await import("../merge/agent");
    const merger = new MergeAgent(this.config.confidenceThreshold);
    const merged = await merger.merge(allFindings, allPatches, pr);

    // Phase 6: Final report
    const elapsedMs = Date.now() - startTime;
    console.log(
      `[Orchestrator] Complete: ${elapsedMs}ms, ${merged.totalTokens} tokens, $${merged.costUsd.toFixed(2)}`
    );

    return {
      sessionId: `sess_${Math.random().toString(36).slice(2, 10)}`,
      prNumber: pr.number,
      tasks,
      findings: merged.findings,
      patches: merged.patches,
      elapsedMs,
      tokensUsed: merged.totalTokens,
      costUsd: merged.costUsd,
      summary: {
        critical: merged.findings.filter((f) => f.severity === "critical")
          .length,
        medium: merged.findings.filter((f) => f.severity === "medium").length,
        low: merged.findings.filter((f) => f.severity === "low").length,
        avgConfidence: merged.avgConfidence,
      },
    };
  }
}
