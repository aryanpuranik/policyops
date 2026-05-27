"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Loader2, ArrowLeft } from "lucide-react";
import { getWorkflow } from "@/lib/api";
import { getRiskColor, getStatusColor } from "@/lib/utils";

export default function EmployeeWorkflowDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [workflow, setWorkflow] = useState<any>(null);

  useEffect(() => {
    getWorkflow(id)
      .then((r) => setWorkflow(r.data))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="h-40 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (!workflow || workflow.status !== "published") {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <p className="text-slate-600">Published workflow not found.</p>
      </div>
    );
  }

  const steps = workflow.steps || [];
  const exceptions = workflow.exceptions?.exceptions || [];

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <Link href="/employee-portal" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 mb-4">
        <ArrowLeft className="w-4 h-4" /> Back to Playbook Hub
      </Link>

      <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6">
        <h1 className="text-2xl font-bold text-slate-900">{workflow.title}</h1>
        <p className="text-sm text-slate-500 mt-1">{workflow.description}</p>
        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          <span className={`px-2 py-1 rounded-full border font-medium ${getStatusColor(workflow.status)}`}>{workflow.status}</span>
          <span className="px-2 py-1 rounded-full border border-slate-200 text-slate-600">Version: {workflow.version || "v1.0"}</span>
          <span className="px-2 py-1 rounded-full border border-slate-200 text-slate-600">Approved by: {workflow.approved_by || "Internal Reviewer"}</span>
          <span className={`px-2 py-1 rounded-full border font-medium ${getRiskColor(workflow.risk_analysis?.risk_level)}`}>
            {(workflow.risk_analysis?.risk_level || "unknown").toLowerCase()} risk
          </span>
          <span className="px-2 py-1 rounded-full border border-slate-200 text-slate-600">Source: {workflow.source_document || "Uploaded Policy"}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-5">
          <h2 className="font-semibold text-slate-900 mb-4">Official Steps</h2>
          <div className="space-y-3">
            {steps.map((step: any, i: number) => (
              <div key={`step-${step.step_id || i}`} className="rounded-xl border border-slate-200 p-4">
                <p className="text-sm font-semibold text-slate-900">{i + 1}. {step.title}</p>
                <p className="text-xs text-slate-500 mt-1">{step.description}</p>
                <p className="text-xs text-slate-400 mt-1">{step.actor} · {step.action_type}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <h2 className="font-semibold text-slate-900 mb-3">Decision Points</h2>
            <p className="text-xs text-slate-500 mb-2">Defined in workflow graph and step branching rules.</p>
            <p className="text-xs text-slate-400">Open the full workflow page for the visual decision tree.</p>
            <Link href={`/workflows/${workflow.id}`} className="inline-flex mt-3 text-xs text-blue-600 hover:text-blue-700 font-medium">
              Open Full Visual Workflow
            </Link>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <h2 className="font-semibold text-slate-900 mb-3">Exceptions</h2>
            <div className="space-y-2">
              {exceptions.slice(0, 6).map((exc: any, i: number) => (
                <div key={`exc-${exc.id || i}`} className="rounded-lg border border-slate-200 p-3">
                  <p className="text-xs font-semibold text-slate-800">{exc.title}</p>
                  <p className="text-xs text-slate-500 mt-1">{exc.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
