"""
Execution API - Minimal workflow execution foundation
"""
from datetime import datetime, timezone
import json
import re
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models import ExecutionDecision, ExecutionRun, Workflow
from app.services.email_service import (
    fetch_execution_reply_email,
    send_execution_input_request_email,
)

router = APIRouter(prefix="/api/workflows/{workflow_id}/execution", tags=["execution"])


@router.get("")
async def get_execution_state(workflow_id: str, db: AsyncSession = Depends(get_db)):
    """Return the latest execution run for a workflow, or a default not-started state."""
    workflow_result = await db.execute(select(Workflow).where(Workflow.id == workflow_id))
    workflow = workflow_result.scalar_one_or_none()
    if not workflow:
        raise HTTPException(404, "Workflow not found")

    result = await db.execute(
        select(ExecutionRun)
        .where(ExecutionRun.workflow_id == workflow_id)
        .order_by(ExecutionRun.created_at.desc())
    )
    run = result.scalar_one_or_none()

    if not run:
        return {
            "workflow_id": workflow_id,
            "execution_status": "not_started",
            "requires_input": False,
            "started_at": None,
            "current_step_id": None,
            "input_schema": [],
            "input_values": None,
            "recipient_type": None,
            "recipient_email": None,
            "submitted_at": None,
            "run": None,
            "analysis": _analyze_workflow_for_inputs(workflow),
        }

    return _serialize_execution_run(run)


@router.post("/start")
async def start_execution(workflow_id: str, db: AsyncSession = Depends(get_db)):
    """Start a basic execution run for a published workflow."""
    workflow_result = await db.execute(select(Workflow).where(Workflow.id == workflow_id))
    workflow = workflow_result.scalar_one_or_none()
    if not workflow:
        raise HTTPException(404, "Workflow not found")

    if workflow.status != "published":
        raise HTTPException(400, "Workflow must be published before execution can start")

    latest_result = await db.execute(
        select(ExecutionRun)
        .where(ExecutionRun.workflow_id == workflow_id)
        .order_by(ExecutionRun.created_at.desc())
    )
    latest_run = latest_result.scalar_one_or_none()
    if latest_run and latest_run.execution_status in ("running", "input_required", "awaiting_email_response", "processing"):
        return _serialize_execution_run(latest_run)

    analysis = _analyze_workflow_for_inputs(workflow)
    first_step_id = None
    steps = workflow.steps or []
    if steps and not analysis["requires_input"]:
        first_step = steps[0]
        first_step_id = first_step.get("step_id") or first_step.get("id")

    run = ExecutionRun(
        workflow_id=workflow_id,
        execution_status="input_required" if analysis["requires_input"] else "running",
        requires_input=analysis["requires_input"],
        started_at=datetime.now(timezone.utc),
        current_step_id=None if analysis["requires_input"] else first_step_id,
        input_schema=analysis["fields"],
        input_values=None,
    )
    db.add(run)
    await db.commit()
    await db.refresh(run)

    if not analysis["requires_input"]:
        await _evaluate_and_apply_decision(db, workflow, run, input_values={})
        await db.refresh(run)

    return _serialize_execution_run(run)


@router.post("/{run_id}/submit-inputs")
async def submit_execution_inputs(workflow_id: str, run_id: str, body: dict, db: AsyncSession = Depends(get_db)):
    """Send generated input form to recipient email and wait for reply."""
    run_result = await db.execute(
        select(ExecutionRun).where(ExecutionRun.id == run_id, ExecutionRun.workflow_id == workflow_id)
    )
    run = run_result.scalar_one_or_none()
    if not run:
        raise HTTPException(404, "Execution run not found")

    if not run.requires_input:
        raise HTTPException(400, "This execution run does not require inputs")

    if run.execution_status not in ("input_required", "awaiting_email_response"):
        raise HTTPException(400, "Execution run is not in input collection stage")

    workflow_result = await db.execute(select(Workflow).where(Workflow.id == workflow_id))
    workflow = workflow_result.scalar_one_or_none()
    if not workflow:
        raise HTTPException(404, "Workflow not found")

    recipient_type = body.get("recipient_type") or "external_contact"
    recipient_email = body.get("recipient_email")

    if not recipient_email:
        raise HTTPException(400, "Recipient email is required")

    email_sent = send_execution_input_request_email(
        to_email=recipient_email,
        workflow_title=workflow.title,
        execution_id=run.id,
        fields=run.input_schema or [],
    )

    if not email_sent:
        raise HTTPException(500, "Unable to send form email. Check SMTP configuration.")

    run.recipient_type = recipient_type
    run.recipient_email = recipient_email
    run.execution_status = "awaiting_email_response"
    run.input_values = None
    run.submitted_at = None
    run.current_step_id = None
    run.computed_variables = None
    run.decisions = None
    run.next_step_id = None
    run.decision_evaluated_at = None

    await db.commit()
    await db.refresh(run)
    payload = _serialize_execution_run(run)
    payload["email_sent"] = True
    payload["email_to"] = recipient_email
    payload["delivery_message"] = "Form emailed successfully. Waiting for recipient reply."
    return payload


