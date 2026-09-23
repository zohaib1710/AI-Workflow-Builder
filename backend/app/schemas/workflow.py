from enum import StrEnum
from typing import Annotated

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    StrictInt,
    StrictStr,
    field_validator,
    model_validator,
)

NonEmptyString = Annotated[StrictStr, Field(min_length=1)]


def _strip_required(value: object) -> object:
    if not isinstance(value, str):
        return value
    stripped = value.strip()
    if not stripped:
        raise ValueError("value must not be blank")
    return stripped


def _strip_optional(value: object) -> object:
    if value is None:
        return None
    if not isinstance(value, str):
        return value
    stripped = value.strip()
    if not stripped:
        raise ValueError("value must not be blank")
    return stripped


class StrictModel(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        strict=True,
        populate_by_name=True,
    )


class SupportedNodeType(StrEnum):
    START = "start"
    END = "end"
    TRIGGER = "trigger"
    ACTION = "action"
    DECISION = "decision"
    API = "api"
    DATABASE = "database"
    WAIT = "wait"
    APPROVAL = "approval"
    NOTIFICATION = "notification"


class WorkflowNode(StrictModel):
    id: NonEmptyString
    type: SupportedNodeType
    title: NonEmptyString
    description: NonEmptyString
    application: str | None

    _normalize_strings = field_validator("id", "title", "description", mode="before")(_strip_required)
    _normalize_application = field_validator("application", mode="before")(_strip_optional)

    @field_validator("type", mode="before")
    @classmethod
    def normalize_node_type(cls, value: str | SupportedNodeType) -> SupportedNodeType:
        if isinstance(value, SupportedNodeType):
            return value
        try:
            return SupportedNodeType(value)
        except ValueError as exc:
            raise ValueError("unsupported workflow node type") from exc


class WorkflowEdge(StrictModel):
    id: NonEmptyString
    source: NonEmptyString
    target: NonEmptyString
    label: str | None

    _normalize_strings = field_validator("id", "source", "target", mode="before")(_strip_required)
    _normalize_label = field_validator("label", mode="before")(_strip_optional)


class Workflow(StrictModel):
    title: NonEmptyString
    description: NonEmptyString
    nodes: list[WorkflowNode] = Field(min_length=1)
    edges: list[WorkflowEdge]
    _normalize_strings = field_validator("title", "description", mode="before")(_strip_required)

    @model_validator(mode="after")
    def require_edges_for_multiple_nodes(self) -> "Workflow":
        if len(self.nodes) > 1 and not self.edges:
            raise ValueError("workflows with multiple nodes must contain edges")
        return self


class GenerateWorkflowRequest(StrictModel):
    prompt: NonEmptyString = Field(max_length=2000)

    _normalize_prompt = field_validator("prompt", mode="before")(_strip_required)


class GenerationMetadata(StrictModel):
    model: NonEmptyString
    duration_ms: StrictInt = Field(ge=0, alias="durationMs")

    _normalize_model = field_validator("model", mode="before")(_strip_required)


class GenerateWorkflowResponse(StrictModel):
    workflow: Workflow
    generation: GenerationMetadata


class ValidationErrorDetail(StrictModel):
    code: NonEmptyString
    message: NonEmptyString
    field: str | None = None

    _normalize_strings = field_validator("code", "message", mode="before")(_strip_required)
    _normalize_field = field_validator("field", mode="before")(_strip_optional)


class ErrorResponse(StrictModel):
    detail: NonEmptyString
    errors: list[ValidationErrorDetail] = Field(default_factory=list)

    _normalize_detail = field_validator("detail", mode="before")(_strip_required)
