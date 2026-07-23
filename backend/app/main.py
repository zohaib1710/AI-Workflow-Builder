from fastapi import FastAPI


app = FastAPI(title="AI Workflow Builder API", version="0.1.0")


@app.get("/")
def root() -> dict[str, str]:
    """Return a temporary shell response until the health route is added."""
    return {"message": "AI Workflow Builder API shell"}
