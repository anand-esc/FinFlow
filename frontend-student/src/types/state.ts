export type JourneyStatus = 
  | 'START' 
  | 'DOC_VERIFICATION' 
  | 'MATCHING_SCHEMES' 
  | 'LENDER_OVERSIGHT' 
  | 'DISBURSAL_PENDING'
  | 'COMPLETED';

export interface AuditTrail {
  id: string;
  timestamp: string;      // ISO string
  agentName: string;      // Master, Eligibility, Document, Scholarship, Lender
  action: string;
  reasoning: string;      // Explainable AI string
  confidenceScore?: number; // 0-100
}

export interface DocumentMetadata {
  id: string;
  type: 'KYC_AADHAAR' | 'KYC_PAN' | 'INCOME_BANK_STATEMENT' | 'ACADEMIC_TRANSCRIPT';
  status: 'UPLOADED' | 'PROCESSING' | 'VERIFIED' | 'REJECTED';
  ocrExtractedData?: Record<string, string | number>;
  verifiedAt?: string;
}

export interface StudentProfile {
  fullName: string;
  email: string;
  phone?: string;
  academicConsistencyScore?: number; 
  collegeTier?: 'TIER_1' | 'TIER_2' | 'TIER_3';
  gpa?: number;
  utilityHistoryScore?: number;
  extracurriculars?: string[];
  alternativeCreditScore?: number;   
}

export interface ErrorRollback {
  failedEndpoint: string;
  errorPayload: string;
  timestamp: string;
  resolved: boolean;
}

export interface StudentJourneyState {
  userId: string;
  journeyState: JourneyStatus;
  studentProfile: Partial<StudentProfile>;
  documentVault: DocumentMetadata[];
  agentMemory: AuditTrail[];
  errorRollback: ErrorRollback[];
  updatedAt: string;
}
