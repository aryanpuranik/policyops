"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import type { Variants } from "framer-motion";
import {
  ArrowRight,
  Brain,
  GitBranch,
  Shield,
  Zap,
  Users,
  CheckCircle,
  ChevronRight,
  FileText,
  Network,
  AlertTriangle,
  Workflow,
  Bot,
} from "lucide-react";

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: [0.25, 0.1, 0.25, 1] as [number, number, number, number] },
  }),
};

const AGENTS = [
  {
    icon: FileText,
    name: "Policy Analysis",
    desc: "Extracts rules, detects conflicts, and scores risk/compliance in one pass",
    color: "bg-blue-500",
  },
  {
    icon: Workflow,
    name: "Workflow Builder",
    desc: "Converts rules into step-by-step operational workflows and decision trees",
    color: "bg-green-500",
  },
  {
    icon: AlertTriangle,
    name: "Exception Generator",
    desc: "Produces edge cases: VIP customers, missing data, fraud scenarios",
    color: "bg-orange-500",
  },
  {
    icon: Zap,
    name: "Simulation Agent",
    desc: "Runs test scenarios through the workflow to identify failures",
    color: "bg-yellow-500",
  },
  {
    icon: Users,
    name: "Human-in-the-Loop",
    desc: "Identifies uncertainty and routes to human approval with full context",
    color: "bg-indigo-500",
  },
];

const FEATURES = [
  {
    icon: Brain,
    title: "True Agentic AI",
    desc: "5 specialized agents reason over your policy documents using LangGraph orchestration — no hardcoded templates.",
  },
  {
    icon: Network,
    title: "Multi-Agent Orchestration",
    desc: "Agents communicate sequentially: policy analysis → workflow generation → exception handling → simulation → human review.",
  },
  {
    icon: GitBranch,
    title: "Visual Decision Trees",
    desc: "Auto-generated React Flow graphs with nodes, edges, and decision points — directly deployable in your operations.",
  },
  {
    icon: Shield,
    title: "Risk Intelligence",
    desc: "Compliance risk scoring, missing control detection, and governance gap analysis on every policy document.",
  },
  {
    icon: Users,
    title: "Human-in-the-Loop",
    desc: "AI identifies ambiguous decisions and routes them to humans with full context, options, and recommendations.",
  },
  {
    icon: Zap,
    title: "Simulation & Testing",
    desc: "AI generates test scenarios and simulates them through your workflow to find failures before deployment.",
  },
];

