"""
Workflow Builder Agent
- Converts extracted rules into step-by-step operational workflows
- Builds decision trees with nodes and edges (React Flow compatible)
- Generates complete operational playbooks
"""
from langchain_core.messages import HumanMessage, SystemMessage
from app.core.llm import get_llm
import json
import re
from copy import deepcopy


SYSTEM_PROMPT = """You are a Workflow Architecture AI. Your job is to convert policy rules into precise operational workflows and decision trees.

You must generate:
1. **Linear Workflow Steps** - Sequential steps an operator follows
2. **Decision Tree** - React Flow compatible nodes and edges
3. **Decision Points** - Where human judgment is required

For React Flow, use these node types:
- "start" - entry point (green)
- "process" - action step (blue)
- "decision" - yes/no branch (orange/diamond shape)
- "approval" - requires human approval (purple)
- "end_success" - successful completion (green)
- "end_failure" - failure/rejection (red)
- "escalation" - escalate to higher authority (yellow)
- "exception" - handle exception (orange)

Workflow construction rules:
- Build a real operational flow, not a generic checklist.
- Each box/node must have a clear relationship to the box before it and after it.
- Every step must be connected with visible lines/edges; do not leave isolated nodes.
- Every decision node must have at least two outgoing edges (yes/no or proceed/escalate) and those branches must eventually converge or terminate.
- Label edges with the condition or business rule that causes the transition.
- Use specific business language from the policy; avoid vague labels like "Review" or "Process" unless paired with a detailed description.
- Give every step a unique, meaningful title that reflects the control being performed.
- Include explicit handoffs between roles, approvals, escalations, holds, releases, and end states.
- If a step is a control gate, show what it blocks and what it unlocks next.
- If the policy has refunds, disputes, fraud, legal hold, jurisdiction, manual mode, estate handling, or audit controls, include them as distinct steps with clear edges.

Return your response as JSON:
{
  "workflow_title": "Name of the workflow",
  "workflow_description": "What this workflow accomplishes",
  "version": "1.0",
  "trigger": "What event starts this workflow",
  "estimated_duration": "Expected time to complete",
  "steps": [
    {
      "step_id": "step_001",
      "step_number": 1,
      "title": "Step title",
      "description": "Detailed description of what happens",
      "actor": "Who performs this step",
      "action_type": "data_entry" | "system_check" | "approval" | "notification" | "decision" | "escalation" | "completion",
      "inputs": ["required inputs"],
      "outputs": ["produced outputs"],
      "rules_applied": ["rule_001"],
      "time_limit": "SLA/time limit or null",
      "automated": true | false,
      "next_steps": {
        "default": "step_002",
        "conditions": [
          {"condition": "if X", "goto": "step_003"},
          {"condition": "if Y", "goto": "step_004"}
        ]
      }
    }
  ],
  "decision_tree": {
    "nodes": [
      {
        "id": "node_start",
        "type": "start",
        "label": "Request Received",
        "description": "Process begins",
        "position": {"x": 400, "y": 50},
        "data": {
          "label": "Start",
          "nodeType": "start",
          "description": "Process begins"
        }
      }
    ],
    "edges": [
      {
        "id": "edge_1",
        "source": "node_start",
        "target": "node_check_1",
        "label": "Begin",
        "animated": false
      }
    ]
  },
  "approval_matrix": [
    {
      "scenario": "When this happens",
      "approver": "Who approves",
      "threshold": "Any amount/condition",
      "sla": "Time limit for approval"
    }
  ],
  "escalation_paths": [
    {
      "trigger": "What causes escalation",
      "from_role": "Who escalates from",
      "to_role": "Who receives escalation",
      "timeframe": "When escalation triggers"
    }
  ]
}

IMPORTANT: For the decision_tree, generate a complete, realistic flowchart. Position nodes clearly and connect them visibly:
- Start at y=50
- Each subsequent row at y+150
- Branch left at x-250, branch right at x+250
- Converge back at center
- Every node should have at least one incoming edge and, except end nodes, at least one outgoing edge.
- Every branch must be readable from the edge labels alone.
- Include the main approval/rejection path, the exception path, and the escalation/hold path if they exist.
- Avoid floating "fallback" nodes that do not connect back to the workflow.

For refund/dispute policies, workflow MUST include explicit branches/steps for:
- Fraud review gate with clearance before final decisioning
- Legal hold freeze and legal-release path (chargeback/legal threat)
- Dispute escalation chain with 48h and 72h checkpoints + customer notification
- Identity verification thresholds (>=500 ID, >=2000 2FA, international passport)
- Seasonal/jurisdiction override checks (e.g., EU withdrawal right)
- System outage manual mode with <=200 cap and supervisor countersign
- Deceased customer estate handling with compliance review
- Audit trail/retention/reporting controls (timestamps, employee ID, reason code, 7-year retention, high-value reporting)

Do not oversimplify fraud-flagged VIP scenarios as direct rejection; require Risk clearance first."""


