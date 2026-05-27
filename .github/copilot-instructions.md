# Copilot Instructions for PolicyOps

## Repo focus and active apps
- Primary stack is `backend/` (FastAPI + SQLAlchemy + LangGraph) + `policy-compiler/` (Next.js App Router).
- Start these with `./start-backend.sh` and `./start-frontend.sh` from repo root.
- `exception-ops/` and `frontend/` exist, but current root scripts target `policy-compiler/`.

## Architecture that matters
- Policy ingestion and orchestration flow:
  1) upload file in `backend/app/api/policies.py`
  2) parse text in `backend/app/services/document_parser.py`
  3) background pipeline via `_run_pipeline_background(...)`
  4) LangGraph execution in `backend/app/orchestrator/graph.py`
  5) persisted outputs in `Workflow` + `AgentRun` tables (`backend/app/core/database.py`)
- Agents are sequential graph nodes (`analysis -> workflow_builder -> exception_generation -> simulation -> human_review`), not ad-hoc prompt chaining.
- Frontend consumes backend through Axios (`policy-compiler/src/lib/api.ts`) and Next rewrites (`policy-compiler/next.config.ts`) from `/api/*` to `http://localhost:8000/api/*`.

## Data and status conventions (do not break)
- `AgentRun.status` is used across API + UI (`pending|running|completed|failed|awaiting_review|published`).
- `Workflow.status` lifecycle is enforced by APIs: `draft/awaiting_review -> approved -> published -> archived` (with `rejected` path).
- Published/archived workflows are effectively read-only (`read_only` guard in `backend/app/api/workflows.py`).
- `graph_state` holds summary + `human_review` payload that the review UI reads (`backend/app/api/reviews.py`).

## LLM/agent implementation patterns
- Use provider abstraction in `backend/app/core/llm.py` (`LLM_PROVIDER=openai|openrouter`); don’t instantiate raw clients in route files.
- Agent outputs must be JSON-shaped and resilient to malformed model output (see fallback parsing in `backend/app/agents/analysis_agent.py`).
- Pipeline nodes log progress through `_persist_stage_state(...)`; if you add/rename a stage, update:
  - `STAGE_PROGRESS` + graph edges in `backend/app/orchestrator/graph.py`
  - agent-name mappings in `policy-compiler/src/app/runs/[id]/page.tsx`

## Execution + human-in-loop specifics
- Execution endpoints are nested under workflows (`/api/workflows/{workflow_id}/execution...`) in `backend/app/api/execution.py`.
- Input collection is heuristic from workflow content (`_analyze_workflow_for_inputs`), then email round-trip (`app/services/email_service.py`) and decision evaluation.
- Human review resolution can mutate workflow fields and normalize run statuses (`normalize_run_status` in `backend/app/api/reviews.py`).

## Developer workflow
- Backend setup: `cd backend && python -m venv venv && source venv/bin/activate && pip install -r requirements.txt`.
- Backend run: `uvicorn app.main:app --reload --host 0.0.0.0 --port 8000` (or `./start-backend.sh`).
- Frontend setup/run: `cd policy-compiler && npm install && npm run dev` (or `./start-frontend.sh`).
- Key env vars in `backend/.env`: `OPENAI_API_KEY`, `LLM_PROVIDER`, provider model/base URL vars, `DATABASE_URL`, `CHROMA_PERSIST_DIR`, `UPLOAD_DIR`.

## Change guidance for agents
- Prefer minimal, end-to-end fixes that preserve current API shapes expected by `policy-compiler/src/lib/api.ts`.
- Keep async SQLAlchemy style (`AsyncSession`, `select`, `await db.execute(...)`) consistent with existing route files.
- If adding schema fields, mirror existing lightweight SQLite migration pattern in `init_db()` (`_ensure_*_columns`).
- Validate behavior using API docs at `http://localhost:8000/docs` and run pages (`/runs/[id]`, `/workflows/[id]`) that depend on live status transitions.
