# PolicyOps

**Turn any business policy document into a production-ready operational workflow — automatically.**

PolicyOps is a multi-agent AI system that ingests raw policy documents (PDFs, Word files, plain text) and produces structured, executable workflows complete with decision trees, risk scoring, exception handling, and human-in-the-loop review. What used to take compliance teams weeks now takes minutes.

---

## The Problem

Every organization has policies — procurement rules, compliance mandates, HR procedures, security frameworks. But policies are written in natural language. Turning them into operational processes that teams can actually follow requires weeks of manual work: reading, interpreting, mapping decision logic, identifying edge cases, and getting approvals.

Most of this work is mechanical. It shouldn't require a human.

## What PolicyOps Does

Upload a policy document. A coordinated pipeline of five specialized AI agents runs in sequence:

1. **Analysis Agent** — Extracts rules, actors, thresholds, and decision conditions. Identifies conflicts and scores compliance risk in a single structured pass.
2. **Workflow Builder Agent** — Produces a step-by-step operational workflow with a visual decision tree (React Flow-compatible nodes and edges).
3. **Exception Generation Agent** — Generates edge cases that the workflow must handle: VIP scenarios, fraud signals, missing data, escalation paths.
4. **Simulation Agent** — Runs synthetic test scenarios through the workflow and surfaces bottlenecks and failure modes before the workflow reaches operations.
5. **Human Review Agent** — Identifies the decisions that genuinely require human judgment and routes them to reviewers with full context — so humans focus only on what AI shouldn't decide alone.

The result: a versioned, auditable workflow ready for approval, publication, and execution.

---

## Demo

```
Upload Policy → Agent Pipeline Runs (live-streamed) → Workflow Generated
     ↓                                                        ↓
  /upload                                           /workflows/:id
                                                  Visual decision tree
                                                  Risk analysis
                                                  Exception cases
                                                  Simulation results
                                                        ↓
                                              Human Review → Approve/Reject
                                                        ↓
                                              Publish to Employee Portal
                                                        ↓
                                              Execute with email-based input collection
```

---

## Architecture

### Agent Pipeline (LangGraph)

Each agent is a node in a directed LangGraph state machine. State flows forward — each agent receives the outputs of all previous agents and appends its own. The full pipeline runs in a background task; the frontend subscribes to live updates via Server-Sent Events.

```
PolicyCompilerState
│
├── analysis_node          → extracted_rules, conflicts, risks
├── workflow_builder_node  → workflow (steps + decision_tree)
├── exception_node         → exceptions
├── simulation_node        → simulation_results
└── human_review_node      → human_review (review_items, blocking flags)
```

### Backend

```
backend/
├── app/
│   ├── main.py                    # FastAPI app, CORS, router registration
│   ├── core/
│   │   ├── config.py              # Pydantic settings (env-driven)
│   │   ├── database.py            # Async SQLAlchemy engine + session factory
│   │   └── llm.py                 # LLM provider abstraction (OpenAI / OpenRouter)
│   ├── models/
│   │   ├── policy.py              # PolicyDocument ORM model
│   │   ├── run.py                 # AgentRun + AgentLog ORM models
│   │   ├── workflow.py            # Workflow + ExecutionRun + ExecutionDecision
│   │   └── review.py              # HumanReview ORM model
│   ├── schemas/
│   │   └── review.py              # Pydantic request/response schemas
│   ├── api/
│   │   ├── policies.py            # Upload, list, delete policies
│   │   ├── agent_runs.py          # Run status, SSE stream, retry
│   │   ├── workflows.py           # CRUD, approve, publish, export
│   │   ├── execution.py           # Workflow execution engine
│   │   ├── reviews.py             # Human review resolution
│   │   └── dashboard.py           # Stats, activity feed
│   ├── agents/
│   │   ├── analysis_agent.py      # Policy extraction + conflict + risk (unified)
│   │   ├── workflow_builder_agent.py
│   │   ├── exception_generation_agent.py
│   │   ├── simulation_agent.py
│   │   ├── human_review_agent.py
│   │   └── legacy/                # Archived standalone agents (superseded)
│   ├── orchestrator/
│   │   └── graph.py               # LangGraph pipeline definition
│   └── services/
│       ├── document_parser.py     # PDF / DOCX / TXT extraction
│       └── email_service.py       # SMTP + IMAP for execution input collection
├── .env.example
└── requirements.txt
```

