import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BarChart3, BrainCircuit, CheckCircle2, ClipboardCheck, Lock, LogOut, Shield, X } from "lucide-react";
import { EscalationPanel } from "./components/EscalationPanel";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { AdminLogin } from "./components/AdminLogin";
import { generateDemoCases } from "./demo/demoCases";

type TabKey = "review" | "locked" | "approved" | "rejected" | "insights";

type AdminCase = {
  id: string;
  userId: string;
  applicant: string;
  journeyState: string;
  trustScore: number;
  altScore: number;
  fundingType?: string;
  scholarshipMatchScore?: number | null;
  reasoning?: string;
  riskLevel?: string;
  updatedAt?: string;
  isDemo?: boolean;
};

function AdminDashboard() {
  const [tab, setTab] = useState<TabKey>("review");
  const [simpleMode, setSimpleMode] = useState(true);
  const [demoMode, setDemoMode] = useState(false);
  const [fundingFilter, setFundingFilter] = useState<"all" | "loan" | "scholarship" | "auto">("all");
  const [cases, setCases] = useState<AdminCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const { logout } = useAuth();

  const [drawerUserId, setDrawerUserId] = useState<string | null>(null);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [drawerError, setDrawerError] = useState("");
  const [drawerData, setDrawerData] = useState<any>(null);
  const [drawerAnalysis, setDrawerAnalysis] = useState<string>("");

  const loadCases = async () => {
    try {
      const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";
      const res = await fetch(`${BACKEND_URL}/api/admin/escalations`);
      const data = await res.json();
      if (data?.status === "success") {
        setCases(data.data || []);
        setError("");
      } else {
        setError("Failed to load escalation queue");
      }
    } catch (_e) {
      setError("Backend unreachable. Start backend server.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadCases();
    // Ultra-fast 1.5s polling interval ensures admin sees fraud/HITL flags practically instantly
    const timer = setInterval(() => {
      void loadCases();
    }, 1500);
    return () => clearInterval(timer);
  }, []);

  const handleDecision = async (userId: string, decision: "APPROVE" | "REJECT" | "REQUEST_REUPLOAD" | "REQUEST_CLARIFICATION") => {
    setActionLoading(true);
    try {
      // Demo cases are local-only (no backend mutation).
      if (String(userId).startsWith("demo_user_")) {
        setCases((prev) =>
          prev.map((c) => {
            if (c.userId !== userId) return c;
            const next =
              decision === "APPROVE"
                ? "ADMIN_APPROVED"
                : decision === "REQUEST_REUPLOAD"
                ? "DOCS_REUPLOAD_REQUIRED"
                : decision === "REQUEST_CLARIFICATION"
                ? "CLARIFICATION_REQUIRED"
                : "REJECTED";
            return { ...c, journeyState: next, updatedAt: new Date().toISOString(), reasoning: `DEMO: Admin action ${decision}` };
          })
        );
        return;
      }
      const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";
      await fetch(`${BACKEND_URL}/api/admin/escalations/${userId}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision,
          admin_id: "admin_console",
          notes: `Action from admin dashboard: ${decision}`,
        }),
      });
      await loadCases();
    } finally {
      setActionLoading(false);
    }
  };

  const openDrawer = async (userId: string) => {
    setDrawerUserId(userId);
    setDrawerLoading(true);
    setDrawerError("");
    setDrawerData(null);
    setDrawerAnalysis("");
    try {
      if (String(userId).startsWith("demo_user_")) {
        // Local demo drawer: show lightweight synthetic log.
        const now = new Date().toISOString();
        setDrawerData({
          userId,
          journeyState: "HITL_ESCALATION",
          updatedAt: now,
          profile: {
            fullName: "Demo Applicant",
            monthlyIncome: "45000",
            existingEmis: "12000",
            loanAmountRequired: "1200000",
            loanTenure: "84",
            cibilScore: "680",
            universityRanking: "Mid Tier",
            hasCoApplicant: false,
            collateral: "No",
          },
          auditTrail: [
            { id: "demo_evt_1", timestamp: now, agentName: "Document Intelligence Agent", action: "LAYERED_FRAUD_DETECTION_COMPLETE", reasoning: "DEMO: Borderline confidence → manual review.", confidenceScore: 78 },
            { id: "demo_evt_2", timestamp: now, agentName: "Risk Assessor Agent", action: "EVALUATE_POLICY_VS_BANK", reasoning: "DEMO: Policy PASS, Bank FAIL due to FOIR/CIBIL levers.", confidenceScore: 45 },
          ],
          tracing: { enabled: false, tags: ["finflow", `user:${userId}`], howToFind: "Demo case (no LangSmith trace)" },
        });
        setDrawerAnalysis(
          [
            "Trust assessment: 68/100",
            "Recommended action: REQUEST_CLARIFICATION",
            "",
            "Key risks:",
            "- FOIR stress likely high at current income/EMI mix",
            "- No co-applicant/collateral; limited mitigations",
            "",
            "Merits:",
            "- Education purpose is standard; no hard fraud lock flags",
            "",
            "Clarifications to request:",
            "- Latest 3 salary credits + employment continuity proof",
            "- Existing EMI breakdown (lender-wise) and closure timelines",
            "",
            "What-if levers:",
            "- Add co-applicant with CIBIL 750+",
            "- Reduce amount or extend tenure to reduce EMI load",
            "- Add collateral (FD/property) for waiver route",
          ].join("\n")
        );
        return;
      }

      const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";
      const res = await fetch(`${BACKEND_URL}/api/admin/escalations/${userId}`);
      const payload = await res.json();
      if (payload?.status !== "success") throw new Error(payload?.detail || "Failed to load case details");
      setDrawerData(payload.data);

      const ares = await fetch(`${BACKEND_URL}/api/admin/escalations/${userId}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ admin_id: "admin_console", focus: "trustworthiness, risk, merits, clarifications" }),
      });
      const ap = await ares.json();
      if (ap?.status === "success") setDrawerAnalysis(String(ap.data?.analysis || ""));
    } catch (e) {
      setDrawerError(e instanceof Error ? e.message : "Failed to open case drawer");
    } finally {
      setDrawerLoading(false);
    }
  };

  const tabData = useMemo(() => {
    if (tab === "review") return cases.filter((x) => x.journeyState === "HITL_ESCALATION" || x.journeyState === "CLARIFICATION_REQUIRED");
    if (tab === "locked") return cases.filter((x) => x.journeyState === "FRAUD_LOCKOUT");
    if (tab === "approved") return cases.filter((x) => x.journeyState === "ADMIN_APPROVED");
    if (tab === "rejected") return cases.filter((x) => x.journeyState === "REJECTED");
    return [];
  }, [tab, cases]);

  const demoCases = useMemo(() => generateDemoCases(2026), []);
  const visibleCases = useMemo(() => {
    if (!demoMode) return cases;
    const realIds = new Set(cases.map((c) => c.userId));
    const merged = [...cases];
    for (const d of demoCases) {
      if (!realIds.has(d.userId)) merged.push(d as any);
    }
    return merged;
  }, [cases, demoCases, demoMode]);

  const filteredCases = useMemo(() => {
    if (fundingFilter === "all") return visibleCases;
    return visibleCases.filter((c) => String(c.fundingType || "loan").toLowerCase() === fundingFilter);
  }, [visibleCases, fundingFilter]);

  const visibleTabData = useMemo(() => {
    if (tab === "review") return filteredCases.filter((x) => x.journeyState === "HITL_ESCALATION" || x.journeyState === "CLARIFICATION_REQUIRED");
    if (tab === "locked") return filteredCases.filter((x) => x.journeyState === "FRAUD_LOCKOUT");
    if (tab === "approved") return filteredCases.filter((x) => x.journeyState === "ADMIN_APPROVED");
    if (tab === "rejected") return filteredCases.filter((x) => x.journeyState === "REJECTED");
    return [];
  }, [tab, filteredCases]);

  return (
    <div className="flex min-h-screen bg-[#fafafa] text-slate-900 font-sans selection:bg-indigo-200">
      <aside className="hidden w-72 border-r border-white/60 bg-white/80 p-4 backdrop-blur-xl lg:block">
        <div className="mb-6 flex items-center gap-3 rounded-xl border border-white/60 bg-white/50 p-3 shadow-sm backdrop-blur-md">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-gradient-to-tr from-rose-500 to-indigo-500">
            <Shield className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="font-outfit text-lg font-black text-slate-900 leading-tight">SPARC Admin</p>
            <p className="text-xs font-semibold text-slate-500">Secured Instance</p>
          </div>
        </div>

        <div className="space-y-2">
          <NavItem
            label="Review Cases"
            icon={<ClipboardCheck className="h-4 w-4" />}
            active={tab === "review"}
            onClick={() => setTab("review")}
            count={visibleCases.filter((x) => x.journeyState === "HITL_ESCALATION" || x.journeyState === "CLARIFICATION_REQUIRED").length}
          />
          <NavItem label="Locked Cases" icon={<Lock className="h-4 w-4" />} active={tab === "locked"} onClick={() => setTab("locked")} count={visibleCases.filter((x) => x.journeyState === "FRAUD_LOCKOUT").length} />
          <NavItem label="Approved" icon={<CheckCircle2 className="h-4 w-4" />} active={tab === "approved"} onClick={() => setTab("approved")} count={visibleCases.filter((x) => x.journeyState === "ADMIN_APPROVED").length} />
          <NavItem label="Rejected" icon={<Shield className="h-4 w-4" />} active={tab === "rejected"} onClick={() => setTab("rejected")} count={visibleCases.filter((x) => x.journeyState === "REJECTED").length} />
          <NavItem label="Insights" icon={<BarChart3 className="h-4 w-4" />} active={tab === "insights"} onClick={() => setTab("insights")} />
        </div>

        <button onClick={logout} className="mt-8 inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100">
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </aside>

      <main className="flex-1 relative">
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-100/30 via-slate-50 to-transparent z-0"></div>
        <header className="sticky top-0 z-20 border-b border-white/60 bg-white/70 px-4 py-5 backdrop-blur-xl sm:px-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-outfit text-2xl font-bold text-slate-900">Multi-layer Case Resolution</h2>
              <p className="text-sm font-medium text-slate-500">Fraud layers, trust score, and decision history</p>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={fundingFilter}
                onChange={(e) => setFundingFilter(e.target.value as any)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700"
              >
                <option value="all">All funding</option>
                <option value="loan">Loan</option>
                <option value="scholarship">Scholarship</option>
                <option value="auto">Auto</option>
              </select>
              <button
                onClick={() => setDemoMode((p) => !p)}
                className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold ${
                  demoMode ? "border-orange-300 bg-orange-50 text-orange-800" : "border-slate-300 bg-white text-slate-700"
                }`}
              >
                Demo Data {demoMode ? "ON" : "OFF"}
              </button>
              <button
                onClick={() => setSimpleMode((p) => !p)}
                className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold ${
                  simpleMode ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-slate-300 bg-white text-slate-700"
                }`}
              >
                <BrainCircuit className="h-4 w-4" /> {simpleMode ? "Simple View" : "Technical View"}
              </button>
            </div>
          </div>
        </header>

        <div className="relative z-10 p-4 sm:p-6">
          <AnimatePresence mode="wait">
            {(tab === "review" || tab === "locked") && (
              <motion.div key={tab} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} className="space-y-4">
                {loading ? (
                  <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">Loading live queue...</div>
                ) : error ? (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 p-8 text-center text-rose-700">{error}</div>
                ) : visibleTabData.length === 0 ? (
                  <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">No cases in this queue.</div>
                ) : (
                  visibleTabData.map((esc) => (
                    <EscalationPanel
                      key={esc.id}
                      data={esc}
                      explainable={simpleMode}
                      onAction={handleDecision}
                      actionLoading={actionLoading}
                      onOpen={openDrawer}
                    />
                  ))
                )}
              </motion.div>
            )}

            {tab === "approved" && (
              <motion.div key="approved" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
                {visibleTabData.length === 0 ? (
                  <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">No approved cases yet.</div>
                ) : visibleTabData.map((c) => (
                  <div key={c.id} className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4">
                    <div>
                      <p className="font-bold text-emerald-900 text-sm">{c.applicant}</p>
                      <p className="text-xs text-emerald-700">Case: {c.id}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => openDrawer(c.userId)} className="rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100">
                        View
                      </button>
                      <span className="rounded-full bg-emerald-200 px-3 py-1 text-xs font-bold text-emerald-800">✓ Admin Approved</span>
                    </div>
                  </div>
                ))}
              </motion.div>
            )}

            {tab === "rejected" && (
              <motion.div key="rejected" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
                {visibleTabData.length === 0 ? (
                  <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">No rejected cases.</div>
                ) : visibleTabData.map((c) => (
                  <div key={c.id} className="flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 px-5 py-4">
                    <div>
                      <p className="font-bold text-rose-900 text-sm">{c.applicant}</p>
                      <p className="text-xs text-rose-700">Case: {c.id}</p>
                      {c.reasoning && <p className="mt-1 text-xs text-rose-600 max-w-md">{c.reasoning}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => openDrawer(c.userId)} className="rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-xs font-semibold text-rose-800 hover:bg-rose-100">
                        View
                      </button>
                      <span className="rounded-full bg-rose-200 px-3 py-1 text-xs font-bold text-rose-800">✗ Rejected</span>
                    </div>
                  </div>
                ))}
              </motion.div>
            )}

            {tab === "insights" && (
              <motion.div key="insights" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <StatCard label="Manual Review" value={String(visibleCases.filter((x) => x.journeyState === "HITL_ESCALATION").length)} tone="indigo" />
                <StatCard label="Fraud Locked" value={String(visibleCases.filter((x) => x.journeyState === "FRAUD_LOCKOUT").length)} tone="rose" />
                <StatCard label="Approved" value={String(visibleCases.filter((x) => x.journeyState === "ADMIN_APPROVED").length)} tone="emerald" />
                <StatCard label="Rejected" value={String(visibleCases.filter((x) => x.journeyState === "REJECTED").length)} tone="rose" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      <AnimatePresence>
        {drawerUserId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm"
            onClick={() => setDrawerUserId(null)}
          >
            <motion.div
              initial={{ x: 420, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 420, opacity: 0 }}
              transition={{ type: "spring", stiffness: 280, damping: 28 }}
              className="absolute right-0 top-0 h-full w-full max-w-xl bg-white shadow-xl border-l border-slate-200"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3 border-b border-slate-200 p-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Case Detail</p>
                  <p className="mt-1 text-sm font-bold text-slate-900">{drawerUserId}</p>
                </div>
                <button
                  onClick={() => setDrawerUserId(null)}
                  className="rounded-lg border border-slate-300 p-2 text-slate-600 hover:bg-slate-100"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="h-[calc(100%-64px)] overflow-y-auto p-4 space-y-4">
                {drawerLoading ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
                    Loading profile, Firestore logs, and analysis...
                  </div>
                ) : drawerError ? (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">{drawerError}</div>
                ) : drawerData ? (
                  <>
                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Snapshot</p>
                      <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                        <div className="text-slate-500">Journey</div>
                        <div className="font-semibold text-slate-800">{drawerData.journeyState}</div>
                        <div className="text-slate-500">Updated</div>
                        <div className="font-semibold text-slate-800">{drawerData.updatedAt || "—"}</div>
                        <div className="text-slate-500">Name</div>
                        <div className="font-semibold text-slate-800">{drawerData.profile?.fullName || "—"}</div>
                        <div className="text-slate-500">CIBIL</div>
                        <div className="font-semibold text-slate-800">{drawerData.profile?.cibilScore ?? "—"}</div>
                        <div className="text-slate-500">Monthly Income</div>
                        <div className="font-semibold text-slate-800">{drawerData.profile?.monthlyIncome ?? "—"}</div>
                        <div className="text-slate-500">Loan</div>
                        <div className="font-semibold text-slate-800">{drawerData.profile?.loanAmountRequired ?? "—"}</div>
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">LangSmith</p>
                      <p className="mt-2 text-xs text-slate-700">
                        {drawerData.tracing?.enabled ? "Tracing enabled." : "Tracing not enabled."}{" "}
                        {drawerData.tracing?.project ? `Project: ${drawerData.tracing.project}` : ""}
                      </p>
                      <p className="mt-2 text-[11px] text-slate-600">How to find trace: {drawerData.tracing?.howToFind}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {(drawerData.tracing?.tags || []).map((t: string) => (
                          <span key={t} className="rounded-full bg-white border border-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Firebase Agent Logs</p>
                      <div className="mt-3 space-y-2">
                        {(drawerData.auditTrail || []).slice().reverse().map((evt: any) => (
                          <div key={evt.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-xs font-bold text-slate-800">{evt.agentName}</p>
                              <p className="text-[10px] text-slate-500">{evt.timestamp}</p>
                            </div>
                            <p className="mt-1 text-[11px] font-semibold text-slate-600">{evt.action}</p>
                            <pre className="mt-2 whitespace-pre-wrap text-[11px] text-slate-700 leading-relaxed">{evt.reasoning}</pre>
                          </div>
                        ))}
                        {(!drawerData.auditTrail || drawerData.auditTrail.length === 0) && (
                          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">No audit trail found.</div>
                        )}
                      </div>
                    </div>

                    <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wider text-indigo-900">AI Admin Analyst</p>
                      <pre className="mt-2 whitespace-pre-wrap text-[12px] text-indigo-900 leading-relaxed">{drawerAnalysis || "No analysis yet."}</pre>
                    </div>
                  </>
                ) : (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">Select a case to view details.</div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function NavItem({
  label,
  icon,
  active,
  onClick,
  count,
}: {
  label: string;
  icon: ReactNode;
  active: boolean;
  onClick: () => void;
  count?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-sm font-semibold transition ${
        active ? "border-indigo-300 bg-indigo-50 text-indigo-700" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
      }`}
    >
      <span className="inline-flex items-center gap-2">{icon} {label}</span>
      {count !== undefined && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">{count}</span>}
    </button>
  );
}

function StatCard({ label, value, tone }: { label: string; value: string; tone: "indigo" | "rose" | "emerald" }) {
  const style =
    tone === "rose"
      ? "border-rose-200 bg-rose-50 text-rose-700"
      : tone === "emerald"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : "border-indigo-200 bg-indigo-50 text-indigo-700";
  return (
    <div className={`rounded-2xl border p-6 shadow-sm backdrop-blur-sm ${style}`}>
      <p className="text-xs font-bold uppercase tracking-widest">{label}</p>
      <p className="mt-2 font-outfit text-4xl font-black">{value}</p>
    </div>
  );
}

function AdminRoute({ children }: { children: ReactNode }) {
  const { user, role } = useAuth();
  if (!user || role !== 'admin') return <AdminLogin />;
  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
       <AdminRoute>
          <AdminDashboard />
       </AdminRoute>
    </AuthProvider>
  );
}
