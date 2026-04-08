from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
import uvicorn
from persistence.firestore import db
from datetime import datetime
from typing import Dict, Any, List, Optional
import base64
import re

from agents.orchestrator import master_agent
from agents.adaptive_documents import (
    get_next_document_request,
    build_document_collection_message,
    update_collection_progress
)
from routers import lender
from firebase_admin import storage

app = FastAPI(title="SPARC-Agent Master Orchestrator")
app.include_router(lender.router, prefix="/api/lender", tags=["Lender"])

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class AgentTriggerRequest(BaseModel):
    user_id: str
    event: str  # e.g., "DOCUMENTS_UPLOADED"
    payload: Dict[str, Any] = {}

class OCRPreviewRequest(BaseModel):
    doc_type: str
    image_base64: str
    hints: Optional[Dict[str, Any]] = None

class AdminDecisionRequest(BaseModel):
    decision: str  # APPROVE | REJECT | REQUEST_REUPLOAD
    admin_id: str
    notes: Optional[str] = ""

class AdminCaseAnalyzeRequest(BaseModel):
    admin_id: str
    focus: Optional[str] = None  # e.g. "trustworthiness", "clarifications", "risk"

@app.get("/health")
def health_check():
    return {
        "status": "online", 
        "firebase_project": os.getenv("FIREBASE_PROJECT_ID"),
        "tracing_enabled": os.getenv("LANGCHAIN_TRACING_V2")
    }

