from datetime import datetime
import uuid

import json
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage

# Import fraud detection layers
from agents.fraud_detection import (
    validate_aadhaar_format,
    validate_pan_format,
    validate_utility_account,
    cross_match_documents,
    create_enhanced_vision_prompt,
    FraudRiskCalculator
)

def document_intelligence_node(state: dict) -> dict:
    """
    ============================================================================
    LAYERED FRAUD DETECTION SYSTEM
    Layer 1: Format Validation (Aadhaar Verhoeff checksum, PAN regex)
    Layer 2: Cross-Document Matching (Fuzzy name/address matching)
    Layer 3: AI Document Validation (GPT Vision - blur, tampering, mismatch)
    Layer 4: Risk Scoring (0-100 Trust Score → Auto-Approve or Admin Review)
    ============================================================================
    """
    docs = state.get("documents", [])
    profile = state.get("profile", {})
    
    verified_docs = []
    reasoning_parts = []
    status = "DOC_VERIFICATION_COMPLETE"
    fraud_detected = False
    
    # Initialize fraud tracking
    format_validation = {
        "aadhaar_valid": False,
        "pan_valid": False,
        "aadhaar_checksum_failed": False
    }
    vision_results = {"documents": []}
    extracted_data = {}
    
    llm = ChatOpenAI(model="gpt-4o", temperature=0)

    # =========================================================================
    # LAYER 1 & 3: Format Validation + Vision AI Extraction
    # =========================================================================
    for doc in docs:
        doc_url = doc.get("url")
        doc_type = doc.get("doc_type", "").lower()
        
        doc_result = {
            "type": doc_type,
            "status": "VERIFIED",
            "verifiedAt": datetime.utcnow().isoformat(),
            "vision_analysis": {}
        }
        
        if doc_url:
            # Use ENHANCED vision prompt with fraud detection
            prompt = create_enhanced_vision_prompt(doc_type)
            
            try:
                msg = llm.invoke(
                    [
                        HumanMessage(
                            content=[
                                {"type": "text", "text": prompt},
                                {
                                    "type": "image_url",
                                    "image_url": {"url": doc_url},
                                },
                            ]
                        )
                    ]
                )
                
                # Clean JSON output
                output_text = msg.content.replace("```json", "").replace("```", "").strip()
                extracted = json.loads(output_text)
                
                # ===== LAYER 3: Vision AI Results =====
                doc_result["vision_analysis"] = extracted
                vision_results["documents"].append({
                    "type": doc_type,
                    "blur_score": extracted.get("blur_score", 0),
                    "tampering_detected": extracted.get("tampering_detected", False),
                    "readability_score": extracted.get("readability_score", 100),
                    "fraud_flags": extracted.get("fraud_flags", []),
                    "recommendation": extracted.get("recommendation", "MANUAL_REVIEW")
                })
                
                # ===== LAYER 1: Format Validation =====
                if doc_type == "aadhaar":
                    uid = extracted.get("aadhaar_number", "")
                    if uid:
                        uid = uid.replace(" ", "")
                        is_valid, validation_msg = validate_aadhaar_format(uid)
                        format_validation["aadhaar_valid"] = is_valid
                        
                        if not is_valid:
                            fraud_detected = True
                            status = "FRAUD_LOCKOUT"
                            format_validation["aadhaar_checksum_failed"] = True
                            reasoning_parts.append(f"🚨 LAYER 1 FRAUD: {validation_msg}")
                            doc_result["status"] = "REJECTED"
                        else:
                            profile["aadhaarData"] = extracted
                            reasoning_parts.append(f"✅ LAYER 1: Aadhaar format & checksum valid ({uid})")
                            extracted_data["aadhaar_number"] = uid
                            extracted_data["aadhaar_name"] = extracted.get("name", "")
                            extracted_data["aadhaar_address"] = extracted.get("address", "")
                    else:
                        fraud_detected = True
                        status = "FRAUD_LOCKOUT"
                        reasoning_parts.append(f"🚨 LAYER 3 FRAUD: Aadhaar number unreadable - {extracted.get('recommendation', 'REJECT')}")
                        doc_result["status"] = "REJECTED"
                
                elif doc_type == "pan":
                    pan = extracted.get("pan_number", "")
                    if pan:
                        is_valid, validation_msg = validate_pan_format(pan)
                        format_validation["pan_valid"] = is_valid
                        
                        if not is_valid:
                            fraud_detected = True
                            reasoning_parts.append(f"⚠️ LAYER 1: Invalid PAN - {validation_msg}")
                            doc_result["status"] = "REJECTED"
                        else:
                            reasoning_parts.append(f"✅ LAYER 1: PAN format valid ({pan})")
                            extracted_data["pan_number"] = pan
                            extracted_data["pan_name"] = extracted.get("name", "")
                
                elif doc_type == "utility":
                    account = extracted.get("account_number", "")
                    if account:
                        is_valid, validation_msg = validate_utility_account(account)
                        if is_valid:
                            profile["utilityHistoryScore"] = extracted.get("consistency_score", 85)
                            reasoning_parts.append(f"✅ LAYER 1: Utility account valid - Consistency: {extracted.get('consistency_score', 85)}/100")
                            extracted_data["utility_account"] = account
                            extracted_data["utility_name"] = extracted.get("name", "")
                            extracted_data["utility_address"] = extracted.get("address", "")
                        else:
                            reasoning_parts.append(f"⚠️ LAYER 1: Invalid utility account - {validation_msg}")
                    else:
                        profile["utilityHistoryScore"] = extracted.get("consistency_score", 70)
                        reasoning_parts.append(f"⚠️ Could not extract utility account - Consistency: {extracted.get('consistency_score', 70)}/100")
                
                # Check vision AI recommendation
                vision_rec = extracted.get("recommendation", "VERIFIED")
                if vision_rec == "REJECT":
                    fraud_detected = True
                    status = "FRAUD_LOCKOUT"
                    reasoning_parts.append(f"🚨 LAYER 3: Vision AI recommends REJECT for {doc_type}")
                    doc_result["status"] = "REJECTED"
                
            except Exception as e:
                reasoning_parts.append(f"⚠️ Failed to analyze {doc_type} via Vision: {str(e)}")
                if doc_type == "utility":
                    profile["utilityHistoryScore"] = 70
        else:
            reasoning_parts.append(f"⚠️ Mocked {doc_type} extraction (No URL provided)")
            if doc_type == "utility":
                profile["utilityHistoryScore"] = 85
        
        verified_docs.append(doc_result)
    
    # =========================================================================
    # LAYER 2: Cross-Document Matching (if not already failed)
    # =========================================================================
    cross_match_data = {
        "name_consistent": True,
        "address_consistent": True,
        "name_match_confidence": 100
    }
    
    if not fraud_detected and extracted_data:
        is_consistent, match_reasoning, mismatches = cross_match_documents(extracted_data)
        reasoning_parts.append(f"📋 LAYER 2: {match_reasoning}")
        
        cross_match_data["name_consistent"] = is_consistent
        cross_match_data["address_consistent"] = is_consistent
        cross_match_data["mismatches"] = mismatches
        
        if not is_consistent and len(mismatches) > 1:
            # Multiple mismatches = fraud signal
            fraud_detected = True
            status = "FRAUD_LOCKOUT"
            reasoning_parts.append(f"🚨 LAYER 2 FRAUD: Multiple document mismatches detected: {mismatches}")
    
    # =========================================================================
    # LAYER 4: Risk Scoring & Auto-Approval Decision
    # =========================================================================
    trust_score_result = {}
    
    if not fraud_detected:
        calculator = FraudRiskCalculator()
        trust_score_result = calculator.calculate_trust_score(
            format_validation=format_validation,
            cross_match=cross_match_data,
            vision_results=vision_results
        )
        
        reasoning_parts.append(f"\n🎯 LAYER 4 RISK SCORING:\n{trust_score_result['reasoning']}")
        
        profile["trustScore"] = trust_score_result["trust_score"]
        profile["fraudRiskLevel"] = trust_score_result["risk_level"]
        
        # Update status based on recommendation
        if trust_score_result["recommendation"] == "AUTO_APPROVE":
            status = "DOC_VERIFICATION_COMPLETE"
            reasoning_parts.append(f"✅ AUTO-APPROVED: Trust Score {trust_score_result['trust_score']}/100 (Low Risk)")
        elif trust_score_result["recommendation"] == "MANUAL_REVIEW":
            status = "HITL_ESCALATION"  # Go to human review
            reasoning_parts.append(f"📊 ESCALATED TO ADMIN: Trust Score {trust_score_result['trust_score']}/100 ({trust_score_result['risk_level']} Risk)")
        else:  # REJECT
            status = "FRAUD_LOCKOUT"
            fraud_detected = True
            reasoning_parts.append(f"🚨 FRAUD LOCKOUT: Trust Score {trust_score_result['trust_score']}/100 - {trust_score_result['recommendation']}")
    else:
        # If fraud was detected earlier, trust score is 0
        trust_score_result = {
            "trust_score": 0.0,
            "risk_level": "CRITICAL",
            "recommendation": "REJECT",
            "fraud_flags": ["FRAUD_DETECTED_IN_LAYERS_1_2_3"],
            "reasoning": "Fraud detected in format validation, vision analysis, or cross-matching"
        }
        profile["trustScore"] = 0
        profile["fraudRiskLevel"] = "CRITICAL"
        reasoning_parts.append(f"🚨 FRAUD LOCKOUT: Trust Score 0/100 - Multiple fraud signals")
    
    # =========================================================================
    # Build Audit Trail
    # =========================================================================
    confidence_score = 99.9 if status == "FRAUD_LOCKOUT" else 96.5
    
    audit = {
        "id": f"doc_{uuid.uuid4().hex[:8]}",
        "timestamp": datetime.utcnow().isoformat(),
        "agentName": "Document Intelligence Agent (4-Layer Fraud Detection)",
        "action": "LAYERED_FRAUD_DETECTION_COMPLETE",
        "reasoning": "\n".join(reasoning_parts),
        "confidenceScore": confidence_score,
        "trustScore": trust_score_result.get("trust_score", 0),
        "fraudFlags": trust_score_result.get("fraud_flags", [])
    }
    
    return {
        "documents": verified_docs,
        "profile": profile,
        "audit_trail": [audit],
        "journeyStatus": status,
        "trustScore": trust_score_result.get("trust_score", 0),
        "fraudRiskLevel": trust_score_result.get("risk_level", "CRITICAL"),
        "requiresHumanReview": trust_score_result.get("requires_human_review", True)
    }
