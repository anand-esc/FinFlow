from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import random
import time

router = APIRouter()

class DisburseRequest(BaseModel):
    user_id: str
    amount: int
    alt_score: int

@router.post("/v1/disburse")
def mock_lender_disburse(req: DisburseRequest):
    # Simulate bank API latency
    time.sleep(1.5)
    
    # Simple Mock Lender Decision Engine
    if req.alt_score < 300:
        raise HTTPException(
            status_code=400, 
            detail="Alt-Score too low for automated bank disbursal. Human review required."
        )
    
    # 5% random failure rate to simulate bank timeout for rollback demonstrations
    if random.random() < 0.05:
        raise HTTPException(status_code=503, detail="Bank Core System Timeout")
        
    return {
        "status": "APPROVED",
        "receipt_id": f"LND_{random.randint(100000, 999999)}",
        "message": f"Successfully disbursed ${req.amount} to user {req.user_id}",
        "timestamp": time.time()
    }