async def run_workflow_builder_agent(extracted_rules: dict, conflicts: dict, risks: dict) -> dict:
    """Build operational workflow from policy rules."""
    llm = get_llm(temperature=0.1)

    messages = [
        SystemMessage(content=SYSTEM_PROMPT),
        HumanMessage(content=f"""Build a complete operational workflow from these policy rules:

POLICY: {extracted_rules.get('policy_summary', 'N/A')}
DOMAIN: {extracted_rules.get('domain', 'N/A')}

PROCESS FLOWS DEFINED IN POLICY:
{json.dumps(extracted_rules.get('process_flows', []), indent=2)[:3000]}

RULES TO ENCODE:
{json.dumps(extracted_rules.get('rules', []), indent=2)[:6000]}

KEY THRESHOLDS:
{json.dumps(extracted_rules.get('key_thresholds', []), indent=2)[:1000]}

ACTORS:
{json.dumps(extracted_rules.get('actors', []), indent=2)[:1000]}

CONFLICTS TO HANDLE:
{json.dumps([c.get('conflict_scenario', '') for c in conflicts.get('conflicts', []) if isinstance(c, dict)], indent=2)[:1000]}

TOP RISKS TO INCORPORATE AS CONTROLS:
{json.dumps([r.get('control_needed', '') for r in risks.get('risks', [])[:5] if isinstance(r, dict)], indent=2)[:1000]}

Build the complete workflow with React Flow nodes and edges. Return valid JSON only.""")
    ]

    response = await llm.ainvoke(messages)
    content = response.content

    try:
        result = json.loads(content)
    except json.JSONDecodeError:
        json_match = re.search(r'\{[\s\S]*\}', content)
        if json_match:
            try:
                result = json.loads(json_match.group())
            except json.JSONDecodeError:
                result = _build_basic_workflow(extracted_rules)
        else:
            result = _build_basic_workflow(extracted_rules)

    result["agent"] = "workflow_builder"
    return _enforce_workflow_coverage(result, extracted_rules)


def _build_basic_workflow(extracted_rules: dict) -> dict:
    """Fallback basic workflow."""
    domain = extracted_rules.get("domain", "process")
    return {
        "workflow_title": f"{domain.title()} Workflow",
        "workflow_description": extracted_rules.get("policy_summary", ""),
        "version": "1.0",
        "trigger": "Request received",
        "estimated_duration": "1-2 business days",
        "steps": [
            {
                "step_id": "step_001", "step_number": 1,
                "title": "Receive Request", "description": "Process the incoming request",
                "actor": "System", "action_type": "data_entry",
                "inputs": [], "outputs": [], "rules_applied": [],
                "time_limit": None, "automated": True,
                "next_steps": {"default": "step_002", "conditions": []}
            },
            {
                "step_id": "step_002", "step_number": 2,
                "title": "Review and Process", "description": "Review request against policy",
                "actor": "Analyst", "action_type": "decision",
                "inputs": [], "outputs": [], "rules_applied": [],
                "time_limit": "1 business day", "automated": False,
                "next_steps": {"default": "step_003", "conditions": []}
            },
            {
                "step_id": "step_003", "step_number": 3,
                "title": "Complete", "description": "Process complete",
                "actor": "System", "action_type": "completion",
                "inputs": [], "outputs": [], "rules_applied": [],
                "time_limit": None, "automated": True,
                "next_steps": {"default": None, "conditions": []}
            }
        ],
        "decision_tree": {
            "nodes": [
                {"id": "node_start", "type": "start", "label": "Start", "position": {"x": 400, "y": 50}, "data": {"label": "Start", "nodeType": "start", "description": "Process begins"}},
                {"id": "node_end", "type": "end_success", "label": "Complete", "position": {"x": 400, "y": 300}, "data": {"label": "Complete", "nodeType": "end_success", "description": "Process complete"}}
            ],
            "edges": [
                {"id": "edge_1", "source": "node_start", "target": "node_end", "label": "Process", "animated": False}
            ]
        },
        "approval_matrix": [],
        "escalation_paths": []
    }


