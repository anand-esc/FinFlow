# End-to-End Workflow Context: Moumita's Journey

🎯 **Core Principle: Ephemeral + Verifiable Architecture**
“We minimize sensitive data retention by deleting raw documents while preserving cryptographic proof of verification and structured insights.”

To understand exactly how the SPARC ecosystem functions, let's track a hypothetical student, **Moumita**, through the end-to-end pipeline.

## Scenario
Moumita is a first-generation college applicant. She has a high GPA but no formal ITR (Income Tax Return) and no CIBIL credit score. Traditional banks universally auto-reject her application.

---

### Step 1: Onboarding on the Zero-Barrier PWA
Moumita visits the SPARC-Agent link on her Android phone. She is prompted to "Add to Home Screen" via our **Progressive Web App** manifesting capabilities.
She clicks "Sign in with Google," immediately verifying her email domain with zero password friction.

### Step 2: Alternative Data Upload
The Dashboard tasks her with proving she is "financially consistent." Since she has no formal ITR, she presses the "Recent Utility Bill" upload card. 
The Web App directly opens her native mobile camera widget. She snaps a photo of her family's electrical bill. 
- *Under the hood:* The image is instantly transported to the Firebase Storage Bucket, generating a temporary URL.

### Step 3: Triggering the AI Brain
Moumita presses "Trigger Orchestrator". 
- SPARC sends her image URL to the FastAPI Backend.
- The **Document Intel Agent** initiates `GPT-4o Vision`, reading her Utility bill image. It extracts key structured data (e.g., {"utility_payment_score": 85}) and mathematically hashes the document.
- **Ephemeralization Protocol**: To protect Moumita's identity, the raw photo of her utility bill is permanently wiped off our cloud storage. We only persist the extracted JSON and her `utility_bill_hash`, generating an unforgeable verification trace without hoarding PII.

### Step 4: The Edge Case (Admin Escalation)
The **Eligibility Agent** calculates her Alternative Credit Score based on her OCR data. It calculates `SCORE: 285`. 
Because it falls below the `300` threshold, the automation suddenly halts. The State Machine updates to `ESCALATED`.

### Step 5: The Human-in-the-Loop Admin Center
Across the city, a SPARC Financial Operator logs into the Desktop Admin Command Center. 
- The operator sees Moumita's case flashing Red in the High Priority Queue.
- **Data Protection**: Moumita's name is completely blurred out on the screen via PII masking rules.
- The operator reads the **Agentic Debate**:
  - The Risk Agent argues: *"Score of 285 is too low for automated disbursement."*
  - The Advocate Agent argues: *"Her Utility Bill history is pristine and she comes from an unbanked geography. Grant the waiver."*
- The Operator clicks the "Unblur" icon (logging an auditing trace) to confirm her application manually, then clicks "Override & Approve".

### Step 6: Final Autonomy (Mock Lender Disbursal)
Upon Admin Override, the state machine resumes. 
- The **Scholarship Logic Engine** catches Moumita's profile and matches her against 400 mock schemes, prioritizing a "State First-Gen Scholarship".
- Finally, it pings the local FastAPI Mock Lender Webhook (`POST /lender/v1/disburse`). Instead of sending the bank her raw documents (the old, problematic model), SPARC passes only her Verification Flags, `alt_score`, and her `doc_hashes`. 
- The Lender API acknowledges the verifiable trace and responds with a successful receipt, simulating real bank transaction latency. 
- Moumita's phone screen automatically updates, flashing green with a confirmed Scholarship Disbursal ID.
- Her financial footprint has been established without a single formal banking document.
