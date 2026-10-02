from collections.abc import Callable

import app.auth.supabase as supabase_auth
import httpx
import pytest
from app.auth.supabase import AuthenticationError, get_authenticated_user
from app.config import Settings
from starlette.requests import Request


def request_with_authorization(value: str | None) -> Request:
    headers = [] if value is None else [(b"authorization", value.encode())]
    return Request({"type": "http", "method": "POST", "headers": headers, "path": "/"})


def configured_settings() -> Settings:
    return Settings(
        _env_file=None,
        supabase_url="https://project.example",
        supabase_publishable_key="publishable-test",
    )


@pytest.mark.asyncio
async def test_valid_bearer_is_verified_with_supabase_and_user_id_is_derived(monkeypatch) -> None:
    seen: list[httpx.Request] = []

    def handle(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return httpx.Response(200, json={"id": "verified-user-id", "email": "person@example.com"})

    transport = httpx.MockTransport(handle)
    client_factory: Callable[[], httpx.AsyncClient] = lambda: httpx.AsyncClient(transport=transport)
    monkeypatch.setattr(supabase_auth, "_create_auth_client", client_factory)

    user = await get_authenticated_user(
        request_with_authorization("Bearer valid-token"),
        configured_settings(),
    )

    assert user.id == "verified-user-id"
    assert len(seen) == 1
    assert str(seen[0].url) == "https://project.example/auth/v1/user"
    assert seen[0].headers["authorization"] == "Bearer valid-token"
    assert seen[0].headers["apikey"] == "publishable-test"


@pytest.mark.asyncio
async def test_missing_bearer_is_rejected_without_contacting_supabase(monkeypatch) -> None:
    def unexpected_request() -> httpx.AsyncClient:
        raise AssertionError("Supabase should not be called without a bearer token")

    monkeypatch.setattr(supabase_auth, "_create_auth_client", unexpected_request)

    with pytest.raises(AuthenticationError) as failure:
        await get_authenticated_user(request_with_authorization(None), configured_settings())

    assert failure.value.status_code == 401
    assert failure.value.code == "authentication_required"


@pytest.mark.asyncio
async def test_supabase_rejection_does_not_expose_remote_error(monkeypatch) -> None:
    transport = httpx.MockTransport(
        lambda _: httpx.Response(401, json={"message": "private token detail"}),
    )
    monkeypatch.setattr(
        supabase_auth,
        "_create_auth_client",
        lambda: httpx.AsyncClient(transport=transport),
    )

    with pytest.raises(AuthenticationError) as failure:
        await get_authenticated_user(
            request_with_authorization("Bearer expired-token"),
            configured_settings(),
        )

    assert failure.value.status_code == 401
    assert failure.value.code == "authentication_required"
    assert "private token detail" not in str(failure.value)


@pytest.mark.asyncio
async def test_supabase_unavailable_fails_closed(monkeypatch) -> None:
    def fail_request() -> httpx.AsyncClient:
        async def handler(_: httpx.Request) -> httpx.Response:
            raise httpx.ConnectError("private connection detail")

        return httpx.AsyncClient(transport=httpx.MockTransport(handler))

    monkeypatch.setattr(supabase_auth, "_create_auth_client", fail_request)

    with pytest.raises(AuthenticationError) as failure:
        await get_authenticated_user(
            request_with_authorization("Bearer valid-looking-token"),
            configured_settings(),
        )

    assert failure.value.status_code == 503
    assert failure.value.code == "authentication_service_unavailable"
    assert "private connection detail" not in str(failure.value)
