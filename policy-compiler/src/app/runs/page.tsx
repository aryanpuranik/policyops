"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { listRuns } from "@/lib/api";
import { formatRelativeTime, getStatusColor, formatDuration } from "@/lib/utils";
import { Play, Loader2, CheckCircle, XCircle, Clock, ArrowRight } from "lucide-react";

export default function RunsPage() {
  const [runs, setRuns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listRuns()
      .then((r) => setRuns(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const statusIcon = (status: string) => {
    if (["completed", "awaiting_review", "approved", "published", "archived"].includes(status))
      return <CheckCircle className="w-4 h-4 text-green-600" />;
    if (status === "processing")
      return <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />;
    if (status === "rejected")
      return <XCircle className="w-4 h-4 text-red-600" />;
    return <Clock className="w-4 h-4 text-slate-400" />;
  };

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Agent Runs</h1>
        <p className="text-slate-500 text-sm mt-1">All policy compilation pipeline executions</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto" />
          </div>
        ) : runs.length === 0 ? (
          <div className="p-12 text-center">
            <Play className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">No runs yet</p>
            <Link href="/upload" className="mt-4 inline-flex items-center gap-2 text-blue-600 text-sm hover:text-blue-700">
              Upload a policy to start <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Status</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Run ID</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Current Agent</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Started</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {runs.map((run) => (
                <tr key={run.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      {statusIcon(run.status)}
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${getStatusColor(run.status)}`}>
                        {run.status.replace("_", " ")}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 font-mono text-xs text-slate-500">
                    {run.id.slice(0, 8)}...
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-700">
                    {run.current_agent || "—"}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-500">
                    {formatRelativeTime(run.created_at)}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link
                      href={`/runs/${run.id}`}
                      className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium"
                    >
                      View
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
