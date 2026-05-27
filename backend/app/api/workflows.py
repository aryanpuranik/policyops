"""
Workflows API - Access and manage generated workflows
"""
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from datetime import datetime, timezone
import json

from app.core.database import get_db
from app.models import Workflow, AgentRun

router = APIRouter(prefix="/api/workflows", tags=["workflows"])


@router.get("/")
async def list_workflows(db: AsyncSession = Depends(get_db)):
    """List all generated workflows."""
    result = await db.execute(
        select(Workflow).order_by(Workflow.created_at.desc())
    )
    workflows = result.scalars().all()

    return [_serialize_workflow_summary(w) for w in workflows]


@router.get("/published")
async def list_published_workflows(search: str | None = None, db: AsyncSession = Depends(get_db)):
    """List official published workflows for internal consumption."""
    query = select(Workflow).where(Workflow.status == "published").order_by(Workflow.published_at.desc(), Workflow.updated_at.desc())
    result = await db.execute(query)
    workflows = result.scalars().all()

    if search:
        needle = search.lower().strip()
        workflows = [
            w for w in workflows
            if needle in (w.title or "").lower() or needle in (w.source_document or "").lower()
        ]

    return [_serialize_published_workflow(w) for w in workflows]


@router.get("/{workflow_id}")
async def get_workflow(workflow_id: str, db: AsyncSession = Depends(get_db)):
    """Get complete workflow with all agent outputs."""
    result = await db.execute(select(Workflow).where(Workflow.id == workflow_id))
    workflow = result.scalar_one_or_none()
    if not workflow:
        raise HTTPException(404, "Workflow not found")

    return _serialize_workflow_full(workflow)


@router.get("/by-run/{run_id}")
async def get_workflow_by_run(run_id: str, db: AsyncSession = Depends(get_db)):
    """Get workflow for a specific agent run."""
    result = await db.execute(
        select(Workflow).where(Workflow.run_id == run_id).order_by(Workflow.created_at.desc())
    )
    workflow = result.scalar_one_or_none()
    if not workflow:
        raise HTTPException(404, "Workflow not found for this run")

    return _serialize_workflow_full(workflow)


@router.patch("/{workflow_id}")
async def update_workflow(
    workflow_id: str,
    body: dict,
    db: AsyncSession = Depends(get_db)
):
    """Update workflow after human review."""
    result = await db.execute(select(Workflow).where(Workflow.id == workflow_id))
    workflow = result.scalar_one_or_none()
    if not workflow:
        raise HTTPException(404, "Workflow not found")

    if workflow.read_only and workflow.status in ("published", "archived"):
        raise HTTPException(400, "Published/archived workflows are read-only")

    allowed_fields = {"title", "description", "steps", "decision_tree", "status", "human_review_notes"}
    for field, value in body.items():
        if field in allowed_fields:
            setattr(workflow, field, value)

    await db.commit()
    await db.refresh(workflow)
    return _serialize_workflow_full(workflow)


@router.post("/{workflow_id}/approve")
async def approve_workflow(
    workflow_id: str,
    body: dict = {},
    db: AsyncSession = Depends(get_db)
):
    """Approve a workflow."""
    result = await db.execute(select(Workflow).where(Workflow.id == workflow_id))
    workflow = result.scalar_one_or_none()
    if not workflow:
        raise HTTPException(404, "Workflow not found")

    workflow.status = "approved"
    workflow.read_only = False
    workflow.human_review_notes = body.get("notes", "Approved by reviewer")
    workflow.approved_by = body.get("approved_by") or body.get("reviewer") or "Internal Reviewer"
    workflow.approved_at = datetime.now(timezone.utc)

    # Update the agent run status
    await db.execute(
        update(AgentRun)
        .where(AgentRun.id == workflow.run_id)
        .values(status="completed", completed_at=datetime.now(timezone.utc))
    )

    await db.commit()
    return {"message": "Workflow approved", "workflow_id": workflow_id, "status": "approved"}


