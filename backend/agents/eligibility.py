from datetime import datetime
import uuid

def eligibility_scoring_node(state: dict) -> dict:
    """
    Bias-aware eligibility model using Alternative Data instead of formal income/CIBIL.
    """
    profile = state.get("profile", {})
    
    gpa = profile.get("gpa", 0.0)
    utility = profile.get("utilityHistoryScore", 0.0)
    
    # Assume default values if empty for demo
    if gpa == 0.0: gpa = 7.5
    if utility == 0.0: utility = 70.0

    # Alternative Credit Score Formula (bias-free)
    base_score = 300
    academic_component = (gpa / 10.0) * 400
    utility_component = (utility / 100.0) * 300
    
    alt_score = round(base_score + academic_component + utility_component)
    profile["alternativeCreditScore"] = alt_score
    
    audit_trail = []
    
    # Human-in-the-loop Escalation Layer
    if alt_score < 400:
        reasoning = f"Alt-Score ({alt_score}) below threshold. Escalating to Human-in-the-loop (HITL) for manual counsellor assessment."
        status = "HITL_ESCALATION"
        confidence = 50.0
    else:
        reasoning = f"Calculated Alt-Score ({alt_score}) using Academic ({gpa}/10) & Utility ({utility}/100) consistency data. Zero reliance on formal income."
        status = "ELIGIBILITY_SCORED"
        confidence = 98.0
        
    audit_trail.append({
        "id": f"elig_{uuid.uuid4().hex[:8]}",
        "timestamp": datetime.utcnow().isoformat(),
        "agentName": "Risk Assessor Agent",
        "action": "SCORED_ELIGIBILITY",
        "reasoning": reasoning,
        "confidenceScore": confidence
    })
    
    return {"profile": profile, "audit_trail": audit_trail, "journeyStatus": status}
