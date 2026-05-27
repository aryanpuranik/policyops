// ── Shared ───────────────────────────────────────────────────────────────────

export type PolicyStatus = "uploaded" | "processing" | "completed" | "failed";

export type AgentRunStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "awaiting_review"
  | "approved"
  | "published";

export type WorkflowStatus =
  | "draft"
  | "awaiting_review"
  | "approved"
  | "published"
  | "archived"
  | "rejected";

export type ExecutionStatus =
  | "not_started"
  | "running"
  | "input_required"
  | "awaiting_email_response"
  | "completed"
  | "failed";

export type RiskLevel = "low" | "medium" | "high" | "critical" | "unknown";

// ── Policy ───────────────────────────────────────────────────────────────────

export interface Policy {
  id: string;
  name: string;
  filename: string;
  file_type: string;
  file_size: number;
  status: PolicyStatus;
  created_at: string;
  content_preview?: string;
}

export interface UploadPolicyResponse {
  policy_id: string;
  run_id: string;
  filename: string;
  file_size: number;
  status: string;
  message: string;
}

// ── Agent Runs ────────────────────────────────────────────────────────────────

export interface AgentLog {
  id: string;
  run_id: string;
  agent_name: string;
  status: "running" | "completed" | "failed" | "skipped";
  message: string | null;
  output_data: Record<string, unknown> | null;
  duration_ms: number | null;
  started_at: string;
  completed_at: string | null;
}

export interface AgentRun {
  id: string;
  policy_id: string;
  status: AgentRunStatus;
  current_agent: string | null;
  progress: number;
  graph_state: Record<string, unknown> | null;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
  logs?: AgentLog[];
  workflow?: WorkflowSummary | null;
}

// ── Workflow ──────────────────────────────────────────────────────────────────

export interface WorkflowStep {
  step_id: string;
  step_number: number;
  title: string;
  description: string;
  actor: string;
  action_type: string;
  inputs: string[];
  outputs: string[];
  rules_applied: string[];
  time_limit?: string;
  automated: boolean;
  next_steps: string[];
}

export interface DecisionTreeNode {
  id: string;
  type?: string;
  position: { x: number; y: number };
  data: Record<string, unknown>;
}

export interface DecisionTreeEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

export interface DecisionTree {
  nodes: DecisionTreeNode[];
  edges: DecisionTreeEdge[];
}

export interface WorkflowSummary {
  id: string;
  run_id: string;
  policy_id: string;
  title: string;
  description: string;
  status: WorkflowStatus;
  steps_count: number;
  risks_count: number;
  exceptions_count: number;
  version: string;
  risk_level: RiskLevel;
  approved_by: string | null;
  approved_at: string | null;
  published_by: string | null;
  published_at: string | null;
  source_document: string | null;
  handoff_status: HandoffStatus;
  read_only: boolean;
  created_at: string;
}

export interface WorkflowFull extends WorkflowSummary {
  human_review_notes: string | null;
  steps: WorkflowStep[];
  decision_tree: DecisionTree;
  risk_analysis: Record<string, unknown>;
  exceptions: Record<string, unknown>;
  simulation_results: Record<string, unknown>;
  extracted_rules: Record<string, unknown>;
  conflicts: Record<string, unknown>;
  updated_at: string;
}

export interface PublishedWorkflow {
  id: string;
  workflow_name: string;
  version: string;
  approved_by: string;
  date_published: string | null;
  risk_level: RiskLevel;
  source_document: string;
  current_status: WorkflowStatus;
  published_by: string | null;
  handoff_status: HandoffStatus;
}

export interface HandoffStatus {
  send_to_operations?: { status: string; by?: string; at?: string };
  export_for_workflow_engine?: { status: string; by?: string; at?: string };
  publish_as_playbook?: { status: string; by?: string; at?: string };
}

// ── Execution ─────────────────────────────────────────────────────────────────

export interface InputField {
  key: string;
  label: string;
  type: "text" | "number" | "boolean" | "dropdown";
  required: boolean;
  placeholder?: string;
  options?: string[];
}

export interface ExecutionRunState {
  id: string;
  workflow_id: string;
  execution_status: ExecutionStatus;
  requires_input: boolean;
  started_at: string | null;
  current_step_id: string | null;
  input_schema: InputField[];
  input_values: Record<string, unknown> | null;
  recipient_type: string | null;
  recipient_email: string | null;
  submitted_at: string | null;
  computed_variables: Record<string, unknown>;
  decisions: Record<string, unknown>;
  next_step_id: string | null;
  decision_evaluated_at: string | null;
  created_at: string;
  updated_at: string;
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export interface DashboardStats {
  total_policies: number;
  total_runs: number;
  total_workflows: number;
  pending_reviews: number;
  successful_runs: number;
  approved_workflows: number;
  published_workflows: number;
  success_rate: number;
}

export interface ActivityItem {
  id: string;
  type: string;
  title: string;
  description: string;
  status: "success" | "error" | "warning" | "info";
  timestamp: string;
  link: string;
  metadata: Record<string, unknown>;
}

// ── Reviews ───────────────────────────────────────────────────────────────────

export interface HumanReview {
  id: string;
  workflow_id: string;
  run_id: string;
  review_type: "conflict" | "risk" | "workflow" | "exception";
  question: string;
  context_data: Record<string, unknown> | null;
  status: "pending" | "approved" | "rejected" | "modified";
  reviewer_decision: string | null;
  reviewer_notes: string | null;
  modified_data: Record<string, unknown> | null;
  created_at: string;
  resolved_at: string | null;
}

export interface ReviewDecision {
  decision: "approved" | "rejected" | "modified";
  notes?: string;
  modified_data?: Record<string, unknown>;
}