@router.post("/{workflow_id}/reject")
async def reject_workflow(
    workflow_id: str,
    body: dict = {},
    db: AsyncSession = Depends(get_db)
):
    """Reject a workflow."""
    result = await db.execute(select(Workflow).where(Workflow.id == workflow_id))
    workflow = result.scalar_one_or_none()
    if not workflow:
        raise HTTPException(404, "Workflow not found")

    workflow.status = "rejected"
    workflow.read_only = False
    workflow.human_review_notes = body.get("notes", "Rejected by reviewer")

    await db.execute(
        update(AgentRun)
        .where(AgentRun.id == workflow.run_id)
        .values(status="failed")
    )
    await db.commit()
    return {"message": "Workflow rejected", "workflow_id": workflow_id, "status": "rejected"}


@router.post("/{workflow_id}/publish")
async def publish_workflow(
    workflow_id: str,
    body: dict = {},
    db: AsyncSession = Depends(get_db)
):
    """Publish an approved workflow for internal employee access."""
    result = await db.execute(select(Workflow).where(Workflow.id == workflow_id))
    workflow = result.scalar_one_or_none()
    if not workflow:
        raise HTTPException(404, "Workflow not found")

    if workflow.status != "approved":
        raise HTTPException(400, "Only approved workflows can be published")

    workflow.status = "published"
    workflow.read_only = True
    workflow.version = body.get("version") or workflow.version or "v1.0"
    workflow.published_by = body.get("published_by") or workflow.approved_by or "Internal Publisher"
    workflow.published_at = datetime.now(timezone.utc)
    if not workflow.source_document:
        workflow.source_document = body.get("source_document") or "Uploaded Policy"

    await db.execute(
        update(AgentRun)
        .where(AgentRun.id == workflow.run_id)
        .values(status="published", completed_at=datetime.now(timezone.utc))
    )

    await db.commit()
    await db.refresh(workflow)

    return {
        "message": "Workflow published",
        "workflow": _serialize_published_workflow(workflow),
    }


@router.post("/{workflow_id}/archive")
async def archive_workflow(workflow_id: str, db: AsyncSession = Depends(get_db)):
    """Archive a published workflow."""
    result = await db.execute(select(Workflow).where(Workflow.id == workflow_id))
    workflow = result.scalar_one_or_none()
    if not workflow:
        raise HTTPException(404, "Workflow not found")

    if workflow.status != "published":
        raise HTTPException(400, "Only published workflows can be archived")

    workflow.status = "archived"
    workflow.read_only = True
    await db.commit()
    return {"message": "Workflow archived", "workflow_id": workflow_id, "status": "archived"}


@router.get("/{workflow_id}/export/{fmt}")
async def export_workflow(workflow_id: str, fmt: str, db: AsyncSession = Depends(get_db)):
    """Export workflow as JSON, PDF (simulated), or DOCX (simulated)."""
    result = await db.execute(select(Workflow).where(Workflow.id == workflow_id))
    workflow = result.scalar_one_or_none()
    if not workflow:
        raise HTTPException(404, "Workflow not found")

    payload = _serialize_workflow_full(workflow)
    filename_base = (workflow.title or "workflow").replace(" ", "_").lower()

    if fmt == "json":
        content = json.dumps(payload, indent=2)
        return Response(
            content=content,
            media_type="application/json",
            headers={"Content-Disposition": f"attachment; filename={filename_base}.json"},
        )

    text_export = _to_export_text(workflow)
    if fmt == "pdf":
        return Response(
            content=text_export.encode("utf-8"),
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename={filename_base}.pdf"},
        )
    if fmt == "docx":
        return Response(
            content=text_export.encode("utf-8"),
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={"Content-Disposition": f"attachment; filename={filename_base}.docx"},
        )

    raise HTTPException(400, "Unsupported export format. Use: pdf, docx, json")


