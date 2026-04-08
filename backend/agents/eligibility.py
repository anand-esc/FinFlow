from datetime import datetime
import uuid

def eligibility_scoring_node(state: dict) -> dict:
    """
    Upgraded Eligibility & Risk Engine matching Government Policy vs strict Bank filters.
    Computes FOIR (Fixed Obligations to Income Ratio), evaluates CIBIL, College tiers, and generates Policy vs Bank risk vectors.
    """
    profile = state.get("profile", {})
    
    # 1. Parse Financials
    try:
        monthly_income = float(profile.get("monthlyIncome", 0))
        existing_emis = float(profile.get("existingEmis", 0))
        req_loan = float(profile.get("loanAmountRequired", 0))
        tenure = max(1, float(profile.get("loanTenure", 12)))
        cibil = int(profile.get("cibilScore", 0))
    except ValueError:
        monthly_income = existing_emis = req_loan = tenure = cibil = 0

    # Rough EMI estimate (flat 10% interest for simulation)
    proposed_emi = (req_loan * 1.1) / tenure
    total_obligations = existing_emis + proposed_emi
    foir = (total_obligations / monthly_income) * 100 if monthly_income > 0 else 100

    # 2. Risk Modifiers
    college_tier = profile.get("universityRanking", "")
    has_co_applicant = profile.get("hasCoApplicant", False)
    co_cibil_raw = profile.get("coApplicantCibil", "0")
    co_cibil = int(co_cibil_raw) if str(co_cibil_raw).isdigit() else 0
    collateral = profile.get("collateral", "No")

    # 3. Policy (Government) Engine - Highly lenient for education access
    policy_approved = True
    policy_reasons = []
    
    if monthly_income < 10000:
        policy_approved = False
        policy_reasons.append("Income below minimum poverty line guidelines.")
    else:
        policy_reasons.append("Meets minimum basic income thresholds.")
        
    if cibil > 0 and cibil < 550:
        policy_approved = False
        policy_reasons.append("CIBIL critically low (< 550).")
    else:
        policy_reasons.append("CIBIL meets baseline minimums.")


    # 4. Bank (Lender) Engine - Stricter on FOIR and CIBIL
    bank_approved = True
    bank_reasons = []

    # Bank constraints
    if foir > 50.0:
        # High FOIR. Can it be mitigated?
        if has_co_applicant and co_cibil >= 750:
            bank_reasons.append(f"FOIR high ({foir:.1f}%), but mitigated by strong Co-Applicant.")
        elif collateral == "Yes":
            bank_reasons.append(f"FOIR high ({foir:.1f}%), but mitigated by provided Collateral.")
        else:
            bank_approved = False
            bank_reasons.append(f"FOIR critical ({foir:.1f}% > 50%). Too much existing debt. Needs Co-applicant or Collateral.")
    else:
        bank_reasons.append(f"FOIR is healthy ({foir:.1f}%).")

    if cibil > 0 and cibil < 700:
        if college_tier == "Top Tier":
            bank_reasons.append(f"CIBIL low ({cibil}), but waived due to Top Tier University admission.")
        else:
            bank_approved = False
            bank_reasons.append(f"CIBIL ({cibil}) falls short of prime lending standard (700).")
    elif cibil == 0:
         # No credit history
         if not has_co_applicant:
             bank_approved = False
             bank_reasons.append("No credit history found. Co-applicant required.")
         else:
             bank_reasons.append("No credit history, but Co-Applicant provided.")

    # Determine Orchestration Status
    if policy_approved and bank_approved:
        status = "ELIGIBILITY_SCORED"
        prob = 92.0
        reasoning = "Approved by both Policy and Bank risk models."
    elif policy_approved and not bank_approved:
        status = "HITL_ESCALATION"
        prob = 45.0
        reasoning = "Mismatch: Policy eligible, but rejected by Bank rules. Escalating for manual waiver or What-If scenario."
    else:
        status = "REJECTED"
        prob = 10.0
        reasoning = "Critically rejected by central policy."

    # Persist signals for downstream scholarship/auto matching (non-breaking additive fields)
    profile["policyApproved"] = policy_approved
    profile["bankApproved"] = bank_approved
    profile["foir"] = round(foir, 1)

    audit_trail = [{
        "id": f"elig_{uuid.uuid4().hex[:8]}",
        "timestamp": datetime.utcnow().isoformat(),
        "agentName": "Risk Assessor Agent",
        "action": "EVALUATE_POLICY_VS_BANK",
        "reasoning": reasoning,
        "confidenceScore": prob,
        "details": {
            "foir": f"{foir:.1f}%",
            "policy_decision": "PASS" if policy_approved else "FAIL",
            "bank_decision": "PASS" if bank_approved else "FAIL",
            "bank_reasons": bank_reasons,
            "policy_reasons": policy_reasons
        }
    }]
    
    return {"profile": profile, "audit_trail": audit_trail, "journeyStatus": status}