@router.post("/{run_id}/check-reply")
async def check_execution_reply(workflow_id: str, run_id: str, db: AsyncSession = Depends(get_db)):
    """Check inbox for recipient reply, extract values, and advance execution when found."""
    run_result = await db.execute(
        select(ExecutionRun).where(ExecutionRun.id == run_id, ExecutionRun.workflow_id == workflow_id)
    )
    run = run_result.scalar_one_or_none()
    if not run:
        raise HTTPException(404, "Execution run not found")

    if not run.requires_input:
        raise HTTPException(400, "This execution run does not require inputs")

    workflow_result = await db.execute(select(Workflow).where(Workflow.id == workflow_id))
    workflow = workflow_result.scalar_one_or_none()
    if not workflow:
        raise HTTPException(404, "Workflow not found")

    reply = fetch_execution_reply_email(
        execution_id=run.id,
        expected_sender_email=run.recipient_email,
    )

    if not reply:
        payload = _serialize_execution_run(run)
        payload["reply_found"] = False
        payload["message"] = "No reply received yet."
        return payload

    parsed_values = _parse_values_from_reply(reply.get("body") or "", run.input_schema or [])
    if not parsed_values:
        payload = _serialize_execution_run(run)
        payload["reply_found"] = True
        payload["message"] = "Reply found, but no valid input values could be extracted yet."
        payload["reply_preview"] = (reply.get("body") or "")[:1200]
        return payload

    await _evaluate_and_apply_decision(db, workflow, run, input_values=parsed_values)
    await db.refresh(run)

    payload = _serialize_execution_run(run)
    payload["reply_found"] = True
    payload["message"] = "Reply received and inputs extracted. Execution started."
    return payload


def _serialize_execution_run(run: ExecutionRun) -> dict:
    return {
        "id": run.id,
        "workflow_id": run.workflow_id,
        "execution_status": run.execution_status,
        "requires_input": bool(run.requires_input),
        "started_at": run.started_at.isoformat() if run.started_at else None,
        "current_step_id": run.current_step_id,
        "input_schema": run.input_schema or [],
        "input_values": run.input_values or None,
        "recipient_type": run.recipient_type,
        "recipient_email": run.recipient_email,
        "submitted_at": run.submitted_at.isoformat() if run.submitted_at else None,
        "computed_variables": run.computed_variables or {},
        "decisions": run.decisions or {},
        "next_step_id": run.next_step_id,
        "decision_evaluated_at": run.decision_evaluated_at.isoformat() if run.decision_evaluated_at else None,
        "created_at": run.created_at.isoformat() if run.created_at else None,
        "updated_at": run.updated_at.isoformat() if run.updated_at else None,
        "run": {
            "id": run.id,
            "workflow_id": run.workflow_id,
            "execution_status": run.execution_status,
            "requires_input": bool(run.requires_input),
            "started_at": run.started_at.isoformat() if run.started_at else None,
            "current_step_id": run.current_step_id,
            "input_schema": run.input_schema or [],
            "input_values": run.input_values or None,
            "recipient_type": run.recipient_type,
            "recipient_email": run.recipient_email,
            "submitted_at": run.submitted_at.isoformat() if run.submitted_at else None,
            "computed_variables": run.computed_variables or {},
            "decisions": run.decisions or {},
            "next_step_id": run.next_step_id,
            "decision_evaluated_at": run.decision_evaluated_at.isoformat() if run.decision_evaluated_at else None,
        },
        "analysis": _analyze_workflow_for_inputs_from_schema(run.input_schema or []),
        "decision_result": {
            "computed_variables": run.computed_variables or {},
            "decisions": run.decisions or {},
            "next_step_id": run.next_step_id,
            "evaluated_at": run.decision_evaluated_at.isoformat() if run.decision_evaluated_at else None,
        },
    }


