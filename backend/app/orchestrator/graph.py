"""
LangGraph Multi-Agent Orchestrator
Manages the full agent pipeline:
Policy Analysis → Workflow Builder
→ Exception Generation → Simulation → Human Review
"""
from typing import TypedDict
from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver
import logging
from datetime import datetime, timezone

from sqlalchemy import select, update

from app.core.database import AsyncSessionLocal
from app.models import AgentLog, AgentRun

from app.agents.analysis_agent import run_analysis_agent
from app.agents.workflow_builder_agent import run_workflow_builder_agent
from app.agents.exception_generation_agent import run_exception_generation_agent
from app.agents.simulation_agent import run_simulation_agent
from app.agents.human_review_agent import run_human_review_agent

logger = logging.getLogger(__name__)

STAGE_PROGRESS = {
    "analysis": 0,
    "workflow_builder": 20,
    "exception_generation": 40,
    "simulation": 60,
    "human_review": 80,
    "complete": 100,
}


# ─── Graph State ─────────────────────────────────────────────────────────────

class PolicyCompilerState(TypedDict):
    # Input
    policy_text: str
    policy_name: str
    run_id: str

    # Agent outputs
    extracted_rules: dict
    conflicts: dict
    risks: dict
    workflow: dict
    exceptions: dict
    simulation: dict
    human_review: dict

    # Control flow
    current_agent: str
    agent_logs: list[dict]
    errors: list[str]
    status: str  # running | awaiting_review | completed | failed

    # Metadata
    started_at: str
    completed_at: str | None


# ─── Agent Nodes ─────────────────────────────────────────────────────────────

async def analysis_node(state: PolicyCompilerState) -> PolicyCompilerState:
    """Node 1: Combined policy extraction + conflict + risk analysis."""
    logger.info(f"[{state['run_id']}] Running Policy Analysis Agent")
    start = datetime.now(timezone.utc)
    await _persist_stage_state(state["run_id"], "Policy Analysis Agent", "running", "analysis", STAGE_PROGRESS["analysis"], "Analysis started")

    try:
        result = await run_analysis_agent(
            state["policy_text"],
            state["policy_name"]
        )
        log = _make_log("Policy Analysis Agent", "completed", result, start)
    except Exception as e:
        logger.error(f"Policy analysis failed: {e}")
        result = {
            "extracted_rules": {
                "rules": [], "actors": [], "key_thresholds": [], "process_flows": [],
                "ambiguities": [], "missing_information": [], "policy_summary": "Error", "domain": "unknown"
            },
            "conflicts": {
                "total_conflicts": 0, "conflicts": [], "ambiguities": [],
                "coverage_gaps": [], "conflict_severity": "low"
            },
            "risks": {
                "overall_risk_score": 50, "risk_level": "medium", "risks": [],
                "missing_controls": [], "governance_gaps": []
            }
        }
        log = _make_log("Policy Analysis Agent", "failed", {}, start, str(e))
        state["errors"].append(f"Policy analysis: {str(e)}")

    await _persist_stage_state(
        state["run_id"],
        "Policy Analysis Agent",
        log["status"],
        "workflow_builder",
        STAGE_PROGRESS["workflow_builder"],
        log["message"],
        result,
    )

    return {
        **state,
        "extracted_rules": result.get("extracted_rules", {}),
        "conflicts": result.get("conflicts", {}),
        "risks": result.get("risks", {}),
        "current_agent": "workflow_builder",
        "agent_logs": state["agent_logs"] + [log],
    }



async def workflow_builder_node(state: PolicyCompilerState) -> PolicyCompilerState:
    """Node 2: Build operational workflow."""
    logger.info(f"[{state['run_id']}] Running Workflow Builder Agent")
    start = datetime.now(timezone.utc)
    await _persist_stage_state(state["run_id"], "Workflow Builder Agent", "running", "workflow_builder", STAGE_PROGRESS["workflow_builder"], "Workflow build started")

    try:
        result = await run_workflow_builder_agent(
            state["extracted_rules"],
            state["conflicts"],
            state["risks"]
        )
        log = _make_log("Workflow Builder Agent", "completed", result, start)
    except Exception as e:
        logger.error(f"Workflow building failed: {e}")
        result = {"workflow_title": "Workflow", "steps": [], "decision_tree": {"nodes": [], "edges": []}}
        log = _make_log("Workflow Builder Agent", "failed", {}, start, str(e))
        state["errors"].append(f"Workflow builder: {str(e)}")

    await _persist_stage_state(
        state["run_id"],
        "Workflow Builder Agent",
        log["status"],
        "exception_generation",
        STAGE_PROGRESS["exception_generation"],
        log["message"],
        result,
    )

    return {
        **state,
        "workflow": result,
        "current_agent": "exception_generation",
        "agent_logs": state["agent_logs"] + [log],
    }



