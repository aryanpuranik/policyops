"""
Exception Generation Agent
- Generates edge cases and exception scenarios
- Identifies scenarios not covered by the main workflow
- Produces exception handling procedures
"""
from langchain_core.messages import HumanMessage, SystemMessage
from app.core.llm import get_llm
import json
import re
from copy import deepcopy


SYSTEM_PROMPT = """You are an Exception Scenario Specialist AI. Your job is to identify edge cases, exceptions, and unusual scenarios that the main policy workflow may not handle correctly.

Think adversarially - what situations would break the workflow? What edge cases would a real employee encounter?

Exception categories to consider:
1. **Data Exceptions** - Missing fields, invalid data, corrupted records
2. **Threshold Edge Cases** - Exactly at threshold, just above/below
3. **VIP/Priority Exceptions** - Special customer types, priority cases
4. **System Failures** - Technology unavailable, timeout scenarios
5. **Multi-party Conflicts** - Multiple actors with conflicting needs
6. **Regulatory Overrides** - Legal requirements that override normal process
7. **Seasonal/Time Exceptions** - After-hours, holiday processing
8. **Fraud Indicators** - Suspicious patterns, repeat attempts
9. **External Dependencies** - Third-party failures, external data unavailable
10. **Cascading Failures** - One failure triggers chain of issues

Return your response as JSON:
{
  "total_exceptions": 8,
  "exception_coverage_score": 85,
  "exceptions": [
    {
      "id": "exc_001",
      "category": "data" | "threshold" | "vip" | "system" | "multi_party" | "regulatory" | "timing" | "fraud" | "external" | "cascade",
      "severity": "low" | "medium" | "high" | "critical",
      "title": "Exception title",
      "description": "What this exception is",
      "trigger_scenario": "Exactly when this exception occurs",
      "example": "Concrete real-world example",
      "affected_workflow_steps": ["step_001"],
      "affected_rules": ["rule_001"],
      "default_behavior": "What the system would do without exception handling",
      "correct_behavior": "What SHOULD happen in this case",
      "exception_handler": {
        "detection": "How to detect this exception",
        "immediate_action": "First thing to do",
        "resolution_steps": ["step 1", "step 2", "step 3"],
        "escalation": "If cannot resolve, escalate to...",
        "sla": "Time to resolve",
        "documentation_required": true | false
      },
      "requires_human_judgment": true | false,
      "prevention": "How to prevent this exception"
    }
  ],
  "exception_workflow_additions": [
    {
      "add_after_step": "step_id",
      "check": "What to check",
      "exception_branch": "What path to take if exception detected"
    }
  ],
  "untested_scenarios": [
    "Scenario not yet covered by workflow"
  ]
}

For refund/dispute policies, explicitly include exception scenarios for:
- Fraud-flagged VIP customer (must be HOLD pending Risk clearance, not direct rejection)
- Legal threat / chargeback with legal-hold freeze
- EU 14-day withdrawal override versus standard policy
- High-value >= $10,000 reporting and governance obligations
- Audit trail/retention control failure
- Identity verification threshold boundaries (exactly $500 / $2,000 and international customers)
- System outage manual mode boundary (> $200 not allowed in manual path)
- Deceased estate documentation and compliance handling"""