def _first_step_id(workflow: Workflow) -> str | None:
    steps = workflow.steps or []
    if not steps:
        return None
    first_step = steps[0]
    return first_step.get("step_id") or first_step.get("id")


def _analyze_workflow_for_inputs(workflow: Workflow) -> dict:
    corpus = " ".join(
        [
            workflow.title or "",
            workflow.description or "",
            json.dumps(workflow.steps or [], ensure_ascii=False),
            json.dumps(workflow.decision_tree or {}, ensure_ascii=False),
            json.dumps(workflow.extracted_rules or {}, ensure_ascii=False),
            json.dumps(workflow.risk_analysis or {}, ensure_ascii=False),
            json.dumps(workflow.exceptions or {}, ensure_ascii=False),
            json.dumps(workflow.conflicts or {}, ensure_ascii=False),
        ]
    ).lower()

    fields: list[dict] = []

    def add_field(key: str, label: str, field_type: str, placeholder: str = "", options: list[str] | None = None):
        if any(field["key"] == key for field in fields):
            return
        field = {"key": key, "label": label, "type": field_type, "required": True}
        if placeholder:
            field["placeholder"] = placeholder
        if options:
            field["options"] = options
        fields.append(field)

    keyword_map = [
        (r"\b(spend threshold|threshold|amount|refund amount|cost|budget)\b", ("spend_threshold", "Spend threshold", "number", "Enter amount")),
        (r"\b(vendor|supplier)\b", ("vendor_name", "Vendor name", "text", "Enter vendor name")),
        (r"\b(employee id|employee|user id)\b", ("employee_id", "Employee ID", "text", "Enter employee ID")),
        (r"\b(customer|requester|contact)\b", ("requester_name", "Requester name", "text", "Enter requester name")),
        (r"\b(email|e-mail)\b", ("contact_email", "Contact email", "text", "Enter email address")),
        (r"\b(data access|system access|access request|access)\b", ("access_type", "Access type", "dropdown", "", ["data access", "system access", "both", "none"])),
        (r"\b(reason|justification|notes|comment)\b", ("request_reason", "Reason / justification", "text", "Enter reason")),
        (r"\b(department|team)\b", ("department", "Department", "text", "Enter department")),
        (r"\b(escalation|incident|urgent|critical)\b", ("escalation_level", "Escalation level", "dropdown", "", ["low", "medium", "high", "critical"])),
    ]

    for pattern, field_def in keyword_map:
        if re.search(pattern, corpus):
            add_field(*field_def)

    # Decision and rule hints can add a small number of useful fields without overfitting.
    if re.search(r"\b(approve|approval|approved|manager approval|supervisor approval)\b", corpus):
        add_field("approval_required", "Approval required", "boolean")

    if re.search(r"\b(include|choose|select|type|category|tier)\b", corpus) and re.search(r"\b(yes|no|true|false|allowed|blocked|required)\b", corpus):
        add_field("requires_override", "Requires override", "boolean")

    requires_input = len(fields) > 0
    return {
        "requires_input": requires_input,
        "fields": fields,
        "reason": "Generated workflow contains input-dependent variables" if requires_input else "No input collection required for this workflow",
    }


def _analyze_workflow_for_inputs_from_schema(fields: list[dict]) -> dict:
    return {
        "requires_input": bool(fields),
        "fields": fields,
        "reason": "Existing execution input schema",
    }