async def exception_generation_node(state: PolicyCompilerState) -> PolicyCompilerState:
    """Node 3: Generate exception scenarios."""
    logger.info(f"[{state['run_id']}] Running Exception Generation Agent")
    start = datetime.now(timezone.utc)
    await _persist_stage_state(state["run_id"], "Exception Generation Agent", "running", "exception_generation", STAGE_PROGRESS["exception_generation"], "Exception generation started")

    try:
        result = await run_exception_generation_agent(
            state["extracted_rules"],
            state["workflow"],
            state["risks"]
        )
        log = _make_log("Exception Generation Agent", "completed", result, start)
    except Exception as e:
        logger.error(f"Exception generation failed: {e}")
        result = {"total_exceptions": 0, "exceptions": [], "exception_workflow_additions": []}
        log = _make_log("Exception Generation Agent", "failed", {}, start, str(e))
        state["errors"].append(f"Exception generation: {str(e)}")

    await _persist_stage_state(
        state["run_id"],
        "Exception Generation Agent",
        log["status"],
        "simulation",
        STAGE_PROGRESS["simulation"],
        log["message"],
        result,
    )

    return {
        **state,
        "exceptions": result,
        "current_agent": "simulation",
        "agent_logs": state["agent_logs"] + [log],
    }



async def simulation_node(state: PolicyCompilerState) -> PolicyCompilerState:
    """Node 4: Run simulation scenarios."""
    logger.info(f"[{state['run_id']}] Running Simulation Agent")
    start = datetime.now(timezone.utc)
    await _persist_stage_state(state["run_id"], "Simulation Agent", "running", "simulation", STAGE_PROGRESS["simulation"], "Simulation started")

    try:
        result = await run_simulation_agent(
            state["workflow"],
            state["extracted_rules"],
            state["exceptions"]
        )
        log = _make_log("Simulation Agent", "completed", result, start)
    except Exception as e:
        logger.error(f"Simulation failed: {e}")
        result = {"simulation_summary": {"pass_rate": 0, "workflow_health": "unknown"}, "scenarios": [], "bottlenecks": []}
        log = _make_log("Simulation Agent", "failed", {}, start, str(e))
        state["errors"].append(f"Simulation: {str(e)}")

    await _persist_stage_state(
        state["run_id"],
        "Simulation Agent",
        log["status"],
        "human_review",
        STAGE_PROGRESS["human_review"],
        log["message"],
        result,
    )

    return {
        **state,
        "simulation": result,
        "current_agent": "human_review",
        "agent_logs": state["agent_logs"] + [log],
    }



async def human_review_node(state: PolicyCompilerState) -> PolicyCompilerState:
    """Node 5: Identify items for human review."""
    logger.info(f"[{state['run_id']}] Running Human Review Agent")
    start = datetime.now(timezone.utc)
    await _persist_stage_state(state["run_id"], "Human Review Agent", "running", "human_review", STAGE_PROGRESS["human_review"], "Human review started")

    try:
        result = await run_human_review_agent(
            state["extracted_rules"],
            state["conflicts"],
            state["risks"],
            state["workflow"],
            state["exceptions"],
            state["simulation"]
        )
        log = _make_log("Human Review Agent", "completed", result, start)
    except Exception as e:
        logger.error(f"Human review agent failed: {e}")
        result = {"review_required": False, "review_items": [], "total_review_items": 0}
        log = _make_log("Human Review Agent", "failed", {}, start, str(e))
        state["errors"].append(f"Human review: {str(e)}")

    # Determine final status
    review_required = result.get("review_required", False)
    no_core_outputs = (
        len((state.get("extracted_rules") or {}).get("rules", [])) == 0
        and len((state.get("workflow") or {}).get("steps", [])) == 0
        and (state.get("exceptions") or {}).get("total_exceptions", 0) == 0
    )
    many_errors = len(state.get("errors", [])) >= 3

    if many_errors and no_core_outputs:
        final_status = "failed"
    else:
        final_status = "awaiting_review" if review_required else "completed"

    await _persist_stage_state(
        state["run_id"],
        "Human Review Agent",
        log["status"],
        "complete",
        STAGE_PROGRESS["complete"],
        log["message"],
        result,
    )

    await _persist_stage_state(
        state["run_id"],
        "Human Review Agent",
        "completed" if not many_errors or not no_core_outputs else "failed",
        "complete",
        STAGE_PROGRESS["complete"],
        "Human review completed" if final_status != "failed" else "Pipeline failed"
    )

    return {
        **state,
        "human_review": result,
        "current_agent": "complete",
        "status": final_status,
        "completed_at": datetime.now(timezone.utc).isoformat(),
        "agent_logs": state["agent_logs"] + [log],
    }


# ─── Router ───────────────────────────────────────────────────────────────────

def should_end(state: PolicyCompilerState) -> str:
    """Determine if we should end or continue."""
    if state["current_agent"] == "complete":
        return "end"
    return "continue"


