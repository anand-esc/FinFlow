# SPARC (FinFlow AI) - 9-Slide Hackathon Presentation Script

## Slide 1 - Problem (PS-04)
- “Million deserving students lose access to higher education because financial options are fragmented.”
- “Students don’t know what they qualify for, don’t understand loan terms, and struggle to gather the right documents.”
- “The process is slow, unclear, and often drops off before submissions are complete.”
- “Traditional portals separate scholarship search, loan eligibility, and document checks into disconnected steps.”
- “Our goal: make funding onboarding feel guided, secure, and explainable—end-to-end.”

## Slide 2 - Solution Overview (What We Built)
- “We built FinFlow AI (SPARC): an agentic platform that guides students from document capture to funding decision.”
- “SPARC uses multi-agent orchestration so the system can verify documents, assess eligibility, and match offers.”
- “We include a human-in-the-loop admin console for high-risk or unclear cases.”
- “We also keep it demo-friendly: users can proceed smoothly even when warnings happen.”
- “Result: faster onboarding, fewer document cycles, and more trust in the decision.”

## Slide 3 - Architecture (How It Works)
- “The UI layer has two frontends: Student onboarding and Admin escalation dashboard.”
- “Backend is FastAPI with a LangGraph master orchestrator that drives the journey state machine.”
- “Document Intelligence runs vision + extraction using GPT-4o Vision via LangChain wrappers.”
- “Eligibility and risk are computed by dedicated rule-based agents (policy engine vs bank rules).”
- “Scholarship matching produces schemes, and loan scenarios trigger a lender disbursal mock.”
- “Firebase provides Auth + persistence (Firestore `journey_states`) and secure document handling.”
- “LangSmith tracing tags every run with `user:{firebase_uid}` so demos are reproducible.”

## Slide 4 - Student User Flow (Clear, Simple, Guided)
- “Student flow is a clean wizard: Home → Explore → Documents → Profile → Bank → Review → Result.”
- “Documents are captured one-by-one and verified immediately with an OCR preview and confidence.”
- “We run a quality gate (blur/glare) and show actionable feedback so the student can retake if needed.”
- “On the Explore page, we show limited real-world-style options: Loans (2) + Scholarships (2–3).”
- “In the demo/approved path, the UI tells the student the offer is available and does not require choosing.”
- “If admin review is needed, student sees clear next actions: re-upload or wait.”

## Slide 5 - Document Intelligence + 4-Layer Fraud Detection
- “SPARC uses a 4-layer fraud system to validate documents and extract structured fields.”
- “Layer 1: format validation (Aadhaar checksum, PAN pattern, utility account checks).”
- “Layer 2: cross-document consistency (name/address match across documents).”
- “Layer 3: vision extraction and fraud signals (GPT-4o Vision with tampering/clarity checks).”
- “Layer 4: trust scoring (0–100) that decides: auto-approve, escalate to admin, or lockout.”
- “This makes the decision explainable and auditable—perfect for demos and compliance storytelling.”

## Slide 6 - Eligibility, Offers, and (Mock) Disbursal
- “Eligibility is computed by the Eligibility Agent using a dual-engine approach.”
- “Government policy engine is more lenient to ensure access-first decisions.”
- “Bank rules are stricter: FOIR and CIBIL-like thresholds determine pass/fail.”
- “For scholarships: the Scholarship Agent generates top schemes (we show a limited set for clarity).”
- “For loans: if the journey reaches the funding stage, SPARC triggers the lender disbursal mock webhook.”
- “We store extracted outputs and journey state, not raw documents.”

## Slide 7 - Admin User Flow (Human-in-the-Loop)
- “Admin signs in and the dashboard polls `GET /api/admin/escalations` for live queue updates.”
- “Admin opens a case drawer with: Firestore snapshot + audit trail + evidence-based reasoning.”
- “Admin can request re-upload, approve, or reject using `POST /decision` endpoint.”
- “High-risk cases go to `HITL_ESCALATION` first; admin decision updates the journey state.”
- “Admin can optionally generate an AI analyst summary to speed up review.”
- “This ensures edge cases still land correctly in the demo and production design.”

## Slide 8 - Security, Privacy, and Auditability
- “SPARC is built around privacy by design: ephemeral documents.”
- “We delete uploaded document blobs after automated verification (zero retention intent).”
- “We store cryptographic hints (document hashes) and extracted metadata for traceability.”
- “Every agent appends evidence-based reasoning to `audit_trail` / `agentMemory`.”
- “If fraud lockout happens, the user sees restricted-mode messaging until admin updates the case.”
- “LangSmith tracing makes it easy to show how the system arrived at a decision.”

## Slide 9 - Why We Win (Impact + Demo Takeaways)
- “SPARC reduces onboarding time by automating verification + extraction + eligibility checks.”
- “It improves trust: students see what was extracted and why they were approved or escalated.”
- “It improves completeness: guided steps and actionable OCR preview reduce document rework cycles.”
- “It supports compliance storytelling with audit logs, hashes, and admin decisions.”
- “Demo-ready behavior: limited 2–3 offer UI and auto-selected offers in admin-approved path.”
- “Next step: connect real queues beyond demo mode and persist corrected OCR fields.”

