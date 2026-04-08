# SPARC End-to-End Flow

This document explains the current app execution flow across student frontend, backend orchestration, and admin review including edge cases.

## System Components

- Student app: `frontend-student` (React, camera-first guided onboarding)
- Admin app: `frontend-admin` (React, multi-layer case review)
- Backend API + orchestrator: `backend/main.py` + `backend/agents/*`
- Persistence: Firestore (`journey_states`, `student_bank_accounts`)
- Storage: Firebase Storage (`documents/{user_id}/...`)

## Student Journey Flow

1. User signs in with Google.
2. Home screen explains process and starts onboarding.
3. Documents are captured one-by-one:
   - Aadhaar
   - Utility bill
   - PAN
4. For each capture:
   - camera snapshot is taken
   - client-side compression is applied for mobile speed
   - blur/glare quality gate runs
   - OCR preview endpoint is called
   - extracted fields + confidence are shown inline and can be corrected
5. User fills profile details:
   - name, DOB, phone, city, education, income range, CIBIL
6. User fills bank setup:
   - owner type (self or parent/guardian)
   - holder name, bank name, last-4 account digits, IFSC
7. Review screen confirms readiness.
8. Submit:
   - document uploads with per-doc state (`uploading`, `uploaded`, `failed`, `cancelled`)
   - bank details posted to `/api/lender/v1/bank-details`
   - orchestration triggered via `/api/orchestrate`
9. Result shown with success/warning/error and guided corrections on warning. On `ADMIN_APPROVED`, the student UI shows auto-selected scholarship/loan offers (limited to 2–3 each) and explicitly does not require the user to choose.

## Student Quality and UX Layers

- Smart camera quality gate:
  - edge sharpness proxy (blur score)
  - glare percentage proxy
  - next step blocked if quality is below threshold
- OCR integration:
  - backend endpoint `/api/ocr/preview`
  - returns extracted fields + confidence
  - user can correct extracted values inline
- Trust simulation:
  - provisional score updates during each step
- Accessibility/interaction:
  - smooth animated transitions
  - reduced-motion respect via system preference
  - large touch targets and clear state labels

## Backend Execution Flow

1. `POST /api/orchestrate` receives user + new documents.
2. Backend fetches existing `journey_states/{user_id}`.
3. Constructs LangGraph state and invokes `master_agent`.
4. Graph order:
   - `document_agent`
   - conditional route
   - `eligibility_agent` (if allowed)
   - conditional route
   - `scholarship_agent` (if allowed)
5. Result state is persisted back to Firestore.
6. Uploaded blobs under `documents/{user_id}/` are deleted (ephemeralization attempt).

## Journey Status Paths

- `DOC_VERIFICATION_COMPLETE`: document/fraud stage passed
- `HITL_ESCALATION`: human review required
- `FRAUD_LOCKOUT`: hard fraud lockout
- `ELIGIBILITY_SCORED`: eligibility passed
- `DISBURSAL_PENDING` / `DISBURSAL_COMPLETE` / `DISBURSAL_FAILED`

## When Admin Is Called

Admin path is triggered when backend sets:

- `journeyStatus = HITL_ESCALATION`

Typical reasons:
- cross-document mismatch around threshold
- quality/vision confidence too low
- trust score in manual-review range
- low eligibility score after document pass

In this state, student receives warning-state messaging and correction checklist.
After admin review, `ADMIN_APPROVED` transitions the student into the approval-success UI. For the demo path, the student is guaranteed to see at least one funding option (scholarship or loan) to keep the end-to-end flow consistent.

## Hard Lockout Edge Case

`journeyStatus = FRAUD_LOCKOUT` is used for critical fraud patterns, such as:
- mathematical document validation failure
- severe multi-layer risk aggregation outcome

Student sees lockout-style failure path; admin sees locked case queue.

## Upload and Submission Edge Cases

- Upload cancelled by user:
  - doc marked `cancelled`
  - retry available
- Upload network failure:
  - doc marked `failed`
  - retry available
- OCR service unavailable:
  - capture flow continues with local fallback preview
- Camera permission denied:
  - actionable error message shown

## Admin Review Flow (Live Connected)

1. Admin signs in (whitelisted role check).
2. Admin opens one of simplified queues:
   - Review Cases
   - Locked Cases
   - Approved
   - Insights
3. Admin frontend polls backend every few seconds:
   - `GET /api/admin/escalations`
   - shows live student cases from `journey_states`
3. Each case shows layered explanation cards:
   - Layer 1 format
   - Layer 2 cross-match
   - Layer 3/4 vision + risk
4. Admin can:
   - request re-upload
   - approve and continue
   - confirm lock and notify (for locked cases)
5. Each action is persisted by:
   - `POST /api/admin/escalations/{user_id}/decision`
   - backend updates `journeyState` + appends admin audit entry

## API Map (Current)

- `GET /health`
- `GET /api/state/{user_id}`
- `GET /api/documents/next-request/{user_id}`
- `GET /api/documents/collection-progress/{user_id}`
- `POST /api/ocr/preview`
- `POST /api/orchestrate`
- `GET /api/admin/escalations`
- `POST /api/admin/escalations/{user_id}/decision`
- `POST /api/lender/v1/bank-details`
- `GET /api/lender/v1/bank-details/{user_id}`
- `POST /api/lender/v1/disburse`

## Known Practical Notes

- OCR endpoint is hybrid:
  - uses pytesseract/Pillow if available
  - otherwise returns deterministic fallback extraction with confidence
- Admin queues are live wired to `GET /api/admin/escalations` (polling) with decisions persisted via `POST /api/admin/escalations/{user_id}/decision`.
- Orchestrator state is persisted under `journeyState` while graph logic uses `journeyStatus`.

## Recommended Next Hardening

1. Add backend endpoints for live admin queue fetch + decision submission.
2. Persist corrected OCR fields from student to journey profile.
3. Add server-side image quality validation (mirrors client gate).
4. Add automated retry strategy and chunked upload for poor networks.
