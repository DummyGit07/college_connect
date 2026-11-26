from typing import Optional
from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect
from jose import JWTError, jwt

from src.config import settings
from src.database.db import SessionLocal
from src.schemas.user import User
from src.services.ws_manager import ws_manager

router = APIRouter(tags=["ws"])


def _authenticate_ws_token(token: Optional[str]) -> Optional[User]:
    if not token:
        return None
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        email: Optional[str] = payload.get("sub")
        user_db_id: Optional[int] = payload.get("id")
        if not email or not user_db_id:
            return None
    except JWTError:
        return None

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.id == user_db_id).first()
        if not user or not user.is_active or not user.is_onboarded:
            return None
        return user
    finally:
        db.close()


@router.websocket("/api/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    token: Optional[str] = Query(default=None),
) -> None:
    user = _authenticate_ws_token(token)
    if user is None:
        await websocket.close(code=4001)
        return

    await ws_manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
    except Exception:
        ws_manager.disconnect(websocket)
