import os
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/copilot")
    redis_url: str = os.getenv("REDIS_URL", "redis://localhost:6379")
    llm_provider: str = os.getenv("LLM_PROVIDER", "ollama")
    ollama_model: str = os.getenv("OLLAMA_MODEL", "llama3.1:8b")
    groq_api_key: str = os.getenv("GROQ_API_KEY", "")
    jwt_secret: str = os.getenv("JWT_SECRET", "change-me")

    class Config:
        env_file = ".env"


settings = Settings()
