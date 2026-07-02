from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from contextlib import asynccontextmanager

from app.routes.notifications import router
from app.database.db import create_tables
from fastapi import WebSocket

from app.websocket.manager import manager


@asynccontextmanager
async def lifespan(_):
    create_tables()
    yield


app = FastAPI(
    title="Notification API",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

app.include_router(router)


@app.get("/")
def home():
    return {
        "message":
        "Notification API Running"
    }

@app.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket
):
    await manager.connect(
        websocket
    )

    try:
        while True:
            await websocket.receive_text()

    except Exception:
        manager.disconnect(
            websocket
        )