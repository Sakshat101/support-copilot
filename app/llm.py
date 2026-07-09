"""Swappable free LLM client: Ollama (local, offline) or Groq (free tier, hosted)."""
from app.config import settings


def chat(messages: list[dict], model: str | None = None) -> str:
    if settings.llm_provider == "groq":
        from groq import Groq
        client = Groq(api_key=settings.groq_api_key)
        resp = client.chat.completions.create(
            model=model or "llama-3.3-70b-versatile",
            messages=messages,
        )
        return resp.choices[0].message.content

    import ollama
    resp = ollama.chat(model=model or settings.ollama_model, messages=messages)
    return resp["message"]["content"]
