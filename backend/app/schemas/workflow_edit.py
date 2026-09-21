from pydantic import Field, StrictStr, field_validator

from app.schemas.workflow import GenerationMetadata, StrictModel, Workflow


class EditWorkflowRequest(StrictModel):
    instruction: StrictStr = Field(min_length=1, max_length=2000)
    workflow: Workflow

    @field_validator("instruction", mode="before")
    @classmethod
    def normalize_instruction(cls, value: object) -> object:
        if not isinstance(value, str):
            return value
        normalized = value.strip()
        if not normalized:
            raise ValueError("instruction must not be blank")
        return normalized


class EditWorkflowResponse(StrictModel):
    workflow: Workflow
    generation: GenerationMetadata
