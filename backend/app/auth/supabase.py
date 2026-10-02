from dataclasses import dataclass

import httpx
from fastapi import Depends, Request

from app.config import Settings, get_settings


@dataclass(frozen=True)
class AuthenticatedUser:
    id: str


class AuthenticationError(Exception):
    def __init__(self, status_code: int, code: str) -> None:
        self.status_code = status_code
        self.code = code
        super().__init__(code)


def _create_auth_client() -> httpx.AsyncClient:
    return httpx.AsyncClient(timeout=httpx.Timeout(5.0))


async def get_authenticated_user(
    request: Request,
    settings: Settings = Depends(get_settings),  # noqa: B008
) -> AuthenticatedUser:
    authorization = request.headers.get("Authorization", "")
    scheme, separator, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not separator or not token.strip():
        raise AuthenticationError(401, "authentication_required")

    supabase_url = settings.supabase_url.rstrip("/")
    publishable_key = settings.supabase_publishable_key.get_secret_value()
    if not supabase_url or not publishable_key:
        raise AuthenticationError(503, "authentication_service_unavailable")

    try:
        async with _create_auth_client() as client:
            response = await client.get(
                f"{supabase_url}/auth/v1/user",
                headers={
                    "apikey": publishable_key,
                    "Authorization": f"Bearer {token.strip()}",
                },
            )
    except httpx.HTTPError as exc:
        raise AuthenticationError(503, "authentication_service_unavailable") from exc

    if response.status_code in (401, 403):
        raise AuthenticationError(401, "authentication_required")
    if response.status_code != 200:
        raise AuthenticationError(503, "authentication_service_unavailable")

    try:
        user = response.json()
    except ValueError as exc:
        raise AuthenticationError(503, "authentication_service_unavailable") from exc

    user_id = user.get("id") if isinstance(user, dict) else None
    if not isinstance(user_id, str) or not user_id.strip():
        raise AuthenticationError(503, "authentication_service_unavailable")

    return AuthenticatedUser(id=user_id)
