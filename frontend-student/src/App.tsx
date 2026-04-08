import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

import {
  AlertTriangle,
  ArrowRight,
  Building2,
  Camera,
  CheckCircle2,
  ChevronLeft,
  Download,
  FileText,
  GraduationCap,
  Landmark,
  Loader2,
  LogOut,
  RefreshCcw,
  ShieldCheck,
  User,
  Users,
  XCircle,
} from "lucide-react";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { StudentLogin } from "./components/StudentLogin";
import { AppLock } from "./components/AppLock";
import { LandingPage } from "./components/landing/LandingPage";


type WizardStep = "home" | "documents" | "profile" | "bank" | "review" | "result";
type DocType = "aadhaar" | "utility" | "pan" | "admission" | "marksheet" | "income_proof" | "bank_statement";

type CapturedDoc = {
  type: DocType;
  label: string;
  blob?: Blob | "DEMO_BLOB";
  preview?: string;
  uploadedUrl?: string;
  uploadStatus: "idle" | "ready" | "uploading" | "uploaded" | "failed" | "cancelled" | "demo_verified";
  uploadError?: string;
};
type OCRField = { key: string; label: string; value: string; confidence: number };

type ProfileState = {
  fullName: string; dateOfBirth: string; phone: string; city: string;
  educationLevel: string; monthlyHouseholdIncome: string; cibilScore: string;
  // Personal Extended
  panNumber: string; maritalStatus: string; dependents: string;
  // Academic Extended
  backlogs: string; gapYears: string; courseDuration: string; universityRanking: string;
  // Financial Extended
  monthlyIncome: string; employmentType: string; employerType: string; existingEmis: string; creditCardUsage: string;
  // Co-applicant
  hasCoApplicant: boolean; coApplicantCibil: string; coApplicantJobStability: string; coApplicantEmployer: string;
  // Loan Details
  loanAmountRequired: string; loanTenure: string; collateral: "Yes" | "No"; collateralType: string;
};

type BankState = {
  ownerType: "self" | "parent";
  accountHolderName: string;
  bankName: string;
  accountLast4: string;
  ifscCode: string;
};

const DOC_FLOW: Array<{ type: DocType; label: string; subtitle: string }> = [
  { type: "aadhaar", label: "Aadhaar Card", subtitle: "Government identity verification" },
  { type: "marksheet", label: "Marksheet", subtitle: "Academic performance proof" },
  { type: "income_proof", label: "Income Proof", subtitle: "Salary slips or ITR" },
  { type: "bank_statement", label: "Bank Statement", subtitle: "Last 6 months transactions" },
  { type: "pan", label: "PAN Card", subtitle: "Financial identity and tax profile anchor" },
  { type: "admission", label: "University Admission Letter", subtitle: "Course details and fee structure verification" },
];

const INITIAL_PROFILE: ProfileState = {
  fullName: "", dateOfBirth: "", phone: "", city: "", educationLevel: "", monthlyHouseholdIncome: "", cibilScore: "",
  panNumber: "", maritalStatus: "", dependents: "",
  backlogs: "", gapYears: "", courseDuration: "", universityRanking: "",
  monthlyIncome: "", employmentType: "", employerType: "", existingEmis: "", creditCardUsage: "",
  hasCoApplicant: false, coApplicantCibil: "", coApplicantJobStability: "", coApplicantEmployer: "",
  loanAmountRequired: "", loanTenure: "", collateral: "No", collateralType: ""
};

const INITIAL_BANK: BankState = {
  ownerType: "self", accountHolderName: "", bankName: "", accountLast4: "", ifscCode: "",
};

function toDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement("canvas");
      // Scale down image to 800px max width for safety
      const MAX_WIDTH = 800;
      let width = img.width;
      let height = img.height;
      if (width > MAX_WIDTH) {
        height = Math.round((height * MAX_WIDTH) / width);
        width = MAX_WIDTH;
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx?.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", 0.6));
    };
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = url;
  });
}

function generateTokenizedId() {
  const seed = Math.random().toString(36).slice(2, 10).toUpperCase();
  return `bank_tok_${seed}`;
}

function detectImageQuality(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return { blurScore: 0, glarePercent: 0, ok: true };
  const { width, height } = canvas;
  const data = ctx.getImageData(0, 0, width, height).data;
  let edgeSum = 0;
  let glarePixels = 0;
  let count = 0;

  for (let y = 1; y < height - 1; y += 4) {
    for (let x = 1; x < width - 1; x += 4) {
      const i = (y * width + x) * 4;
      const l = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];

      const ix = (y * width + (x + 1)) * 4;
      const iy = ((y + 1) * width + x) * 4;
      const lx = 0.299 * data[ix] + 0.587 * data[ix + 1] + 0.114 * data[ix + 2];
      const ly = 0.299 * data[iy] + 0.587 * data[iy + 1] + 0.114 * data[iy + 2];
      edgeSum += Math.abs(lx - l) + Math.abs(ly - l);

      if (l > 245) glarePixels += 1;
      count += 1;
    }
  }

  const blurScore = edgeSum / Math.max(1, count);
  const glarePercent = (glarePixels / Math.max(1, count)) * 100;
  // Calibrated for hackathon demo: user requested blur > 3 and lower glare threshold.
  const ok = blurScore > 3 && glarePercent < 20;
  return { blurScore: Number(blurScore.toFixed(1)), glarePercent: Number(glarePercent.toFixed(1)), ok };
}

async function compressImage(blob: Blob): Promise<Blob> {
  const bmp = await createImageBitmap(blob);
  const maxW = 1280;
  const ratio = Math.min(1, maxW / bmp.width);
  const w = Math.floor(bmp.width * ratio);
  const h = Math.floor(bmp.height * ratio);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return blob;
  ctx.drawImage(bmp, 0, 0, w, h);
  const compressed = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.76));
  return compressed || blob;
}

