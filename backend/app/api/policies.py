"""
Policies API - Upload and manage policy documents
"""
import os
import asyncio
import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, UploadFile, File, HTTPException, BackgroundTasks, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.config import settings
from app.models import PolicyDocument, AgentRun
from app.services.document_parser import parse_document, save_upload

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/policies", tags=["policies"])


@router.post("/upload")
async def upload_policy(
    file: UploadFile = File(...),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    db: AsyncSession = Depends(get_db)
):
    """Upload a policy document and trigger agent pipeline."""
    # Validate file type
    allowed_types = {".pdf", ".docx", ".doc", ".txt", ".md"}
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in allowed_types:
        raise HTTPException(400, f"File type {ext} not supported. Allowed: {', '.join(allowed_types)}")

    # Read file
    content = await file.read()
    file_size = len(content)

    if file_size > settings.MAX_FILE_SIZE_MB * 1024 * 1024:
        raise HTTPException(400, f"File too large. Max size: {settings.MAX_FILE_SIZE_MB}MB")

    # Save to disk
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    file_path = await save_upload(content, file.filename, settings.UPLOAD_DIR)

    # Parse document text
    file_type = ext.strip(".")
    try:
        text_content = await parse_document(file_path, file_type)
    except Exception as e:
        logger.error(f"Failed to parse document: {e}")
        text_content = content.decode("utf-8", errors="ignore")

    # Create policy record
    policy = PolicyDocument(
        name=os.path.splitext(file.filename)[0],
        original_filename=file.filename,
        file_type=file_type,
        file_size=file_size,
        content_text=text_content,
        status="processing"
    )
    db.add(policy)
    await db.commit()
    await db.refresh(policy)

    # Create agent run record
    agent_run = AgentRun(
        policy_id=policy.id,
        status="pending",
        current_agent="analysis",
        progress=0
    )
    db.add(agent_run)
    await db.commit()
    await db.refresh(agent_run)

    # Schedule pipeline in background
    background_tasks.add_task(
        _run_pipeline_background,
        policy.id, policy.name, text_content, agent_run.id
    )

    return {
        "policy_id": policy.id,
        "run_id": agent_run.id,
        "filename": file.filename,
        "file_size": file_size,
        "status": "processing",
        "message": "Policy uploaded. Agent pipeline started."
    }


@router.get("/")
async def list_policies(db: AsyncSession = Depends(get_db)):
    """List all uploaded policies."""
    result = await db.execute(
        select(PolicyDocument).order_by(PolicyDocument.created_at.desc())
    )
    policies = result.scalars().all()

    return [
        {
            "id": p.id,
            "name": p.name,
            "filename": p.original_filename,
            "file_type": p.file_type,
            "file_size": p.file_size,
            "status": p.status,
            "created_at": p.created_at.isoformat() if p.created_at else None
        }
        for p in policies
    ]


@router.get("/{policy_id}")
async def get_policy(policy_id: str, db: AsyncSession = Depends(get_db)):
    """Get a specific policy document."""
    result = await db.execute(select(PolicyDocument).where(PolicyDocument.id == policy_id))
    policy = result.scalar_one_or_none()
    if not policy:
        raise HTTPException(404, "Policy not found")

    return {
        "id": policy.id,
        "name": policy.name,
        "filename": policy.original_filename,
        "file_type": policy.file_type,
        "file_size": policy.file_size,
        "content_preview": (policy.content_text or "")[:500],
        "status": policy.status,
        "created_at": policy.created_at.isoformat() if policy.created_at else None
    }


@router.delete("/{policy_id}")
async def delete_policy(policy_id: str, db: AsyncSession = Depends(get_db)):
    """Delete a policy document."""
    result = await db.execute(select(PolicyDocument).where(PolicyDocument.id == policy_id))
    policy = result.scalar_one_or_none()
    if not policy:
        raise HTTPException(404, "Policy not found")

    await db.delete(policy)
    await db.commit()
    return {"message": "Policy deleted"}


async def _run_pipeline_background(policy_id: str, policy_name: str, text: str, run_id: str):
    """Run the agent pipeline in the background."""
    from app.core.database import AsyncSessionLocal
    from app.models import AgentRun, AgentLog, Workflow, PolicyDocument
    from app.orchestrator.graph import run_pipeline
    from sqlalchemy import update

    logger.info(f"Starting pipeline for policy {policy_id}, run {run_id}")

    async with AsyncSessionLocal() as db:
        try:
            # Update run status to running
            await db.execute(
                update(AgentRun)
                .where(AgentRun.id == run_id)
                .values(status="running", current_agent="analysis")
            )
            await db.commit()

            # Run the full pipeline
            final_state = await run_pipeline(text, policy_name, run_id)

            # Build the workflow title
            workflow_data = final_state.get("workflow", {})
            workflow_title = workflow_data.get("workflow_title", f"{policy_name} Workflow")

            # Create workflow record
            workflow = Workflow(
                run_id=run_id,
                policy_id=policy_id,
                title=workflow_title,
                description=workflow_data.get("workflow_description", ""),
                steps=workflow_data.get("steps", []),
                decision_tree=workflow_data.get("decision_tree", {}),
                risk_analysis=final_state.get("risks", {}),
                exceptions=final_state.get("exceptions", {}),
                simulation_results=final_state.get("simulation", {}),
                extracted_rules=final_state.get("extracted_rules", {}),
                conflicts=final_state.get("conflicts", {}),
                status="awaiting_review" if final_state.get("human_review", {}).get("review_required") else "draft",
                version="v1.0",
                source_document=policy_name,
                handoff_status={
                    "send_to_operations": {"status": "not_sent"},
                    "export_for_workflow_engine": {"status": "not_exported"},
                    "publish_as_playbook": {"status": "not_published"},
                },
                read_only=False,
            )
            db.add(workflow)
            await db.flush()

            # Update agent run with completion
            final_status = final_state.get("status", "completed")
            await db.execute(
                update(AgentRun)
                .where(AgentRun.id == run_id)
                .values(
                    status=final_status,
                    current_agent="complete",
                    progress=100,
                    graph_state={
                        "extracted_rules_count": len(final_state.get("extracted_rules", {}).get("rules", [])),
                        "conflicts_count": final_state.get("conflicts", {}).get("total_conflicts", 0),
                        "risk_level": final_state.get("risks", {}).get("risk_level", "unknown"),
                        "workflow_steps": len(workflow_data.get("steps", [])),
                        "exceptions_count": final_state.get("exceptions", {}).get("total_exceptions", 0),
                        "review_items": final_state.get("human_review", {}).get("total_review_items", 0),
                        "human_review": final_state.get("human_review", {}),
                        "workflow_id": workflow.id,
                        "workflow_status": workflow.status,
                    },
                    completed_at=datetime.now(timezone.utc)
                )
            )

            # Update policy status
            policy_status = "failed" if final_status == "failed" else "completed"
            await db.execute(
                update(PolicyDocument)
                .where(PolicyDocument.id == policy_id)
                .values(status=policy_status)
            )

            await db.commit()
            logger.info(f"Pipeline completed for run {run_id}")

        except Exception as e:
            logger.error(f"Pipeline failed for run {run_id}: {e}", exc_info=True)
            await db.execute(
                update(AgentRun)
                .where(AgentRun.id == run_id)
                .values(status="failed", error_message=str(e))
            )
            await db.execute(
                update(PolicyDocument)
                .where(PolicyDocument.id == policy_id)
                .values(status="failed")
            )
            await db.commit()
