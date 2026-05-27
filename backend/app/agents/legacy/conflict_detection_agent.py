"""
Conflict Detection Agent
- Compares extracted rules
- Detects contradictions between rules
- Highlights ambiguities and overlapping conditions
- Produces conflict report with severity scores
"""
from langchain_core.messages import HumanMessage, SystemMessage
from app.core.llm import get_llm
import json
import re


SYSTEM_PROMPT = """You are a Policy Conflict Detection Specialist AI. Your job is to analyze extracted policy rules and find conflicts, contradictions, ambiguities, and overlapping conditions.

Types of conflicts to detect:
1. **Direct Contradiction** - Rule A says X, Rule B says NOT X
2. **Threshold Overlap** - Two rules cover the same range with different actions
3. **Actor Conflict** - Different roles assigned to same action in different rules
4. **Precedence Ambiguity** - Unclear which rule takes priority
5. **Exception Conflicts** - An exception in one rule contradicts a requirement in another
6. **Process Loop** - Process steps create circular dependencies
7. **Missing Bridge** - Gap between rules leaves a scenario uncovered

Return your response as JSON:
{
  "total_conflicts": 3,
  "conflict_severity": "low" | "medium" | "high" | "critical",
  "conflicts": [
    {
      "id": "conflict_001",
      "type": "direct_contradiction" | "threshold_overlap" | "actor_conflict" | "precedence_ambiguity" | "exception_conflict" | "process_loop" | "missing_bridge",
      "severity": "low" | "medium" | "high" | "critical",
      "title": "Short conflict description",
      "description": "Detailed description of the conflict",
      "rule_a": {"id": "rule_001", "title": "Rule title", "excerpt": "relevant part"},
      "rule_b": {"id": "rule_002", "title": "Rule title", "excerpt": "relevant part"},
      "conflict_scenario": "Describe the exact scenario where this conflict occurs",
      "business_impact": "What happens operationally when this conflict is encountered",
      "resolution_options": [
        "Option 1: ...",
        "Option 2: ..."
      ],
      "recommended_resolution": "The best resolution approach",
      "requires_human_decision": true | false
    }
  ],
  "ambiguities": [
    {
      "id": "amb_001",
      "description": "Ambiguous statement",
      "affected_rules": ["rule_001"],
      "clarification_needed": "What needs to be clarified"
    }
  ],
  "coverage_gaps": [
    {
      "scenario": "Scenario not covered by any rule",
      "suggested_rule": "What rule should cover this"
    }
  ],
  "overall_assessment": "Overall health assessment of the policy rules"
}"""


async def run_conflict_detection_agent(extracted_rules: dict) -> dict:
    """Run conflict detection on extracted policy rules."""
    llm = get_llm(temperature=0.05)

    rules_json = json.dumps(extracted_rules.get("rules", []), indent=2)
    actors_json = json.dumps(extracted_rules.get("actors", []), indent=2)

    messages = [
        SystemMessage(content=SYSTEM_PROMPT),
        HumanMessage(content=f"""Analyze these extracted policy rules for conflicts and contradictions:

POLICY SUMMARY: {extracted_rules.get('policy_summary', 'N/A')}
DOMAIN: {extracted_rules.get('domain', 'N/A')}

EXTRACTED RULES:
{rules_json[:8000]}

ACTORS:
{actors_json[:2000]}

AMBIGUITIES FLAGGED BY EXTRACTION AGENT:
{json.dumps(extracted_rules.get('ambiguities', []), indent=2)}

Identify all conflicts, contradictions, and gaps. Return valid JSON only.""")
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
                result = _build_empty_conflicts()
        else:
            result = _build_empty_conflicts()

    result["agent"] = "conflict_detection"
    return result


def _build_empty_conflicts() -> dict:
    return {
        "total_conflicts": 0,
        "conflict_severity": "low",
        "conflicts": [],
        "ambiguities": [],
        "coverage_gaps": [],
        "overall_assessment": "No significant conflicts detected"
    }
