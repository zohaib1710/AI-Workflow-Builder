class AIProviderError(Exception):
    """Base class for safe provider failures."""


class AIProviderConfigurationError(AIProviderError):
    """The provider configuration is unsupported or invalid."""


class AIProviderCredentialError(AIProviderError):
    """Provider credentials are missing or rejected."""


class AIProviderRateLimitError(AIProviderError):
    """The provider rate limit was reached."""


class AIProviderTimeoutError(AIProviderError):
    """The provider request timed out."""


class AIProviderConnectionError(AIProviderError):
    """The provider could not be reached."""


class AIProviderAPIError(AIProviderError):
    """The provider returned an unsuccessful response."""


class AIProviderResponseError(AIProviderError):
    """The provider returned an unusable successful response."""
