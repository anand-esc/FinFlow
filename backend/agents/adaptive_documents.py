"""
Adaptive Document Collection Engine

Instead of asking for all documents upfront, intelligently requests
documents based on profile analysis:

Stage 1: Collect minimal docs (Aadhaar for ID verification)
Stage 2: Analyze profile, decide next doc type needed
Stage 3: Request specific docs based on need (income, address, etc)
Stage 4: Once sufficient, trigger eligibility scoring
"""

from enum import Enum
from typing import Dict, List, Tuple
from datetime import datetime
import uuid

class DocumentStage(Enum):
    """Journey through document collection"""
    STAGE_1_INITIAL = "STAGE_1_INITIAL"  # Must have: Aadhaar
    STAGE_2_ASSESSMENT = "STAGE_2_ASSESSMENT"  # Analyze Aadhaar, decide next
    STAGE_3_ADDRESS_PROOF = "STAGE_3_ADDRESS_PROOF"  # Need address (utility, rental, etc)
    STAGE_4_INCOME_PROOF = "STAGE_4_INCOME_PROOF"  # Need income (statement, ITR, etc)  
    STAGE_5_COMPLETE = "STAGE_5_COMPLETE"  # Sufficient docs collected
    COMPLETE = "COMPLETE"  # Ready for scoring

class DocumentType(Enum):
    """All possible document types"""
    # Mandatory
    AADHAAR = "aadhaar"
    
    # Address Proof (need ONE)
    UTILITY_BILL = "utility"
    RENTAL_AGREEMENT = "rental"
    PROPERTY_DEED = "property"
    
    # Income Proof (need ONE or evidence of alternative data)
    BANK_STATEMENT = "bank_statement"
    PAYSLIP = "payslip"
    ITR = "itr"
    BUSINESS_PROOF = "business_proof"
    
    # Educational (optional but helps)
    ACADEMIC_TRANSCRIPT = "transcript"
    DEGREE = "degree"
    
    # Identity (alternative to Aadhaar)
    PAN = "pan"
    PASSPORT = "passport"

class DocumentRequirement:
    """What documents are needed based on profile"""
    
    def __init__(self):
        self.mandatory = [DocumentType.AADHAAR]
        self.required_one_of = {
            "address": [DocumentType.UTILITY_BILL, DocumentType.RENTAL_AGREEMENT, DocumentType.PROPERTY_DEED],
            "income": [DocumentType.BANK_STATEMENT, DocumentType.PAYSLIP, DocumentType.ITR]
        }
        self.optional = [DocumentType.ACADEMIC_TRANSCRIPT, DocumentType.DEGREE]

def analyze_collected_documents(uploaded_docs: List[Dict]) -> Dict:
    """
    Analyze what docs have been collected
    Returns: {
        "has_mandatory": bool,
        "has_address_proof": bool,
        "has_income_proof": bool,
        "missing_required": [list of DocumentType]
    }
    """
    doc_types = [doc.get("doc_type").lower() for doc in uploaded_docs]
    
    has_aadhaar = "aadhaar" in doc_types
    has_address = any(d in doc_types for d in ["utility", "rental", "property"])
    has_income = any(d in doc_types for d in ["bank_statement", "payslip", "itr", "business_proof"])
    
    missing = []
    if not has_aadhaar:
        missing.append(DocumentType.AADHAAR)
    if not has_address:
        missing.append("ADDRESS_PROOF")
    if not has_income:
        missing.append("INCOME_PROOF")
    
    return {
        "has_mandatory": has_aadhaar,
        "has_address_proof": has_address,
        "has_income_proof": has_income,
        "missing_required": missing,
        "is_minimal_acceptable": has_aadhaar and has_address,  # Minimum to proceed
        "is_complete": has_aadhaar and has_address and has_income
    }

