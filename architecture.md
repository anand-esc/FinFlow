# SPARC Architectural Overview

SPARC-Agent utilizes a sophisticated React, FastAPI, Firebase, and LangGraph stack. This document details the exact mechanics powering the hackathon-winning experience.

## 1. Student Portal (Progressive Web App)
**Technology:** React, Vite, Framer Motion, Firebase Auth, Firebase Storage, `vite-plugin-pwa`
- **PWA Capabilities**: Students can "Add to Home Screen" on iOS and Android for a seamless app-like experience. 
- **Google OAuth 2.0 Auth**: Stateless zero-password authentication offloads all security vulnerabilities to Google.
- **Native Document Capture**: Relies on `<input type="file" capture="environment">` to tap directly into the mobile device's camera hardware. 
- **Storage Transmission**: Directly uploads the RAW binary file to a Firebase Storage Bucket over a secure websocket, retrieves the Signed Download URL, and ferries it to the Python Backend.
- **Dynamic Feedback UI**: The "Trust Gauge" leverages `framer-motion` to immediately simulate Trust Score injection locally to reduce perceived latency before the Backend Agents finalize the calculation.

## 2. The Python AI Backend Loop
**Technology:** Python, FastAPI, LangGraph, Langchain, GPT-4o Vision, Firebase Admin SDK
SPARC bypasses traditional static coding and invokes a State-Machine graph of AI Agents via LangGraph. 

**The Pipeline:**
1. **Document Intel Agent (OCR Phase)**: Connects to LangChain's wrapper around `GPT-4o Vision`. It consumes the Firebase Image URL and prompts the LLM to act as a rigorous KYC processor. It uses strict JSON enforcement to extract Names, Utility consistency data, and GPAs automatically.
2. **Eligibility Agent**: A rule-based Risk Assessor node that maps the `GPT-4o` outputs into our dynamic 0-1000 Alternative Credit Score. 
3. **Scholarship Matching Agent**: Runs the calculated score and profile through a deduplication logic engine matching it to Mock Bank Schemes.
4. **Mock Lender Webhook (Disbursal Phase)**: Makes an outbound HTTP `POST` internal API call to our `/api/lender/v1/disburse` endpoint to simulate interacting with a real financial institution, logging the latency and the final `receipt_id`.

## 3. Data Ephemeralization (Compliance & Privacy)
A critical feature differentiating SPARC is Data Ephemeralization. 
Financial documents are extremely sensitive. To comply with rigorous unbanked privacy demands:
- The FastAPI orchestrator holds the URL in isolated memory for exactly as long as GPT-4o takes to calculate the JSON summary.
- The moment the Agentic Node Pipeline completes, our `main.py` explicitly invokes `firebase_admin.storage` to **permanently delete the uploaded binary file** from the cloud bucket.
- No human ever sees the raw documentation, and the database only stores the cryptographically secure JSON extracted points.

## 4. Admin Command Center (Human-in-the-Loop)
**Technology:** React Desktop UI, Role-Based Access Control (RBAC). 
If the Risk Assessor Agent flags an application (Score < 300), the orchestrator immediately halts automatic disbursal and escalates the file to the Admin Portal.
- **Strict Whitelist**: Only developer emails mathematically hardcoded into the `AuthContext` array are ever permitted to view this React Route.
- **Data Masking (PII Protection)**: Any Personally Identifiable Information (App ID, First Names, Faces) is physically obfuscated using a `blur-md` CSS filter on the DOM layer.
- **Audited Unveil**: If the admin clicks the "Reveal" eye icon to investigate fraud, an Action Log is printed and recorded noting that human eyes viewed the PII.
- **The "Agentic Debate" Screen**: Instead of just reading a score, the Admin reviews an explainability window showing the Advocate Agent (arguing FOR the student) battling the Risk Agent (arguing AGAINST). The Admin clicks "Override & Approve" to manually resume the LangGraph flow from the suspension.
