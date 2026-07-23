from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes.health import router as health_router
from app.config import get_settings


settings = get_settings()
app = FastAPI(title="AI Workflow Builder API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url],
    allow_credentials=False,
    allow_methods=["GET", "OPTIONS"],
    allow_headers=["Content-Type"],
)

app.include_router(health_router, prefix="/api/v1")


@app.get("/")
def root() -> dict[str, str]:
    """Return a temporary shell response until the health route is added."""
    return {"message": "AI Workflow Builder API shell"}