@app.get("/api/documents/next-request/{user_id}")
def get_next_document_request_endpoint(user_id: str):
    """
    Adaptive document collection: Get the next document to request
    
    Returns what document the user should upload next based on what's already collected
    """
    try:
        doc_ref = db.collection("journey_states").document(user_id)
        doc = doc_ref.get()
        
        if not doc.exists:
            # First time user - start with Aadhaar
            next_request = {
                "stage": "STAGE_1_INITIAL",
                "required_document": "aadhaar",
                "reason": "Government ID verification required for all applications",
                "alternatives": [],
                "is_complete": False
            }
            docs_uploaded = []
        else:
            current_state = doc.to_dict() or {}
            documents_uploaded = current_state.get("documentVault", [])
            profile = current_state.get("studentProfile", {})
            
            next_request = get_next_document_request(profile, documents_uploaded)
            docs_uploaded = documents_uploaded
        
        # Build user-friendly message
        message = build_document_collection_message(next_request)
        
        # Get progress
        progress = update_collection_progress(docs_uploaded)
        
        return {
            "status": "success",
            "nextDocument": message,
            "progress": progress,
            "stage": next_request.get("stage", "STAGE_1_INITIAL")
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get next document: {str(e)}")

@app.get("/api/documents/collection-progress/{user_id}")
def get_document_collection_progress(user_id: str):
    """
    Get current document collection progress for a user
    """
    try:
        doc_ref = db.collection("journey_states").document(user_id)
        doc = doc_ref.get()
        
        if not doc.exists:
            return {
                "progress_percent": 0,
                "stage": "initial",
                "collected": [],
                "needed": ["aadhaar"],
                "can_submit": False,
                "milestone": "Start with ID verification"
            }
        
        current_state = doc.to_dict() or {}
        documents = current_state.get("documentVault", [])
        
        return update_collection_progress(documents)
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get progress: {str(e)}")

@app.get("/api/state/{user_id}")
def get_user_state(user_id: str):
    doc_ref = db.collection("journey_states").document(user_id)
    doc = doc_ref.get()
    
    if doc.exists:
        return doc.to_dict()
    else:
        # Provide Mock/Default "START" state
        initial_state = {
            "userId": user_id,
            "journeyState": "START",
            "studentProfile": {},
            "documentVault": [],
            "options": [],
            "agentMemory": [{
                "id": f"evt_{int(datetime.now().timestamp())}",
                "timestamp": datetime.utcnow().isoformat() + "Z",
                "agentName": "Master Orchestrator",
                "action": "JOURNEY_INITIALIZED",
                "reasoning": "Student launched the SPARC application for the first time.",
                "confidenceScore": 100
            }],
            "errorRollback": [],
            "updatedAt": datetime.utcnow().isoformat() + "Z"
        }
        doc_ref.set(initial_state)
        return initial_state

@app.post("/api/ocr/preview")
def ocr_preview(request: OCRPreviewRequest):
    """
    Lightweight OCR preview endpoint for frontend inline verification.
    Returns extracted fields + confidence score.
    """
    try:
        # Validate incoming base64 payload shape
        if "," in request.image_base64:
            _, encoded = request.image_base64.split(",", 1)
        else:
            encoded = request.image_base64
        _ = base64.b64decode(encoded, validate=True)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid image_base64 payload")

    doc_type = request.doc_type.lower().strip()
    hints = request.hints or {}

    # Optional "real OCR" path when pytesseract/Pillow are available in environment.
    # Falls back safely to deterministic template extraction for hackathon reliability.
    extracted_text = ""
    ocr_confidence = 0.0
    try:
        import io
        from PIL import Image
        import pytesseract

        image_bytes = base64.b64decode(encoded)
        image = Image.open(io.BytesIO(image_bytes))
        extracted_text = pytesseract.image_to_string(image) or ""
        ocr_confidence = 0.82 if extracted_text.strip() else 0.45
    except Exception:
        # Keep fallback path deterministic if OCR libs aren't installed.
        extracted_text = ""
        ocr_confidence = 0.58

    fields: List[Dict[str, Any]] = []

    if doc_type == "aadhaar":
        name_guess = hints.get("fullName") or "Detected Name"
        dob_match = re.search(r"\b\d{2}/\d{2}/\d{4}\b", extracted_text)
        aadhaar_match = re.search(r"\b\d{4}\s?\d{4}\s?\d{4}\b", extracted_text)
        fields = [
            {"key": "fullName", "label": "Full Name", "value": name_guess, "confidence": 0.76},
            {"key": "dateOfBirth", "label": "Date of Birth", "value": dob_match.group(0) if dob_match else "", "confidence": 0.69},
            {"key": "aadhaarNumber", "label": "Aadhaar Number", "value": aadhaar_match.group(0) if aadhaar_match else "", "confidence": 0.66},
        ]
    elif doc_type == "utility":
        city_guess = hints.get("city") or "Detected City"
        account_match = re.search(r"\b[A-Z0-9]{6,20}\b", extracted_text.upper())
        fields = [
            {"key": "nameOnBill", "label": "Name on Bill", "value": hints.get("fullName", ""), "confidence": 0.63},
            {"key": "city", "label": "City", "value": city_guess, "confidence": 0.72},
            {"key": "accountNumber", "label": "Account Number", "value": account_match.group(0) if account_match else "", "confidence": 0.61},
        ]
    elif doc_type == "pan":
        pan_match = re.search(r"\b[A-Z]{5}[0-9]{4}[A-Z]\b", extracted_text.upper())
        fields = [
            {"key": "panHolderName", "label": "PAN Holder Name", "value": hints.get("fullName", ""), "confidence": 0.65},
            {"key": "panNumber", "label": "PAN Number", "value": pan_match.group(0) if pan_match else "", "confidence": 0.74},
        ]
    else:
        fields = [{"key": "rawText", "label": "Raw OCR Text", "value": extracted_text[:120], "confidence": 0.5}]

    # Confidence smoothing by non-empty extraction
    non_empty = [f for f in fields if str(f.get("value", "")).strip()]
    confidence = min(0.95, max(0.35, (ocr_confidence + (len(non_empty) / max(1, len(fields))) * 0.35)))

    return {
        "status": "success",
        "docType": doc_type,
        "confidence": round(confidence, 2),
        "fields": fields,
        "rawTextPreview": extracted_text[:300]
    }

@app.post("/api/orchestrate")
def trigger_agent_workflow(request: AgentTriggerRequest):
    """
    Triggers the LangGraph orchestration handling Documents -> Eligibility -> Scholarship Matching.
    """
    doc_ref = db.collection("journey_states").document(request.user_id)
    doc = doc_ref.get()
    
    if not doc.exists:
        current_state = {
            "userId": request.user_id,
            "journeyState": "START",
            "studentProfile": {},
            "documentVault": [],
            "options": [],
            "agentMemory": [],
            "errorRollback": [],
            "updatedAt": datetime.utcnow().isoformat() + "Z"
        }
        doc_ref.set(current_state)
    else:
        current_state = doc.to_dict() or {}

    # Restricted mode: do not allow new orchestration while under fraud lockout.
    # User can still login, view state, explore, and contact support.
    existing_status = (current_state or {}).get("journeyStatus", (current_state or {}).get("journeyState", "UNKNOWN"))
    if existing_status == "FRAUD_LOCKOUT":
        raise HTTPException(
            status_code=403,
            detail="RESTRICTED_MODE: Account is under fraud review. Submission is disabled until admin updates the case.",
        )
    
    funding_type = (request.payload.get("fundingType") or request.payload.get("funding_type") or "loan").lower().strip()
    if funding_type not in ("loan", "scholarship", "auto"):
        funding_type = "loan"

    langgraph_state = {
        "userId": request.user_id,
        # Always start fresh — never carry over a previous FRAUD_LOCKOUT or REJECTED status
        "journeyStatus": "START",
        "profile": {**(request.payload.get("student_profile", {}) or {}), "fundingType": funding_type},
        "documents": request.payload.get("new_documents") or [],
        "options": [],
        "audit_trail": [],
        "fundingType": funding_type,
    }
    
    try:
        # LangSmith tracing automatically tracks this invocation.
        # Tags make it easy to find traces per user during demos.
        final_state = master_agent.invoke(
            langgraph_state,
            config={
                "tags": [f"finflow", f"user:{request.user_id}", f"event:{request.event}"]
            },
        )
        
        # Update Firestore with new state
        updated_state = {
            "userId": final_state["userId"],
            # Write both keys so any caller finds the state regardless of field name used
            "journeyStatus": final_state["journeyStatus"],
            "journeyState": final_state["journeyStatus"],
            # Write profile under both keys for backward compat
            "profile": final_state["profile"],
            "studentProfile": final_state["profile"],
            "documentVault": final_state["documents"],
            "options": final_state.get("options", []),
            "scholarshipMatches": final_state.get("scholarshipMatches"),
            "fundingType": final_state.get("fundingType", final_state.get("profile", {}).get("fundingType", funding_type)),
            "audit_trail": final_state["audit_trail"],
            "agentMemory": final_state["audit_trail"],
            "langsmithTags": [f"finflow", f"user:{request.user_id}", f"event:{request.event}"],
            "updatedAt": datetime.utcnow().isoformat() + "Z"
        }
        
        doc_ref.set(updated_state)
        
        # Phase 5: Data Ephemeralization
        # Delete the uploaded images from the Storage Bucket to fulfill Zero-Retention compliance
        try:
            bucket = storage.bucket()
            blobs = bucket.list_blobs(prefix=f"documents/{request.user_id}/")
            for blob in blobs:
                blob.delete()
        except Exception as cleanup_err:
            print("Ephemeralization skipped or failed:", cleanup_err)

        return {"status": "success", "newState": updated_state}
        
    except Exception as e:
        error_entry = {
            "failedEndpoint": "orchestrate",
            "errorPayload": str(e),
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "resolved": False
        }
        current_state.setdefault("errorRollback", []).append(error_entry)
        doc_ref.set(current_state)
        current_state.setdefault("agentMemory", []).append({
             "id": f"rollback_{int(datetime.now().timestamp())}",
             "timestamp": datetime.utcnow().isoformat() + "Z",
             "agentName": "Master Orchestrator",
             "action": "ROLLBACK_INITIATED",
             "reasoning": f"Agent graph failed due to error: {str(e)}",
             "confidenceScore": 100
        })
        doc_ref.set(current_state)
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Agent failure: {str(e)}")

@app.get("/api/admin/escalations/{user_id}")
def get_admin_case_details(user_id: str):
    """
    Admin: fetch full Firestore state for a given case, including audit trail.
    This is used by the admin UI when clicking into a user profile/case.
    """
    try:
        doc_ref = db.collection("journey_states").document(user_id)
        doc = doc_ref.get()
        if not doc.exists:
            raise HTTPException(status_code=404, detail="User journey state not found")
        state = doc.to_dict() or {}

        profile = state.get("profile", state.get("studentProfile", {})) or {}
        memory = state.get("audit_trail", state.get("agentMemory", [])) or []
        journey_state = state.get("journeyStatus", state.get("journeyState", "UNKNOWN"))

        # LangSmith: we can't reliably compute a run URL without org/project metadata.
        # We store tags so the demo operator can filter traces by `user:{id}`.
        tracing_enabled = str(os.getenv("LANGCHAIN_TRACING_V2", "")).lower() in ("1", "true", "yes", "on")
        tracing = {
            "enabled": tracing_enabled,
            "project": os.getenv("LANGCHAIN_PROJECT") or os.getenv("LANGSMITH_PROJECT") or None,
            "tags": state.get("langsmithTags", [f"finflow", f"user:{user_id}"]),
            "howToFind": f"Filter traces by tag: user:{user_id}"
        }

        return {
            "status": "success",
            "data": {
                "userId": state.get("userId", user_id),
                "journeyState": journey_state,
                "updatedAt": state.get("updatedAt"),
                "profile": profile,
                "documents": state.get("documentVault", []),
                "options": state.get("options", []),
                "auditTrail": memory,
                "adminReview": state.get("adminReview", None),
                "tracing": tracing,
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch case details: {str(e)}")

@app.post("/api/admin/escalations/{user_id}/analyze")
def analyze_admin_case(user_id: str, request: AdminCaseAnalyzeRequest):
    """
    Admin: agentic analysis for the situation with suggested clarifications.
    This does NOT mutate state; it's an on-demand AI summary.
    """
    try:
        from langchain_openai import ChatOpenAI
        from langchain_core.messages import HumanMessage, SystemMessage

        doc_ref = db.collection("journey_states").document(user_id)
        doc = doc_ref.get()
        if not doc.exists:
            raise HTTPException(status_code=404, detail="User journey state not found")
        state = doc.to_dict() or {}

        profile = state.get("profile", state.get("studentProfile", {})) or {}
        memory = state.get("audit_trail", state.get("agentMemory", [])) or []
        journey_state = state.get("journeyStatus", state.get("journeyState", "UNKNOWN"))

        # Keep prompt deterministic + bank-grade.
        focus = (request.focus or "").strip() or "trustworthiness, risk, merits, clarifications"
        system_prompt = f"""You are FinFlow Admin Analyst, a senior risk reviewer for education loan onboarding.

You will receive a case snapshot (profile + agent audit trail). Produce a concise, structured admin note with:
- Trust assessment (0-100) and recommended action: APPROVE / REJECT / REQUEST_REUPLOAD / REQUEST_CLARIFICATION
- Key risks (bullets)
- Merits/positive signals (bullets)
- Most important clarifications to request (bullets) — make them specific and actionable
- If mismatch/HITL: suggest 2-3 'what-if' levers to improve bank pass (co-applicant, collateral, tenure, amount)

Focus: {focus}
Tone: bank-grade, objective, evidence-based. Do not invent facts. If evidence is missing, say so.
"""

        # Provide a compact context payload to the model.
        context_payload = {
            "userId": user_id,
            "journeyState": journey_state,
            "updatedAt": state.get("updatedAt"),
            "profile": profile,
            "adminReview": state.get("adminReview"),
            "auditTrailTail": memory[-8:],  # last 8 events are usually enough for review
        }

        llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.2)
        resp = llm.invoke([
            SystemMessage(content=system_prompt),
            HumanMessage(content=f"CASE_SNAPSHOT_JSON:\n{context_payload}")
        ])

        return {
            "status": "success",
            "data": {
                "userId": user_id,
                "journeyState": journey_state,
                "analysis": resp.content,
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to analyze case: {str(e)}")

@app.get("/api/admin/escalations")
def get_admin_escalations():
    """
    Live escalation queue for admin dashboard.
    """
    try:
        docs = db.collection("journey_states").stream()
        cases = []
        for d in docs:
            state = d.to_dict() or {}
            journey_state = state.get("journeyStatus", state.get("journeyState", "UNKNOWN"))
            if journey_state not in ["HITL_ESCALATION", "CLARIFICATION_REQUIRED", "FRAUD_LOCKOUT", "ADMIN_APPROVED", "REJECTED"]:
                continue

            profile = state.get("profile", state.get("studentProfile", {})) or {}
            memory = state.get("audit_trail", state.get("agentMemory", [])) or []
            latest_reason = memory[-1].get("reasoning", "") if memory else ""
            trust_score = profile.get("trustScore", state.get("trustScore", 0))
            alt_score = profile.get("alternativeCreditScore", 0)
            funding_type = (state.get("fundingType") or profile.get("fundingType") or "loan")
            schol = state.get("scholarshipMatches")

            cases.append({
                "userId": state.get("userId", d.id),
                "id": d.id,
                "applicant": profile.get("fullName", "Student"),
                "journeyState": journey_state,
                "trustScore": trust_score,
                "altScore": alt_score,
                "fundingType": funding_type,
                "scholarshipMatchScore": schol.get("match_score") if isinstance(schol, dict) else None,
                "riskLevel": profile.get("fraudRiskLevel", "UNKNOWN"),
                "reasoning": latest_reason,
                "updatedAt": state.get("updatedAt"),
            })

        cases.sort(key=lambda x: x.get("updatedAt", ""), reverse=True)
        return {"status": "success", "data": cases}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch escalations: {str(e)}")

@app.post("/api/admin/escalations/{user_id}/decision")
def submit_admin_decision(user_id: str, request: AdminDecisionRequest):
    """
    Persist admin decision and update journey state.
    """
    doc_ref = db.collection("journey_states").document(user_id)
    doc = doc_ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="User journey state not found")

    state = doc.to_dict() or {}
    decision = request.decision.upper().strip()

    if decision == "APPROVE":
        next_state = "ADMIN_APPROVED"
    elif decision == "REQUEST_REUPLOAD":
        next_state = "DOCS_REUPLOAD_REQUIRED"
    elif decision == "REQUEST_CLARIFICATION":
        next_state = "CLARIFICATION_REQUIRED"
    elif decision == "REJECT":
        next_state = "REJECTED"
    else:
        raise HTTPException(status_code=400, detail="Invalid decision")

    audit_entry = {
        "id": f"admin_{int(datetime.now().timestamp())}",
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "agentName": "Admin Review Console",
        "action": f"ADMIN_{decision}",
        "reasoning": request.notes or f"Admin decision: {decision}",
        "confidenceScore": 100
    }

    # Write state under BOTH field names so frontend/backend reads always resolve correctly
    state["journeyStatus"] = next_state
    state["journeyState"] = next_state
    audit_trail = state.get("audit_trail", state.get("agentMemory", []))
    audit_trail.append(audit_entry)
    state["audit_trail"] = audit_trail
    state["agentMemory"] = audit_trail
    state["updatedAt"] = datetime.utcnow().isoformat() + "Z"
    state["adminReview"] = {
        "decision": decision,
        "adminId": request.admin_id,
        "notes": request.notes or "",
        "timestamp": datetime.utcnow().isoformat() + "Z"
    }

    doc_ref.set(state)

    return {
        "status": "success",
        "message": "Decision saved",
        "userId": user_id,
        "newJourneyState": next_state
    }

class ChatRequest(BaseModel):
    user_id: str
    message: str
    context: Optional[str] = None

@app.post("/api/chat")
def chat_assistant(request: ChatRequest):
    try:
        from langchain_openai import ChatOpenAI
        from langchain_core.messages import HumanMessage, SystemMessage
        
        doc_ref = db.collection("journey_states").document(request.user_id)
        doc = doc_ref.get()
        state = doc.to_dict() if doc.exists else {}
        profile = state.get("studentProfile", {})
        memory = state.get("agentMemory", [])
        
        # Get the reason for the mismatch from memory
        mismatch_reason = "No previous assessment found."
        for m in reversed(memory):
            if m.get("action") == "EVALUATE_POLICY_VS_BANK":
                mismatch_reason = str(m.get("details", m.get("reasoning")))
                break
                
        system_prompt = f"""You are an empathetic, insightful fin-tech counselor for FinFlow AI.
The user is applying for an education loan.
Their recent profile evaluated against bank filters yielded this status: {mismatch_reason}
Profile details: 
- Income: {profile.get('monthlyIncome', 'N/A')}
- EMI existing: {profile.get('existingEmis', 'N/A')} 
- Required Loan: {profile.get('loanAmountRequired', 'N/A')}
- CIBIL: {profile.get('cibilScore', 'N/A')}
- Co-Applicant: {'Yes' if profile.get('hasCoApplicant') else 'No'}

Answer the user's question concisely in 2-3 sentences. Focus on actionable improvements (like adding a co-applicant or collateral). Maintain a professional, 'bank-grade' but supportive tone."""

        llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.3)
        response = llm.invoke([
            SystemMessage(content=system_prompt),
            HumanMessage(content=request.message)
        ])
        
        return {"status": "success", "reply": response.content}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    app_module = "backend.main:app" if os.path.exists("backend/main.py") else "main:app"
    uvicorn.run(app_module, host="0.0.0.0", port=8000, reload=True)