# ─── Graph Builder ─────────────────────────────────────────────────────────────

def build_policy_compiler_graph() -> StateGraph:
    """Build and compile the LangGraph agent pipeline."""
    graph = StateGraph(PolicyCompilerState)

    # Add nodes
    graph.add_node("analysis", analysis_node)
    graph.add_node("workflow_builder", workflow_builder_node)
    graph.add_node("exception_generation", exception_generation_node)
    graph.add_node("simulation", simulation_node)
    graph.add_node("human_review", human_review_node)

    # Set entry point
    graph.set_entry_point("analysis")

    # Add sequential edges
    graph.add_edge("analysis", "workflow_builder")
    graph.add_edge("workflow_builder", "exception_generation")
    graph.add_edge("exception_generation", "simulation")
    graph.add_edge("simulation", "human_review")
    graph.add_edge("human_review", END)

    return graph.compile(checkpointer=MemorySaver())


# Singleton compiled graph
_compiled_graph = None


def get_compiled_graph():
    global _compiled_graph
    if _compiled_graph is None:
        _compiled_graph = build_policy_compiler_graph()
    return _compiled_graph


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _make_log(agent_name: str, status: str, output: dict, start: datetime, error: str | None = None) -> dict:
    """Create an agent execution log entry."""
    end = datetime.now(timezone.utc)
    duration_ms = int((end - start).total_seconds() * 1000)
    return {
        "agent_name": agent_name,
        "status": status,
        "started_at": start.isoformat(),
        "completed_at": end.isoformat(),
        "duration_ms": duration_ms,
        "message": error or f"{agent_name} completed successfully",
        "output_summary": _summarize_output(output)
    }


def _summarize_output(output: dict) -> dict:
    """Create a brief summary of agent output for the log."""
    summary = {}
    if "extracted_rules" in output:
        summary["rules_extracted"] = len(output.get("extracted_rules", {}).get("rules", []))
    if "conflicts" in output and isinstance(output.get("conflicts"), dict):
        summary["conflicts_found"] = output.get("conflicts", {}).get("total_conflicts", 0)
    if "risks" in output and isinstance(output.get("risks"), dict):
        summary["risks_identified"] = len(output.get("risks", {}).get("risks", []))
    if "rules" in output and isinstance(output.get("rules"), list):
        summary["rules_extracted"] = len(output.get("rules", []))
    if "conflicts" in output and isinstance(output.get("conflicts"), list):
        summary["conflicts_found"] = len(output.get("conflicts", []))
    if "risks" in output and isinstance(output.get("risks"), list):
        summary["risks_identified"] = len(output.get("risks", []))
    if "steps" in output:
        summary["workflow_steps"] = len(output.get("steps", []))
    if "exceptions" in output:
        summary["exceptions_generated"] = len(output.get("exceptions", []))
    if "scenarios" in output:
        summary["scenarios_simulated"] = len(output.get("scenarios", []))
    if "review_items" in output:
        summary["review_items"] = len(output.get("review_items", []))
    return summary


async def _persist_stage_state(
    run_id: str,
    agent_name: str,
    log_status: str,
    current_agent: str,
    progress: int,
    message: str,
    output: dict | None = None,
) -> None:
    """Persist live run status and agent log state for the UI."""
    async with AsyncSessionLocal() as db:
        await db.execute(
            update(AgentRun)
            .where(AgentRun.id == run_id)
            .values(
                current_agent=current_agent,
                progress=progress,
                status="running" if current_agent != "complete" else "awaiting_review",
            )
        )

        log_result = await db.execute(
            select(AgentLog)
            .where(AgentLog.run_id == run_id, AgentLog.agent_name == agent_name)
            .order_by(AgentLog.started_at.desc())
        )
        log = log_result.scalar_one_or_none()

        if log is None:
            log = AgentLog(
                run_id=run_id,
                agent_name=agent_name,
                status=log_status,
                message=message,
                output_data=_summarize_output(output or {}),
                duration_ms=None,
            )
            db.add(log)
        else:
            log.status = log_status
            log.message = message
            log.output_data = _summarize_output(output or {})

        await db.commit()


async def run_pipeline(policy_text: str, policy_name: str, run_id: str) -> PolicyCompilerState:
    """Execute the full multi-agent pipeline."""
    graph = get_compiled_graph()

    initial_state: PolicyCompilerState = {
        "policy_text": policy_text,
        "policy_name": policy_name,
        "run_id": run_id,
        "extracted_rules": {},
        "conflicts": {},
        "risks": {},
        "workflow": {},
        "exceptions": {},
        "simulation": {},
        "human_review": {},
        "current_agent": "analysis",
        "agent_logs": [],
        "errors": [],
        "status": "running",
        "started_at": datetime.now(timezone.utc).isoformat(),
        "completed_at": None,
    }

    config = {"configurable": {"thread_id": run_id}}
    final_state = await graph.ainvoke(initial_state, config=config)
    return final_state
