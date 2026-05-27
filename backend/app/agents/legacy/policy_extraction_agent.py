"""
Policy Extraction Agent
- Parses uploaded policy documents
- Extracts rules, actors, thresholds, conditions
- Produces structured rule objects for downstream agents
"""
from langchain_core.messages import HumanMessage, SystemMessage
from app.core.llm import get_llm
import json
import re


SYSTEM_PROMPT = """You are a Policy Extraction Specialist AI. Your job is to deeply analyze business policy documents and extract structured operational rules.

For each policy document, extract:
1. **Rules** - Concrete actionable rules (IF-THEN logic, thresholds, conditions)
2. **Actors** - Who is involved (roles, departments, customers, systems)
3. **Thresholds** - Numeric values, limits, deadlines, amounts
4. **Conditions** - Triggers, prerequisites, exceptions
5. **Processes** - Step-by-step procedures mentioned
6. **Approval Gates** - Where approvals are required
7. **Escalation Paths** - How issues escalate up the chain

Return your response as a JSON object with this exact structure:
{
  "policy_summary": "Brief description of what this policy is about",
  "domain": "The business domain (e.g. refunds, onboarding, compliance, HR)",
  "rules": [
    {
      "id": "rule_001",
      "type": "threshold" | "approval" | "condition" | "process" | "escalation" | "exception",
      "title": "Short rule title",
      "description": "Full rule description",
      "condition": "IF condition here",
      "action": "THEN action here",
      "actors": ["list", "of", "actors"],
      "threshold": null or {"field": "field_name", "operator": ">", "value": 500, "unit": "USD"},
      "priority": "low" | "medium" | "high" | "critical",
      "source_text": "exact quote from policy"
    }
  ],
  "actors": [
    {
      "name": "Actor name",
      "role": "their role",
      "permissions": ["what they can do"]
    }
  ],
  "key_thresholds": [
    {"name": "threshold name", "value": "the value", "field": "field it applies to", "consequence": "what happens when triggered"}
  ],
  "process_flows": [
    {
      "name": "Process name",
      "steps": ["step 1", "step 2", "step 3"],
      "start_trigger": "what starts this process",
      "end_state": "how it completes"
    }
  ],
  "ambiguities": ["list any unclear or ambiguous statements"],
  "missing_information": ["list any gaps or missing information"]
}

Be exhaustive. Extract every rule, even implicit ones. If you see "normally", "usually", "in most cases" - flag those as potential conflicts."""


async def run_policy_extraction_agent(policy_text: str, policy_name: str) -> dict:
    """Run the policy extraction agent on a policy document."""
    llm = get_llm(temperature=0.05)

    messages = [
        SystemMessage(content=SYSTEM_PROMPT),
        HumanMessage(content=f"""Policy Document: {policy_name}

---POLICY CONTENT---
{policy_text[:12000]}
---END OF POLICY---

Extract all rules, actors, thresholds, conditions, and process flows from this policy. Return valid JSON only.""")
    ]

    response = await llm.ainvoke(messages)
    content = response.content

    # Extract JSON from response
    try:
        # Try to parse directly
        result = json.loads(content)
    except json.JSONDecodeError:
        # Extract JSON block from markdown
        json_match = re.search(r'\{[\s\S]*\}', content)
        if json_match:
            try:
                result = json.loads(json_match.group())
            except json.JSONDecodeError:
                result = _build_fallback_extraction(content, policy_name)
        else:
            result = _build_fallback_extraction(content, policy_name)

    result["agent"] = "policy_extraction"
    result["policy_name"] = policy_name
    return result


def _build_fallback_extraction(raw_text: str, policy_name: str) -> dict:
    """Build a basic structure if JSON parsing fails."""
    return {
        "policy_summary": f"Policy document: {policy_name}",
        "domain": "general",
        "rules": [
            {
                "id": "rule_001",
                "type": "process",
                "title": "Policy Rule",
                "description": raw_text[:500],
                "condition": "See full text",
                "action": "Follow policy guidelines",
                "actors": [],
                "threshold": None,
                "priority": "medium",
                "source_text": raw_text[:200]
            }
        ],
        "actors": [],
        "key_thresholds": [],
        "process_flows": [],
        "ambiguities": ["Could not fully parse policy structure"],
        "missing_information": []
    }
