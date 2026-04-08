from datetime import datetime
import uuid
import requests

def scholarship_matching_node(state: dict) -> dict:
    """
    Matches student against 400+ schemes. De-duplicates checklist.
    For hackathon/demo, mocks a logic engine returning top options.
    Upgraded: can act as primary funding path for scholarship/auto flows.
    """
    profile = state.get("profile", {})
    alt_score = profile.get("alternativeCreditScore", 0)
    funding_type = (state.get("fundingType") or profile.get("fundingType") or "loan").lower().strip()

    # Inputs for scholarship matching (optional; defaults keep backward-compat)
    marks = float(profile.get("marksPercentage", 0) or 0)
    income = float(profile.get("monthlyIncome", 0) or 0)
    course = str(profile.get("educationLevel", "") or profile.get("courseName", "") or "Education").strip() or "Education"
    gender = str(profile.get("gender", "") or "").strip() or None
    category = str(profile.get("category", "") or "").strip() or None
    
    options = []
    eligible_schemes = []

    # --- Scholarship simulation (Govt + Private + NGO) ---
    # Need-based: low income
    if income > 0 and income <= 40000:
        eligible_schemes.append({
            "id": "gov_need_01",
            "name": "Govt Need-Based Tuition Support",
            "type": "need",
            "amount": 75000,
            "eligibility": f"Income ≤ ₹40,000/mo; enrolled in {course}",
            "provider": "Government",
        })
    # Merit-based: high marks
    if marks >= 85:
        eligible_schemes.append({
            "id": "gov_merit_01",
            "name": "National Merit Scholarship",
            "type": "merit",
            "amount": 60000,
            "eligibility": "Marks ≥ 85%",
            "provider": "Government",
        })
    if marks >= 92:
        eligible_schemes.append({
            "id": "priv_merit_01",
            "name": "Private Excellence Grant",
            "type": "merit",
            "amount": 50000,
            "eligibility": "Marks ≥ 92% + interview",
            "provider": "Private",
        })
    # NGO/community (broad)
    eligible_schemes.append({
        "id": "ngo_01",
        "name": "NGO Community Education Fund",
        "type": "need",
        "amount": 20000,
        "eligibility": "Needs verification + academic intent",
        "provider": "NGO",
    })
    # Optional diversity flags
    if gender and gender.lower() in ("female", "woman", "women"):
        eligible_schemes.append({
            "id": "diversity_01",
            "name": "Women in Higher Education Scholarship",
            "type": "merit",
            "amount": 30000,
            "eligibility": "Female applicants; merit/need composite",
            "provider": "Private",
        })
    if category and category.upper() in ("SC", "ST", "OBC", "EWS"):
        eligible_schemes.append({
            "id": "soc_01",
            "name": f"{category.upper()} Education Support Scheme",
            "type": "need",
            "amount": 45000,
            "eligibility": f"Category {category.upper()} + income/verification",
            "provider": "Government",
        })

    # Rank & trim to 2-5 items
    def score_scheme(s):
        score = 50
        if s["provider"] == "Government":
            score += 10
        if s["type"] == "merit":
            score += min(30, max(0, (marks - 70) * 1.0))
        if s["type"] == "need":
            score += 20 if (income > 0 and income <= 40000) else 0
        return score

    eligible_schemes = sorted(eligible_schemes, key=score_scheme, reverse=True)
    eligible_schemes = eligible_schemes[:5]
    match_score = round(score_scheme(eligible_schemes[0]) if eligible_schemes else 0, 1)
    best_option = eligible_schemes[0] if eligible_schemes else None

    # Backward compatible `options` list (used by existing UI/backend)
    for s in eligible_schemes:
        options.append({
            "id": s["id"],
            "name": s["name"],
            "type": "GRANT",
            "amount": s["amount"],
            "provider": s["provider"],
            "matchScore": score_scheme(s),
            "deduplicated_checklist": ["AADHAAR", "COLLEGE_ADMISSION_LETTER"],
        })

    # Loan option remains for loan/auto comparisons
    if alt_score > 600:
        options.append({
            "id": "loan_sparc_01",
            "name": "SPARC Zero-Collateral Education Loan",
            "type": "LOAN",
            "amount": 250000,
            "interestRate": 8.5
        })
        
    reasoning = (
        f"Matched {len(eligible_schemes)} scholarship schemes based on marks={marks}, income={income}, course={course}. "
        f"Also computed loan option context via alt-score {alt_score}. Deduplicated overlapping document requirements."
    )
    
    audit = {
        "id": f"schol_{uuid.uuid4().hex[:8]}",
        "timestamp": datetime.utcnow().isoformat(),
        "agentName": "Scholarship Logic Engine",
        "action": "SCHEMES_MATCHED",
        "reasoning": reasoning,
        "confidenceScore": 95.5
    }
    
    scholarship_matches = {
        "eligible_schemes": eligible_schemes,
        "match_score": match_score,
        "best_option": best_option,
        "inputs": {"marksPercentage": marks, "monthlyIncome": income, "course": course, "gender": gender, "category": category},
    }

    # If scholarship is the chosen path, do not call lender.
    if funding_type == "scholarship":
        return {
            "options": options,
            "scholarshipMatches": scholarship_matches,
            "audit_trail": [audit],
            "journeyStatus": "SCHOLARSHIP_MATCHED",
            "fundingType": funding_type,
        }

    # Auto: still produce scholarship matches. IMPORTANT:
    # - If the case is escalated, we must KEEP HITL_ESCALATION so it appears in Admin review.
    # - We attach scholarship matches as a recommendation, but we do not "resolve" the state.
    if funding_type == "auto":
        elig_status = state.get("journeyStatus")
        if elig_status == "HITL_ESCALATION":
            return {
                "options": options,
                "scholarshipMatches": scholarship_matches,
                "audit_trail": [audit],
                "journeyStatus": "HITL_ESCALATION",
                "fundingType": funding_type,
            }
        if elig_status == "REJECTED":
            return {
                "options": options,
                "scholarshipMatches": scholarship_matches,
                "audit_trail": [audit],
                "journeyStatus": "REJECTED",
                "fundingType": funding_type,
            }

    # Loan flow: Fire off webhook to Lender API for final Mock Execution!
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
        "scholarshipMatches": scholarship_matches if funding_type == "auto" else None,
        "audit_trail": [audit],
        "journeyStatus": disbursal_status,
        "fundingType": funding_type,
    }
