import { useState } from "react";
import { motion } from "framer-motion";
import { Eye, EyeOff, FileCheck2, ShieldAlert } from "lucide-react";

export function EscalationPanel({
  data,
  explainable,
  onAction,
  actionLoading,
  onOpen,
}: {
  data: {
    id: string;
    userId: string;
    applicant: string;
    altScore: number;
    journeyState: string;
    riskLevel?: string;
    reasoning?: string;
    trustScore?: number;
    isDemo?: boolean;
  };
  explainable: boolean;
  onAction: (userId: string, decision: "APPROVE" | "REJECT" | "REQUEST_REUPLOAD" | "REQUEST_CLARIFICATION") => void;
  actionLoading?: boolean;
  onOpen?: (userId: string) => void;
}) {
  const [piiMasked, setPiiMasked] = useState(true);
  const isLocked = data.journeyState === "FRAUD_LOCKOUT";

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-slate-200 font-bold text-slate-700">{data.applicant.charAt(0)}</div>
          <div>
            <p className="text-sm font-bold text-slate-900">
              <span className={piiMasked ? "blur-sm select-none" : ""}>{data.applicant}</span>
              <button onClick={() => setPiiMasked((p) => !p)} className="ml-2 align-middle text-slate-500 hover:text-slate-700">
                {piiMasked ? <EyeOff className="inline h-4 w-4" /> : <Eye className="inline h-4 w-4" />}
              </button>
            </p>
            <p className="text-xs text-slate-500">
              Case ID: <span className={piiMasked ? "blur-[2px] select-none" : ""}>{data.id}</span>
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-500">Trust Score</p>
          <p className={`text-xl font-bold ${isLocked ? "text-rose-600" : "text-amber-600"}`}>{data.trustScore ?? 0}/100</p>
        </div>
      </div>

      <div className="grid gap-4 p-5 md:grid-cols-3">
        <LayerCard
          title="Layer 1: Format"
          tone={isLocked ? "rose" : "emerald"}
          text={isLocked ? "Checksum failure found in government ID format validation." : "Primary format checks passed for submitted IDs."}
        />
        <LayerCard
          title="Layer 2: Cross-match"
          tone={isLocked ? "rose" : "amber"}
          text={isLocked ? "Cross-document mismatch confirms high fraud likelihood." : "Name/address variance requires human validation."}
        />
        <LayerCard
          title="Layer 3/4: Vision + Risk"
          tone={isLocked ? "rose" : "indigo"}
          text={isLocked ? "Risk reached lockout threshold after multi-layer aggregation." : "Combined score is borderline and routed to review queue."}
        />
      </div>

      <div className="border-t border-slate-200 px-5 py-4">
        {isLocked ? (
          <div className="rounded-xl border border-rose-300 bg-rose-50 p-4 text-sm text-rose-800">
            <p className="inline-flex items-center gap-2 font-semibold">
              <ShieldAlert className="h-4 w-4" /> Locked by automated fraud layer
            </p>
            <p className="mt-1">{data.reasoning || "Critical validation failure identified by fraud system."}</p>
          </div>
        ) : (
          <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-sm text-indigo-800">
            <p className="inline-flex items-center gap-2 font-semibold">
              <FileCheck2 className="h-4 w-4" /> Human review requested
            </p>
            <p className="mt-1">
              {explainable
                ? "Application is likely genuine but needs a quick manual check due to confidence variance."
                : "HITL escalation triggered by confidence threshold crossing."}
            </p>
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={() => onOpen?.(data.userId)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
          >
            View Profile & Logs
          </button>
          {!isLocked && (
            <>
              <button
                onClick={() => onAction(data.userId, "REQUEST_REUPLOAD")}
                disabled={actionLoading}
                className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
              >
                Request Re-upload
              </button>
              <button
                onClick={() => onAction(data.userId, "REQUEST_CLARIFICATION")}
                disabled={actionLoading}
                className="rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-800 hover:bg-indigo-100 disabled:opacity-50"
              >
                Request Clarification
              </button>
              <button
                onClick={() => onAction(data.userId, "APPROVE")}
                disabled={actionLoading}
                className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
              >
                Approve & Continue
              </button>
            </>
          )}
          {isLocked && (
            <button
              onClick={() => onAction(data.userId, "REJECT")}
              disabled={actionLoading}
              className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
            >
              Confirm Lock & Notify
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function LayerCard({ title, text, tone }: { title: string; text: string; tone: "rose" | "amber" | "indigo" | "emerald" }) {
  const styles =
    tone === "rose"
      ? "border-rose-200 bg-rose-50 text-rose-700"
      : tone === "amber"
      ? "border-amber-200 bg-amber-50 text-amber-700"
      : tone === "emerald"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : "border-indigo-200 bg-indigo-50 text-indigo-700";
  return (
    <div className={`rounded-xl border p-4 ${styles}`}>
      <p className="text-xs font-semibold uppercase tracking-wider">{title}</p>
      <p className="mt-2 text-sm leading-relaxed">{text}</p>
    </div>
  );
}
