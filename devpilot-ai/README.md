# DevPilot AI

A polished developer-workspace MVP for the DevPilot AI concept. The frontend is a React + TypeScript + Vite app styled with Tailwind CSS, with a Monaco code context panel. A small FastAPI backend provides a health endpoint and bounded, in-memory ZIP intake that lists source paths without extracting or executing repository content.

## Run locally

```sh
cd devpilot-ai
npm install
npm run dev
```

Optional API (Python 3.10+):

```sh
cd backend
python -m venv .venv
# Activate the environment, then:
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

API routes: `GET /api/health`, `POST /api/repositories/upload` (multipart field `file`, ZIP only, maximum 25 MiB). Upload inspection is metadata-only; archive paths are screened and no content is extracted or executed.

## Preview boundaries

The dashboard uses illustrative workspace content so the interface can be explored. AI diagnosis, GitHub authorization, database indexing, patch generation, and sandboxed tests are not connected in this MVP; chat and run controls are interface demonstrations, and the UI labels the workspace as a demo. Do not treat the sample diagnosis, activity, or metrics as results for an uploaded repository. No claim of test verification is made.

## Stack and next steps

React, TypeScript, Vite, Tailwind CSS, Monaco Editor, Python, FastAPI, Pydantic, PostgreSQL/pgvector, Tree-sitter, Docker, Git/GitHub API, Pytest, and Vitest are the intended project stack. The current artifact implements the frontend and a limited intake API. Add authenticated repository records, real Tree-sitter indexing and DB migrations, an explicitly configured LLM tool-calling service, approval-gated patch application, and a hardened isolated execution service before using it on real projects. Docker is included for packaging the API, not as a code-execution sandbox.
