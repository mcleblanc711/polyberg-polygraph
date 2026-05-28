"""FastAPI backend for Polygraph. Wraps ledger/services.py as a JSON API."""

from pathlib import Path
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.api.routes.status import router as status_router
from app.api.routes.trades import router as trades_router
from app.api.routes.decisions import router as decisions_router
from app.api.routes.attributions import router as attributions_router
from app.api.routes.postmortems import router as postmortems_router
from app.api.routes.import_routes import router as import_router
from app.api.routes.export_routes import router as export_router

app = FastAPI(title="Polygraph API", version="0.1.0")

app.include_router(status_router, prefix="/api")
app.include_router(trades_router, prefix="/api")
app.include_router(decisions_router, prefix="/api")
app.include_router(attributions_router, prefix="/api")
app.include_router(postmortems_router, prefix="/api")
app.include_router(import_router, prefix="/api")
app.include_router(export_router, prefix="/api")

# Serve the compiled React SPA if the dist directory exists.
_dist = Path(__file__).parent.parent / "ui" / "dist"
if _dist.exists():
    app.mount("/", StaticFiles(directory=str(_dist), html=True), name="ui")


def start() -> None:
    import uvicorn
    uvicorn.run("app.api.main:app", host="0.0.0.0", port=8000, reload=True)
