import asyncio
from typing import Any, Optional
from fastapi import WebSocket


class ConnectionManager:
    """In-memory WebSocket connection manager for live feed/comment broadcasts."""

    def __init__(self) -> None:
        self.active_connections: list[WebSocket] = []
        self._loop: Optional[asyncio.AbstractEventLoop] = None

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self._loop = asyncio.get_running_loop()
        if websocket not in self.active_connections:
            self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket) -> None:
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast_json(self, payload: dict[str, Any]) -> None:
        if not self.active_connections:
            return
        dead: list[WebSocket] = []
        for connection in list(self.active_connections):
            try:
                await connection.send_json(payload)
            except Exception:
                dead.append(connection)
        for connection in dead:
            self.disconnect(connection)

    def broadcast_json_sync(self, payload: dict[str, Any]) -> None:
        """Schedule a JSON broadcast from synchronous FastAPI route handlers."""
        if not self.active_connections or self._loop is None or self._loop.is_closed():
            return
        try:
            running_loop = asyncio.get_running_loop()
            if running_loop is self._loop:
                self._loop.create_task(self.broadcast_json(payload))
                return
        except RuntimeError:
            pass

        try:
            asyncio.run_coroutine_threadsafe(self.broadcast_json(payload), self._loop)
        except RuntimeError:
            pass


ws_manager = ConnectionManager()
