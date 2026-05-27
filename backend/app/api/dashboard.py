"""
Dashboard API - Stats, metrics, activity feed
"""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, text

from app.core.database import get_db
from app.models import PolicyDocument, AgentRun, Workflow, AgentLog

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/stats")
async def get_dashboard_stats(db: AsyncSession = Depends(get_db)):
    try:
        policies_count = (await db.execute(select(func.count()).select_from(PolicyDocument))).scalar() or 0
        runs_count = (await db.execute(select(func.count()).select_from(AgentRun))).scalar() or 0
        workflows_count = (await db.execute(select(func.count()).select_from(Workflow))).scalar() or 0
        pending_reviews = (await db.execute(
            select(func.count()).select_from(Workflow).where(Workflow.status.in_(["pending_review", "awaiting_review"]))
        )).scalar() or 0
        successful_runs = (await db.execute(
            select(func.count()).select_from(AgentRun).where(AgentRun.status.in_(["completed", "awaiting_review", "approved", "published", "partially_approved"]))
        )).scalar() or 0
        approved_count = (await db.execute(
            select(func.count()).select_from(Workflow).where(Workflow.status.in_(["approved", "published"]))
        )).scalar() or 0
        published_count = (await db.execute(
            select(func.count()).select_from(Workflow).where(Workflow.status == "published")
        )).scalar() or 0

        return {
            "total_policies": policies_count,
            "total_runs": runs_count,
            "total_workflows": workflows_count,
            "pending_reviews": pending_reviews,
            "successful_runs": successful_runs,
            "approved_workflows": approved_count,
            "published_workflows": published_count,
            "success_rate": round(successful_runs / max(runs_count, 1) * 100, 1)
        }
    except Exception as e:
        return {
            "total_policies": 0, "total_runs": 0, "total_workflows": 0,
            "pending_reviews": 0, "successful_runs": 0, "approved_workflows": 0, "published_workflows": 0,
            "success_rate": 0.0
        }


@router.get("/published-workflows")
async def get_published_workflows(limit: int = 20, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Workflow)
        .where(Workflow.status == "published")
        .order_by(Workflow.published_at.desc(), Workflow.updated_at.desc())
        .limit(limit)
    )
    workflows = result.scalars().all()

    return [
        {
            "id": w.id,
            "workflow_name": w.title,
            "version": w.version or "v1.0",
            "approved_by": w.approved_by or "Internal Reviewer",
            "date_published": w.published_at.isoformat() if w.published_at else None,
            "risk_level": (w.risk_analysis or {}).get("risk_level", "unknown"),
            "source_document": w.source_document or "Uploaded Policy",
            "current_status": w.status,
        }
        for w in workflows
    ]


@router.get("/activity")
async def get_activity_feed(limit: int = 20, db: AsyncSession = Depends(get_db)):
    activities = []
    try:
        # Fetch runs
        runs_result = await db.execute(
            select(AgentRun).order_by(AgentRun.created_at.desc()).limit(10)
        )
        runs = runs_result.scalars().all()

        # Fetch policy names separately
        policy_ids = [r.policy_id for r in runs]
        policy_map = {}
        if policy_ids:
            pol_result = await db.execute(
                select(PolicyDocument).where(PolicyDocument.id.in_(policy_ids))
            )
            for p in pol_result.scalars().all():
                policy_map[p.id] = p.name

        for run in runs:
            policy_name = policy_map.get(run.policy_id, "Unknown Policy")
            ts = run.completed_at or run.created_at
            timestamp = ts.isoformat() if ts else ""

            if run.status == "completed":
                activities.append({
                    "id": f"run_{run.id}", "type": "run_completed",
                    "title": "Agent pipeline completed",
                    "description": f"Policy '{policy_name}' processed successfully",
                    "status": "success", "timestamp": timestamp,
                    "link": f"/runs/{run.id}", "metadata": {}
                })
            elif run.status in ("running", "processing"):
                activities.append({
                    "id": f"run_{run.id}", "type": "run_running",
                    "title": "Agent pipeline running",
                    "description": f"Processing '{policy_name}' — {run.current_agent or 'starting'}",
                    "status": "info", "timestamp": timestamp,
                    "link": f"/runs/{run.id}", "metadata": {}
                })
            elif run.status == "awaiting_review":
                activities.append({
                    "id": f"run_{run.id}", "type": "review_required",
                    "title": "Human review required",
                    "description": f"Workflow for '{policy_name}' needs your review",
                    "status": "warning", "timestamp": timestamp,
                    "link": f"/runs/{run.id}", "metadata": {}
                })
            elif run.status in ("approved", "partially_approved"):
                activities.append({
                    "id": f"run_{run.id}", "type": "run_approved",
                    "title": "Run approved",
                    "description": f"Workflow for '{policy_name}' was approved",
                    "status": "success", "timestamp": timestamp,
                    "link": f"/runs/{run.id}", "metadata": {}
                })
            elif run.status == "failed":
                activities.append({
                    "id": f"run_{run.id}", "type": "run_failed",
                    "title": "Agent pipeline failed",
                    "description": f"Failed to process '{policy_name}'",
                    "status": "error", "timestamp": timestamp,
                    "link": f"/runs/{run.id}", "metadata": {}
                })

        # Approved/rejected workflows
        wf_result = await db.execute(
            select(Workflow).where(Workflow.status.in_(["approved", "rejected", "published"]))
            .order_by(Workflow.updated_at.desc()).limit(5)
        )
        for wf in wf_result.scalars().all():
            ts = wf.updated_at or wf.created_at
            activities.append({
                "id": f"wf_{wf.id}", "type": f"workflow_{wf.status}",
                "title": f"Workflow {wf.status}",
                "description": f"'{wf.title}' was {wf.status}",
                "status": "success" if wf.status in ("approved", "published") else "error",
                "timestamp": ts.isoformat() if ts else "",
                "link": f"/workflows/{wf.id}", "metadata": {}
            })

        activities.sort(key=lambda x: x["timestamp"], reverse=True)
    except Exception as e:
        pass

    return activities[:limit]


@router.get("/recent-runs")
async def get_recent_runs(db: AsyncSession = Depends(get_db)):
    try:
        runs_result = await db.execute(
            select(AgentRun).order_by(AgentRun.created_at.desc()).limit(5)
        )
        runs = runs_result.scalars().all()

        policy_ids = [r.policy_id for r in runs]
        policy_map = {}
        if policy_ids:
            pol_result = await db.execute(
                select(PolicyDocument).where(PolicyDocument.id.in_(policy_ids))
            )
            for p in pol_result.scalars().all():
                policy_map[p.id] = p.name

        return [
            {
                "id": r.id,
                "policy_name": policy_map.get(r.policy_id, "Unknown"),
                "status": r.status,
                "current_agent": r.current_agent,
                "progress": r.progress,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in runs
        ]
    except Exception:
        return []
