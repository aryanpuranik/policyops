"""
Policy-to-Operations Compiler
FastAPI Application Entry Point
"""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os

from app.core.config import settings
from app.core.database import init_db
from app.api.policies import router as policies_router
from app.api.agent_runs import router as runs_router
from app.api.workflows import router as workflows_router
from app.api.execution import router as execution_router
from app.api.reviews import router as reviews_router
from app.api.dashboard import router as dashboard_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize resources on startup."""
    logger.info("Starting Policy-to-Operations Compiler API")
    await init_db()
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    os.makedirs(settings.CHROMA_PERSIST_DIR, exist_ok=True)
    logger.info("Database initialized")
    yield
    logger.info("Shutting down")


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Multi-agent AI system that converts business policies into operational workflows",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(policies_router)
app.include_router(runs_router)
app.include_router(workflows_router)
app.include_router(execution_router)
app.include_router(reviews_router)
app.include_router(dashboard_router)


@app.get("/")
async def root():
    return {
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "status": "operational",
        "agents": [
            "Policy Analysis Agent",
            "Workflow Builder Agent",
            "Exception Generation Agent",
            "Simulation Agent",
            "Human Review Agent"
        ]
    }


@app.get("/health")
async def health():
    return {"status": "healthy", "version": settings.APP_VERSION}
