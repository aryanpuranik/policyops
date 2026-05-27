"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle,
  Loader2,
  XCircle,
  Clock,
  ArrowRight,
  Bot,
  FileText,
  Workflow,
  AlertTriangle,
  Zap,
  Users,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { getRun } from "@/lib/api";
import { formatDuration, getStatusColor } from "@/lib/utils";

const AGENT_META: Record<string, { icon: any; color: string; bg: string; desc: string }> = {
  "Policy Analysis Agent": {
    icon: FileText,
    color: "text-blue-600",
    bg: "bg-blue-100",
    desc: "Extracting rules, detecting conflicts, and scoring risk in one pass",
  },
  "Workflow Builder Agent": {
    icon: Workflow,
    color: "text-green-600",
    bg: "bg-green-100",
    desc: "Converting rules into operational workflow and decision tree",
  },
  "Exception Generation Agent": {
    icon: AlertTriangle,
    color: "text-orange-600",
    bg: "bg-orange-100",
    desc: "Generating edge cases: VIP customers, missing data, fraud",
  },
  "Simulation Agent": {
    icon: Zap,
    color: "text-yellow-600",
    bg: "bg-yellow-100",
    desc: "Running test scenarios through the workflow",
  },
  "Human Review Agent": {
    icon: Users,
    color: "text-indigo-600",
    bg: "bg-indigo-100",
    desc: "Identifying items requiring human judgment",
  },
};

const ALL_AGENTS = Object.keys(AGENT_META);
const CURRENT_AGENT_TO_NAME: Record<string, string> = {
  analysis: "Policy Analysis Agent",
  workflow_builder: "Workflow Builder Agent",
  exception_generation: "Exception Generation Agent",
  simulation: "Simulation Agent",
  human_review: "Human Review Agent",
};

const LEGACY_ANALYSIS_AGENTS = new Set([
  "Policy Extraction Agent",
  "Conflict Detection Agent",
  "Risk & Compliance Agent",
]);

