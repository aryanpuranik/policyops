"""
Risk & Compliance Agent
- Identifies compliance risks in policy rules
- Identifies missing controls
- Identifies governance gaps
- Scores risk levels
"""
from langchain_core.messages import HumanMessage, SystemMessage
from app.core.llm import get_llm
import json
import re


SYSTEM_PROMPT = """You are a Risk and Compliance Analysis AI. Your job is to analyze policy rules and identify compliance risks, missing controls, and governance gaps.

Analyze against these risk frameworks:
- **Operational Risk**: Process failures, human errors, system failures
- **Compliance Risk**: Regulatory violations, legal exposure
- **Financial Risk**: Monetary loss, fraud exposure
- **Reputational Risk**: Customer trust, brand damage
- **Security Risk**: Data privacy, access control issues

For each risk area, evaluate:
1. **Missing Controls** - Required checks that aren't present
2. **Weak Controls** - Present but insufficient checks
3. **Governance Gaps** - Missing oversight, audit trails, accountability
4. **Regulatory Exposure** - Potential regulatory violations
5. **Process Risks** - Operational failure points

Return your response as JSON:
{
  "overall_risk_score": 75,
  "risk_level": "low" | "medium" | "high" | "critical",
  "compliance_status": "compliant" | "partial" | "non_compliant" | "unknown",
  "risks": [
    {
      "id": "risk_001",
      "category": "operational" | "compliance" | "financial" | "reputational" | "security",
      "severity": "low" | "medium" | "high" | "critical",
      "likelihood": "unlikely" | "possible" | "likely" | "almost_certain",
      "risk_score": 85,
      "title": "Risk title",
      "description": "Detailed risk description",
      "affected_rules": ["rule_001"],
      "business_impact": "What could go wrong",
      "root_cause": "Why this risk exists",
      "mitigation": "How to reduce or eliminate this risk",
      "control_needed": "Specific control to add",
      "regulatory_reference": "Any relevant regulation (GDPR, SOX, PCI-DSS, etc.) or null"
    }
  ],
  "missing_controls": [
    {
      "control_type": "approval" | "audit" | "validation" | "authorization" | "monitoring" | "escalation",
      "description": "What control is missing",
      "where_needed": "In which process/rule",
      "risk_if_missing": "What risk this creates"
    }
  ],
  "governance_gaps": [
    {
      "gap": "Description of governance gap",
      "current_state": "What exists now",
      "required_state": "What should exist",
      "recommendation": "How to close the gap"
    }
  ],
  "compliance_checklist": [
    {
      "requirement": "Requirement description",
      "status": "met" | "partial" | "missing",
      "notes": "Any relevant notes"
    }
  ],
  "executive_summary": "C-level risk summary",
  "immediate_actions": ["List of immediate actions required"]
}"""


async def run_risk_compliance_agent(extracted_rules: dict, conflicts: dict) -> dict:
    """Run risk and compliance analysis."""
    llm = get_llm(temperature=0.05)

    messages = [
        SystemMessage(content=SYSTEM_PROMPT),
        HumanMessage(content=f"""Analyze the risk and compliance posture of these policy rules:

POLICY DOMAIN: {extracted_rules.get('domain', 'N/A')}
POLICY SUMMARY: {extracted_rules.get('policy_summary', 'N/A')}

EXTRACTED RULES:
{json.dumps(extracted_rules.get('rules', []), indent=2)[:6000]}

KEY THRESHOLDS:
{json.dumps(extracted_rules.get('key_thresholds', []), indent=2)[:2000]}

DETECTED CONFLICTS ({conflicts.get('total_conflicts', 0)} total):
{json.dumps(conflicts.get('conflicts', [])[:5], indent=2)[:3000]}

COVERAGE GAPS:
{json.dumps(conflicts.get('coverage_gaps', []), indent=2)[:1000]}

Identify all risks, missing controls, and governance gaps. Return valid JSON only.""")
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
                result = _build_empty_risks()
        else:
            result = _build_empty_risks()

    result["agent"] = "risk_compliance"
    return result


def _build_empty_risks() -> dict:
    return {
        "overall_risk_score": 50,
        "risk_level": "medium",
        "compliance_status": "unknown",
        "risks": [],
        "missing_controls": [],
        "governance_gaps": [],
        "compliance_checklist": [],
        "executive_summary": "Risk analysis pending",
        "immediate_actions": []
    }
