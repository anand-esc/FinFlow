import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  GraduationCap, 
  ChevronRight, 
  Banknote,
  Search,
  Scale,
  ShieldCheck,
  Zap,
  XCircle
} from 'lucide-react';

const PARTNERS = [
  "State Bank of India", "HDFC Credila", "Avanse Financial", 
  "Bank of Baroda", "National Scholarship Portal", "MPOWER Financing",
  "Vidya Lakshmi", "InCred Edu"
];

const BENTO_FEATURES = [
  {
    id: "docs",
    title: "Agentic OCR",
    desc: "No more manual entry. We parse your Aadhaar, PAN, and admission letters with zero hallucinations.",
    icon: <Search className="text-indigo-500 w-6 h-6" />,
    color: "bg-indigo-50 border-indigo-100",
    hoverColor: "hover:bg-indigo-100 hover:border-indigo-300"
  },
  {
    id: "scoring",
    title: "Bias-Free Scoring",
    desc: "First-generation student? No formal credit history? We use alternative data from utility bills to build your trust profile.",
    icon: <Scale className="text-emerald-500 w-6 h-6" />,
    color: "bg-emerald-50 border-emerald-100",
    hoverColor: "hover:bg-emerald-100 hover:border-emerald-300"
  },
  {
    id: "scholarships",
    title: "400+ Scholarship Matcher",
    desc: "Our logic engine models overlapping criteria across state and central schemes to automatically find funds you qualify for.",
    icon: <GraduationCap className="text-amber-500 w-6 h-6" />,
    color: "bg-amber-50 border-amber-100",
    hoverColor: "hover:bg-amber-100 hover:border-amber-300"
  },
  {
    id: "disbursal",
    title: "Autopilot Apply",
    desc: "We auto-fill bank applications and trigger disbursal workflows across institutions so you don't have to fill 10 different forms.",
    icon: <Banknote className="text-rose-500 w-6 h-6" />,
    color: "bg-rose-50 border-rose-100",
    hoverColor: "hover:bg-rose-100 hover:border-rose-300"
  }
];

