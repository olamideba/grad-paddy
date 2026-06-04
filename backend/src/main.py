from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.api import chat, users, sessions, hitl, shortlist, tracker, drafts, groups
from src.core.config import get_settings
from src.core.firebase import initialize_firebase
from src.api.schemas.responses import StandardResponse


@asynccontextmanager
async def lifespan(_: FastAPI):
    initialize_firebase(get_settings())
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


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Allows your local file origin to connect
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
