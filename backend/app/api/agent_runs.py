"""
Agent Runs API - Monitor agent execution status
"""
import asyncio
import json
from datetime import datetime
from typing import AsyncGenerator

from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete

from app.core.database import get_db, AsyncSessionLocal
from app.models import AgentRun, AgentLog, PolicyDocument, Workflow, HumanReview

router = APIRouter(prefix="/api/runs", tags=["agent-runs"])


@router.get("/")
async def list_runs(db: AsyncSession = Depends(get_db)):
    """List all agent runs."""
    result = await db.execute(
        select(AgentRun).order_by(AgentRun.created_at.desc()).limit(50)
    )
    runs = result.scalars().all()

    return [_serialize_run(r) for r in runs]


@router.get("/{run_id}")
async def get_run(run_id: str, db: AsyncSession = Depends(get_db)):
    """Get a specific agent run with logs."""
    result = await db.execute(select(AgentRun).where(AgentRun.id == run_id))
    run = result.scalar_one_or_none()
    if not run:
        raise HTTPException(404, "Run not found")

    # Get agent logs
    logs_result = await db.execute(
        select(AgentLog)
        .where(AgentLog.run_id == run_id)
        .order_by(AgentLog.started_at)
    )
    logs = logs_result.scalars().all()

    workflow_result = await db.execute(
        select(Workflow)
        .where(Workflow.run_id == run_id)
        .order_by(Workflow.created_at.desc())
    )
    workflow = workflow_result.scalar_one_or_none()

    run_data = _serialize_run(run)
    run_data["logs"] = [_serialize_log(log) for log in _collapse_logs_to_latest_attempt(logs)]
    run_data["workflow"] = _serialize_workflow(workflow) if workflow else None

    return run_data


@router.get("/{run_id}/stream")
async def stream_run_status(run_id: str, db: AsyncSession = Depends(get_db)):
    """SSE stream for live agent execution updates."""

    async def event_generator() -> AsyncGenerator[str, None]:
        seen_log_ids = set()
        last_status = None

        for _ in range(300):  # Poll for up to 5 minutes
            async with AsyncSessionLocal() as session:
                run_result = await session.execute(select(AgentRun).where(AgentRun.id == run_id))
                run = run_result.scalar_one_or_none()

                if not run:
                    yield f"data: {json.dumps({'error': 'Run not found'})}\n\n"
                    break

                logs_result = await session.execute(
                    select(AgentLog).where(AgentLog.run_id == run_id).order_by(AgentLog.started_at)
                )
                logs = logs_result.scalars().all()

                # Send new logs
                for log in logs:
                    if log.id not in seen_log_ids:
                        seen_log_ids.add(log.id)
                        yield f"data: {json.dumps({'type': 'agent_log', 'data': _serialize_log(log)})}\n\n"

                # Send status update if changed
                current_status = run.status
                if current_status != last_status:
                    last_status = current_status
                    yield f"data: {json.dumps({'type': 'status', 'data': _serialize_run(run)})}\n\n"

                if run.status in ("completed", "failed", "awaiting_review"):
                    yield f"data: {json.dumps({'type': 'complete', 'status': run.status})}\n\n"
                    break

            await asyncio.sleep(2)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )


@router.post("/{run_id}/retry")
async def retry_run(run_id: str, db: AsyncSession = Depends(get_db)):
    """Retry a stalled/failed run without re-uploading policy."""
    run_result = await db.execute(select(AgentRun).where(AgentRun.id == run_id))
    run = run_result.scalar_one_or_none()
    if not run:
        raise HTTPException(404, "Run not found")

    if run.status in ("running",):
        raise HTTPException(400, "Run is already running")

    policy_result = await db.execute(select(PolicyDocument).where(PolicyDocument.id == run.policy_id))
    policy = policy_result.scalar_one_or_none()
    if not policy or not policy.content_text:
        raise HTTPException(400, "Associated policy content not found")

    # Clear stale artifacts from previous attempts so UI reflects latest retry only
    await db.execute(delete(AgentLog).where(AgentLog.run_id == run_id))
    await db.execute(delete(Workflow).where(Workflow.run_id == run_id))
    await db.execute(delete(HumanReview).where(HumanReview.run_id == run_id))

    await db.execute(
        update(AgentRun)
        .where(AgentRun.id == run_id)
        .values(
            status="pending",
            current_agent="analysis",
            progress=0,
            graph_state=None,
            error_message=None,
            completed_at=None,
        )
    )
    await db.commit()

    from app.api.policies import _run_pipeline_background
    asyncio.create_task(_run_pipeline_background(policy.id, policy.name, policy.content_text, run.id))

    return {
        "message": "Run retry started",
        "run_id": run_id,
        "status": "pending",
    }


def _serialize_run(run: AgentRun) -> dict:
    return {
        "id": run.id,
        "policy_id": run.policy_id,
        "status": run.status,
        "current_agent": run.current_agent,
        "progress": run.progress,
        "graph_state": run.graph_state,
        "error_message": run.error_message,
        "created_at": run.created_at.isoformat() if run.created_at else None,
        "completed_at": run.completed_at.isoformat() if run.completed_at else None,
    }


def _serialize_log(log: AgentLog) -> dict:
    return {
        "id": log.id,
        "run_id": log.run_id,
        "agent_name": log.agent_name,
        "status": log.status,
        "message": log.message,
        "output_data": log.output_data,
        "duration_ms": log.duration_ms,
        "started_at": log.started_at.isoformat() if log.started_at else None,
        "completed_at": log.completed_at.isoformat() if log.completed_at else None,
    }


def _collapse_logs_to_latest_attempt(logs: list[AgentLog]) -> list[AgentLog]:
    """Keep only the latest log per agent name.

    This prevents retry history from polluting the run-detail view while still
    preserving the latest outcome for each stage.
    """
    latest_by_agent: dict[str, AgentLog] = {}
    for log in logs:
        latest_by_agent[log.agent_name] = log

    return list(latest_by_agent.values())


def _serialize_workflow(workflow: Workflow) -> dict:
    return {
        "id": workflow.id,
        "run_id": workflow.run_id,
        "policy_id": workflow.policy_id,
        "title": workflow.title,
        "description": workflow.description,
        "status": workflow.status,
        "steps_count": len(workflow.steps or []),
        "decision_tree_nodes": len((workflow.decision_tree or {}).get("nodes", [])),
        "risk_level": (workflow.risk_analysis or {}).get("risk_level"),
        "exceptions_count": len((workflow.exceptions or {}).get("exceptions", [])),
        "created_at": workflow.created_at.isoformat() if workflow.created_at else None,
        "updated_at": workflow.updated_at.isoformat() if workflow.updated_at else None,
    }
