import os
import pytest

os.environ.setdefault("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/copilot")
os.environ.setdefault("LLM_PROVIDER", "ollama")


@pytest.fixture(scope="session")
def db_url():
    return os.environ["DATABASE_URL"]
