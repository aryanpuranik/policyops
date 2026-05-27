"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { listWorkflows, getWorkflowByRun } from "@/lib/api";
import { formatRelativeTime, getStatusColor } from "@/lib/utils";
import { GitBranch, ArrowRight, Loader2, CheckCircle, Clock, AlertCircle } from "lucide-react";

function WorkflowsContent() {
  const searchParams = useSearchParams();
  const runId = searchParams.get("run");
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [redirected, setRedirected] = useState(false);

  useEffect(() => {
    if (runId && !redirected) {
      setRedirected(true);
      getWorkflowByRun(runId)
        .then((r) => {
          window.location.href = `/workflows/${r.data.id}`;
        })
        .catch(() => {
          listWorkflows().then((r) => setWorkflows(r.data)).finally(() => setLoading(false));
        });
    } else {
      listWorkflows().then((r) => setWorkflows(r.data)).finally(() => setLoading(false));
    }
  }, [runId]);

  const statusIcon = (status: string) => {
    if (status === "approved") return <CheckCircle className="w-4 h-4 text-green-600" />;
    if (status === "awaiting_review" || status === "pending_review") return <AlertCircle className="w-4 h-4 text-amber-600" />;
    if (status === "published") return <CheckCircle className="w-4 h-4 text-emerald-600" />;
    return <Clock className="w-4 h-4 text-slate-400" />;
  };

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Workflows</h1>
        <p className="text-slate-500 text-sm mt-1">Generated operational workflows from your policies</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        </div>
      ) : workflows.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <GitBranch className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 mb-4">No workflows generated yet</p>
          <Link href="/upload" className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-all">
            Upload a policy <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {workflows.map((wf) => (
            <Link key={wf.id} href={`/workflows/${wf.id}`}>
              <div className="bg-white rounded-2xl border border-slate-200 p-6 hover:border-blue-200 hover:shadow-md transition-all group">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0">
                      <GitBranch className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900 group-hover:text-blue-700 transition-colors">
                        {wf.title}
                      </h3>
                      <p className="text-sm text-slate-500 mt-0.5 line-clamp-2">{wf.description || "Generated workflow"}</p>
                      <div className="flex items-center gap-4 mt-3 text-xs text-slate-400">
                        <span>{wf.steps_count} steps</span>
                        <span>{wf.risks_count} risks</span>
                        <span>{wf.exceptions_count} exceptions</span>
                        <span>{formatRelativeTime(wf.created_at)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {statusIcon(wf.status)}
                    <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${getStatusColor(wf.status)}`}>
                      {wf.status.replace("_", " ")}
                    </span>
                    <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-blue-500 transition-colors" />
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default function WorkflowsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-40"><div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full" /></div>}>
      <WorkflowsContent />
    </Suspense>
  );
}
