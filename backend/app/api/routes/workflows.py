from time import perf_counter

from fastapi import APIRouter, Depends

from app.config import Settings, get_settings
from app.providers.factory import create_ai_provider
from app.schemas.workflow import (
    GenerateWorkflowRequest,
    GenerateWorkflowResponse,
    GenerationMetadata,
)
from app.services.workflow_generation import WorkflowGenerationService

router = APIRouter(prefix="/api/v1/workflows", tags=["workflows"])


def get_workflow_generation_service(
    settings: Settings = Depends(get_settings),  # noqa: B008
) -> WorkflowGenerationService:
    return WorkflowGenerationService(create_ai_provider(settings))


@router.post("/generate", response_model=GenerateWorkflowResponse)
async def generate_workflow(
    request: GenerateWorkflowRequest,
    settings: Settings = Depends(get_settings),  # noqa: B008
    service: WorkflowGenerationService = Depends(get_workflow_generation_service),  # noqa: B008
) -> GenerateWorkflowResponse:
    started_at = perf_counter()
    workflow = await service.generate_workflow(request.prompt)
    duration_ms = max(0, int((perf_counter() - started_at) * 1000))
    return GenerateWorkflowResponse(
        workflow=workflow,
        generation=GenerationMetadata(model=settings.ai_model, durationMs=duration_ms),
    )
