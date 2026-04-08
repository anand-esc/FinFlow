# FinFlow AI (SPARC) — Production‑grade AI fintech demo

FinFlow AI is a multi‑agent fintech platform for **education loan onboarding** with:
- **Ephemeral documents** (base64 in → agent verification → zero retention)
- **4‑layer fraud detection** (format → cross‑match → vision → trust score)
- **Dual‑engine eligibility** (Govt policy vs strict bank rules)
- **Scholarship matching + lender disbursal mock**
- **Admin HITL console** (review / lock / approve / reject) with **audit logs + AI analyst**

## Live apps (dev)
- **Student app**: `http://localhost:5173` (Vite)
- **Admin app**: `http://localhost:5174` (Vite)
- **Backend**: `http://localhost:8000` (FastAPI + LangGraph)

## System architecture (high level)

```mermaid
flowchart LR
  subgraph FE[Frontends]
    S[Student React 19\nWizard + Docs + Result + Chat]:::fe
    A[Admin React 19\nDashboard + Case Drawer]:::fe
  end

  subgraph BE[Backend]
    API[FastAPI\n/api/*]:::be
    LG[LangGraph Orchestrator\nDocument → Eligibility → Scholarship]:::be
    DOC[Document Agent\n4-layer Fraud Detection]:::agent
    ELIG[Eligibility Agent\nPolicy vs Bank]:::agent
    SCH[Scholarship Agent\nSchemes + Lender call]:::agent
  end

  subgraph DATA[Persistence + Observability]
    FS[(Firestore\njourney_states/*)]:::data
    LS[LangSmith\nTracing + Runs]:::obs
  end

  S --> API
  A --> API
  API --> LG
  LG --> DOC
  DOC --> ELIG
  ELIG --> SCH
  DOC --> FS
  ELIG --> FS
  SCH --> FS
  API -.tags: user:{id}.-> LS

  classDef fe fill:#eef2ff,stroke:#6366f1,color:#111827;
  classDef be fill:#ecfeff,stroke:#06b6d4,color:#111827;
  classDef agent fill:#f0fdf4,stroke:#22c55e,color:#111827;
  classDef data fill:#fff7ed,stroke:#fb923c,color:#111827;
  classDef obs fill:#fdf2f8,stroke:#ec4899,color:#111827;
```

## Journey state machine

```mermaid
stateDiagram-v2
  [*] --> START
  START --> DOC_VERIFICATION_COMPLETE
  START --> HITL_ESCALATION
  START --> FRAUD_LOCKOUT

  DOC_VERIFICATION_COMPLETE --> ELIGIBILITY_SCORED
  DOC_VERIFICATION_COMPLETE --> HITL_ESCALATION
  DOC_VERIFICATION_COMPLETE --> REJECTED

  ELIGIBILITY_SCORED --> DISBURSAL_COMPLETE
  ELIGIBILITY_SCORED --> DISBURSAL_PENDING

  HITL_ESCALATION --> ADMIN_APPROVED
  HITL_ESCALATION --> REJECTED
  HITL_ESCALATION --> DOCS_REUPLOAD_REQUIRED

  FRAUD_LOCKOUT --> REJECTED
```

## Demo workflow (fast showcase)

### Student: “Demo Verified” + “Auto‑Fill Remaining”
- **Home page**: 3 scenario buttons
  - **Approved** → reaches `DISBURSAL_COMPLETE`
  - **Mismatch** → reaches `HITL_ESCALATION`
  - **Rejected** → reaches `REJECTED`
- **Documents step**: each doc has a **⚡ Demo Verified** button (marks it as uploaded/verified)
- **From Profile → Result**: a persistent **Demo Verified bar** appears with:
  - Scenario selector (Approved / Mismatch / Rejected)
  - **⚡ Auto‑Fill Remaining** (fills missing fields + marks missing docs as demo‑verified)

This keeps the demo “live at every step” so you never have to retype details during a showcase.

### Admin: realistic dummy accounts per tab
Admin has a **Demo Data toggle** (ON by default for demos):
- Adds ~20 realistic cases per queue (Review / Locked / Approved / Rejected)
- Each tab’s dummy list is **different** (not copy‑pasted across tabs)
- Demo actions are **local-only** (won’t error if backend doesn’t have those users)

### Admin: click into a case → logs + AI analyst
In Review / Locked, click **“View Profile & Logs”** to open a drawer showing:
- **Firestore state snapshot** (profile + journey status)
- **Firebase agent logs** (`auditTrail` / `agentMemory`)
- **LangSmith trace discovery hints** (tags like `user:{id}`)
- **AI Admin Analyst**: evidence-based recommendation + clarifications to request

## Key backend APIs

### Core
- `GET /health`
- `GET /api/state/{user_id}`
- `POST /api/orchestrate`
  - Runs LangGraph pipeline and persists updated state
  - Adds LangSmith tags `finflow`, `user:{id}`, `event:{event}`
- `POST /api/chat`

### Admin
- `GET /api/admin/escalations`
- `POST /api/admin/escalations/{user_id}/decision`
- `GET /api/admin/escalations/{user_id}` (case drawer details)
- `POST /api/admin/escalations/{user_id}/analyze` (AI admin analyst)

## Persistence model (Firestore)
- `journey_states/{user_id}`
  - Writes **both** `journeyStatus` and `journeyState`
  - Writes **both** `profile` and `studentProfile`
  - Writes **both** `audit_trail` and `agentMemory`

## How to run (Windows / PowerShell)

### Backend
```bash
cd backend
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
python main.py
```

### Student frontend
```bash
cd frontend-student
npm install
npm run dev -- --port 5173
```

### Admin frontend
```bash
cd frontend-admin
npm install
npm run dev -- --port 5174
```

## LangSmith tracing (how to find runs during demo)
- Ensure env enables tracing (e.g. `LANGCHAIN_TRACING_V2=true`)
- Orchestrations are tagged with `user:{user_id}`
- In LangSmith UI, filter by tag: `user:<the firebase uid>`
