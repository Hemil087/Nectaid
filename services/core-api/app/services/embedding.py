"""
Embedding generation via Vertex AI text-embedding-004.
Single public function: embed_need_text(text) -> list[float]
"""
from __future__ import annotations

import asyncio
import json
import os

import vertexai
from vertexai.language_models import TextEmbeddingInput, TextEmbeddingModel

EMBEDDING_DIMS = 768
_INITIALIZED = False


def _ensure_vertexai() -> None:
    global _INITIALIZED
    if _INITIALIZED:
        return
    project = os.getenv("PROJECT_ID", "nectaid-dev")
    location = os.getenv("REGION", "asia-south1")
    credentials = None
    sa_json = os.getenv("GOOGLE_APPLICATION_CREDENTIALS_JSON") or os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON")
    if sa_json:
        from google.oauth2 import service_account  # type: ignore[import-untyped]
        info = json.loads(sa_json.strip().strip("'\""))
        credentials = service_account.Credentials.from_service_account_info(
            info,
            scopes=["https://www.googleapis.com/auth/cloud-platform"],
        )
    vertexai.init(project=project, location=location, credentials=credentials)
    _INITIALIZED = True


async def embed_need_text(text: str) -> list[float]:
    """
    Generate a 768-dim embedding using text-embedding-004.
    Raises on failure — caller is responsible for deciding whether to swallow.
    """
    _ensure_vertexai()
    model = TextEmbeddingModel.from_pretrained("text-embedding-004")
    inputs = [TextEmbeddingInput(text=text, task_type="RETRIEVAL_DOCUMENT")]
    results = await asyncio.to_thread(model.get_embeddings, inputs)
    return list(results[0].values)