export function LandingPage({ onStartJourney }: { onStartJourney: () => void }) {
  const [showTAndC, setShowTAndC] = useState(false);
  const [activeBento, setActiveBento] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-[#fafafa] font-sans selection:bg-emerald-200">
      {/* Background ambient light */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-emerald-200/40 blur-[120px]" />
        <div className="absolute top-[20%] right-[-10%] w-[40%] h-[60%] rounded-full bg-indigo-200/30 blur-[120px]" />
      </div>

      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-40 border-b border-white/40 bg-white/60 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-[38px] w-[38px] place-items-center rounded-xl bg-gradient-to-tr from-indigo-500 to-emerald-400 shadow-md">
              <Zap className="h-[20px] w-[20px] text-white fill-white/20" />
            </div>
            <span className="text-xl font-outfit font-bold tracking-tight text-slate-900">SPARC</span>
          </div>
          <div className="flex items-center gap-6">
            <button 
              onClick={() => setShowTAndC(true)}
              className="text-sm font-semibold text-slate-600 hover:text-indigo-600 transition-colors"
            >
              Privacy & Trust
            </button>
            <button 
              onClick={onStartJourney}
              className="rounded-full bg-slate-900 px-5 py-2 text-sm font-bold text-white transition-transform hover:scale-105 active:scale-95 shadow-md shadow-slate-900/20"
            >
              Log in
            </button>
          </div>
        </div>
      </nav>

      <main className="relative z-10 pt-32 pb-20">
        
        {/* Hero Section */}
        <section className="mx-auto max-w-7xl px-6 pt-10 text-center lg:pt-20">
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="mx-auto max-w-3xl"
          >
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 text-xs font-semibold text-emerald-700">
              <ShieldCheck className="h-4 w-4" /> Agentic AI Loan Origination
            </div>
            
            <h1 className="font-outfit text-5xl font-black leading-[1.1] tracking-tight text-slate-900 md:text-7xl">
              We find the funds. <br />
              <span className="bg-gradient-to-r from-indigo-600 to-emerald-500 bg-clip-text text-transparent">
                You focus on the future.
              </span>
            </h1>
            
            <p className="mx-auto mt-6 max-w-2xl text-lg font-medium text-slate-600 md:text-xl leading-relaxed">
              SPARC bridges the gap for first-generation college-goers. Create a secure profile once, and our AI orchestrator will match, apply, and track loans and scholarships across 400+ institutions autonomously.
            </p>
            
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <button 
                onClick={onStartJourney}
                className="group flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-8 py-4 text-base font-bold text-white shadow-xl shadow-indigo-600/20 transition-all hover:bg-indigo-700 hover:shadow-2xl sm:w-auto"
              >
                Check Eligibility Now
                <ChevronRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
              </button>
            </div>
          </motion.div>
        </section>

        {/* Marquee Section */}
        <section className="mt-24 w-full border-y border-slate-200/60 bg-white/40 py-8 backdrop-blur-sm">
          <div className="mx-auto mb-6 text-center text-xs font-bold uppercase tracking-[0.2em] text-slate-400">
            Connecting you to trusted financial institutions
          </div>
          <div className="relative flex overflow-hidden w-full">
            <div className="pointer-events-none absolute left-0 top-0 z-10 h-full w-24 bg-gradient-to-r from-[#fafafa] to-transparent" />
            <div className="pointer-events-none absolute right-0 top-0 z-10 h-full w-24 bg-gradient-to-l from-[#fafafa] to-transparent" />
            
            <div className="flex animate-marquee whitespace-nowrap">
              {/* Double array for infinite scroll effect */}
              {[...PARTNERS, ...PARTNERS].map((partner, i) => (
                <div key={i} className="mx-8 flex items-center justify-center">
                  <span className="text-xl font-outfit font-black text-slate-300 transition-colors hover:text-slate-400">
                    {partner}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Bento Box Section */}
        <section className="mx-auto max-w-5xl px-6 py-24">
          <div className="mb-12 text-center">
            <h2 className="font-outfit text-3xl font-bold text-slate-900 md:text-4xl">How the Agentic Engine Works</h2>
            <p className="mt-4 text-slate-600">Complex multi-agent orchestration made simple.</p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {BENTO_FEATURES.map((feature, i) => (
              <motion.div
                key={feature.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                onHoverStart={() => setActiveBento(feature.id)}
                onHoverEnd={() => setActiveBento(null)}
                className={`relative overflow-hidden rounded-3xl border ${feature.color} ${feature.hoverColor} p-8 transition-all duration-300 cursor-default`}
              >
                <div className="mb-4 inline-block rounded-2xl bg-white p-3 shadow-sm">
                  {feature.icon}
                </div>
                <h3 className="mb-2 font-outfit text-xl font-bold text-slate-900">{feature.title}</h3>
                <p className="text-sm font-medium text-slate-700 leading-relaxed">{feature.desc}</p>
                
                {/* Pop up overlay inside bento */}
                <AnimatePresence>
                  {activeBento === feature.id && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute bottom-4 right-4"
                    >
                      <span className="inline-flex items-center gap-1 rounded-full bg-white/80 px-3 py-1 text-xs font-bold shadow-sm backdrop-blur">
                        Learn more <ChevronRight className="h-3 w-3" />
                      </span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        </section>

      </main>

      {/* T&C Modal */}
      <AnimatePresence>
        {showTAndC && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl leading-relaxed"
            >
              <div className="border-b border-slate-100 bg-slate-50/50 p-6 flex justify-between items-center">
                <h2 className="font-outfit text-xl font-bold text-slate-900">Privacy & Trust Safety</h2>
                <button 
                  onClick={() => setShowTAndC(false)}
                  className="rounded-full p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>
              <div className="p-6 text-sm text-slate-600 space-y-4 max-h-[60vh] overflow-y-auto">
                <p>
                  <strong>1. Agentic Responsibility:</strong> SPARC utilizes independent AI sub-agents to analyze your documents. Human-in-the-loop (HITL) escalation is guaranteed for all rejected documents.
                </p>
                <p>
                  <strong>2. Zero Hallucination Guarantee:</strong> Our scholarship logic engine operates strictly against official government rulesets. We do not invent or suggest scholarships that do not exist in the official NSP/State databases.
                </p>
                <p>
                  <strong>3. Alternative Credit Scoring:</strong> By using SPARC, you consent to our bias-aware eligibility model accessing local utility and admission data solely for the purpose of demonstrating financial responsibility.
                </p>
                <p>
                  <strong>4. Data Sovereignty:</strong> All Aadhaar and PAN numbers are immediately parsed and discarded after status validation. We store only cryptographic hashes of identity documents.
                </p>
              </div>
              <div className="bg-slate-50 p-4 border-t border-slate-100 text-center">
                <button 
                  onClick={() => setShowTAndC(false)}
                  className="rounded-xl bg-slate-900 px-6 py-2.5 text-sm font-bold text-white hover:bg-slate-800 transition"
                >
                  I Understand
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      
    </div>
  );
}
