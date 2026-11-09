from pathlib import Path
from zipfile import BadZipFile, ZipFile

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="DevPilot AI API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

MAX_UPLOAD_BYTES = 25 * 1024 * 1024
ALLOWED_SUFFIXES = {".py", ".js", ".jsx", ".ts", ".tsx", ".java", ".c", ".h", ".cpp", ".hpp", ".json", ".toml", ".yml", ".yaml", ".md", ".txt"}


@app.get("/api/health")
def health():
    return {"status": "ok", "mode": "intake-only", "analysis_available": False}


@app.post("/api/repositories/upload")
async def upload_repository(file: UploadFile = File(...)):
    """Inspect a ZIP in memory and report supported source file paths; never extracts or executes it."""
    if not file.filename or not file.filename.lower().endswith(".zip"):
        raise HTTPException(415, "Upload a .zip archive")
    payload = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(payload) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, "Archive exceeds the 25 MiB upload limit")
    try:
        import io
        with ZipFile(io.BytesIO(payload)) as archive:
            paths = [
                item.filename for item in archive.infolist()
                if not item.is_dir()
                and Path(item.filename).suffix.lower() in ALLOWED_SUFFIXES
                and not item.filename.startswith(("/", "\\"))
                and ".." not in Path(item.filename).parts
            ]
    except BadZipFile as exc:
        raise HTTPException(400, "The uploaded file is not a valid ZIP archive") from exc
    return {
        "filename": file.filename,
        "source_files": paths[:5000],
        "source_file_count": len(paths),
        "status": "intake_complete",
        "message": "Files were listed only. No repository analysis or code execution was performed.",
    }
