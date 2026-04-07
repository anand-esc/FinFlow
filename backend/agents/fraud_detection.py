"""
Fraud Detection Engine - 4 Layered Approach
Layer 1: Format Validation (Aadhaar Verhoeff, PAN Regex)
Layer 2: Cross-Document Matching (Fuzzy Name/Address Matching)
Layer 3: AI Document Validation (GPT Vision - Blur, Tampering, Mismatch)
Layer 4: Risk Scoring (0-100 Trust Score → Auto-Approve or Admin Review)
"""

import re
import json
from datetime import datetime
from difflib import SequenceMatcher
from typing import Dict, List, Tuple
import uuid

# ============================================================================
# LAYER 1: FORMAT VALIDATION
# ============================================================================

def validate_aadhaar_format(aadhaar: str) -> Tuple[bool, str]:
    """
    Layer 1A: Aadhaar Format Validation
    - Must be 12 digits
    - Must pass Verhoeff checksum (mathematically proven UIDAI standard)
    """
    aadhaar_clean = aadhaar.replace(" ", "").replace("-", "")
    
    # Must be 12 digits
    if not re.match(r'^\d{12}$', aadhaar_clean):
        return False, "Invalid format: Aadhaar must be 12 digits"
    
    # Verhoeff checksum validation
    if not _verify_aadhaar_checksum(aadhaar_clean):
        return False, "CRITICAL: Aadhaar checksum FAILED - mathematically invalid"
    
    return True, "Aadhaar format valid"


def validate_pan_format(pan: str) -> Tuple[bool, str]:
    """
    Layer 1B: PAN Format Validation
    Format: AAAAP5055K
    - 10 characters
    - First 5: Letters (A-Z)
    - 6th: Digit (0-9) - person type
    - 7th-9th: Letters (A-Z)
    - 10th: Digit (0-9) - checksum
    """
    pan_clean = pan.upper().replace(" ", "")
    
    # PAN regex pattern (AAAAP5055K format)
    pan_pattern = r'^[A-Z]{5}[0-9][A-Z]{3}[0-9]{1}$'
    
    if not re.match(pan_pattern, pan_clean):
        return False, "Invalid PAN format: Expected AAAAP5055K"
    
    # Verify checksum digit (simplified NSDL checksum)
    if not _verify_pan_checksum(pan_clean):
        return False, "PAN checksum validation failed"
    
    return True, "PAN format valid"


def validate_utility_account(account_number: str) -> Tuple[bool, str]:
    """
    Layer 1C: Utility Bill Account Format
    - Must be 6-20 characters alphanumeric
    - Must not be obviously fake (all same digits, etc.)
    """
    account_clean = account_number.strip()
    
    if not 6 <= len(account_clean) <= 20:
        return False, "Invalid account number length"
    
    if not re.match(r'^[A-Z0-9]+$', account_clean):
        return False, "Account number must be alphanumeric"
    
    # Check for obviously fake patterns
    if len(set(account_clean)) == 1:  # All same character
        return False, "Account number appears invalid (repeated characters)"
    
    return True, "Account format valid"


# Verhoeff checksum (from UIDAI specification)
d = (
    (0, 1, 2, 3, 4, 5, 6, 7, 8, 9),
    (1, 2, 3, 4, 0, 6, 7, 8, 9, 5),
    (2, 3, 4, 0, 1, 7, 8, 9, 5, 6),
    (3, 4, 0, 1, 2, 8, 9, 5, 6, 7),
    (4, 0, 1, 2, 3, 9, 5, 6, 7, 8),
    (5, 9, 8, 7, 6, 0, 4, 3, 2, 1),
    (6, 5, 9, 8, 7, 1, 0, 4, 3, 2),
    (7, 6, 5, 9, 8, 2, 1, 0, 4, 3),
    (8, 7, 6, 5, 9, 3, 2, 1, 0, 4),
    (9, 8, 7, 6, 5, 4, 3, 2, 1, 0))