def get_next_document_request(profile: Dict, uploaded_docs: List[Dict]) -> Dict:
    """
    Intelligently decide what document to request next
    
    Returns: {
        "stage": DocumentStage,
        "required_document": str,
        "reason": str,
        "alternatives": [list of acceptable alternatives],
        "is_complete": bool
    }
    """
    analysis = analyze_collected_documents(uploaded_docs)
    
    # Stage 1: Must have Aadhaar first
    if not analysis["has_mandatory"]:
        return {
            "stage": DocumentStage.STAGE_1_INITIAL,
            "required_document": "aadhaar",
            "reason": "Government ID verification required for all applications",
            "alternatives": [],
            "is_complete": False,
            "next_after": "Address proof"
        }
    
    # Stage 2: After Aadhaar, check if we need address proof
    if not analysis["has_address_proof"]:
        # Decide based on profile
        income = profile.get("income_type", "unknown").lower()
        
        if "student" in income or "unemployed" in income:
            # Student/unemployed: prefer utility bill (common)
            return {
                "stage": DocumentStage.STAGE_3_ADDRESS_PROOF,
                "required_document": "utility",
                "reason": "Address verification required - recent utility bill preferred",
                "alternatives": ["rental", "property"],
                "is_complete": False,
                "next_after": "Ready for eligibility scoring"
            }
        else:
            # Working professional: still utility bill most common
            return {
                "stage": DocumentStage.STAGE_3_ADDRESS_PROOF,
                "required_document": "utility",
                "reason": "Address verification required",
                "alternatives": ["rental", "property"],
                "is_complete": False
            }
    
    # Stage 3: After address, check income
    if not analysis["has_income_proof"]:
        income_type = profile.get("income_type", "student")
        
        if income_type == "student":
            # Student: bank statement is sufficient
            return {
                "stage": DocumentStage.STAGE_4_INCOME_PROOF,
                "required_document": "bank_statement",
                "reason": "Financial consistency check - last 6 months bank statement",
                "alternatives": ["payslip", "itr"],
                "is_complete": False
            }
        elif income_type == "employed":
            # Employed: prefer payslip
            return {
                "stage": DocumentStage.STAGE_4_INCOME_PROOF,
                "required_document": "payslip",
                "reason": "Income verification - recent payslip required",
                "alternatives": ["bank_statement", "itr"],
                "is_complete": False
            }
        elif income_type == "self_employed":
            # Self-employed: ITR
            return {
                "stage": DocumentStage.STAGE_4_INCOME_PROOF,
                "required_document": "itr",
                "reason": "Income verification - recent ITR/tax filing required",
                "alternatives": ["bank_statement", "business_proof"],
                "is_complete": False
            }
        else:
            # Default to bank statement
            return {
                "stage": DocumentStage.STAGE_4_INCOME_PROOF,
                "required_document": "bank_statement",
                "reason": "Financial profile verification",
                "alternatives": ["payslip", "itr", "business_proof"],
                "is_complete": False
            }
    
    # All required documents collected
    return {
        "stage": DocumentStage.STAGE_5_COMPLETE,
        "required_document": None,
        "reason": "Sufficient documents collected - ready for scoring",
        "alternatives": [],
        "is_complete": True,
        "can_proceed": True
    }