def _parse_values_from_reply(body: str, schema: list[dict]) -> dict:
    values: dict = {}
    if not body:
        return values

    for field in schema:
        key = str(field.get("key") or "")
        label = str(field.get("label") or "")
        if not key:
            continue

        pattern_key = rf"^\s*-?\s*{re.escape(key)}\s*:\s*(.+)$"
        pattern_label = rf"^\s*-?\s*{re.escape(label)}\s*:\s*(.+)$" if label else None
        raw_value = _match_first_multiline(body, pattern_key)
        if raw_value is None and pattern_label:
            raw_value = _match_first_multiline(body, pattern_label)
        if raw_value is None:
            continue

        normalized = _coerce_reply_value(raw_value, str(field.get("type") or "text"), field)
        values[key] = normalized

    return values


def _match_first_multiline(text: str, pattern: str) -> str | None:
    match = re.search(pattern, text, flags=re.IGNORECASE | re.MULTILINE)
    if not match:
        return None
    return match.group(1).strip()


def _coerce_reply_value(raw: str, field_type: str, field: dict):
    if field_type == "number":
        try:
            if "." in raw:
                return float(raw)
            return int(raw)
        except Exception:
            return raw

    if field_type == "boolean":
        normalized = raw.strip().lower()
        if normalized in ("true", "yes", "y", "1"):
            return True
        if normalized in ("false", "no", "n", "0"):
            return False
        return raw

    if field_type == "dropdown":
        options = [str(opt).lower() for opt in (field.get("options") or [])]
        if raw.strip().lower() in options:
            return raw.strip().lower()
        return raw

    return raw


async def _evaluate_and_apply_decision(
    db: AsyncSession,
    workflow: Workflow,
    run: ExecutionRun,
    input_values: dict[str, Any],
) -> dict:
    evaluated = _evaluate_decision_agent(workflow, input_values, run)

    run.input_values = input_values
    run.submitted_at = datetime.now(timezone.utc)
    run.computed_variables = evaluated["computed_variables"]
    run.decisions = evaluated["decisions"]
    run.next_step_id = evaluated["next_step_id"]
    run.decision_evaluated_at = datetime.now(timezone.utc)
    run.execution_status = "running"
    run.current_step_id = evaluated["next_step_id"] or _first_step_id(workflow)

    db.add(
        ExecutionDecision(
            run_id=run.id,
            input_data=input_values,
            computed_variables=evaluated["computed_variables"],
            decisions=evaluated["decisions"],
            next_step_id=evaluated["next_step_id"],
            evaluated_at=run.decision_evaluated_at,
        )
    )
    await db.commit()
    return evaluated


def _evaluate_decision_agent(workflow: Workflow, input_values: dict[str, Any], run: ExecutionRun) -> dict:
    text_blob = " ".join(
        [
            workflow.title or "",
            workflow.description or "",
            json.dumps(workflow.steps or [], ensure_ascii=False),
            json.dumps(workflow.extracted_rules or {}, ensure_ascii=False),
            json.dumps(workflow.decision_tree or {}, ensure_ascii=False),
            json.dumps(workflow.exceptions or {}, ensure_ascii=False),
            json.dumps(workflow.risk_analysis or {}, ensure_ascii=False),
            json.dumps(input_values or {}, ensure_ascii=False),
        ]
    ).lower()

    numeric_inputs = _extract_numeric_inputs(input_values)
    spend_amount = _infer_spend_amount(input_values, numeric_inputs, text_blob)
    data_access = _infer_boolean_input(input_values, ["data_access", "data access", "access", "request_data_access"]) or ("data access" in text_blob)
    system_access = _infer_boolean_input(input_values, ["system_access", "system access", "request_system_access"]) or ("system access" in text_blob)
    critical_request = any(keyword in text_blob for keyword in ["critical", "urgent", "high risk", "escalat"])

    risk_tier = _compute_risk_tier(spend_amount, data_access, system_access, critical_request, text_blob)
    legal_review_required = risk_tier == "Tier 3" or any(word in text_blob for word in ["legal", "compliance", "policy violation"])
    finance_approval_required = bool(spend_amount is not None and spend_amount >= 100000) or any(word in text_blob for word in ["finance", "approval threshold", "budget"])
    security_review_required = bool(system_access or data_access or risk_tier == "Tier 3" or any(word in text_blob for word in ["security", "access review"]))

    computed_variables = {
        "spend_amount": spend_amount,
        "data_access": data_access,
        "system_access": system_access,
        "critical_request": critical_request,
    }
    decisions = {
        "risk_tier": risk_tier,
        "legal_review_required": legal_review_required,
        "finance_approval_required": finance_approval_required,
        "security_review_required": security_review_required,
    }

    next_step_id = _determine_next_step_id(workflow, decisions, input_values, run.current_step_id)

    return {
        "computed_variables": computed_variables,
        "decisions": decisions,
        "next_step_id": next_step_id,
    }


