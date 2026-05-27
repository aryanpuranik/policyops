"""
Human Review API - Manage human-in-the-loop review items
"""
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update

from app.core.database import get_db
from app.models import HumanReview, Workflow, AgentRun
from app.schemas.review import ReviewDecision


def normalize_run_status(status: str) -> str:
    """Normalize review outcomes to valid run statuses."""
    mapping = {
        "approved": "completed",
        "partially_approved": "completed",
        "rejected": "failed",
        "published": "published",
    }
    return mapping.get(status, status)

router = APIRouter(prefix="/api/reviews", tags=["reviews"])


@router.get("/")
async def list_reviews(db: AsyncSession = Depends(get_db)):
    """List all human review items."""
    result = await db.execute(
        select(HumanReview).order_by(HumanReview.created_at.desc())
    )
    reviews = result.scalars().all()
    return [_serialize_review(r) for r in reviews]


@router.get("/pending")
async def list_pending_reviews(db: AsyncSession = Depends(get_db)):
    """List pending human review items."""
    result = await db.execute(
        select(HumanReview)
        .where(HumanReview.status == "pending")
        .order_by(HumanReview.created_at.desc())
    )
    reviews = result.scalars().all()
    return [_serialize_review(r) for r in reviews]


@router.get("/workflow/{workflow_id}")
async def get_workflow_review_items(workflow_id: str, db: AsyncSession = Depends(get_db)):
    """Get all review items for a workflow."""
    # Get the workflow to get human review data
    w_result = await db.execute(select(Workflow).where(Workflow.id == workflow_id))
    workflow = w_result.scalar_one_or_none()
    if not workflow:
        raise HTTPException(404, "Workflow not found")

    # Get review items from agent run state
    r_result = await db.execute(select(AgentRun).where(AgentRun.id == workflow.run_id))
    run = r_result.scalar_one_or_none()

    human_review_data = {}
    if run and run.graph_state:
        human_review_data = run.graph_state.get("human_review", {})

    return {
        "workflow_id": workflow_id,
        "workflow_status": workflow.status,
        "human_review": human_review_data,
        "review_items": human_review_data.get("review_items", []),
        "total_items": human_review_data.get("total_review_items", 0),
        "urgency": human_review_data.get("urgency", "low"),
    }


@router.post("/{review_id}/decide")
async def submit_review_decision(
    review_id: str,
    decision: ReviewDecision,
    db: AsyncSession = Depends(get_db)
):
    """Submit a human review decision."""
    result = await db.execute(select(HumanReview).where(HumanReview.id == review_id))
    review = result.scalar_one_or_none()
    if not review:
        raise HTTPException(404, "Review item not found")

    review.status = decision.decision
    review.reviewer_decision = decision.decision
    review.reviewer_notes = decision.notes
    review.modified_data = decision.modified_data
    review.resolved_at = datetime.now(timezone.utc)
    await db.commit()

    return {"message": "Decision recorded", "review_id": review_id, "decision": decision.decision}


@router.post("/workflow/{workflow_id}/resolve")
async def resolve_workflow_review(
    workflow_id: str,
    body: dict,
    db: AsyncSession = Depends(get_db)
):
    """
    Resolve human review for entire workflow.
    body: {action: "approve"|"reject"|"modify", notes: str, modifications: dict}
    """
    w_result = await db.execute(select(Workflow).where(Workflow.id == workflow_id))
    workflow = w_result.scalar_one_or_none()
    if not workflow:
        raise HTTPException(404, "Workflow not found")

    action = body.get("action", "approve")
    notes = body.get("notes", "")
    modifications = body.get("modifications", {})

    if action == "approve":
        workflow.status = "approved"
        run_status = "approved"
    elif action == "reject":
        workflow.status = "rejected"
        run_status = "rejected"
    elif action == "modify":
        workflow.status = "approved"
        run_status = "partially_approved"
        # Apply modifications
        if "steps" in modifications:
            workflow.steps = modifications["steps"]
        if "title" in modifications:
            workflow.title = modifications["title"]
        if "description" in modifications:
            workflow.description = modifications["description"]

    workflow.human_review_notes = notes

    # Update run status
    await db.execute(
        update(AgentRun)
        .where(AgentRun.id == workflow.run_id)
        .values(status=normalize_run_status(run_status))
    )

    await db.commit()
    return {
        "message": f"Workflow {action}d",
        "workflow_id": workflow_id,
        "status": workflow.status
    }


def _serialize_review(r: HumanReview) -> dict:
    return {
        "id": r.id,
        "workflow_id": r.workflow_id,
        "run_id": r.run_id,
        "review_type": r.review_type,
        "question": r.question,
        "context_data": r.context_data,
        "status": r.status,
        "reviewer_decision": r.reviewer_decision,
        "reviewer_notes": r.reviewer_notes,
        "modified_data": r.modified_data,
        "created_at": r.created_at.isoformat() if r.created_at else None,
        "resolved_at": r.resolved_at.isoformat() if r.resolved_at else None,
    }