def build_document_collection_message(request: Dict) -> Dict:
    """
    Create user-friendly message for document request
    """
    messages = {
        "aadhaar": {
            "title": "Government ID Verification",
            "subtitle": "Start with your Aadhaar card",
            "description": "We need to verify your identity. Upload a clear photo of your Aadhaar card.",
            "icon": "shield",
            "priority": "MANDATORY"
        },
        "utility": {
            "title": "Address Proof",
            "subtitle": "Recent utility bill preferred",
            "description": "Upload a recent bill (electricity, gas, or water) from your current address. Last 3 months acceptable.",
            "icon": "home",
            "priority": "REQUIRED",
            "alternatives_text": "Or rental agreement / property deed"
        },
        "rental": {
            "title": "Address Proof",
            "subtitle": "Rental agreement accepted",
            "description": "Upload your rental/lease agreement showing your current address.",
            "icon": "filing",
            "priority": "REQUIRED"
        },
        "bank_statement": {
            "title": "Financial Profile",
            "subtitle": "Last 6 months bank statement",
            "description": "Upload your recent bank statement. This helps us understand your financial consistency.",
            "icon": "trending",
            "priority": "REQUIRED",
            "alternatives_text": "Or payslip / ITR"
        },
        "payslip": {
            "title": "Income Verification",
            "subtitle": "Recent payslip required",
            "description": "Upload a recent payslip (last 3 months) to verify your income.",
            "icon": "briefcase",
            "priority": "REQUIRED",
            "alternatives_text": "Or bank statement / ITR"
        },
        "itr": {
            "title": "Income Verification",
            "subtitle": "Recent ITR filing required",
            "description": "Upload your most recent income tax return filing.",
            "icon": "document",
            "priority": "REQUIRED"
        }
    }
    
    doc_type = request.get("required_document", "")
    msg = messages.get(doc_type, {})
    
    return {
        **msg,
        "stage": request["stage"].value,
        "reason": request.get("reason", ""),
        "alternatives": request.get("alternatives", [])
    }

def update_collection_progress(current_docs: List[Dict]) -> Dict:
    """
    Show progress in document collection
    
    Returns: {
        "progress_percent": 0-100,
        "stage": "minimal" | "standard" | "complete",
        "collected": [...],
        "needed": [...],
        "can_submit": bool
    }
    """
    analysis = analyze_collected_documents(current_docs)
    
    if analysis["is_complete"]:
        progress = 100
        stage = "complete"
        can_submit = True
    elif analysis["is_minimal_acceptable"]:
        progress = 67
        stage = "standard"
        can_submit = False  # Minimum docs, wait for income proof
    elif analysis["has_mandatory"]:
        progress = 33
        stage = "initial"
        can_submit = False
    else:
        progress = 0
        stage = "initial"
        can_submit = False
    
    collected_types = [doc.get("doc_type") for doc in current_docs]
    
    return {
        "progress_percent": progress,
        "stage": stage,
        "collected": collected_types,
        "needed": analysis["missing_required"],
        "can_submit": can_submit,
        "milestone": {
            0: "Start",
            33: "ID Verified",
            67: "Address Verified",
            100: "Ready to Score"
        }.get(int(progress / 33) * 33, "Processing")
    }

def create_adaptive_collection_state(user_profile: Dict = None) -> Dict:
    """
    Initialize adaptive document collection state
    """
    if user_profile is None:
        user_profile = {
            "income_type": "student",
            "status": "student"
        }
    
    return {
        "collection_stage": DocumentStage.STAGE_1_INITIAL.value,
        "documents_uploaded": [],
        "documents_verified": [],
        "next_required": {
            "document_type": "aadhaar",
            "reason": "Government ID verification required"
        },
        "collection_progress": 0,
        "user_profile": user_profile,
        "started_at": datetime.utcnow().isoformat(),
        "estimated_time_remaining": "5-10 minutes",
        "can_submit": False
    }

# ============================================================================
# For Frontend Integration
# ============================================================================

def get_ui_state(adaptive_state: Dict) -> Dict:
    """
    Convert adaptive state to UI-friendly format
    
    Returns what components need to show
    """
    progress = update_collection_progress(adaptive_state.get("documents_uploaded", []))
    next_request = get_next_document_request(
        adaptive_state.get("user_profile", {}),
        adaptive_state.get("documents_uploaded", [])
    )
    next_msg = build_document_collection_message(next_request)
    
    return {
        "progress": progress,
        "next_document": next_msg,
        "is_complete": next_request["is_complete"],
        "can_submit": progress["can_submit"],
        "documents_collected": {
            "aadhaar": any(d.get("doc_type") == "aadhaar" for d in adaptive_state.get("documents_uploaded", [])),
            "address": any(d.get("doc_type") in ["utility", "rental", "property"] for d in adaptive_state.get("documents_uploaded", [])),
            "income": any(d.get("doc_type") in ["bank_statement", "payslip", "itr"] for d in adaptive_state.get("documents_uploaded", []))
        }
    }