p = (
    (0, 1, 2, 3, 4, 5, 6, 7, 8, 9),
    (1, 5, 7, 6, 2, 8, 3, 0, 9, 4),
    (5, 8, 0, 3, 7, 9, 6, 1, 4, 2),
    (8, 9, 1, 6, 0, 4, 3, 5, 2, 7),
    (9, 4, 5, 3, 1, 2, 6, 8, 7, 0),
    (4, 2, 8, 6, 5, 7, 3, 9, 0, 1),
    (2, 7, 9, 3, 8, 0, 6, 4, 1, 5),
    (7, 0, 4, 6, 9, 1, 3, 2, 5, 8))

def _verify_aadhaar_checksum(num: str) -> bool:
    """Verify Aadhaar using Verhoeff algorithm"""
    try:
        c = 0
        for i, item in enumerate(reversed(num)):
            c = d[c][p[i % 8][int(item)]]
        return c == 0
    except Exception:
        return False

def _verify_pan_checksum(pan: str) -> bool:
    """Simplified PAN checksum (actual NSDL uses weighting)"""
    try:
        # PAN last digit is checksum - simplified validation
        # In production, use actual NSDL algorithm
        if len(pan) != 10:
            return False
        # Checksum digit must be 0-9
        return pan[-1].isdigit()
    except Exception:
        return False


# ============================================================================
# LAYER 2: CROSS-DOCUMENT MATCHING
# ============================================================================

def fuzzy_match_names(name1: str, name2: str, threshold: float = 0.85) -> Tuple[bool, float]:
    """
    Layer 2A: Fuzzy match names across documents
    Uses SequenceMatcher for robust matching
    
    Returns: (match_status, confidence_score)
    """
    # Normalize names: lowercase, remove extra spaces, remove special chars
    name1_norm = ' '.join(name1.lower().split())
    name2_norm = ' '.join(name2.lower().split())
    
    # Remove common titles (Mr, Mrs, Dr, etc.)
    name1_norm = re.sub(r'^(mr|mrs|ms|dr|prof)\s+', '', name1_norm)
    name2_norm = re.sub(r'^(mr|mrs|ms|dr|prof)\s+', '', name2_norm)
    
    # Calculate similarity ratio
    ratio = SequenceMatcher(None, name1_norm, name2_norm).ratio()
    
    is_match = ratio >= threshold
    return is_match, ratio * 100


def fuzzy_match_address(addr1: str, addr2: str, threshold: float = 0.75) -> Tuple[bool, float]:
    """
    Layer 2B: Fuzzy match addresses
    More lenient than names due to address format variations
    """
    # Normalize addresses
    addr1_norm = ' '.join(addr1.lower().split())
    addr2_norm = ' '.join(addr2.lower().split())
    
    # Remove common address keywords
    for keyword in ['street', 'st', 'road', 'rd', 'avenue', 'ave', 'building', 'block', 'apt']:
        addr1_norm = addr1_norm.replace(keyword, '')
        addr2_norm = addr2_norm.replace(keyword, '')
    
    # Recalculate after keyword removal
    addr1_norm = ' '.join(addr1_norm.split())
    addr2_norm = ' '.join(addr2_norm.split())
    
    ratio = SequenceMatcher(None, addr1_norm, addr2_norm).ratio()
    is_match = ratio >= threshold
    return is_match, ratio * 100