def _enforce_workflow_coverage(workflow: dict, extracted_rules: dict) -> dict:
    """Ensure critical branches exist for complex refund/dispute policies."""
    if not isinstance(workflow, dict):
        return workflow

    rules_blob = json.dumps(extracted_rules or {}).lower()
    if "refund" not in rules_blob and "dispute" not in rules_blob:
        return workflow

    out = deepcopy(workflow)
    steps = out.get("steps", []) or []
    existing_titles = " ".join((s.get("title", "") + " " + s.get("description", "")).lower() for s in steps if isinstance(s, dict))

    required_steps = [
        ("Fraud Review Gate", "If account is fraud-flagged, route to Risk & Fraud; no final decision until clearance."),
        ("Legal Hold Freeze", "If legal threat or chargeback exists, freeze final decision and wait for Legal release."),
        ("Dispute Escalation Checkpoint", "Escalate unresolved disputes at 48h and 72h with customer notifications."),
        ("Identity Verification Check", "Apply >=$500 ID, >=$2000 2FA, and international passport requirements."),
        ("Seasonal & Jurisdiction Override Check", "Apply holiday windows and statutory overrides such as EU withdrawal rights."),
        ("System Outage Manual Mode", "Allow manual processing <=$200 with supervisor countersign and backup logging."),
        ("Deceased Estate Handling", "Require estate documentation and compliance review for deceased customer requests."),
        ("Audit Trail and Reporting", "Log decision metadata, enforce retention, and route high-value reporting obligations."),
    ]

    next_idx = len(steps) + 1
    for title, desc in required_steps:
        key = title.lower()
        if key.split()[0] in existing_titles and any(tok in existing_titles for tok in key.split()[1:3]):
            continue
        steps.append({
            "step_id": f"step_{next_idx:03d}",
            "step_number": next_idx,
            "title": title,
            "description": desc,
            "actor": "Operations",
            "action_type": "decision",
            "inputs": [],
            "outputs": [],
            "rules_applied": [],
            "time_limit": "See policy SLA",
            "automated": False,
            "next_steps": {"default": None, "conditions": []},
        })
        next_idx += 1

    for idx, step in enumerate(steps, start=1):
        step["step_number"] = idx
        if not step.get("step_id"):
            step["step_id"] = f"step_{idx:03d}"

    out["steps"] = steps

    approval_matrix = out.get("approval_matrix", []) or []
    matrix_blob = json.dumps(approval_matrix).lower()
    required_matrix = [
        ("Exactly $500 boundary", "Manager", "$500 boundary", "48 hours"),
        ("Legal hold release", "Legal Department", "Any amount under legal hold", "5 business days"),
        ("High-value >= $10,000", "CFO", ">= $10,000", "Per finance calendar"),
    ]
    for scenario, approver, threshold, sla in required_matrix:
        if scenario.lower() in matrix_blob:
            continue
        approval_matrix.append({
            "scenario": scenario,
            "approver": approver,
            "threshold": threshold,
            "sla": sla,
        })
    out["approval_matrix"] = approval_matrix

    escalation_paths = out.get("escalation_paths", []) or []
    escal_blob = json.dumps(escalation_paths).lower()
    required_escalations = [
        ("Dispute unresolved at 48h", "Customer Success Specialist", "Customer Experience Director", "48 hours"),
        ("Dispute unresolved at 72h", "Customer Experience Director", "VP Customer Operations", "72 hours"),
        ("Risk team unavailable", "Risk & Fraud Queue", "Compliance Officer", "4 business hours"),
    ]
    for trigger, from_role, to_role, timeframe in required_escalations:
        if trigger.lower() in escal_blob:
            continue
        escalation_paths.append({
            "trigger": trigger,
            "from_role": from_role,
            "to_role": to_role,
            "timeframe": timeframe,
        })
    out["escalation_paths"] = escalation_paths

    return out
