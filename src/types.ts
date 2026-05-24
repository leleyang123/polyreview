/**
 * PolyReview — Core Type Definitions
 */

export interface PRContext {
  number: number;
  title: string;
  author: string;
  baseBranch: string;
  headBranch: string;
  diff: string;
  files: ChangedFile[];
  repository: string;
}

export interface ChangedFile {
  path: string;
  language: "typescript" | "go" | "python" | "rust" | "java" | "unknown";
  additions: number;
  deletions: number;
  isNew: boolean;
  isDeleted: boolean;
  patch: string;
}

export interface DependencyGraph {
  nodes: DependencyNode[];
  edges: DependencyEdge[];
  downstreamConsumers: string[];
}

export interface DependencyNode {
  file: string;
  exports: string[];
  imports: string[];
}

export interface DependencyEdge {
  from: string;
  to: string;
  type: "import" | "re-export" | "type-reference";
}

export interface ReviewTask {
  id: string;
  file: string;
  language: string;
  focus: ReviewFocus;
  severity: "critical" | "medium" | "low";
  dependencies: string[]; // other task IDs this depends on
}

export type ReviewFocus =
  | "security"
  | "performance"
  | "correctness"
  | "style"
  | "testing"
  | "migration"
  | "dependency"
  | "api-compatibility";

export type AgentRole = "reviewer" | "security" | "refactor" | "perf";

export interface Finding {
  id: string;
  taskId: string;
  file: string;
  line: number;
  severity: "critical" | "medium" | "low";
  category: string;
  title: string;
  description: string;
  impact: string;
  recommendation: string;
  confidence: number; // 0.0–1.0
  cwe?: string;
  cvss?: number;
  diff?: string; // Suggested fix as unified diff
}

export interface AgentResult {
  taskId: string;
  agentRole: AgentRole;
  findings: Finding[];
  patches: string[];
  tokensUsed: number;
  elapsedMs: number;
}

export interface ReReviewResult {
  patchId: string;
  conflicts: PatchConflict[];
  regressionFindings: Finding[];
}

export interface PatchConflict {
  file: string;
  line: number;
  patchA: string;
  patchB: string;
  resolved?: string;
}

export interface MergeResult {
  findings: Finding[];
  patches: string[];
  totalTokens: number;
  costUsd: number;
  avgConfidence: number;
  systemicIssues: SystemicIssue[];
  deprecationNotices: DeprecationNotice[];
}

export interface SystemicIssue {
  pattern: string;
  occurrences: number;
  firstSeen: string;
  recommendation: string;
}

export interface DeprecationNotice {
  api: string;
  currentVersion: string;
  newVersion: string;
  sunsetReleases: number;
  affectedFiles: string[];
}
