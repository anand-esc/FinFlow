from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
import uvicorn
from persistence.firestore import db
from datetime import datetime
from typing import Dict, Any

from agents.orchestrator import master_agent
from routers import lender
import firebase_admin.storage as firebase_storage

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

@app.get("/health")
def health_check():
    return {
        "status": "online", 
        "firebase_project": os.getenv("FIREBASE_PROJECT_ID"),
        "tracing_enabled": os.getenv("LANGCHAIN_TRACING_V2")
    }

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
        current_state = doc.to_dict()
    
    langgraph_state = {
        "userId": request.user_id,
        "journeyStatus": current_state.get("journeyState", "START"),
        "profile": current_state.get("studentProfile", {}),
        "documents": current_state.get("documentVault", []) + request.payload.get("new_documents", []),
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
            bucket = firebase_storage.bucket()
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

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
