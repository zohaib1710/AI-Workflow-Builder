from collections.abc import Iterator

import pytest
from app.api.routes.workflows import get_workflow_edit_service
from app.main import app
from app.schemas.workflow import ValidationErrorDetail, Workflow
from app.services.workflow_edit import (
    WorkflowEditInputValidationError,
    WorkflowEditOutputValidationError,
)
from fastapi.testclient import TestClient

SECRET_SENTINEL = "SUPER_SECRET_TEST_VALUE"


def workflow_payload(*, title: str = "Current workflow") -> dict[str, object]:
    return {
        "title": title,
        "description": "A valid workflow.",
        "nodes": [
            {
                "id": "start",
                "type": "start",
                "title": "Start",
                "description": "Begin.",
                "application": None,
            },
            {
                "id": "end",
                "type": "end",
                "title": "End",
                "description": "Finish.",
                "application": None,
            },
        ],
        "edges": [
            {
                "id": "edge-1",
                "source": "start",
                "target": "end",
                "label": None,
            }
        ],
        "assumptions": [],
        "missingRequirements": ["Confirm owner."],
        "suggestions": [],
    }


class FakeEditService:
    def __init__(self, error: Exception | None = None) -> None:
        self.error = error
        self.calls: list[tuple[str, Workflow]] = []

    async def edit_workflow(
        self,
        instruction: str,
        workflow: Workflow,
    ) -> Workflow:
        self.calls.append((instruction, workflow))
        if self.error is not None:
            raise self.error
        return Workflow.model_validate(workflow_payload(title="Revised workflow"))


@pytest.fixture(autouse=True)
def clear_dependency_overrides() -> Iterator[None]:
    yield
    app.dependency_overrides.clear()


def client() -> TestClient:
    return TestClient(app, raise_server_exceptions=False)


def use_service(service: FakeEditService) -> None:
    app.dependency_overrides[get_workflow_edit_service] = lambda: service


def test_valid_edit_returns_workflow_metadata_and_normalized_service_input() -> None:
    service = FakeEditService()
    use_service(service)

    response = client().post(
        "/api/v1/workflows/edit",
        json={
            "instruction": "  Rename the workflow.  ",
            "workflow": workflow_payload(),
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["workflow"]["title"] == "Revised workflow"
    assert body["generation"]["model"] == "openai/gpt-oss-20b"
    assert isinstance(body["generation"]["durationMs"], int)
    assert body["generation"]["durationMs"] >= 0
    assert len(service.calls) == 1
    instruction, workflow = service.calls[0]
    assert instruction == "Rename the workflow."
    assert workflow.title == "Current workflow"


@pytest.mark.parametrize(
    "payload",
    [
        {"instruction": "   ", "workflow": workflow_payload()},
        {
            "instruction": "Rename the workflow.",
            "workflow": {**workflow_payload(), "nodes": "invalid"},
        },
        {
            "instruction": "Rename the workflow.",
            "workflow": workflow_payload(),
            "apiKey": "secret",
        },
    ],
    ids=["blank-instruction", "malformed-workflow", "unknown-field"],
)
def test_invalid_request_returns_422_before_service(
    payload: dict[str, object],
) -> None:
    service = FakeEditService()
    use_service(service)

    response = client().post("/api/v1/workflows/edit", json=payload)

    assert response.status_code == 422
    assert response.json()["errors"][0]["code"] == "invalid_request"
    assert "secret" not in response.text
    assert service.calls == []


def test_invalid_current_workflow_maps_safely_to_422() -> None:
    service = FakeEditService(
        WorkflowEditInputValidationError(
            [ValidationErrorDetail(code="disconnected_graph", message="safe")]
        )
    )
    use_service(service)

    response = client().post(
        "/api/v1/workflows/edit",
        json={"instruction": "Rename.", "workflow": workflow_payload()},
    )

    assert response.status_code == 422
    assert response.json()["errors"][0]["code"] == "invalid_edit_workflow"


def test_invalid_revised_output_maps_safely_to_502_without_leakage() -> None:
    service = FakeEditService(
        WorkflowEditOutputValidationError(
            [ValidationErrorDetail(code="invalid_json", message=SECRET_SENTINEL)]
        )
    )
    use_service(service)

    response = client().post(
        "/api/v1/workflows/edit",
        json={"instruction": "Rename.", "workflow": workflow_payload()},
    )

    assert response.status_code == 502
    assert response.json()["errors"][0]["code"] == "invalid_edit_output"
    assert SECRET_SENTINEL not in response.text
