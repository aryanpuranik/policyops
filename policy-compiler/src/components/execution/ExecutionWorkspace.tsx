"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Activity, ArrowLeft, ClipboardList, Clock, Loader2, ListTodo, Play } from "lucide-react";
import { checkWorkflowExecutionReply, getWorkflowExecution, startWorkflowExecution, submitWorkflowExecutionInputs } from "@/lib/api";

type ExecutionField = {
  key: string;
  label: string;
  type: "text" | "number" | "boolean" | "dropdown";
  required?: boolean;
  placeholder?: string;
  options?: string[];
};

type ExecutionWorkspaceProps = {
  workflow: any;
  workflowId: string;
  backHref?: string;
};

export function ExecutionWorkspace({ workflow, workflowId, backHref }: ExecutionWorkspaceProps) {
  const [executionRun, setExecutionRun] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [executionLoading, setExecutionLoading] = useState(false);
  const [executionStarting, setExecutionStarting] = useState(false);
  const [sendingForm, setSendingForm] = useState(false);
  const [checkingReply, setCheckingReply] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [recipientType, setRecipientType] = useState("external_contact");
  const [recipientEmail, setRecipientEmail] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    getWorkflowExecution(workflowId)
      .then((r) => {
        if (!active) return;
        setExecutionRun(r.data);
        if (r.data?.recipient_type) setRecipientType(r.data.recipient_type);
        if (r.data?.recipient_email) setRecipientEmail(r.data.recipient_email);
      })
      .catch(() => {
        if (!active) return;
        setExecutionRun(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [workflowId]);

  useEffect(() => {
    if (executionRun?.execution_status !== "awaiting_email_response" || !executionRun?.id) return;

    const interval = window.setInterval(() => {
      checkWorkflowExecutionReply(workflowId, executionRun.id)
        .then((res) => {
          setExecutionRun(res.data);
          if (res.data?.reply_found) {
            setActionSuccess(res.data?.message || "Reply received and processed.");
          }
        })
        .catch(() => {
          // silent polling errors; user can manually retry
        });
    }, 20000);

    return () => window.clearInterval(interval);
  }, [executionRun?.execution_status, executionRun?.id, workflowId]);

  const executionStatus = executionRun?.execution_status || "not_started";
  const requiresInput = Boolean(executionRun?.requires_input);
  const inputSchema: ExecutionField[] = executionRun?.input_schema || [];
  const decisionResult = executionRun?.decision_result || {};
  const decisions = decisionResult?.decisions || executionRun?.decisions || {};
  const computedVariables = decisionResult?.computed_variables || executionRun?.computed_variables || {};
  const nextStepId = decisionResult?.next_step_id || executionRun?.next_step_id || null;

  const inputLabel = useMemo(() => {
    if (executionStatus === "awaiting_email_response") return "Form emailed. Waiting for recipient reply";
    if (executionStatus === "running") return "No inputs required. Workflow execution started.";
    if (requiresInput) return "Inputs required to start workflow";
    return "Ready to run";
  }, [executionStatus, requiresInput]);

  const handleRunWorkflow = async () => {
    setExecutionStarting(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const res = await startWorkflowExecution(workflowId);
      setExecutionRun(res.data);
      setRecipientType(res.data?.recipient_type || "external_contact");
      setRecipientEmail(res.data?.recipient_email || "");
      if (res.data?.requires_input) {
        setActionSuccess("Inputs are required. Send the generated form to the recipient email.");
      } else {
        setActionSuccess("No inputs required. Workflow execution started.");
      }
    } catch (e) {
      console.error(e);
      setActionError("Unable to start execution right now. Publish the workflow first and try again.");
    } finally {
      setExecutionStarting(false);
    }
  };

  const handleSendForm = async () => {
    if (!executionRun?.id) return;
    setSendingForm(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const res = await submitWorkflowExecutionInputs(workflowId, executionRun.id, {
        recipient_type: recipientType,
        recipient_email: recipientEmail,
      });
      setExecutionRun(res.data);
      const delivery = res.data?.delivery_message || "Form emailed successfully. Waiting for recipient reply.";
      setActionSuccess(delivery);
    } catch (e) {
      console.error(e);
      setActionError("Unable to send form email right now. Please check SMTP settings and try again.");
    } finally {
      setSendingForm(false);
    }
  };

  const handleCheckReply = async () => {
    if (!executionRun?.id) return;
    setCheckingReply(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const res = await checkWorkflowExecutionReply(workflowId, executionRun.id);
      setExecutionRun(res.data);
      setActionSuccess(res.data?.message || "Reply check completed.");
    } catch (e) {
      console.error(e);
      setActionError("Unable to check reply inbox right now. Verify IMAP settings and try again.");
    } finally {
      setCheckingReply(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          {backHref && (
            <div className="flex items-center gap-2 mb-1 text-sm text-slate-500">
              <Link href={backHref} className="hover:text-slate-700 inline-flex items-center gap-1">
                <ArrowLeft className="w-4 h-4" /> Back to Workflow
              </Link>
            </div>
          )}
          <h1 className="text-2xl font-bold text-slate-900">Execution</h1>
          <p className="text-sm text-slate-500 mt-1">{workflow.title}</p>
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

      {(actionError || actionSuccess) && (
        <div className={`rounded-xl border px-4 py-3 text-sm ${actionError ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
          {actionError || actionSuccess}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[
          {
            title: "Current Status",
            value: executionStatus,
            helper: inputLabel,
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
            value: executionRun?.requires_input && (executionStatus === "input_required" || executionStatus === "awaiting_email_response") ? "1" : "0",
            helper: executionRun?.requires_input && (executionStatus === "input_required" || executionStatus === "awaiting_email_response") ? "Awaiting recipient email reply" : "No pending tasks",
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

      {(Object.keys(decisions).length > 0 || Object.keys(computedVariables).length > 0 || nextStepId) && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
          <div>
            <h3 className="font-semibold text-slate-900">Decision Results</h3>
            <p className="text-sm text-slate-500 mt-1">Rule evaluation and workflow branching output from the decision agent.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-xl border border-slate-200 p-4 bg-slate-50">
              <p className="text-xs text-slate-500">Risk Tier</p>
              <p className="text-lg font-bold text-slate-900">{decisions.risk_tier || "—"}</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-4 bg-slate-50">
              <p className="text-xs text-slate-500">Legal Review</p>
              <p className="text-lg font-bold text-slate-900">{decisions.legal_review_required ? "Required" : "Not required"}</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-4 bg-slate-50">
              <p className="text-xs text-slate-500">Finance Approval</p>
              <p className="text-lg font-bold text-slate-900">{decisions.finance_approval_required ? "Required" : "Not required"}</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-4 bg-slate-50">
              <p className="text-xs text-slate-500">Security Review</p>
              <p className="text-lg font-bold text-slate-900">{decisions.security_review_required ? "Required" : "Not required"}</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-4 bg-slate-50 md:col-span-2">
              <p className="text-xs text-slate-500">Next Step</p>
              <p className="text-lg font-bold text-slate-900">{nextStepId || "—"}</p>
            </div>
          </div>

          {Object.keys(computedVariables).length > 0 && (
            <div>
              <p className="text-sm font-medium text-slate-700 mb-2">Computed Variables</p>
              <pre className="text-xs text-slate-700 bg-slate-50 rounded-xl border border-slate-200 p-4 overflow-auto">{JSON.stringify(computedVariables, null, 2)}</pre>
            </div>
          )}
        </div>
      )}

      {requiresInput && (executionRun?.execution_status === "input_required" || executionRun?.execution_status === "awaiting_email_response") && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
          <div>
            <h3 className="font-semibold text-slate-900">Inputs required to start workflow</h3>
            <p className="text-sm text-slate-500 mt-1">Enter only the recipient email. PolicyOps will send the form template and wait for reply before continuing.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Who should fill this form?</label>
              <select
                value={recipientType}
                onChange={(e) => setRecipientType(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="internal_requester">Internal requester</option>
                <option value="external_contact">External contact</option>
                <option value="operations">Operations</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Email address</label>
              <input
                type="email"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                placeholder="name@company.com"
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="space-y-4">
            {inputSchema.length === 0 ? (
              <p className="text-sm text-slate-500">No specific fields were inferred. A generic request email will still be sent.</p>
            ) : (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-medium text-slate-800 mb-2">Fields requested from recipient</p>
                <ul className="space-y-1 text-sm text-slate-600">
                  {inputSchema.map((field) => (
                    <li key={field.key}>- {field.key} ({field.type})</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleSendForm}
              disabled={sendingForm || !recipientEmail}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-all disabled:opacity-50"
            >
              {sendingForm ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              Send Form Email
            </button>
            <button
              onClick={handleCheckReply}
              disabled={checkingReply || executionRun?.execution_status !== "awaiting_email_response"}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-all disabled:opacity-50"
            >
              {checkingReply ? <Loader2 className="w-4 h-4 animate-spin" /> : <Clock className="w-4 h-4" />}
              Check Mail Reply
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="font-semibold text-slate-900 mb-3">Submitted Data</h3>
        {executionRun?.input_values ? (
          <pre className="text-xs text-slate-700 bg-slate-50 rounded-xl border border-slate-200 p-4 overflow-auto">
{JSON.stringify(
  {
    recipient_type: executionRun.recipient_type,
    recipient_email: executionRun.recipient_email,
    values: executionRun.input_values,
    submitted_at: executionRun.submitted_at,
  },
  null,
  2
)}
          </pre>
        ) : (
          <p className="text-sm text-slate-500">No submitted data yet.</p>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="font-semibold text-slate-900 mb-3">Execution Timeline</h3>
        {executionRun?.started_at ? (
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-2.5 h-2.5 rounded-full bg-blue-600 mt-1.5" />
              <div>
                <p className="text-sm font-medium text-slate-900">Workflow execution initialized</p>
                <p className="text-xs text-slate-500">{new Date(executionRun.started_at).toLocaleString()}</p>
              </div>
            </div>
            {executionRun.submitted_at && (
              <div className="flex items-start gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-600 mt-1.5" />
                <div>
                  <p className="text-sm font-medium text-slate-900">Inputs submitted</p>
                  <p className="text-xs text-slate-500">{new Date(executionRun.submitted_at).toLocaleString()}</p>
                </div>
              </div>
            )}
            <p className="text-sm text-slate-500">Execution events will appear here.</p>
          </div>
        ) : (
          <p className="text-sm text-slate-500">Execution events will appear here.</p>
        )}
      </div>
    </div>
  );
}