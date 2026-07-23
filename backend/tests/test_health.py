from fastapi.testclient import TestClient

from app.config import Settings
from app.main import app


client = TestClient(app)


def test_health_returns_ok() -> None:
    response = client.get("/api/v1/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_app_startup_does_not_require_groq_key() -> None:
    settings = Settings()

    assert settings.groq_api_key == ""
    assert client.get("/api/v1/health").status_code == 200


def test_health_does_not_expose_settings() -> None:
    response = client.get("/api/v1/health")

    assert "GROQ_API_KEY" not in response.text
    assert "groq_api_key" not in response.text
    assert "FRONTEND_URL" not in response.text


def test_cors_allows_only_configured_frontend_origin() -> None:
    allowed = client.options(
        "/api/v1/health",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "GET",
        },
    )
    disallowed = client.options(
        "/api/v1/health",
        headers={
            "Origin": "http://malicious.example",
            "Access-Control-Request-Method": "GET",
        },
    )

    assert allowed.headers["access-control-allow-origin"] == "http://localhost:5173"
    assert "access-control-allow-origin" not in disallowed.headers
