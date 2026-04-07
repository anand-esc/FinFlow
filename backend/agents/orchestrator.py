from langgraph.graph import StateGraph, END
import operator
from typing import TypedDict, Annotated, List, Dict, Any
from .document import document_intelligence_node
from .eligibility import eligibility_scoring_node
from .scholarship import scholarship_matching_node

class AuditTrail(TypedDict):
    id: str
    timestamp: str
    agentName: str
    action: str
    reasoning: str
    confidenceScore: float

class JourneyState(TypedDict):
    userId: str
    journeyStatus: str
    profile: Dict[str, Any]
    documents: List[Dict[str, Any]]
    options: List[Dict[str, Any]]
    audit_trail: Annotated[List[AuditTrail], operator.add]
    # New: Fraud detection outputs
    trustScore: float
    fraudRiskLevel: str  # LOW, MEDIUM, HIGH, CRITICAL
    requiresHumanReview: bool

def route_after_document(state: JourneyState):
    """
    Route after document verification with 4-layer fraud detection
    """
    status = state.get("journeyStatus")
    trust_score = state.get("trustScore", 0)
    
    if status == "FRAUD_LOCKOUT":
        # CRITICAL: Fraud detected → HALT immediately
        return "end"
    elif status == "HITL_ESCALATION":
        # Medium/High risk → Escalate to human
        return "end"
    elif trust_score >= 85 and status == "DOC_VERIFICATION_COMPLETE":
        # Low risk, auto-approved → Continue to eligibility
        return "continue"
    else:
        # Fallback: Go to human review
        return "end"

def route_after_eligibility(state: JourneyState):
    if state.get("journeyStatus") == "HITL_ESCALATION" or state.get("journeyStatus") == "FRAUD_LOCKOUT":
        return "end" # Escalate to human, halt autonomy
    return "continue"

def build_workflow():
    workflow = StateGraph(JourneyState)
    
    workflow.add_node("document_agent", document_intelligence_node)
    workflow.add_node("eligibility_agent", eligibility_scoring_node)
    workflow.add_node("scholarship_agent", scholarship_matching_node)
    
    workflow.set_entry_point("document_agent")
    
    workflow.add_conditional_edges(
        "document_agent",
        route_after_document,
        {
            "continue": "eligibility_agent",
            "end": END
        }
    )
    
    workflow.add_conditional_edges(
        "eligibility_agent",
        route_after_eligibility,
        {
            "continue": "scholarship_agent",
            "end": END
        }
    )
    workflow.add_edge("scholarship_agent", END)
    
    return workflow.compile()

master_agent = build_workflow()
