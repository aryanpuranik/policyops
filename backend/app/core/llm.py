from langchain_openai import ChatOpenAI
from app.core.config import settings


def _resolve_provider_defaults(model: str | None = None, fast: bool = False) -> dict:
    provider = (settings.LLM_PROVIDER or "openai").lower()

    if provider == "openrouter":
        resolved_model = model or (settings.OPENROUTER_MODEL_FAST if fast else settings.OPENROUTER_MODEL)
        return {
            "model": resolved_model,
            "api_key": settings.OPENROUTER_API_KEY or settings.OPENAI_API_KEY,
            "base_url": settings.OPENROUTER_BASE_URL,
            "default_headers": {
                "HTTP-Referer": "http://localhost:3000",
                "X-Title": "PolicyOps",
            },
        }

    resolved_model = model or (settings.OPENAI_MODEL_FAST if fast else settings.OPENAI_MODEL)
    return {
        "model": resolved_model,
        "api_key": settings.OPENAI_API_KEY,
        "base_url": settings.OPENAI_BASE_URL,
        "default_headers": None,
    }


def get_llm(temperature: float = 0.1, model: str | None = None) -> ChatOpenAI:
    """Get a ChatOpenAI instance for agent reasoning."""
    cfg = _resolve_provider_defaults(model=model, fast=False)
    return ChatOpenAI(
        model=cfg["model"],
        temperature=temperature,
        api_key=cfg["api_key"],
        base_url=cfg["base_url"],
        default_headers=cfg["default_headers"],
        streaming=True,
    )


def get_fast_llm(temperature: float = 0.1) -> ChatOpenAI:
    """Get a faster, cheaper model for less complex tasks."""
    cfg = _resolve_provider_defaults(fast=True)
    return ChatOpenAI(
        model=cfg["model"],
        temperature=temperature,
        api_key=cfg["api_key"],
        base_url=cfg["base_url"],
        default_headers=cfg["default_headers"],
    )
