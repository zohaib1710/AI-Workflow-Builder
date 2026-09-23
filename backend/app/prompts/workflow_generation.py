from app.schemas.workflow import SupportedNodeType

SUPPORTED_NODE_TYPES = ", ".join(node_type.value for node_type in SupportedNodeType)

SYSTEM_PROMPT = f"""You generate semantic workflow diagrams as JSON only.
Return exactly the workflow schema with no Markdown, code fences, or surrounding prose.
Use only these node types: {SUPPORTED_NODE_TYPES}.
Keep node and edge IDs unique, reference existing node IDs, avoid self-referencing edges and disconnected sections,
give decision nodes at least two outgoing edges with meaningful labels, keep start nodes free of incoming edges,
and keep end nodes free of outgoing edges. Generate no coordinates, positions, React Flow state, HTML, executable code,
credentials, tokens, execution metadata, or persistence identifiers. Keep titles concise and descriptions clear.
Render all values as plain text and keep the workflow compact enough to complete the entire JSON document."""


def build_user_prompt(prompt: str) -> str:
    return f"Create a workflow for this request. Return the complete workflow JSON only.\n\nRequest:\n{prompt}"


def build_correction_prompt(prompt: str, feedback: str) -> str:
    return (
        "Return a complete corrected workflow JSON object, not a patch and not surrounding prose.\n\n"
        f"Original request:\n{prompt}\n\nValidation feedback:\n{feedback}\n\n"
        f"Use only these node types: {SUPPORTED_NODE_TYPES}. Return all required workflow fields."
    )


def format_validation_feedback(feedback: list[tuple[str, str, str | None]]) -> str:
    return "\n".join(
        f"- {code} at {field or 'workflow'}: {message}" for code, message, field in feedback
    )