@router.post("/{workflow_id}/handoff")
async def handoff_workflow(
    workflow_id: str,
    body: dict = {},
    db: AsyncSession = Depends(get_db)
):
    """Record operational handoff actions for a published workflow."""
    action = body.get("action")
    actor = body.get("actor") or "Operations Lead"
    valid_actions = {
        "send_to_operations": "sent",
        "export_for_workflow_engine": "exported",
        "publish_as_playbook": "published",
    }
    if action not in valid_actions:
        raise HTTPException(400, "Invalid handoff action")

    result = await db.execute(select(Workflow).where(Workflow.id == workflow_id))
    workflow = result.scalar_one_or_none()
    if not workflow:
        raise HTTPException(404, "Workflow not found")

    handoff = workflow.handoff_status or {}
    handoff[action] = {
        "status": valid_actions[action],
        "by": actor,
        "at": datetime.now(timezone.utc).isoformat(),
    }
    workflow.handoff_status = handoff
    await db.commit()

    return {"message": "Handoff updated", "handoff_status": workflow.handoff_status}


def _serialize_workflow_summary(w: Workflow) -> dict:
    return {
        "id": w.id,
        "run_id": w.run_id,
        "policy_id": w.policy_id,
        "title": w.title,
        "description": w.description,
        "status": w.status,
        "steps_count": len(w.steps or []),
        "risks_count": len((w.risk_analysis or {}).get("risks", [])),
        "exceptions_count": len((w.exceptions or {}).get("exceptions", [])),
        "version": w.version,
        "approved_by": w.approved_by,
        "approved_at": w.approved_at.isoformat() if w.approved_at else None,
        "published_by": w.published_by,
        "published_at": w.published_at.isoformat() if w.published_at else None,
        "source_document": w.source_document,
        "risk_level": (w.risk_analysis or {}).get("risk_level", "unknown"),
        "handoff_status": w.handoff_status or {},
        "read_only": bool(w.read_only),
        "created_at": w.created_at.isoformat() if w.created_at else None,
    }


def _serialize_workflow_full(w: Workflow) -> dict:
    return {
        "id": w.id,
        "run_id": w.run_id,
        "policy_id": w.policy_id,
        "title": w.title,
        "description": w.description,
        "status": w.status,
        "human_review_notes": w.human_review_notes,
        "version": w.version,
        "approved_by": w.approved_by,
        "approved_at": w.approved_at.isoformat() if w.approved_at else None,
        "published_by": w.published_by,
        "published_at": w.published_at.isoformat() if w.published_at else None,
        "source_document": w.source_document,
        "handoff_status": w.handoff_status or {},
        "read_only": bool(w.read_only),
        "steps": w.steps or [],
        "decision_tree": w.decision_tree or {"nodes": [], "edges": []},
        "risk_analysis": w.risk_analysis or {},
        "exceptions": w.exceptions or {},
        "simulation_results": w.simulation_results or {},
        "extracted_rules": w.extracted_rules or {},
        "conflicts": w.conflicts or {},
        "created_at": w.created_at.isoformat() if w.created_at else None,
        "updated_at": w.updated_at.isoformat() if w.updated_at else None,
    }


def _serialize_published_workflow(w: Workflow) -> dict:
    return {
        "id": w.id,
        "workflow_name": w.title,
        "version": w.version or "v1.0",
        "approved_by": w.approved_by or "Internal Reviewer",
        "date_published": w.published_at.isoformat() if w.published_at else None,
        "risk_level": (w.risk_analysis or {}).get("risk_level", "unknown"),
        "source_document": w.source_document or "Uploaded Policy",
        "current_status": w.status,
        "published_by": w.published_by,
        "handoff_status": w.handoff_status or {},
    }


def _to_export_text(w: Workflow) -> str:
    lines = [
        f"Workflow: {w.title}",
        f"Version: {w.version or 'v1.0'}",
        f"Status: {w.status}",
        f"Approved By: {w.approved_by or 'N/A'}",
        f"Published By: {w.published_by or 'N/A'}",
        f"Published At: {w.published_at.isoformat() if w.published_at else 'N/A'}",
        f"Risk Level: {(w.risk_analysis or {}).get('risk_level', 'unknown')}",
        f"Source Document: {w.source_document or 'Uploaded Policy'}",
        "",
        "Steps:",
    ]
    for idx, step in enumerate(w.steps or [], start=1):
        lines.append(f"{idx}. {step.get('title', 'Untitled')} - {step.get('description', '')}")
    return "\n".join(lines)
