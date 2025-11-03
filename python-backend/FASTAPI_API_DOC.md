# FastAPI Backend API Documentation

This document describes the backend API for the 5‑step Script Workflow (Generate → Enhance with AI → Human Validation → Finalize & Run → AI Insights), implemented with FastAPI, async SQLAlchemy, and JWT authentication.

It complements `python-backend/README.md` by focusing on endpoint design, request/response contracts, and operational guidance.

## Overview

- Stack: FastAPI, Pydantic, SQLAlchemy (async), PostgreSQL, JWT auth, Uvicorn.
- Structure: Routers per domain (`auth`, `scripts`, `script_ai`, `test_runs`, `ai_insights`) with service/repository separation.
- Goals: Clear domain boundaries, reliable validation and error handling, observability, and easy extension for AI features.

## Folder Layout (expected)

```
python-backend/
  app/
    main.py
    config.py
    security.py
    session.py
    models.py
    repositories/
      script_repository.py
      test_run_repository.py
    schemas/
      script.py
      test_run.py
    routers/
      auth.py
      scripts.py
      script_ai.py
      test_runs.py
      ai_insights.py
```

## Configuration

- `DATABASE_URL`: PostgreSQL DSN (e.g. `postgresql+asyncpg://user:pass@localhost:5432/dbname`).
- `JWT_SECRET`: Secret for signing JWT.
- `JWT_ALGORITHM`: JWT algorithm (e.g. `HS256`).
- `JWT_EXPIRES_IN`: Token lifetime (seconds), e.g. `3600`.
- `OPENAI_API_KEY` (optional): For AI enhancement if using OpenAI (or equivalent provider vars).

## Running Locally

1. Create and activate a virtual environment.
2. Install dependencies: `pip install -r requirements.txt`.
3. Set environment variables listed above.
4. Start server: `uvicorn app.main:app --reload`.
5. Open docs: `http://localhost:8000/docs` (OpenAPI UI).

## Authentication

- Strategy: JWT bearer tokens.
- Usage: Include header `Authorization: Bearer <token>` for all protected routes.

### Endpoints

- `POST /auth/register`: Create a new user.
  - Request: `{ "email": "user@example.com", "password": "StrongPass!" }`
  - Response: `{ "id": "uuid", "email": "user@example.com" }`

- `POST /auth/login`: Obtain JWT.
  - Request: `{ "email": "user@example.com", "password": "StrongPass!" }`
  - Response: `{ "access_token": "<jwt>", "token_type": "bearer", "expires_in": 3600 }`

- `GET /auth/me`: Current user.
  - Response: `{ "id": "uuid", "email": "user@example.com" }`

## Domain: Scripts

Represents test scripts with optional revision history. Aligns to frontend “Scripts” step and default 5‑card workflow.

### Schemas (simplified)

- Script: `{ id, project_id, title, content, created_at, updated_at }`
- ScriptRevision: `{ id, script_id, version, diff, applied_by, created_at }`
- ScriptChangeSet: `{ id, script_id, proposed_diff, ai_model, confidence, status, created_at }`

### Endpoints

- `GET /scripts`: List scripts for current user/project.
  - Response: `[ Script ]`

- `POST /scripts`: Create script.
  - Request: `{ "project_id": "uuid", "title": "Login flow", "content": "..." }`
  - Response: `Script`

- `GET /scripts/{script_id}`: Get script.

- `PUT /scripts/{script_id}`: Update script.
  - Request: `{ "title?": "...", "content?": "..." }`
  - Response: `Script`

- `DELETE /scripts/{script_id}`: Delete script.

## Domain: AI Enhancement

Creates a proposed change set for a script using an AI provider. Maps to “Enhance with AI”.

- `POST /scripts/{script_id}/enhance`
  - Request: `{ "prompt": "Improve waits and selectors", "provider": "openai", "model": "gpt-4o-mini", "temperature": 0.2 }`
  - Response: `ScriptChangeSet`
    - Example:
      ```json
      {
        "id": "uuid",
        "script_id": "uuid",
        "proposed_diff": "diff --git a ...",
        "ai_model": "gpt-4o-mini",
        "confidence": 0.86,
        "status": "proposed",
        "created_at": "2025-11-03T10:00:00Z"
      }
      ```

## Domain: Human Validation

Accepts or rejects a proposed change set. Maps to “Human Validation”.

- `POST /scripts/{script_id}/changesets/{changeset_id}/accept`
  - Action: Persist a `ScriptRevision` derived from the proposed diff; mark changeset `accepted`.
  - Response: `{ "revision_id": "uuid", "version": 7, "status": "accepted" }`

- `POST /scripts/{script_id}/changesets/{changeset_id}/reject`
  - Action: Mark changeset `rejected`.
  - Response: `{ "status": "rejected" }`

## Domain: Test Runs

Runs a script in the execution environment. Maps to “Finalize & Run”.

- `POST /test-runs`
  - Request: `{ "script_id": "uuid", "environment": "staging", "browser": "chromium" }`
  - Response: `{ "id": "uuid", "status": "queued" }`

- `GET /test-runs/{id}`: Status.
  - Response: `{ "id": "uuid", "status": "running", "started_at": "...", "completed_at": null, "results": null }`

- `POST /test-runs/{id}/cancel`
  - Response: `{ "id": "uuid", "status": "cancelled" }`

## Domain: AI Insights

Aggregates analytics or findings produced by AI after runs. Maps to “AI Insights”.

- `GET /scripts/{script_id}/insights`
  - Response: `[ { "id": "uuid", "type": "flaky-selector", "severity": "medium", "summary": "Selector #login may be flaky", "details": { ... }, "created_at": "..." } ]`

