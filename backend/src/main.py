from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.api.chat import router as chat_router
from src.api.users import router as users_router
from src.core.config import get_settings
from src.core.firebase import initialize_firebase


@asynccontextmanager
async def lifespan(_: FastAPI):
    initialize_firebase(get_settings())
    yield


app = FastAPI(title="Grad Paddy Backend", lifespan=lifespan)


@app.get("/health")
async def health_check() -> dict[str, str]:
    return {"status": "ok"}


app.include_router(chat_router)
app.include_router(users_router)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Allows your local file origin to connect
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)