def _extract_numeric_inputs(input_values: dict[str, Any]) -> dict[str, float]:
    result: dict[str, float] = {}
    for key, value in (input_values or {}).items():
        try:
            result[str(key).lower()] = float(value)
        except Exception:
            continue
    return result


def _infer_spend_amount(input_values: dict[str, Any], numeric_inputs: dict[str, float], text_blob: str) -> float | None:
    candidates = [
        "spend",
        "spend_threshold",
        "amount",
        "refund_amount",
        "refund amount",
        "cost",
        "budget",
        "threshold",
    ]
    for candidate in candidates:
        if candidate in numeric_inputs:
            return numeric_inputs[candidate]

    for key, value in numeric_inputs.items():
        if any(candidate.replace(" ", "") in key.replace(" ", "") for candidate in candidates):
            return value

    if any(word in text_blob for word in ["spend", "refund", "amount", "budget"]):
        for key, value in numeric_inputs.items():
            if value:
                return value

    return None


def _infer_boolean_input(input_values: dict[str, Any], keys: list[str]) -> bool:
    normalized = {str(k).replace(" ", "_").lower(): v for k, v in (input_values or {}).items()}
    for key in keys:
        key_norm = key.replace(" ", "_").lower()
        if key_norm in normalized:
            value = normalized[key_norm]
            if isinstance(value, bool):
                return value
            if isinstance(value, (int, float)):
                return bool(value)
            if isinstance(value, str):
                return value.strip().lower() in ("true", "yes", "y", "1", "on")
    return False


def _compute_risk_tier(
    spend_amount: float | None,
    data_access: bool,
    system_access: bool,
    critical_request: bool,
    text_blob: str,
) -> str:
    if critical_request or (spend_amount is not None and spend_amount >= 100000) or ((data_access or system_access) and spend_amount is not None and spend_amount >= 50000):
        return "Tier 3"
    if (spend_amount is not None and spend_amount >= 50000) or data_access or system_access or any(word in text_blob for word in ["medium risk", "review"]):
        return "Tier 2"
    return "Tier 1"


def _determine_next_step_id(workflow: Workflow, decisions: dict, input_values: dict[str, Any], current_step_id: str | None) -> str | None:
    steps = workflow.steps or []
    if not steps:
        return None

    step_lookup = {str(step.get("step_id") or step.get("id")): step for step in steps if step.get("step_id") or step.get("id")}

    def find_step(*needles: str) -> str | None:
        for step_id, step in step_lookup.items():
            haystack = " ".join([
                str(step.get("title") or ""),
                str(step.get("description") or ""),
                str(step.get("actor") or ""),
                str(step.get("action_type") or ""),
            ]).lower()
            if all(needle.lower() in haystack for needle in needles):
                return step_id
        return None

    if decisions.get("legal_review_required"):
        return find_step("legal") or find_step("compliance") or find_step("review")
    if decisions.get("finance_approval_required"):
        return find_step("finance") or find_step("approval") or find_step("manager")
    if decisions.get("security_review_required"):
        return find_step("security") or find_step("access") or find_step("review")

    tier = str(decisions.get("risk_tier") or "Tier 1")
    if tier == "Tier 3":
        return find_step("vp") or find_step("director") or find_step("legal") or find_step("approval")
    if tier == "Tier 2":
        return find_step("supervisor") or find_step("manager") or find_step("approval")

    if current_step_id and current_step_id in step_lookup:
        current_index = next((i for i, step in enumerate(steps) if str(step.get("step_id") or step.get("id")) == current_step_id), -1)
        if current_index >= 0 and current_index + 1 < len(steps):
            next_step = steps[current_index + 1]
            return str(next_step.get("step_id") or next_step.get("id"))

    return str(steps[0].get("step_id") or steps[0].get("id"))