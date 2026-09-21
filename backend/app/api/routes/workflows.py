from time import perf_counter

from fastapi import APIRouter, Depends

from app.config import Settings, get_settings
from app.providers.factory import create_ai_provider
from app.schemas.workflow import (
    GenerateWorkflowRequest,
    GenerateWorkflowResponse,
    GenerationMetadata,
)
from app.schemas.workflow_edit import EditWorkflowRequest, EditWorkflowResponse
from app.services.workflow_edit import WorkflowEditService
from app.services.workflow_generation import WorkflowGenerationService

router = APIRouter(prefix="/api/v1/workflows", tags=["workflows"])


def get_workflow_generation_service(
    settings: Settings = Depends(get_settings),  # noqa: B008
) -> WorkflowGenerationService:
    return WorkflowGenerationService(create_ai_provider(settings))


def get_workflow_edit_service(
    settings: Settings = Depends(get_settings),  # noqa: B008
) -> WorkflowEditService:
    return WorkflowEditService(create_ai_provider(settings))


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


@router.post("/edit", response_model=EditWorkflowResponse)
async def edit_workflow(
    request: EditWorkflowRequest,
    settings: Settings = Depends(get_settings),  # noqa: B008
    service: WorkflowEditService = Depends(get_workflow_edit_service),  # noqa: B008
) -> EditWorkflowResponse:
    started_at = perf_counter()
    workflow = await service.edit_workflow(request.instruction, request.workflow)
    duration_ms = max(0, int((perf_counter() - started_at) * 1000))
    return EditWorkflowResponse(
        workflow=workflow,
        generation=GenerationMetadata(model=settings.ai_model, durationMs=duration_ms),
    )
