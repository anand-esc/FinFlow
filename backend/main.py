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
    
    langgraph_state = {
        "userId": request.user_id,
        "journeyStatus": current_state.get("journeyState", "START"),
        "profile": current_state.get("studentProfile", {}),
        "documents": current_state.get("documentVault", []) + (request.payload.get("new_documents") or []),
        "options": current_state.get("options", []),
        "audit_trail": current_state.get("agentMemory", [])
    }
    
    try:
        # LangSmith tracing automatically tracks this invocation
        final_state = master_agent.invoke(langgraph_state)
        
        # Update Firestore with new state
        updated_state = {
            "userId": final_state["userId"],
            "journeyState": final_state["journeyStatus"],
            "studentProfile": final_state["profile"],
            "documentVault": final_state["documents"],
            "options": final_state.get("options", []),
            "agentMemory": final_state["audit_trail"],
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
            journey_state = state.get("journeyState", "UNKNOWN")
            if journey_state not in ["HITL_ESCALATION", "FRAUD_LOCKOUT", "ADMIN_APPROVED"]:
                continue

            profile = state.get("studentProfile", {}) or {}
            memory = state.get("agentMemory", []) or []
            latest_reason = memory[-1].get("reasoning", "") if memory else ""
            trust_score = profile.get("trustScore", state.get("trustScore", 0))
            alt_score = profile.get("alternativeCreditScore", 0)

            cases.append({
                "userId": state.get("userId", d.id),
                "id": d.id,
                "applicant": profile.get("fullName", "Student"),
                "journeyState": journey_state,
                "trustScore": trust_score,
                "altScore": alt_score,
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
    elif decision == "REJECT":
        next_state = "FRAUD_LOCKOUT"
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

    state["journeyState"] = next_state
    state.setdefault("agentMemory", []).append(audit_entry)
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

if __name__ == "__main__":
    app_module = "backend.main:app" if os.path.exists("backend/main.py") else "main:app"
    uvicorn.run(app_module, host="0.0.0.0", port=8000, reload=True)