def cross_match_documents(extracted_data: Dict, profile_name: str = "") -> Tuple[bool, str, Dict]:
    """
    Layer 2: Complete Cross-Document Matching
    Validates consistency across Aadhaar, PAN, Utility Bill
    
    Returns: (is_consistent, reasoning, mismatches)
    """
    mismatches = {}
    mismatch_count = 0
    reasoning_parts = []
    
    # Extract names from documents
    aadhaar_name = extracted_data.get("aadhaar_name", "").strip()
    pan_name = extracted_data.get("pan_name", "").strip()
    utility_name = extracted_data.get("utility_name", "").strip()
    
    # Extract addresses
    aadhaar_addr = extracted_data.get("aadhaar_address", "").strip()
    utility_addr = extracted_data.get("utility_address", "").strip()
    
    # NAME MATCHING
    # 1. Profile Name vs Document Names (Crucial anti-fraud layer)
    if profile_name:
        if aadhaar_name:
            match, confidence = fuzzy_match_names(profile_name, aadhaar_name)
            if not match:
                mismatch_count += 1
                mismatches["profile_aadhaar"] = f"{confidence:.1f}% match"
                reasoning_parts.append(f"🚨 FRAUD ALERT: Aadhaar Name ({aadhaar_name}) DOES NOT MATCH Registration ({profile_name}) - {confidence:.1f}% similar")
            else:
                reasoning_parts.append(f"✓ Aadhaar name matches Student Profile")
                
        if pan_name:
            match, confidence = fuzzy_match_names(profile_name, pan_name)
            if not match:
                mismatch_count += 1
                mismatches["profile_pan"] = f"{confidence:.1f}% match"
                reasoning_parts.append(f"🚨 FRAUD ALERT: PAN Name ({pan_name}) DOES NOT MATCH Registration ({profile_name}) - {confidence:.1f}% similar")
            else:
                reasoning_parts.append(f"✓ PAN name matches Student Profile")

    # 2. Document vs Document (Consistency)
    if aadhaar_name and pan_name:
        match, confidence = fuzzy_match_names(aadhaar_name, pan_name)
        if not match:
            mismatch_count += 1
            mismatches["name_aadhaar_pan"] = f"{confidence:.1f}% match"
            reasoning_parts.append(f"⚠️ Document Name Mismatch: Aadhaar ({aadhaar_name}) vs PAN ({pan_name}) - {confidence:.1f}% similar")
        else:
            reasoning_parts.append(f"✓ Aadhaar-PAN consistency verified ({confidence:.1f}%)")
    
    # ADDRESS MATCHING
    if aadhaar_addr and utility_addr:
        match, confidence = fuzzy_match_address(aadhaar_addr, utility_addr)
        if not match:
            mismatch_count += 1
            mismatches["address_mismatch"] = f"{confidence:.1f}% match"
            reasoning_parts.append(f"⚠️ Address mismatch: Aadhaar vs Utility - {confidence:.1f}% similar")
        else:
            reasoning_parts.append(f"✓ Address cross-match verified ({confidence:.1f}%)")
    
    is_consistent = mismatch_count == 0
    reasoning = " | ".join(reasoning_parts)
    
    return is_consistent, reasoning, mismatches


# ============================================================================
# LAYER 3: AI DOCUMENT VALIDATION
# ============================================================================

