"""
Human-in-the-Loop Agent
- Identifies decisions that require human judgment
- Formats review requests with full context
- Incorporates human feedback back into workflow
- Tracks review history
"""
from langchain_core.messages import HumanMessage, SystemMessage
from app.core.llm import get_llm
import json
import re


SYSTEM_PROMPT = """You are a Human Review Coordination AI. Your job is to identify which aspects of the generated workflow require human review, approval, or judgment before the workflow can be finalized.

Identify items needing human review based on:
1. **High-severity conflicts** that require business decision
2. **Ambiguous rules** where interpretation matters
3. **Risk items** above threshold requiring executive sign-off
4. **Missing information** that only humans can provide
5. **Exception scenarios** requiring human judgment
6. **Approval thresholds** that policy doesn't clearly define
7. **Simulation failures** that require workflow redesign

Return your response as JSON:
{
  "review_required": true | false,
  "urgency": "low" | "medium" | "high" | "critical",
  "total_review_items": 5,
  "review_items": [
    {
      "id": "review_001",
      "type": "conflict_resolution" | "rule_clarification" | "risk_acceptance" | "missing_info" | "exception_policy" | "workflow_approval" | "threshold_definition",
      "priority": "low" | "medium" | "high" | "critical",
      "title": "What needs review",
      "description": "Detailed description of what the reviewer needs to decide",
      "context": "Background information the reviewer needs",
      "question": "The specific question the human must answer",
      "options": [
        {"id": "opt_a", "label": "Option A", "description": "What choosing A means", "risk": "Risk of this choice"},
        {"id": "opt_b", "label": "Option B", "description": "What choosing B means", "risk": "Risk of this choice"}
      ],
      "ai_recommendation": "What the AI recommends and why",
      "confidence": 0.75,
      "blocking": true,
      "affected_workflow_steps": ["step_001"],
      "data": {}
    }
  ],
  "auto_approved_items": [
    {
      "item": "What was auto-approved",
      "reason": "Why no human review needed",
      "confidence": 0.95
    }
  ],
  "workflow_ready_for_review": true | false,
  "review_summary": "Summary for the human reviewer",
  "estimated_review_time": "15-30 minutes"
}"""


async def run_human_review_agent(
    extracted_rules: dict,
    conflicts: dict,
    risks: dict,
    workflow: dict,
    exceptions: dict,
    simulation: dict
) -> dict:
    """Identify items requiring human review."""
    llm = get_llm(temperature=0.05)

    # Identify critical items that need review
    conflict_items = [c for c in conflicts.get("conflicts", []) if isinstance(c, dict)]
    risk_items = [r for r in risks.get("risks", []) if isinstance(r, dict)]
    simulation_items = [s for s in simulation.get("scenarios", []) if isinstance(s, dict)]

    critical_conflicts = [c for c in conflict_items if c.get("severity") in ("high", "critical") and c.get("requires_human_decision")]
    critical_risks = [r for r in risk_items if r.get("severity") in ("high", "critical")]
    failed_simulations = [s for s in simulation_items if not s.get("passed")]

    messages = [
        SystemMessage(content=SYSTEM_PROMPT),
        HumanMessage(content=f"""Determine what requires human review for this workflow:

WORKFLOW: {workflow.get('workflow_title', 'Workflow')}
DOMAIN: {extracted_rules.get('domain', 'N/A')}

CRITICAL CONFLICTS REQUIRING DECISIONS ({len(critical_conflicts)}):
{json.dumps(critical_conflicts[:3], indent=2)[:2000]}

HIGH RISKS ({len(critical_risks)}):
{json.dumps(critical_risks[:3], indent=2)[:2000]}

SIMULATION FAILURES ({len(failed_simulations)}):
{json.dumps(failed_simulations[:2], indent=2)[:2000]}

AMBIGUITIES FROM EXTRACTION:
{json.dumps(extracted_rules.get('ambiguities', []), indent=2)[:1000]}

MISSING INFORMATION:
{json.dumps(extracted_rules.get('missing_information', []), indent=2)[:1000]}

OVERALL RISK LEVEL: {risks.get('risk_level', 'unknown')}
CONFLICT SEVERITY: {conflicts.get('conflict_severity', 'unknown')}

Identify all items that require human review. Create specific, actionable review requests with clear questions. Return valid JSON only.""")
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
                result = _build_basic_review()
        else:
            result = _build_basic_review()

    result["agent"] = "human_review"
    return result


async def incorporate_human_feedback(
    workflow: dict,
    review_decisions: list[dict],
    llm_update: bool = True
) -> dict:
    """
    Incorporate human reviewer decisions back into the workflow.
    Each decision in review_decisions has: {review_item_id, decision, notes, modified_data}
    """
    if not llm_update:
        workflow["human_review_applied"] = True
        workflow["review_decisions"] = review_decisions
        return workflow

    llm = get_llm(temperature=0.05)

    messages = [
        SystemMessage(content="You are a Workflow Integration AI. Your job is to incorporate human reviewer decisions into a workflow definition. Update the workflow to reflect the human decisions exactly."),
        HumanMessage(content=f"""Update this workflow based on human reviewer decisions:

CURRENT WORKFLOW:
{json.dumps(workflow, indent=2)[:5000]}

HUMAN REVIEWER DECISIONS:
{json.dumps(review_decisions, indent=2)[:3000]}

Return the updated workflow JSON with all human decisions incorporated. Keep the same structure but update relevant steps, rules, and notes.""")
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
                workflow["human_review_applied"] = True
                workflow["review_decisions"] = review_decisions
                return workflow
        else:
            workflow["human_review_applied"] = True
            workflow["review_decisions"] = review_decisions
            return workflow

    result["human_review_applied"] = True
    result["review_decisions"] = review_decisions
    return result


def _build_basic_review() -> dict:
    return {
        "review_required": True,
        "urgency": "medium",
        "total_review_items": 1,
        "review_items": [
            {
                "id": "review_001",
                "type": "workflow_approval",
                "priority": "medium",
                "title": "Workflow Approval",
                "description": "The generated workflow requires human approval before deployment",
                "context": "AI-generated workflow based on extracted policy rules",
                "question": "Do you approve this workflow for operational use?",
                "options": [
                    {"id": "approve", "label": "Approve", "description": "Approve workflow as-is", "risk": "Low"},
                    {"id": "modify", "label": "Modify", "description": "Approve with modifications", "risk": "Low"},
                    {"id": "reject", "label": "Reject", "description": "Reject and restart", "risk": "Delay"}
                ],
                "ai_recommendation": "Review and approve the workflow",
                "confidence": 0.8,
                "blocking": True,
                "affected_workflow_steps": [],
                "data": {}
            }
        ],
        "auto_approved_items": [],
        "workflow_ready_for_review": True,
        "review_summary": "Workflow ready for human review",
        "estimated_review_time": "15 minutes"
    }
