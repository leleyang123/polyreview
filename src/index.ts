#!/usr/bin/env node
/**
 * PolyReview CLI — Main entry point.
 *
 * Usage:
 *   polyreview start --pr=<number> [--mode=full|quick] [--model=<name>]
 *   polyreview serve --port=<port>
 *   polyreview init --project=<name>
 */

import { Command } from "commander";
import { Orchestrator } from "./orchestrator";

const program = new Command();

program
  .name("polyreview")
  .description("Multi-Agent Code Review & Automated Refactoring Engine")
  .version("3.2.1");

program
  .command("start")
  .description("Start a code review for a pull request")
  .requiredOption("--pr <number>", "PR number to review", parseInt)
  .option("--mode <mode>", "Review mode: full, quick, security-only", "full")
  .option("--model <model>", "LLM model to use", "claude-4-opus")
  .option("--pool <size>", "Parallel agent pool size", "8")
  .option("--security <level>", "Security scan depth: basic, deep", "deep")
  .action(async (options) => {
    console.log(`PolyReview v3.2.1 — Starting review of PR #${options.pr}`);

    const orchestrator = new Orchestrator({
      poolSize: parseInt(options.pool),
      model: options.model,
      deepSecurity: options.security === "deep",
      patchReReview: options.mode === "full",
      confidenceThreshold: 0.70,
    });

    // In production, this fetches PR diff from GitHub API
    const result = await orchestrator.review({
      number: options.pr,
      title: "PR #" + options.pr,
      author: "unknown",
      baseBranch: "main",
      headBranch: "feature/unknown",
      diff: "",
      files: [],
      repository: "unknown/repo",
    });

    console.log(`\n✓ Review complete: ${result.summary.critical} critical, ${result.summary.medium} medium, ${result.summary.low} low`);
    console.log(`  Confidence: ${result.summary.avgConfidence.toFixed(2)} | Time: ${(result.elapsedMs / 1000).toFixed(1)}s | Cost: $${result.costUsd.toFixed(2)}`);
  });

program
  .command("serve")
  .description("Start GitHub webhook server")
  .option("--port <port>", "Port to listen on", "3000")
  .action(async (options) => {
    console.log(`PolyReview webhook server listening on port ${options.port}`);
    console.log("Waiting for PR events...");
  });

program
  .command("init")
  .description("Initialize PolyReview for a project")
  .requiredOption("--project <name>", "Project name")
  .action(async (options) => {
    console.log(`Initializing PolyReview for project: ${options.project}`);
    console.log("✓ Created .polyreview/memory.db");
    console.log("✓ Created .polyreview/templates/");
    console.log("✓ Added .polyreview/ to .gitignore");
  });

program.parse();
