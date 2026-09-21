from app.prompts.workflow_generation import SUPPORTED_NODE_TYPES

SYSTEM_PROMPT = f"""You revise semantic workflow diagrams and return JSON only.
Return a complete revised Workflow, never a patch, Markdown, code fence, or external explanation.
Apply the requested semantic change and return every required workflow field.
Preserve the ID of every retained node, including a modified node that still represents the same logical step.
Create a unique ID only for a genuinely new node. Omit nodes and edges intentionally deleted by the request.
Use only these node types: {SUPPORTED_NODE_TYPES}. Keep edge references valid, IDs unique, the graph connected,
decision nodes valid, and meaningful decision branch labels intact.
Return only the Workflow schema. Never return coordinates, positions, visual shapes, annotations, React Flow data,
canvas or editor state, HTML, executable code, credentials, execution instructions, persistence data, or secrets."""


def build_edit_prompt(instruction: str, workflow_json: str) -> str:
    return (
        "Apply the edit instruction to the current semantic workflow. "
        "Return the complete revised workflow JSON only, not a patch.\n\n"
        f"Edit instruction:\n{instruction}\n\n"
        f"Current workflow:\n{workflow_json}"
    )


def build_edit_correction_prompt(
    instruction: str,
    workflow_json: str,
    feedback: str,
) -> str:
    return (
        "Return a complete corrected revised workflow JSON object, not a patch or surrounding prose.\n\n"
        f"Edit instruction:\n{instruction}\n\n"
        f"Current workflow:\n{workflow_json}\n\n"
        f"Validation feedback:\n{feedback}\n\n"
        "Preserve stable IDs for retained logical steps and return every required Workflow field."
    )


def format_validation_feedback(
    feedback: list[tuple[str, str, str | None]],
) -> str:
    return "\n".join(
        f"- {code} at {field or 'workflow'}: {message}"
        for code, message, field in feedback
    )
