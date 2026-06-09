from contextlib import asynccontextmanager
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.core.config import get_settings
from src.core.firebase import initialize_firebase
from src.api.schemas.responses import StandardResponse


def _configure_logging() -> None:
    # Uvicorn configures the root handlers, so here we only raise the relevant
    # logger levels for the app and ADK namespaces.
    for logger_name in ("google.adk", "google_adk", "ag_ui_adk", "src"):
        logging.getLogger(logger_name).setLevel(logging.DEBUG)
    logging.getLogger("opentelemetry.context").setLevel(logging.CRITICAL)


_configure_logging()

from src.api import chat, users, sessions, hitl, shortlist, tracker, drafts, groups, cvs, integrations, emails, memory
from src.services.memory_service import MemoryService


@asynccontextmanager
async def lifespan(_: FastAPI):
    initialize_firebase(get_settings())
    try:
        await MemoryService.ensure_index()
    except Exception as exc:
        logging.getLogger(__name__).warning(
            "Memory index check failed at startup (non-fatal — index may already exist): %s", exc
        )
    yield


app = FastAPI(title="Grad Paddy Backend", lifespan=lifespan, redirect_slashes=False)

@app.get("/", tags=["root"])
async def root() -> StandardResponse[dict[str, str]]:
    return StandardResponse(
        message="Grad Paddy API",
        data={
            "version": "1.0.0",
            "docs": "/docs",
        },
    )

@app.get("/health", tags=["root"])
async def health_check() -> dict[str, str]:
    return {"status": "ok"}


app.include_router(chat.router)
app.include_router(users.router)
app.include_router(sessions.router)
app.include_router(hitl.router)
app.include_router(shortlist.router)
app.include_router(tracker.router)
app.include_router(drafts.router)
app.include_router(groups.router)
app.include_router(cvs.router)
app.include_router(integrations.router)
app.include_router(emails.router)
app.include_router(memory.router)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Allows your local file origin to connect
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