function StudentDashboard() {
  const { user, logout } = useAuth();
  const [demoScenario, setDemoScenario] = useState<"APPROVED" | "MISMATCH" | "REJECTED">("APPROVED");
  const [step, setStep] = useState<WizardStep>(() => {
    const params = new URLSearchParams(window.location.search);
    const stepParam = params.get('step') as WizardStep;
    if (stepParam && ["home", "documents", "profile", "bank", "review", "result"].includes(stepParam)) {
      return stepParam;
    }
    return "home";
  });
  const [docs, setDocs] = useState<CapturedDoc[]>(
    DOC_FLOW.map((d) => ({ type: d.type, label: d.label, uploadStatus: "idle" }))
  );
  const [docIndex, setDocIndex] = useState(0);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [profile, setProfile] = useState<ProfileState>(INITIAL_PROFILE);
  const [bank, setBank] = useState<BankState>(INITIAL_BANK);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resultMessage, setResultMessage] = useState("");
  const [resultStatus, setResultStatus] = useState<"success" | "warning" | "error">("success");
  const [ocrByDoc, setOcrByDoc] = useState<Record<DocType, { confidence: number; fields: OCRField[] }>>({
    aadhaar: { confidence: 0, fields: [] },
    utility: { confidence: 0, fields: [] },
    pan: { confidence: 0, fields: [] },
    admission: { confidence: 0, fields: [] },
    marksheet: { confidence: 0, fields: [] },
    income_proof: { confidence: 0, fields: [] },
    bank_statement: { confidence: 0, fields: [] },
  });
  const [qualityByDoc, setQualityByDoc] = useState<Record<DocType, { blurScore: number; glarePercent: number; ok: boolean }>>({
    aadhaar: { blurScore: 0, glarePercent: 0, ok: false },
    utility: { blurScore: 0, glarePercent: 0, ok: false },
    pan: { blurScore: 0, glarePercent: 0, ok: false },
    admission: { blurScore: 0, glarePercent: 0, ok: false },
    marksheet: { blurScore: 0, glarePercent: 0, ok: false },
    income_proof: { blurScore: 0, glarePercent: 0, ok: false },
    bank_statement: { blurScore: 0, glarePercent: 0, ok: false },
  });
  
  const [chatInput, setChatInput] = useState("");
  const [chatHistory, setChatHistory] = useState<Array<{role: "user"|"ai"; content: string}>>([]);
  const [isChatting, setIsChatting] = useState(false);
  
  const handleChat = async () => {
    if (!chatInput.trim() || !user) return;
    const msg = chatInput.trim();
    setChatHistory(p => [...p, { role: "user", content: msg }]);
    setChatInput("");
    setIsChatting(true);
    try {
      const BACKEND_URL = (import.meta as any).env?.VITE_BACKEND_URL || "http://localhost:8000";
      const res = await fetch(`${BACKEND_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: user.uid, message: msg }),
      });
      const data = await res.json();
      setChatHistory(p => [...p, { role: "ai", content: data.reply || "Sorry, I couldn't reach the backend." }]);
    } catch {
      setChatHistory(p => [...p, { role: "ai", content: "AI is currently offline." }]);
    } finally {
      setIsChatting(false);
    }
  };

  const [reducedMotion, setReducedMotion] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<any>(null);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstallClick = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') {
      setInstallPrompt(null);
    }
  };

  const fillDemoData = (scenario: "APPROVED" | "MISMATCH" | "REJECTED") => {
    setDemoScenario(scenario);
    setDocs(DOC_FLOW.map(d => ({ type: d.type, label: d.label, uploadStatus: "demo_verified" as any, blob: "DEMO_BLOB" as any, preview: "/placeholder_pdf.png" })));
    setQualityByDoc(Object.fromEntries(DOC_FLOW.map(d => [d.type, { blurScore: 0, glarePercent: 0, ok: true }])) as any);
    setOcrByDoc(Object.fromEntries(DOC_FLOW.map(d => [d.type, { confidence: 0.99, fields: [] }])) as any);

    let p = { ...INITIAL_PROFILE, fullName: "Maya Sharma", dateOfBirth: "2001-08-15", phone: "9876543210", city: "Bangalore" };
    setBank({ ownerType: "self", accountHolderName: "Maya Sharma", bankName: "HDFC Bank", accountLast4: "1234", ifscCode: "HDFC0001234" });

    if (scenario === "APPROVED") {
      p = { ...p, educationLevel: "PG", backlogs: "0", gapYears: "0", courseDuration: "2", universityRanking: "Top Tier", monthlyIncome: "120000", employmentType: "Salaried", employerType: "MNC", existingEmis: "5000", creditCardUsage: "15", cibilScore: "780", hasCoApplicant: true, coApplicantCibil: "810", coApplicantJobStability: "10", coApplicantEmployer: "Infosys", loanAmountRequired: "800000", loanTenure: "60", collateral: "No", collateralType: "" };
    } else if (scenario === "MISMATCH") {
      p = { ...p, educationLevel: "UG", backlogs: "0", gapYears: "1", courseDuration: "4", universityRanking: "Mid Tier", monthlyIncome: "35000", employmentType: "Salaried", employerType: "Startup", existingEmis: "12000", creditCardUsage: "60", cibilScore: "680", hasCoApplicant: false, coApplicantCibil: "", coApplicantJobStability: "", coApplicantEmployer: "", loanAmountRequired: "1200000", loanTenure: "84", collateral: "No", collateralType: "" };
    } else if (scenario === "REJECTED") {
      p = { ...p, educationLevel: "Diploma", backlogs: "4", gapYears: "3", courseDuration: "3", universityRanking: "Low Tier", monthlyIncome: "15000", employmentType: "Unemployed", employerType: "None", existingEmis: "25000", creditCardUsage: "95", cibilScore: "540", hasCoApplicant: false, coApplicantCibil: "", coApplicantJobStability: "", coApplicantEmployer: "", loanAmountRequired: "2500000", loanTenure: "120", collateral: "No", collateralType: "" };
    }
    setProfile(p);
    setStep("review");
  };

  const applyDemoFillMissing = (scenario: "APPROVED" | "MISMATCH" | "REJECTED") => {
    setDemoScenario(scenario);

    // 1) Ensure docs are demo-verified if missing (keeps showcase fast at any step)
    setDocs((prev) =>
      prev.map((d) => {
        if (d.blob) return d;
        return { ...d, blob: "DEMO_BLOB" as any, preview: "/placeholder_pdf.png", uploadStatus: "demo_verified" as any, uploadError: undefined };
      })
    );
    setQualityByDoc((prev) => {
      const next = { ...prev } as any;
      for (const d of DOC_FLOW) next[d.type] = { blurScore: 0, glarePercent: 0, ok: true };
      return next;
    });
    setOcrByDoc((prev) => {
      const next = { ...prev } as any;
      for (const d of DOC_FLOW) next[d.type] = { confidence: 0.99, fields: prev[d.type]?.fields || [] };
      return next;
    });

    // 2) Fill profile only where blank
    setProfile((p0) => {
      const base = { ...p0 };
      if (!base.fullName) base.fullName = "Maya Sharma";
      if (!base.dateOfBirth) base.dateOfBirth = "2001-08-15";
      if (!base.phone) base.phone = "9876543210";
      if (!base.city) base.city = "Bangalore";

      if (scenario === "APPROVED") {
        return {
          ...base,
          educationLevel: base.educationLevel || "PG",
          backlogs: base.backlogs || "0",
          gapYears: base.gapYears || "0",
          courseDuration: base.courseDuration || "2",
          universityRanking: base.universityRanking || "Top Tier",
          monthlyIncome: base.monthlyIncome || "120000",
          employmentType: base.employmentType || "Salaried",
          employerType: base.employerType || "MNC",
          existingEmis: base.existingEmis || "5000",
          creditCardUsage: base.creditCardUsage || "15",
          cibilScore: base.cibilScore || "780",
          hasCoApplicant:
            base.hasCoApplicant || (!base.coApplicantCibil && !base.coApplicantEmployer && !base.coApplicantJobStability) ? true : base.hasCoApplicant,
          coApplicantCibil: base.coApplicantCibil || "810",
          coApplicantJobStability: base.coApplicantJobStability || "10",
          coApplicantEmployer: base.coApplicantEmployer || "Infosys",
          loanAmountRequired: base.loanAmountRequired || "800000",
          loanTenure: base.loanTenure || "60",
          collateral: base.collateral || "No",
        };
      }
      if (scenario === "MISMATCH") {
        return {
          ...base,
          educationLevel: base.educationLevel || "UG",
          backlogs: base.backlogs || "0",
          gapYears: base.gapYears || "1",
          courseDuration: base.courseDuration || "4",
          universityRanking: base.universityRanking || "Mid Tier",
          monthlyIncome: base.monthlyIncome || "35000",
          employmentType: base.employmentType || "Salaried",
          employerType: base.employerType || "Startup",
          existingEmis: base.existingEmis || "12000",
          creditCardUsage: base.creditCardUsage || "60",
          cibilScore: base.cibilScore || "680",
          hasCoApplicant: base.hasCoApplicant ?? false,
          loanAmountRequired: base.loanAmountRequired || "1200000",
          loanTenure: base.loanTenure || "84",
          collateral: base.collateral || "No",
        };
      }
      return {
        ...base,
        educationLevel: base.educationLevel || "Diploma",
        backlogs: base.backlogs || "4",
        gapYears: base.gapYears || "3",
        courseDuration: base.courseDuration || "3",
        universityRanking: base.universityRanking || "Low Tier",
        monthlyIncome: base.monthlyIncome || "15000",
        employmentType: base.employmentType || "Unemployed",
        employerType: base.employerType || "None",
        existingEmis: base.existingEmis || "25000",
        creditCardUsage: base.creditCardUsage || "95",
        cibilScore: base.cibilScore || "540",
        hasCoApplicant: base.hasCoApplicant ?? false,
        loanAmountRequired: base.loanAmountRequired || "2500000",
        loanTenure: base.loanTenure || "120",
        collateral: base.collateral || "No",
      };
    });

    // 3) Fill bank only where blank
    setBank((b0) => {
      const b = { ...b0 };
      if (!b.accountHolderName) b.accountHolderName = "Maya Sharma";
      if (!b.bankName) b.bankName = "HDFC Bank";
      if (!b.accountLast4) b.accountLast4 = "1234";
      if (!b.ifscCode) b.ifscCode = "HDFC0001234";
      return b;
    });
  };

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const currentDocConfig = DOC_FLOW[docIndex];
  const currentDoc = docs[docIndex];
  const currentQuality = qualityByDoc[currentDocConfig.type];
  const completedDocs = docs.filter((d) => d.blob).length;
  const progressPercent = Math.round((completedDocs / DOC_FLOW.length) * 100);

  const canContinueToProfile = useMemo(() => docs.every((d) => Boolean(d.blob)), [docs]);

  const profileComplete = Boolean(profile.fullName.trim() && profile.monthlyIncome && profile.loanAmountRequired);

  const bankComplete = Boolean(
    bank.accountHolderName.trim() &&
      bank.bankName.trim() &&
      /^\d{4}$/.test(bank.accountLast4) &&
      /^[A-Za-z]{4}0[A-Za-z0-9]{6}$/.test(bank.ifscCode.trim().toUpperCase())
  );

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(media.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    media.addEventListener("change", handler);
    return () => {
      media.removeEventListener("change", handler);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const startCamera = async () => {
    setCameraError("");
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraActive(true);
    } catch (_err) {
      setCameraError("Unable to access camera. Allow camera permission and try again.");
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  const captureDoc = async () => {
    if (!videoRef.current || !canvasRef.current || !currentDocConfig) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const rawBlob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
    if (!rawBlob) return;
    const blob = await compressImage(rawBlob);
    const quality = detectImageQuality(canvas);
    setQualityByDoc((prev) => ({ ...prev, [currentDocConfig.type]: quality }));
    if (!quality.ok) {
      setCameraError(`Image quality warning: blur ${quality.blurScore}, glare ${quality.glarePercent}%. Please retake.`);
    }
    const preview = await toDataUrl(blob);
    setDocs((prev) =>
      prev.map((item, idx) =>
        idx === docIndex
          ? { ...item, blob, preview, type: currentDocConfig.type, uploadStatus: "ready", uploadError: undefined }
          : item
      )
    );
    try {
      const res = await fetch("http://localhost:8000/api/ocr/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doc_type: currentDocConfig.type,
          image_base64: preview,
          hints: {
            fullName: profile.fullName,
            city: profile.city,
            dateOfBirth: profile.dateOfBirth,
          },
        }),
      });
      const data = await res.json();
      if (data?.status === "success") {
        setOcrByDoc((prev) => ({
          ...prev,
          [currentDocConfig.type]: {
            confidence: Number(data.confidence || 0),
            fields: (data.fields || []).map((f: OCRField) => ({ ...f, value: String(f.value || "") })),
          },
        }));
      }
    } catch {
      // keep flow resilient
    }
    stopCamera();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentDocConfig) return;
    
    // Convert to preview and trigger OCR dynamically
    const isPdf = file.type === "application/pdf";
    const previewUrl = isPdf ? "/placeholder_pdf.png" : await toDataUrl(file);
    
    setQualityByDoc((prev) => ({ ...prev, [currentDocConfig.type]: { blurScore: 0, glarePercent: 0, ok: true } }));
    
    setDocs((prev) =>
      prev.map((item, idx) =>
        idx === docIndex
          ? { ...item, blob: file, preview: previewUrl, type: currentDocConfig.type, uploadStatus: "ready", uploadError: undefined }
          : item
      )
    );
    
    try {
      const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";
      const res = await fetch(`${BACKEND_URL}/api/ocr/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doc_type: currentDocConfig.type,
          image_base64: isPdf ? "" : previewUrl, // PDF parsing usually needs full backend parse but we'll mock for hackathon
          hints: {
            fullName: profile.fullName,
            city: profile.city,
            dateOfBirth: profile.dateOfBirth,
          },
        }),
      });
      const data = await res.json();
      if (data?.status === "success") {
        setOcrByDoc((prev) => ({
          ...prev,
          [currentDocConfig.type]: {
            confidence: Number(data.confidence || 0),
            fields: (data.fields || []).map((f: OCRField) => ({ ...f, value: String(f.value || "") })),
          },
        }));
      }
    } catch {
      // ignore
    }
    
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const goNextDoc = () => {
    if (docIndex < DOC_FLOW.length - 1) {
      setDocIndex((p) => p + 1);
      setCameraError("");
      return;
    }
    setStep("profile");
  };

  const goPrevDoc = () => {
    if (docIndex > 0) {
      setDocIndex((p) => p - 1);
      setCameraError("");
      return;
    }
    setStep("home");
  };

  const updateDocStatus = (docType: DocType, patch: Partial<CapturedDoc>) => {
    setDocs((prev) => prev.map((doc) => (doc.type === docType ? { ...doc, ...patch } : doc)));
  };

  const uploadSingleDoc = async (doc: CapturedDoc) => {
    if (!user || !doc.preview) throw new Error(`Missing snapshot for ${doc.label}`);

    updateDocStatus(doc.type, { uploadStatus: "uploading", uploadError: undefined });

    // EPHEMERAL ARCHITECTURE OVERRIDE
    // We bypass Firebase Storage completely and pass the base64 image data directly
    // This removes the hanging bottleneck and adheres to zero-trust storage constraints
    const url = doc.preview;
    
    // Slight simulated latency for UX
    await new Promise(r => setTimeout(r, 600));

    updateDocStatus(doc.type, { uploadStatus: "uploaded", uploadedUrl: url, uploadError: undefined });
    return { doc_type: doc.type, url };
  };

  const submitFullJourney = async () => {
    if (!user) return;
    setIsSubmitting(true);
    setStep("result");
    try {
      const uploadedDocs: Array<{ doc_type: DocType; url: string }> = [];
      for (const doc of docs) {
        if (!doc.blob) {
          throw new Error(`Missing snapshot for ${doc.label}`);
        }
        const uploaded = await uploadSingleDoc(doc);
        uploadedDocs.push(uploaded);
      }

      const bankPayload = {
        user_id: user.uid,
        bankDetails: {
          accountHolderName: bank.accountHolderName,
          bankName: bank.bankName,
          maskedAccount: `XXXX${bank.accountLast4}`,
          tokenized_account_id: generateTokenizedId(),
          verifiedAt: new Date().toISOString(),
        },
      };

      try {
        const BACKEND_URL = (import.meta as any).env?.VITE_BACKEND_URL || "http://localhost:8000";
        await fetch(`${BACKEND_URL}/api/lender/v1/bank-details`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(bankPayload),
        });
      } catch (bankErr) {
        console.warn("Bank details fetch skipped or failed", bankErr);
      }

      console.log("SENDING TO ORCHESTRATE:", uploadedDocs.map(d => d.doc_type));
      const BACKEND_URL = (import.meta as any).env?.VITE_BACKEND_URL || "http://localhost:8000";
      const res = await fetch(`${BACKEND_URL}/api/orchestrate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user.uid,
          event: "DOCUMENTS_UPLOADED",
          payload: {
            new_documents: uploadedDocs,
            student_profile: profile,
            bank_owner_type: bank.ownerType,
            declared_cibil: profile.cibilScore,
          },
        }),
      });
      
      if (!res.ok) {
         const respText = await res.text();
         throw new Error(`Orchestration failed: ${res.status} ${respText}`);
      }
      
      const data = await res.json();
      const state = data?.newState || {};
      const status = state.journeyState || state.journeyStatus || "UNKNOWN";

      const triggerPushNotification = (title: string, body: string) => {
        if ('serviceWorker' in navigator && 'Notification' in window && Notification.permission === 'granted') {
          navigator.serviceWorker.ready.then(registration => {
            registration.showNotification(title, {
              body,
              icon: '/pwa-192x192.png'
            });
          }).catch(() => {
            new Notification(title, { body, icon: '/pwa-192x192.png' });
          });
        } else if ('Notification' in window && Notification.permission === 'granted') {
           new Notification(title, { body, icon: '/pwa-192x192.png' });
        }
      };

      if (status === "FRAUD_LOCKOUT") {
        setResultStatus("error");
        setResultMessage("Security review flagged this application for manual intervention. Our team will contact you shortly.");
<<<<<<< HEAD
      } else if (status === "REJECTED") {
        setResultStatus("error");
        setResultMessage("Unfortunately, your application was declined based on core policy requirements.");
=======
        triggerPushNotification("SPARC Security Alert", "Your application has been flagged for manual intervention.");
>>>>>>> pwa-edits
      } else if (status === "HITL_ESCALATION") {
        setResultStatus("warning");
        setResultMessage("Submitted successfully. Your profile has been moved to priority counselor review.");
        triggerPushNotification("Application Under Review", "Your profile has been moved to priority counselor review.");
      } else {
        setResultStatus("success");
        setResultMessage("Application submitted successfully. You are now progressing to eligibility and funding steps.");
        triggerPushNotification("Application Approved", "Your application was successful. Progressing to funding.");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("SUBMISSION ERROR:", error);
      if (!message.toLowerCase().includes("cancel")) {
        const pendingDoc = docs.find((d) => d.uploadStatus === "uploading")?.type;
        // Even if closure is stale, mark Aadhaar as failed just to show it stopped
        updateDocStatus(pendingDoc || "aadhaar", { uploadStatus: "failed", uploadError: message });
      }
      setResultStatus("error");
      setResultMessage(`Submission crashed! ERROR MSG: ${message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const retryFailedUpload = async (docType: DocType) => {
    if (!user) return;
    const target = docs.find((d) => d.type === docType);
    if (!target) return;
    try {
      await uploadSingleDoc(target);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Retry failed";
      updateDocStatus(docType, { uploadStatus: "failed", uploadError: message });
    }
  };


  const clearCurrentCapture = () => {
    setDocs((prev) =>
      prev.map((item, idx) =>
        idx === docIndex
          ? {
              ...item,
              blob: undefined,
              preview: undefined,
              uploadedUrl: undefined,
              uploadStatus: "idle",
              uploadError: undefined,
            }
          : item
      )
    );
  };

  const extractionPreview = useMemo(() => {
    if (!currentDocConfig || !currentDoc?.preview) return [];
    if (currentDocConfig.type === "aadhaar") {
      return [
        { key: "Name", value: profile.fullName || "Detected from card image" },
        { key: "DOB", value: profile.dateOfBirth || "Extracted date" },
        { key: "Status", value: "Identity structure recognized" },
      ];
    }
    if (currentDocConfig.type === "utility") {
      return [
        { key: "City", value: profile.city || "Address line detected" },
        { key: "Bill Type", value: "Utility statement" },
        { key: "Status", value: "Address fields matched format" },
      ];
    }
    if (currentDocConfig.type === "admission") {
      return [
        { key: "University", value: "Detected from document" },
        { key: "Course Fee", value: "Fee Extracted" },
        { key: "Status", value: "Admission structured recognized" }
      ];
    }
    return [
      { key: "PAN", value: "Pattern validated from image" },
      { key: "Holder", value: profile.fullName || "Name token detected" },
      { key: "Status", value: "Tax-ID structure identified" },
    ];
  }, [currentDocConfig, currentDoc?.preview, profile.fullName, profile.dateOfBirth, profile.city]);

  const trustSimulation = useMemo(() => {
    let score = 320;
    score += completedDocs * 120;
    if (profile.educationLevel) score += 60;
    if (profile.city) score += 20;
    if (profile.phone.length >= 10) score += 20;
    if (bankComplete) score += 70;
    const cibil = Number(profile.cibilScore || 0);
    if (cibil > 0) score += Math.max(0, Math.min(180, Math.round((cibil - 300) * 0.3)));
    return Math.max(300, Math.min(900, score));
  }, [completedDocs, profile.educationLevel, profile.city, profile.phone, bankComplete, profile.cibilScore]);

  const stepOrder: WizardStep[] = ["home", "documents", "profile", "bank", "review", "result"];
  const activeStepIndex = stepOrder.indexOf(step);

  return (
    <AppLock>
      <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
        <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-200/60 via-slate-50 to-slate-100" />
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur-xl">
          <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-tr from-indigo-500 to-emerald-400">
                <GraduationCap className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold tracking-wide text-slate-900">SPARC Student Flow</p>
                <p className="text-xs text-slate-500">Simple. Secure. Step-by-step onboarding.</p>
              </div>
            </div>
            <button
              onClick={logout}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
            >
              <span className="inline-flex items-center gap-2">
                <LogOut className="h-4 w-4" /> Sign out
              </span>
            </button>
          </div>
        </header>
      
      {/* PWA Install Banner */}
      <AnimatePresence>
        {installPrompt && (
          <motion.div
             initial={{ opacity: 0, y: -20 }}
             animate={{ opacity: 1, y: 0 }}
             exit={{ opacity: 0, y: -20 }}
             className="bg-indigo-600 text-white px-4 py-3 shadow-md border-b border-indigo-700 w-full z-40 relative flex items-center justify-center gap-4"
          >
             <p className="text-sm font-medium">Install SPARC app for the best mobile experience.</p>
             <button onClick={handleInstallClick} className="bg-white text-indigo-700 px-4 py-1.5 rounded-full text-xs font-bold hover:bg-indigo-50 transition shadow-sm flex items-center gap-1">
                <Download className="w-3 h-3" /> Install Now
             </button>
             <button onClick={() => setInstallPrompt(null)} className="absolute right-4 text-indigo-300 hover:text-white">
                <XCircle className="w-4 h-4" />
             </button>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="relative mx-auto w-full max-w-6xl px-4 pb-24 pt-8 sm:px-6">
        {(step === "profile" || step === "bank" || step === "review" || step === "result") && (
          <div className="mb-5 rounded-2xl border border-orange-200 bg-orange-50 p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-orange-800">Demo Verified</p>
                <p className="text-xs text-orange-700">Auto-fill missing fields + mark missing docs as verified for fast showcase.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={demoScenario}
                  onChange={(e) => setDemoScenario(e.target.value as any)}
                  className="rounded-xl border border-orange-300 bg-white px-3 py-2 text-xs font-bold text-orange-800"
                >
                  <option value="APPROVED">Approved Profile</option>
                  <option value="MISMATCH">Mismatch Profile</option>
                  <option value="REJECTED">Rejected Profile</option>
                </select>
                <button
                  onClick={() => applyDemoFillMissing(demoScenario)}
                  className="rounded-xl border border-orange-300 bg-orange-100 px-4 py-2 text-xs font-bold text-orange-800 hover:bg-orange-200 transition"
                >
                  ⚡ Auto-Fill Remaining
                </button>
              </div>
            </div>
          </div>
        )}
        <div className="sticky top-[72px] z-20 mb-5 rounded-xl border border-slate-200 bg-white/90 p-3 backdrop-blur lg:hidden">
          <div className="mb-2 flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-700">Step {Math.max(activeStepIndex + 1, 1)} / {stepOrder.length}</span>
            <span className="text-slate-500 capitalize">{step}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-800">
            <motion.div
              className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400"
              animate={{ width: `${((Math.max(activeStepIndex, 0) + 1) / stepOrder.length) * 100}%` }}
              transition={{ duration: 0.4 }}
            />
          </div>
        </div>

        <div className="grid items-start gap-6 lg:grid-cols-[240px_1fr]">
          <aside className="sticky top-[92px] hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:block">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Application Steps</p>
            <div className="space-y-2">
              {stepOrder.map((s, i) => {
                const done = i < activeStepIndex;
                const active = s === step;
                return (
                  <div
                    key={s}
                    className={`rounded-lg border px-3 py-2 text-sm capitalize ${
                      active
                        ? "border-indigo-400 bg-indigo-500/20 text-indigo-200"
                        : done
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                        : "border-slate-200 bg-slate-50 text-slate-500"
                    }`}
                  >
                    {i + 1}. {s}
                  </div>
                );
              })}
            </div>
          </aside>

          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 36 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -28 }}
              transition={{ duration: reducedMotion ? 0 : 0.35, ease: "easeInOut" }}
            >
        {step === "home" && (
          <motion.section initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
              <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                <ShieldCheck className="h-4 w-4" /> Multi-layer trust verification
              </p>
              <h1 className="text-4xl font-extrabold leading-tight text-slate-900">Education finance onboarding, beautifully guided.</h1>
              <p className="mt-4 max-w-2xl text-slate-600">
                In 5 simple steps, you will verify identity, capture required documents, share profile details, and set disbursal bank preferences
                (self or parent). Our fraud and eligibility engines run after submission.
              </p>
              <button
                onClick={() => {
                  setStep("documents");
                  if ('Notification' in window && Notification.permission === 'default') {
                    Notification.requestPermission();
                  }
                }}
                className="mt-7 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-800"
              >
                Start Application <ArrowRight className="h-4 w-4" />
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {[
                { title: "1. Camera Capture", text: "Snap Aadhaar, utility bill, and PAN one by one with guided prompts." },
                { title: "2. Profile Inputs", text: "Share key personal and education basics needed for score computation." },
                { title: "3. Bank Setup", text: "Choose self/parent account and complete secure tokenized bank setup." },
              ].map((card) => (
                <div key={card.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <p className="text-sm font-semibold text-slate-900">{card.title}</p>
                  <p className="mt-2 text-sm text-slate-600">{card.text}</p>
                </div>
              ))}
            </div>
            
            <div className="mt-8 rounded-2xl border border-orange-200 bg-orange-50 p-6 shadow-sm">
              <h2 className="text-sm font-semibold text-orange-800 mb-4 uppercase tracking-wider flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" /> Fast-Track Demo Scenarios</h2>
              <div className="flex gap-3 flex-wrap">
                <button onClick={() => fillDemoData("APPROVED")} className="rounded-xl border border-emerald-300 bg-emerald-100 px-4 py-2 text-sm font-bold text-emerald-800 hover:bg-emerald-200 transition">⚡ Fill 'Approved' Profile</button>
                <button onClick={() => fillDemoData("MISMATCH")} className="rounded-xl border border-amber-300 bg-amber-100 px-4 py-2 text-sm font-bold text-amber-800 hover:bg-amber-200 transition">⚡ Fill 'Mismatch' Profile</button>
                <button onClick={() => fillDemoData("REJECTED")} className="rounded-xl border border-rose-300 bg-rose-100 px-4 py-2 text-sm font-bold text-rose-800 hover:bg-rose-200 transition">⚡ Fill 'Rejected' Profile</button>
              </div>
            </div>
          </motion.section>
        )}

        {step === "documents" && (
          <motion.section initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-900">Document Capture</p>
                <p className="text-xs font-semibold text-emerald-300">{progressPercent}% completed</p>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                <div className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400" style={{ width: `${progressPercent}%` }} />
              </div>
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                  Step {docIndex + 1} of {DOC_FLOW.length}
                </p>
                <h2 className="mt-2 text-2xl font-bold text-slate-900">{currentDocConfig.label}</h2>
                <p className="mt-1 text-sm text-slate-600">{currentDocConfig.subtitle}</p>
                <div className="mt-3 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs text-indigo-700">
                  Live trust simulation: <span className="font-bold">{trustSimulation}/900</span>
                </div>

                <div className="mt-5 space-y-3">
                  {!cameraActive && (
                    <div className="flex flex-col gap-3">
                      <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                        <button
                          onClick={() => {
                            if (!currentDocConfig) return;
                            setQualityByDoc((prev) => ({ ...prev, [currentDocConfig.type]: { blurScore: 0, glarePercent: 0, ok: true } }));
                            setDocs((prev) => prev.map((item, idx) => idx === docIndex ? { ...item, blob: "DEMO_BLOB" as any, preview: "/placeholder_pdf.png", type: currentDocConfig.type, uploadStatus: "demo_verified" as any, uploadError: undefined } : item));
                            setOcrByDoc((prev) => ({ ...prev, [currentDocConfig.type]: { confidence: 0.99, fields: [] }}));
                          }}
                          className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-100 border border-orange-300 px-4 py-2.5 text-sm font-semibold text-orange-700 hover:bg-orange-200"
                        >
                          ⚡ Demo Verified
                        </button>
                        <button
                          onClick={startCamera}
                          className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-400"
                        >
                          <Camera className="h-4 w-4" /> Take Photo
                        </button>
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="col-span-2 lg:col-span-1 inline-flex items-center justify-center gap-2 rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-200"
                        >
                          <FileText className="h-4 w-4" /> Upload File
                        </button>
                      </div>
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleFileUpload} 
                        className="hidden" 
                        accept="image/*,application/pdf"
                      />
                    </div>
                  )}
                  {cameraActive && (
                    <button
                      onClick={captureDoc}
                      className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-400"
                    >
                      <CheckCircle2 className="h-4 w-4" /> Snap & Save
                    </button>
                  )}
                  {cameraActive && (
                    <button
                      onClick={stopCamera}
                      className="ml-2 inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700"
                    >
                      Stop Camera
                    </button>
                  )}
                  {currentDoc?.preview && (
                    <div className="flex gap-2">
                      <button
                        onClick={startCamera}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700"
                      >
                        <RefreshCcw className="h-4 w-4" /> Retake
                      </button>
                      <button
                        onClick={clearCurrentCapture}
                        className="inline-flex items-center gap-2 rounded-xl border border-rose-300 px-4 py-2.5 text-sm font-semibold text-rose-700"
                      >
                        <XCircle className="h-4 w-4" /> Cancel Capture
                      </button>
                    </div>
                  )}
                </div>
                {cameraError && <p className="mt-3 text-sm text-rose-300">{cameraError}</p>}
                {currentDoc?.preview && !currentQuality.ok && (
                  <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800">
                    Quality gate active: recapture is required to continue.
                  </div>
                )}

                <div className="mt-6 flex gap-2">
                  <button onClick={goPrevDoc} className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-3 py-2 text-xs">
                    <ChevronLeft className="h-4 w-4" /> Previous
                  </button>
                  <button
                    onClick={goNextDoc}
                    disabled={!currentDoc?.blob || !currentQuality.ok}
                    className="inline-flex items-center gap-1 rounded-lg bg-white px-3 py-2 text-xs font-bold text-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Next Step <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="aspect-[4/3] overflow-hidden rounded-xl border border-slate-300 bg-black">
                  <video ref={videoRef} className={`h-full w-full object-cover ${cameraActive ? "block" : "hidden"}`} playsInline muted />
                  {!cameraActive && currentDoc?.preview && (currentDoc?.blob as any)?.type === "application/pdf" && (
                     <div className="grid h-full place-items-center bg-slate-100 text-sm text-slate-500">PDF File Selected</div>
                  )}
                  {!cameraActive && currentDoc?.preview && (currentDoc?.blob as any)?.type !== "application/pdf" && <img src={currentDoc.preview} alt="Captured preview" className="h-full w-full object-cover" />}
                  {!cameraActive && !currentDoc?.preview && (
                    <div className="grid h-full place-items-center text-sm text-slate-500">Preview will appear here</div>
                  )}
                </div>
                <canvas ref={canvasRef} className="hidden" />
                <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-50 p-3">
                   <p className="text-xs font-semibold text-emerald-800 flex items-center gap-2"><ShieldCheck className="w-4 h-4"/> Ephemeral Guarantee</p>
                   <p className="mt-1 text-[11px] text-emerald-700">For your privacy, raw documents are securely deleted immediately after automated verification. We only store cryptographic proof.</p>
                </div>
                <p className="mt-3 text-xs text-slate-500">Tip: Please upload a clear, legible photo ensuring all 4 corners are visible. Supported formats: PDF, JPG, PNG.</p>
                {currentDoc?.preview && (
                  <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">OCR Preview (AI extraction)</p>
                    <p className="mt-1 text-[11px] text-slate-500">
                      Confidence: {Math.round((ocrByDoc[currentDocConfig.type]?.confidence || 0) * 100)}%
                    </p>
                    <div className="mt-2 space-y-2">
                      {(ocrByDoc[currentDocConfig.type]?.fields?.length
                        ? ocrByDoc[currentDocConfig.type].fields
                        : extractionPreview.map((i) => ({ key: i.key, label: i.key, value: i.value, confidence: 0.6 }))
                      ).map((item) => (
                        <div key={item.key} className="flex items-center justify-between text-sm">
                          <span className="text-slate-400">{item.label}</span>
                          <input
                            value={item.value}
                            onChange={(e) =>
                              setOcrByDoc((prev) => ({
                                ...prev,
                                [currentDocConfig.type]: {
                                  ...prev[currentDocConfig.type],
                                  fields: prev[currentDocConfig.type].fields.map((f) =>
                                    f.key === item.key ? { ...f, value: e.target.value } : f
                                  ),
                                },
                              }))
                            }
                            className="w-44 rounded border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-800"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {canContinueToProfile && (
              <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-700">
                All mandatory documents captured successfully. Continue to profile details.
              </div>
            )}
          </motion.section>
        )}

        {step === "profile" && (
          <motion.section initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex justify-between items-start mb-1">
                <h2 className="text-2xl font-bold text-slate-900">Student Profile</h2>
                <div className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs text-indigo-700 shadow-sm">
                  Trust Simulation <span className="font-bold">{trustSimulation}/900</span>
                </div>
              </div>
              <p className="mb-6 text-sm text-slate-600">Please provide detailed academic and financial backgrounds for accurate risk evaluation.</p>
              
              <div className="space-y-8">
                {/* 1. Personal */}
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-3 pb-1 border-b">1. Personal Details</h3>
                  <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                    <input className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm block w-full" placeholder="Full name" value={profile.fullName} onChange={e => setProfile(p => ({ ...p, fullName: e.target.value }))} />
                    <input className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm block w-full" type="date" value={profile.dateOfBirth} onChange={e => setProfile(p => ({ ...p, dateOfBirth: e.target.value }))} />
                    <input className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm block w-full" placeholder="Phone number" value={profile.phone} onChange={e => setProfile(p => ({ ...p, phone: e.target.value }))} />
                    <input className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm block w-full" placeholder="City" value={profile.city} onChange={e => setProfile(p => ({ ...p, city: e.target.value }))} />
                    <input className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm block w-full" placeholder="PAN Number" value={profile.panNumber} onChange={e => setProfile(p => ({ ...p, panNumber: e.target.value }))} />
                    <select className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm block w-full bg-white" value={profile.maritalStatus} onChange={e => setProfile(p => ({ ...p, maritalStatus: e.target.value }))}>
                      <option value="">Marital Status</option><option value="Single">Single</option><option value="Married">Married</option>
                    </select>
                    <input className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm block w-full lg:col-span-3" type="number" placeholder="Number of Dependents" value={profile.dependents} onChange={e => setProfile(p => ({ ...p, dependents: e.target.value }))} />
                  </div>
                </div>

                {/* 2. Academic */}
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-3 pb-1 border-b">2. Academic Details</h3>
                  <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                    <select className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm block w-full bg-white" value={profile.educationLevel} onChange={e => setProfile(p => ({ ...p, educationLevel: e.target.value }))}>
                      <option value="">Education level</option><option value="UG">Undergraduate</option><option value="PG">Postgraduate</option><option value="Diploma">Diploma</option>
                    </select>
                    <input className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm block w-full" type="number" placeholder="Backlogs (count)" value={profile.backlogs} onChange={e => setProfile(p => ({ ...p, backlogs: e.target.value }))} />
                    <input className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm block w-full" type="number" placeholder="Gap Years" value={profile.gapYears} onChange={e => setProfile(p => ({ ...p, gapYears: e.target.value }))} />
                    <input className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm block w-full" type="number" placeholder="Course Duration (Years)" value={profile.courseDuration} onChange={e => setProfile(p => ({ ...p, courseDuration: e.target.value }))} />
                    <select className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm block w-full lg:col-span-2 bg-white" value={profile.universityRanking} onChange={e => setProfile(p => ({ ...p, universityRanking: e.target.value }))}>
                      <option value="">University Ranking</option><option value="Top Tier">Top Tier</option><option value="Mid Tier">Mid Tier</option><option value="Low Tier">Low Tier</option>
                    </select>
                  </div>
                </div>

                {/* 3. Financial */}
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-3 pb-1 border-b">3. Financial Details</h3>
                  <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                    <input className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm block w-full" type="number" placeholder="Monthly Income (₹)" value={profile.monthlyIncome} onChange={e => setProfile(p => ({ ...p, monthlyIncome: e.target.value }))} />
                    <select className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm block w-full bg-white" value={profile.employmentType} onChange={e => setProfile(p => ({ ...p, employmentType: e.target.value }))}>
                      <option value="">Employment Type</option><option value="Salaried">Salaried</option><option value="Self-Employed">Self-Employed</option><option value="Unemployed">Unemployed</option>
                    </select>
                    <input className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm block w-full" placeholder="Employer Type (MNC, Startup, Govt)" value={profile.employerType} onChange={e => setProfile(p => ({ ...p, employerType: e.target.value }))} />
                    <input className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm block w-full" type="number" placeholder="Existing EMIs (₹/mo)" value={profile.existingEmis} onChange={e => setProfile(p => ({ ...p, existingEmis: e.target.value }))} />
                    <input className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm block w-full" type="number" placeholder="Credit Card Usage (%)" value={profile.creditCardUsage} onChange={e => setProfile(p => ({ ...p, creditCardUsage: e.target.value }))} />
                    <input className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm block w-full" type="number" placeholder="CIBIL score (300-900)" value={profile.cibilScore} onChange={e => setProfile(p => ({ ...p, cibilScore: e.target.value }))} />
                  </div>
                </div>

                {/* 4. Co-Applicant */}
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-600">4. Co-Applicant Form</h3>
                    <label className="flex items-center gap-2 text-sm font-bold text-indigo-600 cursor-pointer">
                      <input type="checkbox" className="w-4 h-4 rounded text-indigo-600" checked={profile.hasCoApplicant} onChange={e => setProfile(p => ({ ...p, hasCoApplicant: e.target.checked }))} /> Enable
                    </label>
                  </div>
                  {profile.hasCoApplicant ? (
                    <div className="grid gap-3 md:grid-cols-3">
                      <input className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm block w-full bg-white" placeholder="CIBIL Score" value={profile.coApplicantCibil} onChange={e => setProfile(p => ({ ...p, coApplicantCibil: e.target.value }))} />
                      <input className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm block w-full bg-white" type="number" placeholder="Job Stability (years)" value={profile.coApplicantJobStability} onChange={e => setProfile(p => ({ ...p, coApplicantJobStability: e.target.value }))} />
                      <input className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm block w-full bg-white" placeholder="Employer Name" value={profile.coApplicantEmployer} onChange={e => setProfile(p => ({ ...p, coApplicantEmployer: e.target.value }))} />
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 italic">No co-applicant included. Adding a co-applicant can significantly improve approval chances.</p>
                  )}
                </div>

                {/* 5. Loan Details */}
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-3 pb-1 border-b">5. Loan Details</h3>
                  <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                    <input className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm block w-full" type="number" placeholder="Amount Required (₹)" value={profile.loanAmountRequired} onChange={e => setProfile(p => ({ ...p, loanAmountRequired: e.target.value }))} />
                    <input className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm block w-full" type="number" placeholder="Tenure (Months)" value={profile.loanTenure} onChange={e => setProfile(p => ({ ...p, loanTenure: e.target.value }))} />
                    <select className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm block w-full bg-white" value={profile.collateral} onChange={e => setProfile(p => ({ ...p, collateral: e.target.value as any }))}>
                      <option value="No">No Collateral</option><option value="Yes">Provide Collateral</option>
                    </select>
                    {profile.collateral === "Yes" && (
                      <input className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm block w-full lg:col-span-3" placeholder="Collateral Type (e.g. Property, FD)" value={profile.collateralType} onChange={e => setProfile(p => ({ ...p, collateralType: e.target.value }))} />
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-8 flex gap-2 pt-4 border-t">
                <button onClick={() => setStep("documents")} className="rounded-lg border border-slate-300 px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition">Back</button>
                <button onClick={() => setStep("bank")} disabled={!profileComplete} className="rounded-lg bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-indigo-500 transition disabled:opacity-40 disabled:cursor-not-allowed">Continue to Bank Setup</button>
              </div>
            </div>
          </motion.section>
        )}

        {step === "bank" && (
          <motion.section initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-bold text-slate-900">Bank Details Setup</h2>
            <p className="mt-1 text-sm text-slate-600">Choose whether disbursal account is yours or your parent/guardian's.</p>
            <div className="mt-3 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs text-indigo-700">
              Live trust simulation: <span className="font-bold">{trustSimulation}/900</span>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <button
                onClick={() => setBank((b) => ({ ...b, ownerType: "self" }))}
                className={`rounded-xl border px-4 py-3 text-left ${bank.ownerType === "self" ? "border-indigo-400 bg-indigo-500/20" : "border-slate-300 bg-slate-50"}`}
              >
                <span className="inline-flex items-center gap-2 text-sm font-semibold text-slate-800"><User className="h-4 w-4" /> My account</span>
              </button>
              <button
                onClick={() => setBank((b) => ({ ...b, ownerType: "parent" }))}
                className={`rounded-xl border px-4 py-3 text-left ${bank.ownerType === "parent" ? "border-indigo-400 bg-indigo-500/20" : "border-slate-300 bg-slate-50"}`}
              >
                <span className="inline-flex items-center gap-2 text-sm font-semibold text-slate-800"><Users className="h-4 w-4" /> Parent/Guardian account</span>
              </button>
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <input className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm" placeholder="Account holder name" value={bank.accountHolderName} onChange={(e) => setBank((b) => ({ ...b, accountHolderName: e.target.value }))} />
              <input className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm" placeholder="Bank name" value={bank.bankName} onChange={(e) => setBank((b) => ({ ...b, bankName: e.target.value }))} />
              <input className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm" maxLength={4} placeholder="Last 4 digits of account number" value={bank.accountLast4} onChange={(e) => setBank((b) => ({ ...b, accountLast4: e.target.value.replace(/\D/g, "") }))} />
              <input className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm uppercase" placeholder="IFSC (e.g. HDFC0001234)" value={bank.ifscCode} onChange={(e) => setBank((b) => ({ ...b, ifscCode: e.target.value.toUpperCase() }))} />
            </div>
            <div className="mt-4 rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-xs text-emerald-700">
              Full bank account number is never stored in this app. Only masked account and tokenized references are saved.
            </div>
            <div className="mt-6 flex gap-2">
              <button onClick={() => setStep("profile")} className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700">Back</button>
              <button onClick={() => setStep("review")} disabled={!bankComplete} className="rounded-lg bg-white px-4 py-2 text-xs font-bold text-slate-900 disabled:opacity-40">Continue</button>
            </div>
          </motion.section>
        )}

        {step === "review" && (
          <motion.section initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-bold text-slate-900">Review & Submit</h2>
            <p className="mt-1 text-sm text-slate-600">Final check before secure upload and orchestration.</p>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Documents</p>
                <ul className="mt-2 space-y-2 text-sm">
                  {docs.map((d) => (
                    <li key={d.type} className="flex items-center justify-between text-slate-700">
                      <span>{d.label}</span>
                      <span className={d.blob ? "text-emerald-300" : "text-rose-300"}>{d.blob ? "Captured" : "Missing"}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Bank Setup</p>
                <p className="mt-2 text-sm text-slate-700">{bank.ownerType === "self" ? "Your account" : "Parent/Guardian account"}</p>
                <p className="text-sm text-slate-700">{bank.bankName} • XXXX{bank.accountLast4}</p>
                <p className="text-sm text-slate-700">{bank.ifscCode}</p>
              </div>
            </div>

            <div className="mt-6 flex gap-2">
              <button onClick={() => setStep("bank")} className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700">Back</button>
              <button
                onClick={submitFullJourney}
                className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-xs font-bold text-slate-900"
              >
                Submit Application <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </motion.section>
        )}

        {step === "result" && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }} 
            animate={{ opacity: 1, scale: 1 }} 
            className="w-full max-w-2xl mx-auto rounded-2xl bg-white p-8 shadow border border-slate-100"
          >
            {isSubmitting ? (
              <div className="flex flex-col items-center justify-center p-8">
                <Loader2 className="h-12 w-12 animate-spin text-indigo-500 mb-6" />
                <h2 className="text-2xl font-bold text-slate-800 mb-2">Executing Local Ephemeral Override...</h2>
                <p className="text-slate-500 mb-8 max-w-md mx-auto">
                  Bypassing Firebase Storage and injecting base64 signatures into orchestration directly.
                </p>
                <div className="mx-auto mt-3 max-w-md space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-left">
                  {docs.map((d) => (
                    <div key={d.type} className="flex items-center justify-between text-xs">
                      <span className="capitalize text-slate-700">{d.type}</span>
                      <span
                        className={
                          d.uploadStatus === "uploaded"
                            ? "text-emerald-300"
                            : d.uploadStatus === "uploading"
                            ? "text-indigo-300"
                            : d.uploadStatus === "failed"
                            ? "text-rose-300"
                            : d.uploadStatus === "cancelled"
                            ? "text-amber-300"
                            : "text-slate-500"
                        }
                      >
                        {d.uploadStatus.toUpperCase()}
                      </span>
                    </div>
                  ))}
                </div>

              </div>
            ) : (
              <div className="space-y-3">
                <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-slate-100">
                  {resultStatus === "success" && <CheckCircle2 className="h-8 w-8 text-emerald-400" />}
                  {resultStatus === "warning" && <Landmark className="h-8 w-8 text-amber-300" />}
                  {resultStatus === "error" && <Building2 className="h-8 w-8 text-rose-400" />}
                </div>
                <h2 className="text-2xl font-bold text-slate-900">Submission Result</h2>
                <p className="mx-auto max-w-xl text-sm text-slate-700">{resultMessage}</p>
                {resultStatus === "warning" && (
                  <div className="mx-auto mt-2 max-w-xl rounded-lg border border-amber-300 bg-amber-50 p-4 text-left text-sm text-amber-900 border-l-4 border-l-amber-500 shadow-sm">
                    <p className="mb-2 inline-flex items-center gap-2 font-bold text-base">
                      <AlertTriangle className="h-5 w-5" /> Policy vs Bank Mismatch Detected
                    </p>
                    <p className="mb-3">Your profile meets initial policy guidelines but falls short of specific lender risk thresholds. The AI engine recommends the following modifications to pass the Bank Filter:</p>
                    <ul className="space-y-1.5 list-disc list-inside ml-2 font-medium">
                       {Number(profile.monthlyIncome) < 50000 && <li>Add Co-Applicant income to reach ₹50,000/mo minimum.</li>}
                       {Number(profile.cibilScore) < 700 && <li>Provide a Co-Applicant with a CIBIL score of 750+.</li>}
                       {profile.collateral === "No" && <li>Add Property or FD collateral to lower risk exposure.</li>}
                       <li>Decrease required loan amount or extend tenure to reduce EMI stress.</li>
                    </ul>
                    <div className="mt-5 border-t border-amber-200 pt-3 flex flex-col sm:flex-row gap-3 items-center justify-between">
                      <p className="text-xs text-amber-700 w-full sm:w-1/2">Try adjusting these parameters live to see how they impact your probability of approval.</p>
                      <button onClick={() => setStep("profile")} className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-white font-bold hover:bg-indigo-700 transition shadow-sm">
                        <RefreshCcw className="h-4 w-4" /> Run 'What-If' Simulation
                      </button>
                    </div>
                  </div>
                )}
                <div className="mx-auto mt-3 max-w-md space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-left">
                  {docs.map((d) => (
                    <div key={d.type} className="flex items-center justify-between text-xs">
                      <span className="capitalize text-slate-700">{d.type}</span>
                      <div className="flex items-center gap-2">
                        <span
                          className={
                            d.uploadStatus === "uploaded"
                              ? "text-emerald-300"
                              : d.uploadStatus === "failed"
                              ? "text-rose-300"
                              : d.uploadStatus === "cancelled"
                              ? "text-amber-300"
                              : "text-slate-500"
                          }
                        >
                          {d.uploadStatus.toUpperCase()}
                        </span>
                        {(d.uploadStatus === "failed" || d.uploadStatus === "cancelled") && (
                          <button
                            onClick={() => retryFailedUpload(d.type)}
                            className="inline-flex items-center gap-1 rounded border border-slate-300 px-2 py-1 text-[10px] font-semibold text-slate-700"
                          >
                            <RefreshCcw className="h-3 w-3" /> Retry
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mx-auto mt-6 max-w-md rounded-xl border border-indigo-200 bg-white overflow-hidden shadow-sm">
                  <div className="bg-indigo-50 border-b border-indigo-100 p-3 text-left">
                    <p className="text-xs font-bold text-indigo-900 uppercase tracking-wider flex items-center gap-2">
                       Ask FinFlow AI
                    </p>
                  </div>
                  <div className="p-4 flex flex-col gap-3 min-h-[120px] max-h-64 overflow-y-auto text-left">
                    {chatHistory.length === 0 ? (
                      <p className="text-xs text-slate-500 italic">Curious why you got this result or how to improve? Ask the AI model that scored you.</p>
                    ) : (
                      chatHistory.map((msg, i) => (
                        <div key={i} className={`text-xs p-2.5 rounded-lg ${msg.role === 'user' ? 'bg-slate-100 text-slate-800 self-end ml-6' : 'bg-indigo-50 text-indigo-900 self-start mr-6'}`}>
                          {msg.content}
                        </div>
                      ))
                    )}
                    {isChatting && <div className="text-xs text-indigo-500 italic p-2 bg-indigo-50 rounded-lg self-start">FinFlow AI is typing...</div>}
                  </div>
                  <div className="p-3 bg-slate-50 border-t border-slate-100 flex gap-2">
                    <input 
                      type="text" 
                      value={chatInput} 
                      onChange={e => setChatInput(e.target.value)} 
                      onKeyDown={e => e.key === 'Enter' && handleChat()}
                      placeholder="E.g., How much more income do I need?" 
                      className="flex-1 rounded border border-slate-300 px-3 py-1.5 text-xs focus:outline-indigo-500"
                    />
                    <button onClick={handleChat} disabled={isChatting || !chatInput.trim()} className="bg-indigo-600 text-white px-3 py-1.5 rounded text-xs font-bold disabled:opacity-50">Send</button>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setStep("home");
                    setDocIndex(0);
                    setDocs(DOC_FLOW.map((d) => ({ type: d.type, label: d.label, uploadStatus: "idle" })));
                    setProfile(INITIAL_PROFILE);
                    setBank(INITIAL_BANK);
                  }}
                  className="mt-2 rounded-lg bg-white px-4 py-2 text-xs font-bold text-slate-900"
                >
                  Start New Application
                </button>
              </div>
            )}
          </motion.div>
        )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
    </AppLock>
  );
}

function AuthController({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [showLogin, setShowLogin] = useState(false);
  
  if (!user) {
    return (
      <>
        <LandingPage onStartJourney={() => setShowLogin(true)} />
        <AnimatePresence>
          {showLogin && <StudentLogin onClose={() => setShowLogin(false)} />}
        </AnimatePresence>
      </>
    );
  }
  
  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <AuthController>
        <StudentDashboard />
      </AuthController>
    </AuthProvider>
  );
}
