"""
Policy Analysis Agent
- Performs extraction, conflict detection, and risk/compliance analysis in a single LLM call
- Returns the same three output objects expected by downstream workflow generation
"""
from langchain_core.messages import HumanMessage, SystemMessage
from app.core.llm import get_llm
import json
import re


def _as_dict(value) -> dict:
    return value if isinstance(value, dict) else {}


def _as_list(value) -> list:
    return value if isinstance(value, list) else []


SYSTEM_PROMPT = """You are a senior Policy Analysis AI.

In ONE pass, analyze a business policy document and return three sections:
1) extracted_rules
2) conflicts
3) risks

Return valid JSON only with this exact top-level structure:
{
  "extracted_rules": {
    "policy_summary": "...",
    "domain": "...",
    "rules": [],
    "actors": [],
    "key_thresholds": [],
    "process_flows": [],
    "ambiguities": [],
    "missing_information": []
  },
  "conflicts": {
    "total_conflicts": 0,
    "conflict_severity": "low|medium|high|critical",
    "conflicts": [],
    "ambiguities": [],
    "coverage_gaps": [],
    "overall_assessment": "..."
  },
  "risks": {
    "overall_risk_score": 50,
    "risk_level": "low|medium|high|critical",
    "compliance_status": "compliant|partial|non_compliant|unknown",
    "risks": [],
    "missing_controls": [],
    "governance_gaps": [],
    "compliance_checklist": [],
    "executive_summary": "...",
    "immediate_actions": []
  }
}

Policy quality requirements:
- Extract at least 10 concrete operational rules when the policy is non-trivial.
- Make each rule specific enough to stand alone in an ops playbook: who does what, when, under which threshold, and what happens next.
- Capture threshold boundaries exactly (e.g., <, <=, =, >=, >) and escalation/override precedence.
- Prefer explicit rule objects with rule_id, title, condition, action, owner, threshold, and notes when possible.
- Detect contradictions, overlaps, precedence ambiguities, and missing-coverage scenarios.
- Include compliance and control gaps tied to concrete process risks.
- Populate risks with at least 3 specific items for complex refund/dispute policies, including operational, regulatory, and audit/control risks.
- If the policy mentions refunds, disputes, chargebacks, fraud, jurisdiction, identity verification, legal hold, retention, or manual processing, surface them in extracted_rules and risks explicitly.
- Be concise but complete; do not add markdown or explanation outside JSON.
"""


async def run_analysis_agent(policy_text: str, policy_name: str) -> dict:
    """Run combined extraction + conflict + risk analysis."""
    llm = get_llm(temperature=0.05)

    messages = [
        SystemMessage(content=SYSTEM_PROMPT),
        HumanMessage(content=f"""Policy Document: {policy_name}

---POLICY CONTENT---
{policy_text[:14000]}
---END OF POLICY---

Return valid JSON only with extracted_rules, conflicts, and risks."""),
    ]

    response = await llm.ainvoke(messages)
    content = response.content

    try:
        result = json.loads(content)
    except json.JSONDecodeError:
        json_match = re.search(r"\{[\s\S]*\}", content)
        if json_match:
            try:
                result = json.loads(json_match.group())
            except json.JSONDecodeError:
                result = _build_fallback(policy_name)
        else:
            result = _build_fallback(policy_name)

    result = _as_dict(result)
    extracted = _as_dict(result.get("extracted_rules", {}))
    conflicts = _as_dict(result.get("conflicts", {}))
    risks = _as_dict(result.get("risks", {}))

    return {
        "agent": "analysis",
        "extracted_rules": {
            "policy_summary": extracted.get("policy_summary", f"Policy document: {policy_name}"),
            "domain": extracted.get("domain", "general"),
            "rules": [r for r in _as_list(extracted.get("rules", [])) if isinstance(r, dict)],
            "actors": [a for a in _as_list(extracted.get("actors", [])) if isinstance(a, dict)],
            "key_thresholds": [t for t in _as_list(extracted.get("key_thresholds", [])) if isinstance(t, dict)],
            "process_flows": [p for p in _as_list(extracted.get("process_flows", [])) if isinstance(p, dict)],
            "ambiguities": [str(a) for a in _as_list(extracted.get("ambiguities", []))],
            "missing_information": [str(m) for m in _as_list(extracted.get("missing_information", []))],
        },
        "conflicts": {
            "total_conflicts": conflicts.get("total_conflicts", len(_as_list(conflicts.get("conflicts", [])))),
            "conflict_severity": conflicts.get("conflict_severity", "low"),
            "conflicts": [c for c in _as_list(conflicts.get("conflicts", [])) if isinstance(c, dict)],
            "ambiguities": _as_list(conflicts.get("ambiguities", [])),
            "coverage_gaps": [g for g in _as_list(conflicts.get("coverage_gaps", [])) if isinstance(g, dict)],
            "overall_assessment": conflicts.get("overall_assessment", "Conflict analysis completed"),
        },
        "risks": {
            "overall_risk_score": risks.get("overall_risk_score", 50),
            "risk_level": risks.get("risk_level", "medium"),
            "compliance_status": risks.get("compliance_status", "unknown"),
            "risks": [r for r in _as_list(risks.get("risks", [])) if isinstance(r, dict)],
            "missing_controls": [c for c in _as_list(risks.get("missing_controls", [])) if isinstance(c, dict)],
            "governance_gaps": [g for g in _as_list(risks.get("governance_gaps", [])) if isinstance(g, dict)],
            "compliance_checklist": [c for c in _as_list(risks.get("compliance_checklist", [])) if isinstance(c, dict)],
            "executive_summary": risks.get("executive_summary", "Risk analysis completed"),
            "immediate_actions": [str(a) for a in _as_list(risks.get("immediate_actions", []))],
        },
    }


def _build_fallback(policy_name: str) -> dict:
    return {
        "extracted_rules": {
            "policy_summary": f"Policy document: {policy_name}",
            "domain": "general",
            "rules": [],
            "actors": [],
            "key_thresholds": [],
            "process_flows": [],
            "ambiguities": ["Could not fully parse policy structure"],
            "missing_information": [],
        },
        "conflicts": {
            "total_conflicts": 0,
            "conflict_severity": "low",
            "conflicts": [],
            "ambiguities": [],
            "coverage_gaps": [],
            "overall_assessment": "Conflict analysis unavailable; fallback used",
        },
        "risks": {
            "overall_risk_score": 50,
            "risk_level": "medium",
            "compliance_status": "unknown",
            "risks": [],
            "missing_controls": [],
            "governance_gaps": [],
            "compliance_checklist": [],
            "executive_summary": "Risk analysis unavailable; fallback used",
            "immediate_actions": [],
        },
    }
