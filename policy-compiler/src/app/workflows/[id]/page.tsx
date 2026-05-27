"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  GitBranch,
  Shield,
  AlertTriangle,
  Zap,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  Loader2,
  Users,
  FileText,
  Clock,
  TrendingUp,
  Send,
  PackageCheck,
  Download,
  FileJson,
  Activity,
  Play,
  ListTodo,
  ClipboardList,
} from "lucide-react";
import {
  getWorkflow,
  approveWorkflow,
  rejectWorkflow,
  publishWorkflow,
  handoffWorkflow,
  exportWorkflowFile,
  getWorkflowExecution,
  startWorkflowExecution,
} from "@/lib/api";
import { getRiskColor, getStatusColor } from "@/lib/utils";
import dynamic from "next/dynamic";
import { ExecutionWorkspace } from "@/components/execution/ExecutionWorkspace";

const WorkflowGraph = dynamic(
  () => import("@/components/workflow/WorkflowGraph").then((m) => m.WorkflowGraph),
  { ssr: false, loading: () => <div className="h-[500px] bg-slate-100 rounded-xl animate-pulse" /> }
);

export default function WorkflowDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [workflow, setWorkflow] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"graph" | "steps" | "risks" | "exceptions" | "simulation" | "execution" | "rules">("graph");
  const [approving, setApproving] = useState(false);
  const [expandedStep, setExpandedStep] = useState<string | null>(null);
  const [approveNotes, setApproveNotes] = useState("");
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [handoffBusy, setHandoffBusy] = useState<string | null>(null);
  const [executionRun, setExecutionRun] = useState<any>(null);
  const [executionLoading, setExecutionLoading] = useState(false);
  const [executionStarting, setExecutionStarting] = useState(false);

  useEffect(() => {
    getWorkflow(id)
      .then((r) => setWorkflow(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!workflow?.id || activeTab !== "execution") return;

    let active = true;
    setExecutionLoading(true);
    getWorkflowExecution(workflow.id)
      .then((r) => {
        if (!active) return;
        setExecutionRun(r.data);
      })
      .catch(() => {
        if (!active) return;
        setExecutionRun(null);
      })
      .finally(() => {
        if (active) setExecutionLoading(false);
      });

    return () => {
      active = false;
    };
  }, [workflow?.id, activeTab]);

  const handleApprove = async () => {
    setApproving(true);
    setActionError(null);
    try {
      await approveWorkflow(id, approveNotes || "Approved by reviewer");
      const refreshed = await getWorkflow(id);
      setWorkflow(refreshed.data);
      setShowReviewModal(false);
      setActionSuccess("Workflow approved. Next step: publish for internal employee access.");
    } catch (e) {
      console.error(e);
      setActionError("Unable to approve workflow right now. Please try again.");
    } finally {
      setApproving(false);
    }
  };

  const handleReject = async () => {
    setApproving(true);
    setActionError(null);
    try {
      await rejectWorkflow(id, approveNotes || "Rejected by reviewer");
      const refreshed = await getWorkflow(id);
      setWorkflow(refreshed.data);
      setShowReviewModal(false);
    } catch (e) {
      console.error(e);
      setActionError("Unable to reject workflow right now. Please try again.");
    } finally {
      setApproving(false);
    }
  };

  const handlePublish = async () => {
    setPublishing(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      await publishWorkflow(id, { published_by: "Internal Publisher" });
      const refreshed = await getWorkflow(id);
      setWorkflow(refreshed.data);
      setActionSuccess("Workflow published successfully and is now available in the employee portal.");
    } catch (e) {
      console.error(e);
      setActionError("Unable to publish workflow right now. Please try again.");
    } finally {
      setPublishing(false);
    }
  };

  const handleExport = async (format: "pdf" | "docx" | "json") => {
    setActionError(null);
    try {
      const res = await exportWorkflowFile(id, format);
      const blob = new Blob([res.data], { type: res.headers["content-type"] });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      const ext = format;
      a.href = url;
      a.download = `${(workflow.title || "workflow").replace(/\s+/g, "_").toLowerCase()}.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      setActionError(`Unable to export ${format.toUpperCase()} right now.`);
    }
  };

  const handleHandoff = async (action: "send_to_operations" | "export_for_workflow_engine" | "publish_as_playbook") => {
    setHandoffBusy(action);
    setActionError(null);
    setActionSuccess(null);
    try {
      await handoffWorkflow(id, action, "Operations Lead");
      const refreshed = await getWorkflow(id);
      setWorkflow(refreshed.data);
      setActionSuccess("Operational handoff updated.");
    } catch (e) {
      console.error(e);
      setActionError("Unable to record handoff action. Please try again.");
    } finally {
      setHandoffBusy(null);
    }
  };

  const handleRunWorkflow = async () => {
    setExecutionStarting(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const res = await startWorkflowExecution(id);
      setExecutionRun(res.data);
      setActionSuccess("Execution started. Placeholder execution state is now available.");
    } catch (e) {
      console.error(e);
      setActionError("Unable to start execution right now. Publish the workflow first and try again.");
    } finally {
      setExecutionStarting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (!workflow) return null;

  const riskAnalysis = workflow.risk_analysis || {};
  const exceptions = workflow.exceptions?.exceptions || [];
  const simulation = workflow.simulation_results || {};
  const decisionTree = workflow.decision_tree || { nodes: [], edges: [] };
  const steps = workflow.steps || [];
  const conflicts = workflow.conflicts || {};
  const extractedRules = workflow.extracted_rules || {};

  const TABS = [
    { id: "graph", label: "Workflow Graph", icon: GitBranch },
    { id: "steps", label: `Steps (${steps.length})`, icon: FileText },
    { id: "risks", label: `Risks (${riskAnalysis.risks?.length || 0})`, icon: Shield },
    { id: "exceptions", label: `Exceptions (${exceptions.length})`, icon: AlertTriangle },
    { id: "simulation", label: "Simulation", icon: Zap },
    { id: "execution", label: "Execution", icon: Activity },
    { id: "rules", label: `Rules (${extractedRules.rules?.length || 0})`, icon: TrendingUp },
  ];

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/workflows" className="text-slate-400 hover:text-slate-600 text-sm">Workflows</Link>
            <span className="text-slate-300">/</span>
            <span className="text-slate-600 text-sm">{workflow.title}</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">{workflow.title}</h1>
          {workflow.description && (
            <p className="text-slate-500 text-sm mt-1 max-w-2xl">{workflow.description}</p>
          )}
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <span className={`text-sm px-3 py-1.5 rounded-full border font-medium ${getStatusColor(workflow.status)}`}>
            {workflow.status.replace("_", " ")}
          </span>
          {(workflow.status === "awaiting_review" || workflow.status === "pending_review") && (
            <button
              onClick={() => setShowReviewModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white text-sm font-semibold rounded-xl hover:bg-amber-600 transition-all"
            >
              <Users className="w-4 h-4" />
              Review Workflow
            </button>
          )}
          {workflow.status === "approved" && (
            <button
              onClick={handlePublish}
              disabled={publishing}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700 transition-all disabled:opacity-50"
            >
              {publishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <PackageCheck className="w-4 h-4" />}
              Publish Workflow
            </button>
          )}
          {workflow.status === "published" && (
            <div className="flex items-center gap-2">
              <Link href={`/workflows/${id}/execution`} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-all">
                <Play className="w-4 h-4" />
                Run Workflow
              </Link>
              <Link href="/employee-portal" className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 text-sm font-semibold rounded-xl hover:bg-slate-200 transition-all">
                <Users className="w-4 h-4" />
                Open Employee Portal
              </Link>
            </div>
          )}
        </div>
      </div>

      {(actionError || actionSuccess) && (
        <div className={`mb-6 rounded-xl border px-4 py-3 text-sm ${actionError ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
          {actionError || actionSuccess}
        </div>
      )}

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Steps", value: steps.length, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "Risk Level", value: riskAnalysis.risk_level || "N/A", color: "text-orange-600", bg: "bg-orange-50" },
          { label: "Conflicts", value: conflicts.total_conflicts || 0, color: "text-red-600", bg: "bg-red-50" },
          { label: "Sim Pass Rate", value: `${simulation.simulation_summary?.pass_rate || 0}%`, color: "text-green-600", bg: "bg-green-50" },
        ].map((s) => (
          <div key={s.label} className={`${s.bg} rounded-xl p-4`}>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {workflow.status === "published" && (
        <div className="mb-6 bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div>
              <h3 className="font-semibold text-slate-900">Published Workflow Controls</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Version {workflow.version || "v1.0"} · Source {workflow.source_document || "Uploaded Policy"}
              </p>
            </div>
            <span className={`text-xs px-2 py-1 rounded-full border font-medium ${getStatusColor(workflow.status)}`}>
              Read-only {workflow.status}
            </span>
          </div>

          <div className="flex flex-wrap gap-2 mb-4">
            <button onClick={() => handleExport("pdf")} className="px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 hover:bg-slate-50 inline-flex items-center gap-2">
              <Download className="w-4 h-4" /> Export PDF
            </button>
            <button onClick={() => handleExport("docx")} className="px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 hover:bg-slate-50 inline-flex items-center gap-2">
              <Download className="w-4 h-4" /> Export DOCX
            </button>
            <button onClick={() => handleExport("json")} className="px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 hover:bg-slate-50 inline-flex items-center gap-2">
              <FileJson className="w-4 h-4" /> Export JSON
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <button
              onClick={() => handleHandoff("send_to_operations")}
              disabled={handoffBusy !== null}
              className="px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 inline-flex items-center justify-center gap-2"
            >
              {handoffBusy === "send_to_operations" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Send to Operations
            </button>
            <button
              onClick={() => handleHandoff("export_for_workflow_engine")}
              disabled={handoffBusy !== null}
              className="px-3 py-2 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 disabled:opacity-50 inline-flex items-center justify-center gap-2"
            >
              {handoffBusy === "export_for_workflow_engine" ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
              Export for Workflow Engine
            </button>
            <button
              onClick={() => handleHandoff("publish_as_playbook")}
              disabled={handoffBusy !== null}
              className="px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 inline-flex items-center justify-center gap-2"
            >
              {handoffBusy === "publish_as_playbook" ? <Loader2 className="w-4 h-4 animate-spin" /> : <PackageCheck className="w-4 h-4" />}
              Publish as Playbook
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-6 overflow-x-auto">
        {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                  activeTab === tab.id
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
        ))}
      </div>

      {/* Tab Content */}
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        {/* ─── GRAPH ─── */}
        {activeTab === "graph" && (
          <div className="space-y-4">
            <WorkflowGraph
              nodes={decisionTree.nodes || []}
              edges={decisionTree.edges || []}
              className="h-[550px]"
            />

            {/* Approval matrix */}
            {workflow.approval_matrix?.length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <h3 className="font-semibold text-slate-900 mb-3">Approval Matrix</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="text-left px-4 py-2 text-xs text-slate-500 font-medium">Scenario</th>
                        <th className="text-left px-4 py-2 text-xs text-slate-500 font-medium">Approver</th>
                        <th className="text-left px-4 py-2 text-xs text-slate-500 font-medium">Threshold</th>
                        <th className="text-left px-4 py-2 text-xs text-slate-500 font-medium">SLA</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {(workflow.approval_matrix || []).map((row: any, i: number) => (
                        <tr key={i}>
                          <td className="px-4 py-2.5 text-slate-700">{row.scenario}</td>
                          <td className="px-4 py-2.5 text-slate-700 font-medium">{row.approver}</td>
                          <td className="px-4 py-2.5 text-slate-500">{row.threshold || "—"}</td>
                          <td className="px-4 py-2.5 text-slate-500">{row.sla || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {workflow.coverage_checklist?.length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <h3 className="font-semibold text-slate-900 mb-3">Policy Coverage Checklist</h3>
                <div className="space-y-2">
                  {(workflow.coverage_checklist || []).map((item: any, i: number) => (
                    <div key={`${item.requirement || "req"}-${i}`} className="flex items-center justify-between p-3 rounded-lg border border-slate-100 bg-slate-50">
                      <div>
                        <p className="text-sm font-medium text-slate-800">{item.requirement}</p>
                        {item.evidence && <p className="text-xs text-slate-500 mt-0.5">{item.evidence}</p>}
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${item.covered ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                        {item.covered ? "Covered" : "Missing"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── STEPS ─── */}
        {activeTab === "steps" && (
          <div className="space-y-3">
            {steps.length === 0 ? (
              <div className="text-center py-10 text-slate-400">No steps generated</div>
            ) : steps.map((step: any) => (
              <div key={step.step_id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div
                  className="flex items-center gap-4 p-4 cursor-pointer hover:bg-slate-50 transition-colors"
                  onClick={() => setExpandedStep(expandedStep === step.step_id ? null : step.step_id)}
                >
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0 text-sm font-bold text-blue-700">
                    {step.step_number}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-slate-900 text-sm">{step.title}</p>
                    <p className="text-xs text-slate-500">{step.actor} · {step.action_type?.replace("_", " ")}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {step.automated !== undefined && (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${step.automated ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-700"}`}>
                        {step.automated ? "Auto" : "Manual"}
                      </span>
                    )}
                    {step.time_limit && (
                      <span className="flex items-center gap-1 text-xs text-slate-400">
                        <Clock className="w-3 h-3" />
                        {step.time_limit}
                      </span>
                    )}
                    {expandedStep === step.step_id ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                  </div>
                </div>
                {expandedStep === step.step_id && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="border-t border-slate-100 px-4 py-4 bg-slate-50"
                  >
                    <p className="text-sm text-slate-700 mb-3">{step.description}</p>
                    {step.inputs?.length > 0 && (
                      <p className="text-xs text-slate-500 mb-1">
                        <span className="font-semibold">Inputs:</span> {step.inputs.join(", ")}
                      </p>
                    )}
                    {step.outputs?.length > 0 && (
                      <p className="text-xs text-slate-500 mb-1">
                        <span className="font-semibold">Outputs:</span> {step.outputs.join(", ")}
                      </p>
                    )}
                    {step.next_steps?.conditions?.length > 0 && (
                      <div className="mt-3">
                        <p className="text-xs font-semibold text-slate-600 mb-2">Branching Logic</p>
                        {step.next_steps.conditions.map((c: any, i: number) => (
                          <div key={i} className="flex items-center gap-2 text-xs text-slate-600 mb-1">
                            <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded font-mono">{c.condition}</span>
                            <ArrowRight className="w-3 h-3 text-slate-400" />
                            <span className="text-slate-500">{c.goto}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </motion.div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ─── RISKS ─── */}
        {activeTab === "risks" && (
          <div className="space-y-4">
            {/* Summary */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-slate-900">Risk Overview</h3>
                <span className={`text-sm px-3 py-1 rounded-full border font-medium ${getRiskColor(riskAnalysis.risk_level)}`}>
                  {riskAnalysis.risk_level?.toUpperCase() || "UNKNOWN"} RISK
                </span>
              </div>
              {riskAnalysis.executive_summary && (
                <p className="text-sm text-slate-600 mb-4">{riskAnalysis.executive_summary}</p>
              )}
              {riskAnalysis.immediate_actions?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-700 mb-2">Immediate Actions Required</p>
                  <ul className="space-y-1">
                    {riskAnalysis.immediate_actions.map((action: string, i: number) => (
                      <li key={`immediate-action-${i}-${action}`} className="flex items-start gap-2 text-sm text-slate-600">
                        <span className="w-5 h-5 bg-red-100 text-red-600 rounded-full flex items-center justify-center text-xs flex-shrink-0 mt-0.5">{i + 1}</span>
                        {action}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Risk items */}
            {(riskAnalysis.risks || []).map((risk: any, i: number) => (
              <div key={`risk-${risk.id || risk.title || i}`} className={`bg-white rounded-xl border p-5 ${getRiskColor(risk.severity)}`}>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getRiskColor(risk.severity)}`}>
                      {risk.severity?.toUpperCase()} · {risk.category?.toUpperCase()}
                    </span>
                    <h4 className="font-semibold text-slate-900 mt-2">{risk.title}</h4>
                  </div>
                  {risk.risk_score && (
                    <div className="text-right flex-shrink-0">
                      <p className="text-2xl font-bold text-slate-900">{risk.risk_score}</p>
                      <p className="text-xs text-slate-500">risk score</p>
                    </div>
                  )}
                </div>
                <p className="text-sm text-slate-600 mb-3">{risk.description}</p>
                {risk.mitigation && (
                  <div className="flex items-start gap-2 p-3 bg-green-50 rounded-lg border border-green-100">
                    <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-green-800"><span className="font-semibold">Mitigation:</span> {risk.mitigation}</p>
                  </div>
                )}
              </div>
            ))}

            {(!riskAnalysis.risks || riskAnalysis.risks.length === 0) && (
              <div className="text-center py-10 text-slate-400">No risks identified</div>
            )}
          </div>
        )}

        {/* ─── EXCEPTIONS ─── */}
        {activeTab === "exceptions" && (
          <div className="space-y-3">
            {exceptions.length === 0 ? (
              <div className="text-center py-10 text-slate-400">No exceptions generated</div>
            ) : exceptions.map((exc: any, i: number) => (
              <div key={`exception-${exc.id || exc.title || i}`} className="bg-white rounded-xl border border-slate-200 p-5">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getRiskColor(exc.severity)}`}>
                      {exc.severity?.toUpperCase()} · {exc.category?.toUpperCase()}
                    </span>
                    <h4 className="font-semibold text-slate-900 mt-2">{exc.title}</h4>
                  </div>
                  {exc.requires_human_judgment && (
                    <span className="text-xs px-2 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-full font-medium flex-shrink-0">
                      Human judgment needed
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-600 mb-3">{exc.description}</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {exc.trigger_scenario && (
                    <div className="p-3 bg-amber-50 rounded-lg border border-amber-100">
                      <p className="text-xs font-semibold text-amber-800 mb-1">Trigger Scenario</p>
                      <p className="text-xs text-amber-700">{exc.trigger_scenario}</p>
                    </div>
                  )}
                  {exc.correct_behavior && (
                    <div className="p-3 bg-green-50 rounded-lg border border-green-100">
                      <p className="text-xs font-semibold text-green-800 mb-1">Correct Behavior</p>
                      <p className="text-xs text-green-700">{exc.correct_behavior}</p>
                    </div>
                  )}
                </div>
                {exc.exception_handler?.resolution_steps?.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs font-semibold text-slate-700 mb-2">Resolution Steps</p>
                    <ol className="space-y-1">
                      {exc.exception_handler.resolution_steps.map((s: string, i: number) => (
                        <li key={`resolution-${exc.id || exc.title || "exc"}-${i}-${s}`} className="flex items-start gap-2 text-xs text-slate-600">
                          <span className="w-4 h-4 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-[10px] flex-shrink-0">{i + 1}</span>
                          {s}
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ─── SIMULATION ─── */}
        {activeTab === "simulation" && (
          <div className="space-y-4">
            {simulation.simulation_summary && (
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <h3 className="font-semibold text-slate-900 mb-4">Simulation Summary</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  {[
                    { label: "Total Scenarios", value: simulation.simulation_summary.total_scenarios },
                    { label: "Passed", value: simulation.simulation_summary.passed, color: "text-green-600" },
                    { label: "Failed", value: simulation.simulation_summary.failed, color: "text-red-600" },
                    { label: "Pass Rate", value: `${simulation.simulation_summary.pass_rate}%`, color: "text-blue-600" },
                  ].map((s) => (
                    <div key={s.label} className="text-center p-3 bg-slate-50 rounded-xl">
                      <p className={`text-2xl font-bold ${s.color || "text-slate-900"}`}>{s.value}</p>
                      <p className="text-xs text-slate-500 mt-1">{s.label}</p>
                    </div>
                  ))}
                </div>
                {simulation.simulation_summary.key_finding && (
                  <p className="text-sm text-slate-600 p-3 bg-blue-50 rounded-lg border border-blue-100">
                    <span className="font-semibold text-blue-800">Key Finding:</span> {simulation.simulation_summary.key_finding}
                  </p>
                )}
              </div>
            )}

            {(simulation.scenarios || []).map((scenario: any, i: number) => (
              <div key={`scenario-${scenario.id || scenario.name || i}`} className={`bg-white rounded-xl border p-5 ${scenario.passed ? "border-green-200" : "border-red-200"}`}>
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2">
                    {scenario.passed
                      ? <CheckCircle className="w-4 h-4 text-green-600" />
                      : <XCircle className="w-4 h-4 text-red-600" />}
                    <h4 className="font-medium text-slate-900 text-sm">{scenario.name}</h4>
                    <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full">
                      {scenario.type?.replace("_", " ")}
                    </span>
                  </div>
                  <span className={`text-xs font-semibold ${scenario.passed ? "text-green-700" : "text-red-700"}`}>
                    {scenario.outcome?.replace("_", " ").toUpperCase()}
                  </span>
                </div>
                <p className="text-sm text-slate-600 mb-2">{scenario.outcome_description}</p>
                {scenario.failure_reason && (
                  <div className="p-2 bg-red-50 border border-red-100 rounded text-xs text-red-700">
                    Failure: {scenario.failure_reason}
                  </div>
                )}
              </div>
            ))}

            {simulation.coverage_validation?.length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <h3 className="font-semibold text-slate-900 mb-3">Simulation Coverage Validation</h3>
                <div className="space-y-2">
                      {(simulation.coverage_validation || []).map((item: any, i: number) => (
                        <div key={`coverage-${item.requirement || "coverage"}-${i}`} className="flex items-center justify-between p-3 rounded-lg border border-slate-100 bg-slate-50">
                      <div>
                        <p className="text-sm font-medium text-slate-800">{item.requirement}</p>
                        {item.notes && <p className="text-xs text-slate-500 mt-0.5">{item.notes}</p>}
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${item.validated ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                        {item.validated ? "Validated" : "Needs Test"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── EXECUTION ─── */}
        {activeTab === "execution" && (
          <ExecutionWorkspace workflow={workflow} workflowId={id} />
        )}

        {/* ─── EXECUTION ─── */}
        {activeTab === "execution" && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Activity className="w-4 h-4 text-blue-600" />
                  <h3 className="font-semibold text-slate-900">Execution Dashboard</h3>
                </div>
                <p className="text-sm text-slate-500">
                  {workflow.status === "published"
                    ? "Ready to start a workflow execution run."
                    : "Publish the workflow before execution can start."}
                </p>
              </div>
              <button
                onClick={handleRunWorkflow}
                disabled={executionStarting || workflow.status !== "published"}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-all disabled:opacity-50"
              >
                {executionStarting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                Run Workflow
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                {
                  title: "Current Status",
                  value: executionRun?.execution_status || "not_started",
                  helper: executionRun ? "Execution run started" : "No execution run started yet",
                  icon: Activity,
                },
                {
                  title: "Current Step",
                  value: executionRun?.current_step_id || "—",
                  helper: executionRun?.current_step_id ? "Step currently in progress" : "No current step yet",
                  icon: ListTodo,
                },
                {
                  title: "Pending Tasks",
                  value: "0",
                  helper: "No pending tasks",
                  icon: ClipboardList,
                },
                {
                  title: "Execution Timeline / Audit Log",
                  value: executionRun?.started_at ? "Started" : "Empty",
                  helper: executionRun?.started_at ? `Started at ${new Date(executionRun.started_at).toLocaleString()}` : "Execution events will appear here",
                  icon: Clock,
                },
              ].map((card) => (
                <div key={card.title} className="bg-white rounded-xl border border-slate-200 p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <card.icon className="w-4 h-4 text-slate-400" />
                    <h4 className="text-sm font-semibold text-slate-900">{card.title}</h4>
                  </div>
                  <p className="text-2xl font-bold text-slate-900">{card.value}</p>
                  <p className="text-xs text-slate-500 mt-1">{card.helper}</p>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold text-slate-900 mb-3">Execution Timeline / Audit Log</h3>
              {executionLoading ? (
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading execution state...
                </div>
              ) : executionRun?.started_at ? (
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-2.5 h-2.5 rounded-full bg-blue-600 mt-1.5" />
                    <div>
                      <p className="text-sm font-medium text-slate-900">Workflow execution started</p>
                      <p className="text-xs text-slate-500">{new Date(executionRun.started_at).toLocaleString()}</p>
                    </div>
                  </div>
                  <p className="text-sm text-slate-500">Execution events will appear here.</p>
                </div>
              ) : (
                <p className="text-sm text-slate-500">No execution run started yet.</p>
              )}
            </div>
          </div>
        )}

        {/* ─── RULES ─── */}
        {activeTab === "rules" && (
          <div className="space-y-3">
            {(extractedRules.rules || []).map((rule: any, i: number) => (
              <div key={`rule-${rule.id || rule.title || i}`} className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono text-slate-400">{rule.id}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getRiskColor(rule.priority)}`}>
                        {rule.priority}
                      </span>
                      <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full">
                        {rule.type}
                      </span>
                    </div>
                    <h4 className="font-medium text-slate-900 text-sm mb-1">{rule.title}</h4>
                    <p className="text-xs text-slate-500 mb-2">{rule.description}</p>
                    {rule.condition && (
                      <div className="flex items-center gap-2 text-xs">
                        <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded font-mono">{rule.condition}</span>
                        <ArrowRight className="w-3 h-3 text-slate-400" />
                        <span className="px-2 py-1 bg-green-50 text-green-700 rounded font-mono">{rule.action}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {(!extractedRules.rules || extractedRules.rules.length === 0) && (
              <div className="text-center py-10 text-slate-400">No rules extracted</div>
            )}
          </div>
        )}
      </motion.div>

      {/* Review Modal */}
      {showReviewModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl"
          >
            <h2 className="text-xl font-bold text-slate-900 mb-2">Review Workflow</h2>
            <p className="text-slate-500 text-sm mb-4">
              Review the AI-generated workflow and approve, modify, or reject it.
            </p>

            {actionError && (
              <div className="mb-4 p-3 rounded-lg border border-red-200 bg-red-50 text-sm text-red-700">
                {actionError}
              </div>
            )}

            {/* Human review items */}
            {workflow.conflicts?.conflicts?.filter((c: any) => c.requires_human_decision).slice(0, 3).map((conflict: any, i: number) => (
              <div key={`conflict-${conflict.id || conflict.title || i}`} className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-xs font-semibold text-amber-800 mb-1">⚠ Review Required: {conflict.title}</p>
                <p className="text-xs text-amber-700">{conflict.recommended_resolution}</p>
              </div>
            ))}

            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-2">Review Notes</label>
              <textarea
                value={approveNotes}
                onChange={(e) => setApproveNotes(e.target.value)}
                placeholder="Add your review notes, modifications, or feedback..."
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm resize-none h-28 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleApprove}
                disabled={approving}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 transition-all disabled:opacity-50"
              >
                {approving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                Approve
              </button>
              <button
                onClick={handleReject}
                disabled={approving}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-red-600 text-white font-semibold rounded-xl hover:bg-red-700 transition-all disabled:opacity-50"
              >
                {approving ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                Reject
              </button>
              <button
                onClick={() => setShowReviewModal(false)}
                className="py-3 px-4 border border-slate-200 text-slate-600 font-medium rounded-xl hover:bg-slate-50 transition-all"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
