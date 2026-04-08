# Demo Modes - End-to-End Flow (Student + Admin)

This file documents the **4 demo scenarios** and what each one does end-to-end, including which queue it lands in on Admin and what the student sees.

## Shared baseline (all modes)

- Student uses the wizard: **Home -> Explore -> Documents -> Profile -> Bank -> Review -> Result**
- On submit, the student calls: `POST /api/orchestrate`
- Backend runs LangGraph pipeline:
  - Document Intelligence -> Eligibility/Risk -> Scholarship/Funding
- Backend persists the final status into Firestore: `journey_states/{user_id}`
- Admin dashboard polls: `GET /api/admin/escalations`

### Admin decision outcomes

Admin actions call: `POST /api/admin/escalations/{user_id}/decision`

- `APPROVE` -> `ADMIN_APPROVED`
- `REJECT` -> `REJECTED`
- `REQUEST_REUPLOAD` -> `DOCS_REUPLOAD_REQUIRED`
- `REQUEST_CLARIFICATION` -> `CLARIFICATION_REQUIRED`

---

## Mode 1 - APPROVED (Green end state)

### Student
- Student completes submission.
- System returns a **green end state**:
  - Loan path: `DISBURSAL_COMPLETE` (Loan accepted / disbursed)
  - Scholarship path: `SCHOLARSHIP_MATCHED` (Scholarship accepted)
- Student sees a green result card and completion message.

### Admin
- Approved cases can still be visible in Admin “Approved” for tracking if needed.
- No manual action required for the demo.

---

## Mode 2 - REJECTED (Reject + visible to Admin)

### Student
- Student completes submission.
- Backend returns: `REJECTED`
- Student sees “Declined” with a clear message.

### Admin
- Case appears in Admin “Rejected” tab.
- Admin can open the case logs (audit trail) to explain why it failed.

---

## Mode 3 - FRAUD (Lockout + visible to Admin locked cases)

### Student
- Student completes submission using the Fraud demo profile.
- Document Intelligence triggers: `FRAUD_LOCKOUT`
- Student enters restricted mode:
  - cannot re-submit until admin updates the case
  - sees warning + “Contact support” style actions

### Admin
- Case appears in Admin “Locked Cases”
- Admin can confirm lock/notify (or reject) based on policy.

---

## Mode 4 - MISMATCH (Manual review workflow)

This mode is designed to **always land in Admin review**.

### Student
- Student completes submission using the Mismatch demo profile.
- Backend returns: `HITL_ESCALATION`
- Student sees “Under Review” messaging.

### Admin
- Case appears in Admin “Review Cases”
- Admin has 3 resolution options:
  - **Approve & Continue** -> student moves to `ADMIN_APPROVED`
  - **Reject** -> student moves to `REJECTED`
  - **Request Clarification** -> student moves to `CLARIFICATION_REQUIRED`

### Student (after Request Clarification)
- Student sees:
  - “Clarification Required”
  - “You will receive a message requesting further information/clarification.”

---

## Why mismatch must not be swallowed by “scholarship recommended”

Auto mode may compute scholarship suggestions, but **it must not overwrite escalation**.
- If eligibility returns `HITL_ESCALATION`, the system keeps `HITL_ESCALATION`
- Scholarship matching can still attach recommended schemes as context for admin

