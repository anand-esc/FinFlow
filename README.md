# SPARC-Agent: Current System Execution Guide

This README describes what the app is doing **right now** based on current frontend and backend code paths.

## Project Purpose

SPARC is a student-finance workflow platform with:
- document ingestion,
- fraud detection and trust scoring,
- eligibility scoring,
- scholarship/lender disbursal flow,
- admin review capability for escalations,
- Firebase-based state persistence.

## Current Runtime Architecture

```mermaid
graph TD
    S1[Student Frontend - Static SignLingo HTML/JS] --> B[FastAPI Backend]
    S2[Student Frontend - React app in src (present but not mounted)] --> B
    A[Admin Frontend - React] --> B
    B --> O[LangGraph Orchestrator]
    O --> D[Document + Fraud]
    O --> E[Eligibility]
    O --> M[Scholarship]
    M --> L[Mock Lender API]
    D --> F[(Firestore)]
    E --> F
    M --> F
    B --> FS[Firebase Storage cleanup]
```

## What Is Active vs Present

### Active in `frontend-student`
- `frontend-student/index.html` is currently a static SignLingo page.
- It loads:
  - `/css/styles.css`
  - `/js/app.js`
- It uses webcam + MediaPipe + WebSocket prediction flow.

### Present but not mounted in `frontend-student`
- Full React student app exists under `frontend-student/src`.
- Since current `index.html` has no React root mount and no `type="module" src="/src/main.tsx"`, React student dashboard flow is currently disconnected from runtime.

### Active in `frontend-admin`
- Admin frontend is a normal Vite React app and is mounted from `frontend-admin/src/main.tsx`.

## Backend APIs and What They Do

## Health and state
- `GET /health`
  - service health and environment information.
- `GET /api/state/{user_id}`
  - returns saved journey state; initializes default state if missing.

## Adaptive document collection
- `GET /api/documents/next-request/{user_id}`
  - computes next best document request and progress.
- `GET /api/documents/collection-progress/{user_id}`
  - returns collection completion metrics.

## Orchestration
- `POST /api/orchestrate`
  - triggers LangGraph pipeline for document -> fraud -> eligibility -> scholarship/disbursal.
  - persists updated state to Firestore.
  - attempts storage cleanup for user docs.

## Lender routes (mounted under `/api/lender`)
- `POST /api/lender/v1/disburse`
  - mock lender decision path using `alt_score` and randomized timeout behavior.
- `POST /api/lender/v1/bank-details`
  - saves tokenized/masked bank account details.
- `GET /api/lender/v1/bank-details/{user_id}`
  - returns bank details in masked/tokenized form.

## End-to-End Execution Flow (Backend)

1. Frontend sends `POST /api/orchestrate` with user and documents.
2. Backend loads current state from Firestore (`journey_states/{user_id}`).
3. Orchestrator invokes `document_intelligence_node`.
4. Document node performs layered fraud checks and sets `journeyStatus`.
5. Router logic decides:
   - if `FRAUD_LOCKOUT` -> stop.
   - if `HITL_ESCALATION` -> stop.
   - if `DOC_VERIFICATION_COMPLETE` and `trustScore >= 85` -> continue to eligibility.
6. Eligibility node computes alternative credit score:
   - score `< 400` -> `HITL_ESCALATION` and stop.
   - otherwise -> `ELIGIBILITY_SCORED` and continue.
7. Scholarship node performs matching and calls lender disburse endpoint.
8. Final state and audit trail are persisted to Firestore.
9. Backend attempts to delete uploaded blobs under `documents/{user_id}/` from Firebase Storage.

## Journey Status Values Observed

- `START` (initial default)
- `DOC_VERIFICATION_COMPLETE`
- `HITL_ESCALATION`
- `FRAUD_LOCKOUT`
- `ELIGIBILITY_SCORED`
- `DISBURSAL_PENDING`
- `DISBURSAL_COMPLETE`
- `DISBURSAL_FAILED`

Note: runtime state uses `journeyStatus`, persistence uses `journeyState`; backend maps between them during orchestration.

## Fraud System (Implemented Layers)

### Layer 1: format checks
- Aadhaar checksum validation.
- PAN format validation.
- Utility/account format validation.

### Layer 2: cross-document consistency
- fuzzy name matching.
- fuzzy address matching.

### Layer 3: vision analysis
- blur/tampering/readability/security cues.

### Layer 4: risk aggregation
- trust score (0-100) and risk-level based routing.
- threshold behavior used by orchestrator:
  - >=85 continues automatically,
  - 50-84 generally escalates,
  - <50 lockout path.

## Frontend Execution Flows

## Student frontend (currently active static flow)

Current static app behavior:
1. Loads letters from `GET http://localhost:8000/config`.
2. Opens WebSocket `ws://localhost:8000/ws/predict`.
3. Captures webcam frames, extracts landmarks via MediaPipe.
4. Sends landmarks to websocket.
5. Receives prediction/confidence and updates gamified UI.

This is independent of the student document/orchestration React flow.

## Student frontend (React flow in code, currently disconnected)

If mounted, the React student flow is:
1. Firebase Google login.
2. Fetch next document request from backend.
3. Upload documents to Firebase Storage.
4. Call `/api/orchestrate` when minimum progress is reached.
5. Show lockout panel on fraud lockout; otherwise currently limited post-success UI.

## Admin frontend (active React flow)

1. Firebase Google login.
2. Local role gate via allowed admin email list.
3. Escalation dashboard loads hardcoded `mockEscalations` (not backend data).
4. Escalation panel supports:
   - PII masking toggle,
   - plain-language vs technical reasoning toggle,
   - visual review panels and action buttons.
5. Action buttons are currently UI-only (no backend mutation call).

## Persistence Model

## Firestore collections
- `journey_states/{user_id}`
  - canonical user journey and profile data.
- `student_bank_accounts/{user_id}`
  - masked/tokenized bank account records.

## Storage usage
- uploaded files are read by agents and then cleanup is attempted by backend.

## Important Current Gaps / Mismatches

- Student runtime mismatch:
  - static SignLingo HTML is active, while React student app is not mounted.
- Admin data source mismatch:
  - admin UI shows mock escalation data, not live backend data.
- Adaptive docs data-shape mismatch:
  - parts of adaptive collection expect `doc_type`, while persisted docs may use `type`.
- Orchestrate response handling mismatch in React student:
  - frontend checks top-level `journeyStatus`, backend returns nested `newState` payload.
- Disbursal validation gap:
  - disburse endpoint does not currently enforce bank-details existence check.
- Request `event` field in orchestrate payload is currently not used for branching logic.

## How to Run

### Backend
```bash
cd backend
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
python main.py
```

### Student frontend (current static runtime)
```bash
cd frontend-student
npm install
npm run dev
```

### Admin frontend
```bash
cd frontend-admin
npm install
npm run dev
```

## Quick Verification Checklist

- Backend:
  - `GET /health` returns healthy response.
  - `POST /api/orchestrate` writes state into Firestore.
- Student:
  - static SignLingo page renders and camera opens.
  - websocket prediction stream is active.
- Admin:
  - admin login gate works.
  - escalation panels render with mask/explainability toggles.