export default function RunDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [run, setRun] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Load initial run data
  useEffect(() => {
    getRun(id)
      .then((r) => {
        setRun(r.data);
        setLogs(r.data.logs || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  // SSE stream for live updates
  useEffect(() => {
    const es = new EventSource(`/api/runs/${id}/stream`);
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "agent_log") {
          setLogs((prev) => {
            const exists = prev.find((l) => l.id === data.data.id);
            if (exists) return prev.map((l) => (l.id === data.data.id ? data.data : l));
            return [...prev, data.data];
          });
        } else if (data.type === "status") {
          setRun(data.data);
        } else if (data.type === "complete") {
          es.close();
          // Refresh to get final state
          getRun(id).then((r) => {
            setRun(r.data);
            setLogs(r.data.logs || []);
          });
        }
      } catch {}
    };

    return () => es.close();
  }, [id]);

  const getAgentStatus = (agentName: string) => {
    const agentLogs = logs.filter((l) => l.agent_name === agentName);
    const log = agentLogs[agentLogs.length - 1];

    if (!log && agentName === "Policy Analysis Agent") {
      const legacyLogs = logs.filter((l) => LEGACY_ANALYSIS_AGENTS.has(l.agent_name));
      if (legacyLogs.some((l) => l.status === "failed")) return "failed";
      if (legacyLogs.length > 0 && legacyLogs.every((l) => l.status === "completed")) return "completed";
      if (legacyLogs.some((l) => l.status === "running")) return "running";
    }

    if (!log) {
      if (run?.status === "running" && run?.current_agent) {
        const currentAgentName = CURRENT_AGENT_TO_NAME[run.current_agent] || run.current_agent;
        if (agentName === currentAgentName) return "running";
      }
      return "pending";
    }
    if (log?.status === "completed" && run?.status === "running" && run?.current_agent) {
      const currentAgentName = CURRENT_AGENT_TO_NAME[run.current_agent] || run.current_agent;
      if (agentName === currentAgentName) return "running";
    }
    return log.status;
  };

  const completedCount = ALL_AGENTS.filter((agentName) => getAgentStatus(agentName) === "completed").length;
  const totalAgents = ALL_AGENTS.length;
  const progressPct = (completedCount / totalAgents) * 100;
  const currentAgentLabel = run?.current_agent ? (CURRENT_AGENT_TO_NAME[run.current_agent] || run.current_agent) : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  const isComplete = run?.status === "completed" || run?.status === "awaiting_review" || run?.status === "failed";

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/runs" className="text-slate-400 hover:text-slate-600 text-sm">
              Agent Runs
            </Link>
            <span className="text-slate-300">/</span>
            <span className="text-slate-600 text-sm font-mono">{id.slice(0, 8)}...</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Agent Execution</h1>
        </div>
        <span className={`text-sm px-3 py-1.5 rounded-full border font-medium ${getStatusColor(run?.status)}`}>
          {run?.status?.replace("_", " ")}
        </span>
      </div>

      {/* Progress Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium text-slate-700">Pipeline Progress</p>
          <p className="text-sm text-slate-500">{completedCount}/{totalAgents} agents completed</p>
        </div>
        <div className="w-full bg-slate-100 rounded-full h-3 mb-4">
          <motion.div
            className="bg-gradient-to-r from-blue-500 to-violet-500 h-3 rounded-full"
            initial={{ width: "0%" }}
            animate={{ width: `${progressPct}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>

        {!isComplete && (
          <div className="flex items-center gap-2 text-sm text-blue-700">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>
              {currentAgentLabel ? `${currentAgentLabel} running...` : "Starting pipeline..."}
            </span>
          </div>
        )}

        {run?.status === "completed" && (
          <div className="flex items-center gap-2 text-sm text-green-700">
            <CheckCircle className="w-4 h-4" />
            <span>Pipeline completed successfully</span>
          </div>
        )}

        {run?.status === "awaiting_review" && (
          <div className="flex items-center gap-2 text-sm text-amber-700">
            <Users className="w-4 h-4" />
            <span>Waiting for human review</span>
          </div>
        )}

        {run?.status === "failed" && (
          <div className="flex items-center gap-2 text-sm text-red-700">
            <XCircle className="w-4 h-4" />
            <span>{run.error_message || "Pipeline failed"}</span>
          </div>
        )}
      </div>

      {/* Agent Cards */}
      <div className="space-y-3 mb-6">
        {ALL_AGENTS.map((agentName, idx) => {
          const meta = AGENT_META[agentName] || { icon: Bot, color: "text-slate-600", bg: "bg-slate-100", desc: "" };
          const status = getAgentStatus(agentName);
          const log = [...logs].reverse().find((l) => l.agent_name === agentName);
          const isExpanded = expanded === agentName;

          return (
            <motion.div
              key={agentName}
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.06 }}
              className={`bg-white rounded-xl border transition-all ${
                status === "running"
                  ? "border-blue-300 shadow-md shadow-blue-50"
                  : status === "completed"
                  ? "border-green-200"
                  : status === "failed"
                  ? "border-red-200"
                  : "border-slate-200"
              }`}
            >
              <div className="p-4">
                <div className="flex items-center gap-4">
                  {/* Icon */}
                  <div className={`w-10 h-10 ${meta.bg} rounded-xl flex items-center justify-center flex-shrink-0`}>
                    <meta.icon className={`w-5 h-5 ${meta.color}`} />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="font-medium text-slate-900 text-sm">{agentName}</p>
                      <span className="text-xs text-slate-400 font-mono">
                        {String(idx + 1).padStart(2, "0")}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">{meta.desc}</p>
                  </div>

                  {/* Status badge */}
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {log?.duration_ms && (
                      <span className="text-xs text-slate-400">{formatDuration(log.duration_ms)}</span>
                    )}
                    {status === "running" ? (
                      <div className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium agent-running">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Running
                      </div>
                    ) : status === "completed" ? (
                      <div className="flex items-center gap-1.5 px-2.5 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                        <CheckCircle className="w-3 h-3" />
                        Done
                      </div>
                    ) : status === "failed" ? (
                      <div className="flex items-center gap-1.5 px-2.5 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">
                        <XCircle className="w-3 h-3" />
                        Failed
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 text-slate-500 rounded-full text-xs font-medium">
                        <Clock className="w-3 h-3" />
                        Queued
                      </div>
                    )}

                    {log && (
                      <button
                        onClick={() => setExpanded(isExpanded ? null : agentName)}
                        className="p-1 text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    )}
                  </div>
                </div>

                {/* Expanded output */}
                <AnimatePresence>
                  {isExpanded && log && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-4 pt-4 border-t border-slate-100">
                        <p className="text-xs font-semibold text-slate-600 mb-2">Output Summary</p>
                        <div className="grid grid-cols-2 gap-2">
                          {Object.entries(log.output_data || {}).map(([key, val]) => (
                            <div key={key} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                              <span className="text-xs text-slate-500 capitalize">{key.replace(/_/g, " ")}</span>
                              <span className="text-xs font-semibold text-slate-900">{String(val)}</span>
                            </div>
                          ))}
                        </div>
                        {log.message && (
                          <p className="text-xs text-slate-500 mt-2">{log.message}</p>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Results Summary */}
      {run?.graph_state && isComplete && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl border border-slate-200 p-6 mb-6"
        >
          <h2 className="font-semibold text-slate-900 mb-4">Pipeline Results</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[
              { label: "Rules Extracted", value: run.graph_state.extracted_rules_count },
              { label: "Conflicts Found", value: run.graph_state.conflicts_count },
              { label: "Risk Level", value: run.graph_state.risk_level },
              { label: "Workflow Steps", value: run.graph_state.workflow_steps },
              { label: "Exceptions Generated", value: run.graph_state.exceptions_count },
              { label: "Review Items", value: run.graph_state.review_items },
            ].map((item) => (
              <div key={item.label} className="p-4 bg-slate-50 rounded-xl text-center">
                <p className="text-2xl font-bold text-slate-900">
                  {item.value ?? "—"}
                </p>
                <p className="text-xs text-slate-500 mt-1">{item.label}</p>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* CTA */}
      {isComplete && run?.status !== "failed" && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row gap-3"
        >
          <Link
            href={`/workflows?run=${id}`}
            className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-all shadow-sm"
          >
            <Workflow className="w-5 h-5" />
            View Generated Workflow
            <ArrowRight className="w-4 h-4 ml-1" />
          </Link>
          {run?.status === "awaiting_review" && (
            <Link
              href={`/workflows?run=${id}&review=true`}
              className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-amber-500 text-white font-semibold rounded-xl hover:bg-amber-600 transition-all"
            >
              <Users className="w-5 h-5" />
              Review Required
            </Link>
          )}
        </motion.div>
      )}
    </div>
  );
}
