from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from src.config import settings
from src.schemas import user, post
from src.routers.login import router as login_router
from src.routers.register import router as register_router
from src.routers.posts import router as posts_router

app = FastAPI(title="College Connect API")

# Allow requests from local frontend and configured production URL(s)
origins = [
    "http://localhost:5173",  # Vite local dev
    "http://127.0.0.1:5173",  # Vite local dev
]
if settings.FRONTEND_URL:
    origins.extend(
        url.strip().rstrip("/")
        for url in settings.FRONTEND_URL.split(",")
        if url.strip()
    )

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(login_router)
app.include_router(register_router)
app.include_router(posts_router)

@app.get("/")
def test():
    return {"OK!!"}