### Frontend

```
policy-compiler/
└── src/
    ├── app/                        # Next.js App Router pages
    │   ├── page.tsx                # Landing page
    │   ├── dashboard/              # Metrics, activity feed, recent runs
    │   ├── upload/                 # Policy upload with drag-and-drop
    │   ├── runs/                   # Agent run list + live log stream
    │   ├── workflows/              # Workflow library + detail + execution
    │   ├── employee-portal/        # Published workflow library for end users
    │   └── settings/
    ├── components/
    │   ├── layout/sidebar.tsx      # Navigation
    │   ├── workflow/WorkflowGraph.tsx   # React Flow decision tree
    │   └── execution/ExecutionWorkspace.tsx
    ├── lib/
    │   ├── api.ts                  # Axios API client (all endpoints)
    │   └── utils.ts                # Formatting utilities
    └── types/
        ├── index.ts                # TypeScript interfaces for all API types
        └── global.d.ts
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Backend** | FastAPI, SQLAlchemy 2.0 (async), SQLite |
| **Agent Framework** | LangGraph, LangChain |
| **LLM** | OpenAI GPT-4o (configurable via OpenRouter) |
| **Document Parsing** | pdfplumber, python-docx |
| **Vector Store** | ChromaDB |
| **Real-time** | Server-Sent Events (SSE) |
| **Frontend** | Next.js 15, React 19, TypeScript |
| **Styling** | Tailwind CSS v3, Framer Motion |
| **UI Primitives** | Radix UI |
| **Workflow Visualization** | React Flow |

---

## Getting Started

### Prerequisites

- Python 3.11+
- Node.js 18+
- An OpenAI API key

### 1. Clone and configure

```bash
git clone https://github.com/your-username/policyops.git
cd policyops

cp backend/.env.example backend/.env
# Open backend/.env and set OPENAI_API_KEY
```

### 2. Start the backend

```bash
./start-backend.sh
# FastAPI runs at  http://localhost:8000
# API docs at      http://localhost:8000/docs
```

### 3. Start the frontend

```bash
./start-frontend.sh
# App runs at http://localhost:3000
```

Or use Make:

```bash
make setup   # install all dependencies
make dev     # start backend + frontend together
```

---

## Key Design Decisions

**Why LangGraph over a single prompt?**
Each agent in the pipeline has a distinct responsibility and a different output schema. LangGraph enforces this separation — agents can't bleed into each other's outputs, the state is typed, and the graph is inspectable. Adding or replacing a node doesn't require touching unrelated logic.

**Why not stream directly from the LLM?**
The pipeline runs in a FastAPI background task. The frontend polls via SSE on a separate connection. This means the pipeline is decoupled from the HTTP request lifecycle — it survives client disconnects, can be retried, and the full log history is persisted in SQLite.

**Why SQLite?**
For the scope of this project, SQLite with async SQLAlchemy is fast enough and requires zero infrastructure. The schema migration pattern (`_ensure_*_columns`) allows the database to evolve without a migration framework. Swapping to Postgres requires only a `DATABASE_URL` change.

**Human-in-the-loop as a first-class citizen**
The Human Review Agent doesn't just flag items — it structures each review item with a question, context, AI recommendation, confidence score, and the set of workflow steps it affects. This gives reviewers everything they need to make a decision without re-reading the original policy.

---

## Workflow Lifecycle

```
uploaded policy
     │
     ▼
  draft ──────────────────────────────► rejected
     │                                      │
     ▼                                      │
awaiting_review ──── human approve ──► approved
                                           │
                                           ▼
                                       published ──► archived
```

Published workflows are read-only and exposed to the Employee Portal, where end users can execute them. Execution triggers an email-based input collection flow: the system emails a structured form to the relevant contact, polls for a reply, extracts values, and evaluates decision logic.

---

## Supported Document Formats

| Format | Extension |
|---|---|
| PDF | `.pdf` |
| Word | `.docx`, `.doc` |
| Plain text / Markdown | `.txt`, `.md` |

---

## Roadmap

- [ ] Postgres support for production deployments
- [ ] Webhook notifications on workflow status changes
- [ ] Multi-tenant access control (org-level isolation)
- [ ] Workflow versioning with diff view
- [ ] Native DOCX export with proper formatting
- [ ] Support for structured policy formats (JSON, YAML)

---

## License

MIT
