from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
import random
import time
from datetime import datetime
from persistence.firestore import db

router = APIRouter()

class BankDetails(BaseModel):
    """Tokenized bank details - never stores full account info"""
    accountHolderName: str
    bankName: str
    maskedAccount: str  # Format: XXXX1234
    tokenized_account_id: str  # Format: bank_tok_XXXXXX
    verifiedAt: str = Field(default_factory=lambda: datetime.utcnow().isoformat())

class BankDetailsRequest(BaseModel):
    user_id: str
    bankDetails: BankDetails

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

@router.post("/v1/bank-details")
def save_bank_details(req: BankDetailsRequest):
    """
    Store tokenized bank details for a student.
    - Never stores full account numbers
    - Only stores masked account (XXXX1234)
    - Generates unique token ID for payment processing
    """
    try:
        # Get user's journey state
        user_ref = db.collection("journey_states").document(req.user_id)
        user_doc = user_ref.get()
        
        if not user_doc.exists:
            raise HTTPException(
                status_code=404, 
                detail="User profile not found. Upload documents first."
            )
        
        # Store in a separate collection for PCI compliance
        # (Tokenized data separate from full app state)
        bank_ref = db.collection("student_bank_accounts").document(req.user_id)
        
        bank_data = {
            "userId": req.user_id,
            "accountHolderName": req.bankDetails.accountHolderName,
            "bankName": req.bankDetails.bankName,
            "maskedAccount": req.bankDetails.maskedAccount,
            "tokenized_account_id": req.bankDetails.tokenized_account_id,
            "verifiedAt": req.bankDetails.verifiedAt,
            "savedAt": datetime.utcnow().isoformat(),
            "status": "VERIFIED"  # In production: would verify with bank
        }
        
        bank_ref.set(bank_data)
        
        # Update journey state with bank verification flag
        user_data = user_doc.to_dict()
        user_data["studentProfile"]["bankDetailsVerified"] = True
        user_data["studentProfile"]["bankAccountToken"] = req.bankDetails.tokenized_account_id
        user_data["updatedAt"] = datetime.utcnow().isoformat()
        
        user_ref.update({
            "studentProfile": user_data["studentProfile"],
            "updatedAt": user_data["updatedAt"]
        })
        
        return {
            "status": "SAVED",
            "message": "Bank details saved securely",
            "maskedAccount": req.bankDetails.maskedAccount,
            "tokenized_account_id": req.bankDetails.tokenized_account_id,
            "timestamp": datetime.utcnow().isoformat(),
            "readyForDisbursal": True
        }
    
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to save bank details: {str(e)}"
        )

@router.get("/v1/bank-details/{user_id}")
def get_bank_details(user_id: str):
    """
    Retrieve masked bank details for a user (no full account info exposed).
    """
    try:
        bank_ref = db.collection("student_bank_accounts").document(user_id)
        bank_doc = bank_ref.get()
        
        if not bank_doc.exists:
            return {
                "status": "NOT_SET",
                "message": "No bank details on file"
            }
        
        data = bank_doc.to_dict()
        # Only return masked data
        return {
            "status": "VERIFIED",
            "accountHolderName": data.get("accountHolderName"),
            "bankName": data.get("bankName"),
            "maskedAccount": data.get("maskedAccount"),
            "tokenized_account_id": data.get("tokenized_account_id"),
            "verifiedAt": data.get("verifiedAt"),
            "readyForDisbursal": True
        }
    
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve bank details: {str(e)}"
        )