async def run_exception_generation_agent(extracted_rules: dict, workflow: dict, risks: dict) -> dict:
    """Generate exception scenarios for the workflow."""
    llm = get_llm(temperature=0.2)  # Slightly higher temp for creativity

    messages = [
        SystemMessage(content=SYSTEM_PROMPT),
        HumanMessage(content=f"""Generate exception scenarios for this workflow:

POLICY DOMAIN: {extracted_rules.get('domain', 'N/A')}
POLICY: {extracted_rules.get('policy_summary', 'N/A')}

WORKFLOW STEPS:
{json.dumps([{'id': s.get('step_id'), 'title': s.get('title'), 'description': s.get('description')} for s in workflow.get('steps', []) if isinstance(s, dict)], indent=2)[:3000]}

KEY RULES:
{json.dumps(extracted_rules.get('rules', [])[:10], indent=2)[:4000]}

KEY THRESHOLDS:
{json.dumps(extracted_rules.get('key_thresholds', []), indent=2)[:1000]}

ACTORS:
{json.dumps(extracted_rules.get('actors', []), indent=2)[:1000]}

IDENTIFIED RISKS (for exception context):
{json.dumps([r.get('title', '') for r in risks.get('risks', []) if isinstance(r, dict)], indent=2)[:1000]}

COVERAGE GAPS IN WORKFLOW:
{json.dumps(risks.get('missing_controls', [])[:5], indent=2)[:1000]}

Generate comprehensive exception scenarios. Think adversarially. Return valid JSON only.""")
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
                result = _build_basic_exceptions()
        else:
            result = _build_basic_exceptions()

    result["agent"] = "exception_generation"
    return _enforce_exception_coverage(result, extracted_rules)


def _build_basic_exceptions() -> dict:
    return {
        "total_exceptions": 3,
        "exception_coverage_score": 60,
        "exceptions": [
            {
                "id": "exc_001", "category": "data", "severity": "medium",
                "title": "Missing Required Data",
                "description": "Required fields are missing from the request",
                "trigger_scenario": "Submission with incomplete data",
                "example": "Customer submits without required documentation",
                "affected_workflow_steps": [], "affected_rules": [],
                "default_behavior": "Process fails silently",
                "correct_behavior": "Return error with clear guidance",
                "exception_handler": {
                    "detection": "Validate all required fields on intake",
                    "immediate_action": "Reject with specific field list",
                    "resolution_steps": ["Identify missing fields", "Notify requestor", "Allow resubmission"],
                    "escalation": "Supervisor if resubmission fails 3 times",
                    "sla": "24 hours",
                    "documentation_required": True
                },
                "requires_human_judgment": False,
                "prevention": "Add field validation at intake"
            }
        ],
        "exception_workflow_additions": [],
        "untested_scenarios": []
    }


def _enforce_exception_coverage(result: dict, extracted_rules: dict) -> dict:
    """Ensure critical exception categories are present for complex refund policies."""
    if not isinstance(result, dict):
        return result

    rules_blob = json.dumps(extracted_rules or {}).lower()
    if "refund" not in rules_blob and "dispute" not in rules_blob:
        return result

    out = deepcopy(result)
    exceptions = out.get("exceptions", []) or []
    existing = " ".join((e.get("title", "") + " " + e.get("description", "") + " " + e.get("trigger_scenario", "")).lower() for e in exceptions if isinstance(e, dict))

    required = [
        {
            "needle": ["fraud", "vip"],
            "exception": {
                "id": "exc_fraud_vip_hold",
                "category": "fraud",
                "severity": "high",
                "title": "Fraud-Flagged VIP Requires Risk Clearance",
                "description": "VIP status cannot bypass active fraud controls.",
                "trigger_scenario": "VIP customer has active fraud flag and requests refund.",
                "example": "Platinum customer requests expedited refund while fraud flag is active.",
                "affected_workflow_steps": [],
                "affected_rules": [],
                "default_behavior": "Immediate denial based on fraud signal.",
                "correct_behavior": "Place case on hold pending Risk clearance; resume decisioning only after clearance.",
                "exception_handler": {
                    "detection": "Check fraud flag before VIP concessions.",
                    "immediate_action": "Route to Risk & Fraud queue and apply hold status.",
                    "resolution_steps": ["Open risk review", "Await clearance outcome", "Resume standard threshold routing"],
                    "escalation": "Compliance Officer if Risk SLA breached",
                    "sla": "24 hours",
                    "documentation_required": True,
                },
                "requires_human_judgment": True,
                "prevention": "Hard-code fraud precedence over VIP concessions.",
            },
        },
        {
            "needle": ["legal", "chargeback"],
            "exception": {
                "id": "exc_legal_hold",
                "category": "regulatory",
                "severity": "critical",
                "title": "Legal Hold Freeze Triggered",
                "description": "Chargeback or legal threat requires legal-hold freeze.",
                "trigger_scenario": "Customer files chargeback or threatens legal action.",
                "example": "Refund request includes legal notice from customer counsel.",
                "affected_workflow_steps": [],
                "affected_rules": [],
                "default_behavior": "Continue regular approval/denial workflow.",
                "correct_behavior": "Freeze final decisioning until Legal releases hold.",
                "exception_handler": {
                    "detection": "Detect legal/chargeback indicator in case metadata.",
                    "immediate_action": "Apply legal hold and notify Legal.",
                    "resolution_steps": ["Preserve evidence", "Await legal guidance", "Resume only after legal release code"],
                    "escalation": "CLO delegate after 5 business days",
                    "sla": "Immediate hold; release decision per Legal",
                    "documentation_required": True,
                },
                "requires_human_judgment": True,
                "prevention": "Automate legal-hold trigger and block final decision actions.",
            },
        },
        {
            "needle": ["eu", "14"],
            "exception": {
                "id": "exc_eu_override",
                "category": "regulatory",
                "severity": "high",
                "title": "EU 14-Day Withdrawal Override",
                "description": "Statutory withdrawal rights may override standard refund conditions.",
                "trigger_scenario": "EU customer exercises withdrawal right within statutory period.",
                "example": "EU consumer requests cancellation within 14 days despite stricter product rule.",
                "affected_workflow_steps": [],
                "affected_rules": [],
                "default_behavior": "Apply company standard window/rules only.",
                "correct_behavior": "Apply statutory override before standard policy.",
                "exception_handler": {
                    "detection": "Jurisdiction and transaction type check.",
                    "immediate_action": "Route to regulatory override path.",
                    "resolution_steps": ["Validate jurisdiction", "Apply legal entitlement", "Log legal basis"],
                    "escalation": "Compliance Officer for interpretation ambiguity",
                    "sla": "Per jurisdictional SLA",
                    "documentation_required": True,
                },
                "requires_human_judgment": True,
                "prevention": "Embed jurisdiction rules engine in eligibility stage.",
            },
        },
    ]

    for item in required:
        if all(token in existing for token in item["needle"]):
            continue
        exceptions.append(item["exception"])

    out["exceptions"] = exceptions
    out["total_exceptions"] = len(exceptions)

    untested = out.get("untested_scenarios", []) or []
    for scenario in [
        "Boundary check at exactly $500 and exactly $2,000 identity/approval transitions",
        "Manual outage mode over $200 should be blocked",
        "Audit trail missing required fields should fail control checks",
    ]:
        if scenario not in untested:
            untested.append(scenario)
    out["untested_scenarios"] = untested

    return out