def create_enhanced_vision_prompt(doc_type: str) -> str:
    """
    Layer 3: Enhanced Vision AI Prompt for Fraud Detection
    Detects: Blur, Tampering, Misalignment, Discoloration
    """
    
    base_instructions = {
        "aadhaar": """You are a strict Aadhaar verification agent. Analyze this Aadhaar card image for fraud indicators:

1. QUALITY CHECKS:
   - Is the image blurry (out of focus)? Rate blur: 0-100
   - Is the image properly cropped/aligned?
   - Are there obvious signs of digital manipulation?

2. SECURITY FEATURES:
   - Hologram present and undamaged?
   - QR code visible and clear?
   - All 12 digits clearly readable?
   - Security thread visible? (for physical card)

3. CONTENT EXTRACTION (must extract if readable):
   - Extract the EXACT 12-digit number into 'aadhaar_number'
   - Extract full name into 'name'
   - Extract date of birth into 'dob'
   - Extract address into 'address'

4. FRAUD FLAGS:
   - Signs of photoshop/tampering?
   - Inconsistent fonts or colors?
   - Unusual wear patterns?

OUTPUT FORMAT - ONLY valid JSON with NO markdown:
{
    "aadhaar_number": "XXXXXXXXXXXXXX",
    "name": "Full Name",
    "dob": "DD/MM/YYYY",
    "address": "Address",
    "blur_score": 0-100,
    "tampering_detected": true/false,
    "hologram_intact": true/false,
    "qr_present": true/false,
    "readability_score": 0-100,
    "fraud_flags": ["flag1", "flag2"],
    "recommendation": "VERIFIED/MANUAL_REVIEW/REJECT"
}
If unreadable or obvious forgery, return minimal JSON with recommendation: "REJECT".""",
        
        "pan": """You are a PAN verification agent. Analyze this PAN card image:

1. QUALITY: Is it blurry? Rate 0-100.
2. SECURITY: Hologram intact? Numbering sequence correct?
3. EXTRACTION:
   - PAN number (10 chars) into 'pan_number'
   - Name into 'name'
   - Date of birth into 'dob'
4. FRAUD FLAGS: Photoshopped? Fonts inconsistent?

OUTPUT JSON only:
{
    "pan_number": "XXXXXXXXXX",
    "name": "Full Name",
    "dob": "DD/MM/YYYY",
    "blur_score": 0-100,
    "tampering_detected": true/false,
    "readability_score": 0-100,
    "fraud_flags": [],
    "recommendation": "VERIFIED/MANUAL_REVIEW/REJECT"
}""",
        
        "utility": """You are a utility bill verification agent. Analyze this bill image:

1. QUALITY: Blurriness 0-100?
2. CONTENT EXTRACTION:
   - Customer name into 'name'
   - Account number into 'account_number'
   - Address into 'address'
   - Bill amount into 'amount'
   - Provider into 'provider' (e.g., "Electricity", "Gas", "Water")
3. UTILITY CONSISTENCY SCORE (0-100): Based on bill appearance, consistency, legitimacy
4. FRAUD CHECKS: Obvious fake? Photoshopped dates?

OUTPUT JSON only:
{
    "name": "Customer Name",
    "account_number": "XXXXXXXXX",
    "address": "Address",
    "amount": 1000,
    "provider": "Electricity",
    "blur_score": 0-100,
    "consistency_score": 0-100,
    "tampering_detected": true/false,
    "fraud_flags": [],
    "recommendation": "VERIFIED/MANUAL_REVIEW/REJECT"
}"""
    }
    
    return base_instructions.get(doc_type, base_instructions["aadhaar"])


# ============================================================================
# LAYER 4: RISK SCORING & AUTO-APPROVAL
# ============================================================================

