from typing import Protocol


class AIProvider(Protocol):
    """Vendor-independent contract for structured AI candidate generation."""

    is_configured: bool

    async def generate_structured(
        self,
        *,
        system_prompt: str,
        user_prompt: str,
        schema: dict[str, object],
    ) -> str:
        """Return untrusted candidate content from the configured provider."""
        ...
