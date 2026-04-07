from datetime import datetime
import uuid
import requests

def scholarship_matching_node(state: dict) -> dict:
    """
    Matches student against 400+ schemes. De-duplicates checklist.
    For hackathon, mocks a logic engine returning top options.
    """
    profile = state.get("profile", {})
    alt_score = profile.get("alternativeCreditScore", 0)
    
    options = []
    if alt_score > 600:
        options.append({
            "id": "sch_state_01",
            "name": "State First-Gen Scholarship",
            "type": "GRANT",
            "amount": 50000,
            "deduplicated_checklist": ["AADHAAR", "COLLEGE_ADMISSION_LETTER"]
        })
        options.append({
            "id": "loan_sparc_01",
            "name": "SPARC Zero-Collateral Education Loan",
            "type": "LOAN",
            "amount": 250000,
            "interestRate": 8.5
        })
    elif alt_score <= 600:
        options.append({
            "id": "sch_micro_01",
            "name": "Community Micro-Grant",
            "type": "GRANT",
            "amount": 10000,
            "deduplicated_checklist": ["AADHAAR"]
        })
        
    reasoning = f"Matched {len(options)} schemes based on alt-score {alt_score} and First-Gen profile. Deduplicated overlapping document requirements to a single checklist."
    
    audit = {
        "id": f"schol_{uuid.uuid4().hex[:8]}",
        "timestamp": datetime.utcnow().isoformat(),
        "agentName": "Scholarship Logic Engine",
        "action": "SCHEMES_MATCHED",
        "reasoning": reasoning,
        "confidenceScore": 95.5
    }
    
    # Fire off webhook to Lender API for final Mock Execution!
    disbursal_status = "DISBURSAL_PENDING"
    try:
        req_payload = {
            "user_id": state.get("userId", "anonymous"),
            "amount": options[0]["amount"] if options else 0,
            "alt_score": alt_score
        }
        res = requests.post("http://localhost:8000/api/lender/v1/disburse", json=req_payload)
        if res.status_code == 200:
            disbursal_status = "DISBURSAL_COMPLETE"
            audit["reasoning"] += f" Successfully invoked Lender API. Receipt: {res.json()['receipt_id']}"
        else:
            disbursal_status = "DISBURSAL_FAILED"
            audit["reasoning"] += f" Lender API Failed: {res.text}"
    except Exception as e:
        audit["reasoning"] += f" Failed to reach Lender API: {str(e)}"
    
    return {
        "options": options,
        "audit_trail": [audit],
        "journeyStatus": disbursal_status
    }