class FraudRiskCalculator:
    """
    Layer 4: Comprehensive Risk Scoring (0-100 Trust Score)
    Aggregates all fraud detection signals into single trust score
    """
    
    def __init__(self):
        self.fraud_flags = []
        self.risk_factors = {}
    
    def calculate_trust_score(self, 
                             format_validation: Dict,
                             cross_match: Dict,
                             vision_results: Dict) -> Dict:
        """
        Calculate final trust score (0-100) from all layers
        
        Returns: {
            "trust_score": 0-100,
            "risk_level": "LOW|MEDIUM|HIGH|CRITICAL",
            "recommendation": "AUTO_APPROVE|MANUAL_REVIEW|REJECT",
            "fraud_flags": [...],
            "reasoning": "...",
            "escalation_priority": "NONE|LOW|HIGH|CRITICAL"
        }
        """
        trust_score = 100.0
        self.fraud_flags = []
        self.risk_factors = {}
        
        # ===== LAYER 1: Format Validation Penalties =====
        format_score = 100.0
        
        if not format_validation.get("aadhaar_valid", False):
            format_score -= 40
            self.fraud_flags.append("INVALID_AADHAAR_FORMAT")
        
        if not format_validation.get("pan_valid", False):
            format_score -= 25
            self.fraud_flags.append("INVALID_PAN_FORMAT")
        
        if format_validation.get("aadhaar_checksum_failed", False):
            format_score -= 50  # CRITICAL
            self.fraud_flags.append("AADHAAR_CHECKSUM_FAILED")
        
        self.risk_factors["format_validation"] = format_score
        trust_score *= (format_score / 100.0)
        
        # ===== LAYER 2: Cross-Document Matching Penalties =====
        match_score = 100.0
        
        if not cross_match.get("name_consistent", True):
            match_score -= 35
            self.fraud_flags.append("NAME_MISMATCH")
        
        if not cross_match.get("address_consistent", True):
            match_score -= 25
            self.fraud_flags.append("ADDRESS_MISMATCH")
        
        # Track mismatch quality
        name_confidence = cross_match.get("name_match_confidence", 100)
        if name_confidence < 70:
            match_score -= (100 - name_confidence) * 0.2
        
        self.risk_factors["cross_match"] = match_score
        trust_score *= (match_score / 100.0)
        
        # ===== LAYER 3: Vision AI Document Quality Penalties =====
        vision_score = 100.0
        
        for doc_result in vision_results.get("documents", []):
            if doc_result.get("tampering_detected", False):
                vision_score -= 40
                self.fraud_flags.append(f"TAMPERING_DETECTED_{doc_result.get('type', 'UNKNOWN').upper()}")
            
            blur = doc_result.get("blur_score", 0)
            if blur > 70:  # Very blurry
                vision_score -= 30
                self.fraud_flags.append(f"HIGH_BLUR_{doc_result.get('type', 'UNKNOWN').upper()}")
            elif blur > 40:  # Moderately blurry
                vision_score -= 10
            
            readability = doc_result.get("readability_score", 100)
            if readability < 70:
                vision_score -= (100 - readability) * 0.3
                self.fraud_flags.append(f"POOR_READABILITY_{doc_result.get('type', 'UNKNOWN').upper()}")
            
            # Fraud flags from vision
            doc_fraud_flags = doc_result.get("fraud_flags", [])
            if doc_fraud_flags:
                vision_score -= len(doc_fraud_flags) * 15
                self.fraud_flags.extend([f"VISION_{flag}" for flag in doc_fraud_flags])
        
        self.risk_factors["vision_quality"] = max(vision_score, 0)
        trust_score *= (max(vision_score, 0) / 100.0)
        
        # ===== Ensure trust_score in valid range =====
        trust_score = max(0, min(100, trust_score))
        
        # ===== DETERMINE RISK LEVEL & RECOMMENDATION =====
        if trust_score >= 85:
            risk_level = "LOW"
            recommendation = "AUTO_APPROVE"
            escalation_priority = "NONE"
        elif trust_score >= 70:
            risk_level = "MEDIUM"
            recommendation = "MANUAL_REVIEW"
            escalation_priority = "LOW"
        elif trust_score >= 50:
            risk_level = "HIGH"
            recommendation = "MANUAL_REVIEW"
            escalation_priority = "HIGH"
        else:
            risk_level = "CRITICAL"
            recommendation = "REJECT"
            escalation_priority = "CRITICAL"
        
        # ===== BUILD REASONING =====
        reasoning = self._build_reasoning(trust_score, risk_level, recommendation)
        
        return {
            "trust_score": round(trust_score, 1),
            "risk_level": risk_level,
            "recommendation": recommendation,
            "fraud_flags": self.fraud_flags,
            "risk_factors": {k: round(v, 1) for k, v in self.risk_factors.items()},
            "reasoning": reasoning,
            "escalation_priority": escalation_priority,
            "requires_human_review": recommendation == "MANUAL_REVIEW",
            "auto_approved": recommendation == "AUTO_APPROVE"
        }
    
    def _build_reasoning(self, trust_score: float, risk_level: str, recommendation: str) -> str:
        """Generate audit trail reasoning"""
        reasoning = f"Trust Score: {trust_score}/100 | Risk Level: {risk_level} | Recommendation: {recommendation}\n\n"
        
        reasoning += "Risk Factor Breakdown:\n"
        for factor, score in self.risk_factors.items():
            reasoning += f"  • {factor}: {score:.1f}/100\n"
        
        if self.fraud_flags:
            reasoning += f"\nFraud Flags ({len(self.fraud_flags)}):\n"
            for flag in self.fraud_flags:
                reasoning += f"  ⚠️ {flag}\n"
        else:
            reasoning += "\n✓ No fraud flags detected\n"
        
        return reasoning
