from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # App
    APP_NAME: str = "Policy-to-Operations Compiler"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False

    # OpenAI
    LLM_PROVIDER: str = "openai"  # openai | openrouter
    OPENAI_API_KEY: str = ""
    OPENAI_BASE_URL: str = "https://api.openai.com/v1"
    OPENAI_MODEL: str = "gpt-4o-mini"
    OPENAI_MODEL_FAST: str = "gpt-4o-mini"

    # OpenRouter
    OPENROUTER_API_KEY: str = ""
    OPENROUTER_BASE_URL: str = "https://openrouter.ai/api/v1"
    OPENROUTER_MODEL: str = "openai/gpt-4o-mini"
    OPENROUTER_MODEL_FAST: str = "openai/gpt-4o-mini"

    # Database
    DATABASE_URL: str = "sqlite+aiosqlite:///./policy_compiler.db"

    # ChromaDB
    CHROMA_PERSIST_DIR: str = "./chroma_db"

    # CORS
    ALLOWED_ORIGINS: list[str] = ["http://localhost:3000", "http://localhost:3001", "http://localhost:3002", "http://localhost:3003", "http://localhost:5173"]

    # File upload
    MAX_FILE_SIZE_MB: int = 50
    UPLOAD_DIR: str = "./uploads"

    # Email delivery (execution input submissions)
    EMAIL_SMTP_HOST: str = ""
    EMAIL_SMTP_PORT: int = 587
    EMAIL_SMTP_USERNAME: str = ""
    EMAIL_SMTP_PASSWORD: str = ""
    EMAIL_SMTP_USE_TLS: bool = True
    EMAIL_FROM_ADDRESS: str = ""
    EMAIL_FROM_NAME: str = "PolicyOps"
    EMAIL_IMAP_HOST: str = "imap.gmail.com"
    EMAIL_IMAP_PORT: int = 993
    EMAIL_IMAP_USERNAME: str = ""
    EMAIL_IMAP_PASSWORD: str = ""
    EMAIL_IMAP_MAILBOX: str = "INBOX"

    class Config:
        env_file = ".env"
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