## Request Lifecycle & Logic

1. Router validates input with Pydantic schemas, enforces auth via dependency injection.
2. Service orchestrates domain actions, e.g. calling AI provider or enqueuing runs.
3. Repository handles DB I/O using async SQLAlchemy sessions.
4. Errors map to HTTP exceptions with consistent JSON shapes (see below).

### Example Controller Logic

Enhance Script (router):

```python
@router.post("/scripts/{script_id}/enhance", response_model=ChangeSetOut)
async def enhance_script(script_id: UUID, req: EnhanceReq, user: User = Depends(get_current_user)):
    script = await scripts_repo.get(script_id, user.id)
    if not script:
        raise HTTPException(status_code=404, detail={"code": "SCRIPT_NOT_FOUND"})
    changeset = await ai_service.propose_changes(script, req)
    return changeset
```

Accept ChangeSet (router):

```python
@router.post("/scripts/{script_id}/changesets/{changeset_id}/accept")
async def accept_changeset(script_id: UUID, changeset_id: UUID, user: User = Depends(get_current_user)):
    cs = await scripts_repo.get_changeset(changeset_id, script_id, user.id)
    if not cs or cs.status != "proposed":
        raise HTTPException(status_code=409, detail={"code": "INVALID_CHANGESET_STATE"})
    revision = await scripts_service.apply_changeset(cs, applied_by=user.id)
    return {"revision_id": revision.id, "version": revision.version, "status": "accepted"}
```

Start Test Run (router):

```python
@router.post("/test-runs", response_model=TestRunOut)
async def start_test_run(req: TestRunReq, user: User = Depends(get_current_user)):
    script = await scripts_repo.get(req.script_id, user.id)
    if not script:
        raise HTTPException(status_code=404, detail={"code": "SCRIPT_NOT_FOUND"})
    run = await test_runs_service.start(script, req.environment, req.browser)
    return run
```

## Error Handling

- Shape: `{ "error": { "code": "STRING_CODE", "message": "Human readable", "details": { ... } } }`
- Common codes: `SCRIPT_NOT_FOUND`, `INVALID_CHANGESET_STATE`, `UNAUTHORIZED`, `FORBIDDEN`, `VALIDATION_ERROR`, `CONFLICT`.
- Use appropriate HTTP statuses: 400, 401, 403, 404, 409, 422, 500.

## Observability

- Logging: Use `logging` with request correlation IDs (e.g., from header `X-Request-ID`).
- Metrics: Integrate Prometheus or StatsD if needed (request counts, latencies, error rates).
- Tracing: Optional OpenTelemetry for cross‑service traces.

## Security

- JWT: Rotate secrets periodically; set short `expires_in`; support refresh tokens if needed.
- RBAC: Optional roles; gate sensitive endpoints.
- Validation: Strict Pydantic schemas; reject unknown fields.
- Rate limiting: Optional per user/IP on AI endpoints and run creation.
- Secrets: Load via environment; never commit secrets.

## Versioning & Docs

- Version routes under `/v1` for future evolution (e.g. `/v1/scripts`).
- OpenAPI: Auto-generated at `/docs` and `/openapi.json`.

## Data Model Summary

- `User(id, email, password_hash, created_at)`
- `Project(id, owner_id, name, created_at)`
- `Script(id, project_id, title, content, created_at, updated_at)`
- `ScriptRevision(id, script_id, version, diff, applied_by, created_at)`
- `ScriptChangeSet(id, script_id, proposed_diff, ai_model, confidence, status, created_at)`
- `TestRun(id, script_id, environment, browser, status, started_at, completed_at, results)`
- `AIInsight(id, script_id, type, severity, summary, details, created_at)`

## Example cURL

Login:

```
curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"StrongPass!"}'
```

Create Script:

```
curl -X POST http://localhost:8000/scripts \
  -H "Authorization: Bearer <jwt>" \
  -H "Content-Type: application/json" \
  -d '{"project_id":"<uuid>","title":"Login flow","content":"..."}'
```

Enhance Script:

```
curl -X POST http://localhost:8000/scripts/<script_id>/enhance \
  -H "Authorization: Bearer <jwt>" \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Improve waits","provider":"openai","model":"gpt-4o-mini","temperature":0.2}'
```

Accept ChangeSet:

```
curl -X POST http://localhost:8000/scripts/<script_id>/changesets/<changeset_id>/accept \
  -H "Authorization: Bearer <jwt>"
```

Start Test Run:

```
curl -X POST http://localhost:8000/test-runs \
  -H "Authorization: Bearer <jwt>" \
  -H "Content-Type: application/json" \
  -d '{"script_id":"<uuid>","environment":"staging","browser":"chromium"}'
```

## Frontend Mapping

- “Scripts” view: Calls `/scripts` for list/create/update/delete.
- “Enhance with AI”: Calls `/scripts/{script_id}/enhance` to propose changes.
- “Human Validation”: Calls `accept`/`reject` endpoints for changesets.
- “Finalize & Run”: Calls `/test-runs` then polls `/test-runs/{id}`.
- “AI Insights”: Calls `/scripts/{script_id}/insights` after runs.

## Next Steps

- Implement persistence for `ScriptRevision`, `ScriptChangeSet`, and `AIInsight` if not already.
- Wire real AI provider or use a deterministic rules engine for initial enhancement.
- Add background worker for executing test runs and storing results.
- Introduce pagination and filtering for lists; index DB columns accordingly.
- Harden error shapes and observability across services.