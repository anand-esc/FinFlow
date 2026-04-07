import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BarChart3, BrainCircuit, CheckCircle2, ClipboardCheck, Lock, LogOut, Shield } from "lucide-react";
import { EscalationPanel } from "./components/EscalationPanel";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { AdminLogin } from "./components/AdminLogin";

type TabKey = "review" | "locked" | "approved" | "insights";

type AdminCase = {
  id: string;
  userId: string;
  applicant: string;
  journeyState: string;
  trustScore: number;
  altScore: number;
  reasoning?: string;
  riskLevel?: string;
  updatedAt?: string;
};

function AdminDashboard() {
  const [tab, setTab] = useState<TabKey>("review");
  const [simpleMode, setSimpleMode] = useState(true);
  const [cases, setCases] = useState<AdminCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const { logout } = useAuth();

  const loadCases = async () => {
    try {
      const res = await fetch("http://localhost:8000/api/admin/escalations");
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
    const timer = setInterval(() => {
      void loadCases();
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const handleDecision = async (userId: string, decision: "APPROVE" | "REJECT" | "REQUEST_REUPLOAD") => {
    setActionLoading(true);
    try {
      await fetch(`http://localhost:8000/api/admin/escalations/${userId}/decision`, {
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

  const tabData = useMemo(() => {
    if (tab === "review") return cases.filter((x) => x.journeyState === "HITL_ESCALATION");
    if (tab === "locked") return cases.filter((x) => x.journeyState === "FRAUD_LOCKOUT");
    if (tab === "approved") return cases.filter((x) => x.journeyState === "ADMIN_APPROVED");
    return [];
  }, [tab, cases]);

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      <aside className="hidden w-72 border-r border-slate-200 bg-white p-4 lg:block">
        <div className="mb-6 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-gradient-to-tr from-indigo-500 to-emerald-400">
            <Shield className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900">SPARC Admin</p>
            <p className="text-xs text-slate-500">Aligned with student flow</p>
          </div>
        </div>

        <div className="space-y-2">
          <NavItem label="Review Cases" icon={<ClipboardCheck className="h-4 w-4" />} active={tab === "review"} onClick={() => setTab("review")} count={cases.filter((x) => x.journeyState === "HITL_ESCALATION").length} />
          <NavItem label="Locked Cases" icon={<Lock className="h-4 w-4" />} active={tab === "locked"} onClick={() => setTab("locked")} count={cases.filter((x) => x.journeyState === "FRAUD_LOCKOUT").length} />
          <NavItem label="Approved" icon={<CheckCircle2 className="h-4 w-4" />} active={tab === "approved"} onClick={() => setTab("approved")} />
          <NavItem label="Insights" icon={<BarChart3 className="h-4 w-4" />} active={tab === "insights"} onClick={() => setTab("insights")} />
        </div>

        <button onClick={logout} className="mt-8 inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100">
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </aside>

      <main className="flex-1">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 px-4 py-4 backdrop-blur sm:px-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Multi-layer Case Resolution</h2>
              <p className="text-xs text-slate-500">Fraud layers, trust score, and decision history in one place</p>
            </div>
            <button
              onClick={() => setSimpleMode((p) => !p)}
              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold ${
                simpleMode ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-slate-300 bg-white text-slate-700"
              }`}
            >
              <BrainCircuit className="h-4 w-4" /> {simpleMode ? "Simple View" : "Technical View"}
            </button>
          </div>
        </header>

        <div className="p-4 sm:p-6">
          <AnimatePresence mode="wait">
            {(tab === "review" || tab === "locked") && (
              <motion.div key={tab} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} className="space-y-4">
                {loading ? (
                  <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">Loading live queue...</div>
                ) : error ? (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 p-8 text-center text-rose-700">{error}</div>
                ) : tabData.length === 0 ? (
                  <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">No cases in this queue.</div>
                ) : (
                  tabData.map((esc) => (
                    <EscalationPanel
                      key={esc.id}
                      data={esc}
                      explainable={simpleMode}
                      onAction={handleDecision}
                      actionLoading={actionLoading}
                    />
                  ))
                )}
              </motion.div>
            )}

            {tab === "approved" && (
              <motion.div key="approved" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="rounded-xl border border-slate-200 bg-white p-8 text-sm text-slate-600">
                {tabData.length === 0 ? "No approved cases yet." : `Approved cases: ${tabData.length}`}
              </motion.div>
            )}

            {tab === "insights" && (
              <motion.div key="insights" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="grid gap-4 md:grid-cols-3">
                <StatCard label="Manual Review" value={String(cases.filter((x) => x.journeyState === "HITL_ESCALATION").length)} tone="indigo" />
                <StatCard label="Locked" value={String(cases.filter((x) => x.journeyState === "FRAUD_LOCKOUT").length)} tone="rose" />
                <StatCard label="Approved" value={String(cases.filter((x) => x.journeyState === "ADMIN_APPROVED").length)} tone="emerald" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
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
    <div className={`rounded-xl border p-5 ${style}`}>
      <p className="text-xs font-semibold uppercase tracking-wider">{label}</p>
      <p className="mt-2 text-2xl font-bold">{value}</p>
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