const DEMO_STEPS = [
  { step: "01", label: "Upload Policy", desc: "PDF, Word, or plain text" },
  { step: "02", label: "Agents Reason", desc: "5 AI agents analyze in sequence" },
  { step: "03", label: "Human Review", desc: "Approve, edit, or reject" },
  { step: "04", label: "Deploy Workflow", desc: "Production-ready operations" },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* ─── Navbar ─────────────────────────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-slate-900 text-lg">PolicyOps</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm text-slate-600">
            <a href="#features" className="hover:text-slate-900 transition-colors">Features</a>
            <a href="#agents" className="hover:text-slate-900 transition-colors">Agents</a>
            <a href="#how-it-works" className="hover:text-slate-900 transition-colors">How It Works</a>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="text-sm text-slate-600 hover:text-slate-900 transition-colors"
            >
              Dashboard
            </Link>
            <Link
              href="/upload"
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              Try Demo
            </Link>
          </div>
        </div>
      </nav>

      {/* ─── Hero ────────────────────────────────────────────────────── */}
      <section className="pt-32 pb-20 px-6 overflow-hidden">
        <div className="max-w-5xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-100 rounded-full text-blue-700 text-sm font-medium mb-8"
          >
            <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
            Powered by LangGraph Multi-Agent AI
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-5xl md:text-7xl font-bold text-slate-900 leading-tight tracking-tight mb-6"
          >
            Turn Business Policies Into{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-violet-600">
              Operational Workflows
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-xl text-slate-500 max-w-2xl mx-auto mb-10 leading-relaxed"
          >
            Upload messy policies. Get production-ready workflows. Powered by 5
            specialized AI agents that reason, detect conflicts, assess risk, and
            generate decision trees — automatically.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Link
              href="/upload"
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-4 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 hover:shadow-xl hover:-translate-y-0.5"
            >
              Upload Policy
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              href="/dashboard"
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-4 bg-white text-slate-700 font-semibold rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all"
            >
              View Dashboard
              <ChevronRight className="w-5 h-5" />
            </Link>
          </motion.div>

          {/* Social proof */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="mt-12 flex flex-wrap items-center justify-center gap-6 text-sm text-slate-400"
          >
            {["PDF / DOCX / TXT", "5 AI Agents", "LangGraph Orchestration", "Human-in-the-Loop", "React Flow Visualization"].map((item) => (
              <div key={item} className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span>{item}</span>
              </div>
            ))}
          </motion.div>
        </div>

        {/* Hero visual */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="max-w-5xl mx-auto mt-20"
        >
          <div className="relative rounded-2xl border border-slate-200 shadow-2xl shadow-slate-100 overflow-hidden bg-white">
            <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-400" />
              <div className="w-3 h-3 rounded-full bg-yellow-400" />
              <div className="w-3 h-3 rounded-full bg-green-400" />
              <span className="ml-3 text-xs text-slate-400 font-mono">PolicyOps — Agent Execution</span>
            </div>
            <div className="p-6 space-y-3">
              {AGENTS.map((agent, i) => (
                <div
                  key={agent.name}
                  className={`flex items-center gap-4 p-3 rounded-lg border ${
                    i === 2
                      ? "border-blue-200 bg-blue-50"
                      : i < 2
                      ? "border-green-200 bg-green-50"
                      : "border-slate-200 bg-white opacity-50"
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-lg ${agent.color} flex items-center justify-center flex-shrink-0`}
                  >
                    <agent.icon className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900">{agent.name}</p>
                    <p className="text-xs text-slate-500 truncate">{agent.desc}</p>
                  </div>
                  <div className={`text-xs font-medium px-2 py-1 rounded-full ${
                    i < 2 ? "bg-green-100 text-green-700" :
                    i === 2 ? "bg-blue-100 text-blue-700 agent-running" :
                    "bg-slate-100 text-slate-400"
                  }`}>
                    {i < 2 ? "✓ Done" : i === 2 ? "● Running" : "Queued"}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </section>

      {/* ─── Features ────────────────────────────────────────────────── */}
      <section id="features" className="py-24 px-6 bg-slate-50">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            custom={0}
            className="text-center mb-16"
          >
            <p className="text-blue-600 font-semibold text-sm uppercase tracking-wide mb-3">
              Platform Capabilities
            </p>
            <h2 className="text-4xl font-bold text-slate-900 mb-4">
              Policy Intelligence at Scale
            </h2>
            <p className="text-lg text-slate-500 max-w-2xl mx-auto">
              Not a template engine. Not a rule wizard. A true multi-agent AI system
              that reasons over your policies like a senior compliance analyst would.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((f, i) => (
              <motion.div
                key={f.title}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                custom={i}
                className="bg-white rounded-2xl p-6 border border-slate-200 hover:border-blue-200 hover:shadow-lg transition-all group"
              >
                <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center mb-4 group-hover:bg-blue-100 transition-colors">
                  <f.icon className="w-6 h-6 text-blue-600" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">{f.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Agent Architecture ──────────────────────────────────────── */}
      <section id="agents" className="py-24 px-6 bg-white">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            custom={0}
            className="text-center mb-16"
          >
            <p className="text-violet-600 font-semibold text-sm uppercase tracking-wide mb-3">
              Multi-Agent Architecture
            </p>
            <h2 className="text-4xl font-bold text-slate-900 mb-4">
              5 Specialized AI Agents
            </h2>
            <p className="text-lg text-slate-500 max-w-2xl mx-auto">
              Each agent has a distinct role. Together, they form an autonomous pipeline
              that handles the full complexity of policy interpretation.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {AGENTS.map((agent, i) => (
              <motion.div
                key={agent.name}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                custom={i}
                className="relative flex items-start gap-4 p-5 rounded-2xl border border-slate-100 hover:border-slate-200 hover:shadow-md transition-all"
              >
                <div className={`w-10 h-10 ${agent.color} rounded-xl flex items-center justify-center flex-shrink-0`}>
                  <agent.icon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-mono text-slate-400">Agent {String(i + 1).padStart(2, "0")}</span>
                  </div>
                  <h3 className="font-semibold text-slate-900 text-sm mb-1">{agent.name}</h3>
                  <p className="text-xs text-slate-500 leading-relaxed">{agent.desc}</p>
                </div>
                {i < AGENTS.length - 1 && (
                  <div className="absolute -bottom-3 left-8 z-10">
                    <ArrowRight className="w-4 h-4 text-slate-300 rotate-90" />
                  </div>
                )}
              </motion.div>
            ))}
          </div>

          {/* Pipeline visualization */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            custom={8}
            className="mt-16 p-8 bg-slate-900 rounded-2xl"
          >
            <p className="text-center text-slate-400 text-sm font-mono mb-6">
              Agent Pipeline (LangGraph)
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {AGENTS.map((agent, i) => (
                <div key={agent.name} className="flex items-center gap-2">
                  <div className={`px-3 py-1.5 ${agent.color} rounded-lg text-white text-xs font-medium`}>
                    {agent.name.split(" ")[0]}
                  </div>
                  {i < AGENTS.length - 1 && (
                    <ArrowRight className="w-4 h-4 text-slate-500" />
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ─── How It Works ────────────────────────────────────────────── */}
      <section id="how-it-works" className="py-24 px-6 bg-gradient-to-b from-slate-50 to-white">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            custom={0}
            className="text-center mb-16"
          >
            <p className="text-green-600 font-semibold text-sm uppercase tracking-wide mb-3">
              How It Works
            </p>
            <h2 className="text-4xl font-bold text-slate-900 mb-4">
              From Policy to Operations in Minutes
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {DEMO_STEPS.map((step, i) => (
              <motion.div
                key={step.step}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                custom={i}
                className="text-center"
              >
                <div className="w-14 h-14 bg-white border-2 border-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm">
                  <span className="text-2xl font-bold text-blue-600">{step.step}</span>
                </div>
                <h3 className="font-semibold text-slate-900 mb-2">{step.label}</h3>
                <p className="text-sm text-slate-500">{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA ─────────────────────────────────────────────────────── */}
      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            custom={0}
            className="bg-gradient-to-r from-blue-600 to-violet-600 rounded-3xl p-12 text-center text-white"
          >
            <h2 className="text-4xl font-bold mb-4">
              Ready to compile your policies?
            </h2>
            <p className="text-blue-100 text-lg mb-8 max-w-xl mx-auto">
              Upload any policy document and watch 5 AI agents turn it into a
              production-ready operational workflow.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/upload"
                className="px-8 py-4 bg-white text-blue-600 font-bold rounded-xl hover:bg-blue-50 transition-all shadow-lg"
              >
                Upload Policy Now
              </Link>
              <Link
                href="/dashboard"
                className="px-8 py-4 bg-blue-500/30 text-white font-semibold rounded-xl hover:bg-blue-500/40 transition-all border border-white/20"
              >
                View Dashboard
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ─── Footer ──────────────────────────────────────────────────── */}
      <footer className="py-12 px-6 border-t border-slate-100">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-slate-900">PolicyOps</span>
            <span className="text-slate-400 text-sm">Policy-to-Operations Compiler</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-slate-400">
            <span>Built with LangGraph + FastAPI + Next.js</span>
          </div>
          <p className="text-sm text-slate-400">
            © 2026 PolicyOps. Multi-Agent AI Platform.
          </p>
        </div>
      </footer>
    </div>
  );
}
