"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search, BookOpen, ArrowRight, Loader2 } from "lucide-react";
import { listPublishedWorkflowLibrary } from "@/lib/api";
import { formatRelativeTime, getRiskColor, getStatusColor } from "@/lib/utils";

export default function EmployeePortalPage() {
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [workflows, setWorkflows] = useState<any[]>([]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    listPublishedWorkflowLibrary(search)
      .then((r) => {
        if (!active) return;
        setWorkflows(r.data || []);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [search]);

  const headingCount = useMemo(() => workflows.length, [workflows]);

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Internal Workflow Playbook Hub</h1>
        <p className="text-slate-500 text-sm mt-1">Official published workflows for internal employee access</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by workflow name or source document..."
              className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <span className="text-xs text-slate-500 px-3 py-2 bg-slate-50 rounded-lg border border-slate-200">
            {headingCount} published
          </span>
        </div>
      </div>

      {loading ? (
        <div className="h-40 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        </div>
      ) : workflows.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <BookOpen className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-600">No published workflows available.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {workflows.map((wf) => (
            <Link
              key={wf.id}
              href={`/employee-portal/${wf.id}`}
              className="bg-white rounded-2xl border border-slate-200 p-5 hover:border-blue-200 hover:shadow-sm transition-all"
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-semibold text-slate-900 truncate">{wf.workflow_name}</h3>
                <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${getStatusColor(wf.current_status)}`}>
                  {wf.current_status}
                </span>
              </div>
              <div className="mt-2 text-xs text-slate-500 space-y-1">
                <p>Version: {wf.version}</p>
                <p>Approved by: {wf.approved_by}</p>
                <p>Published: {wf.date_published ? formatRelativeTime(wf.date_published) : "—"}</p>
                <p>Source: {wf.source_document}</p>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${getRiskColor(wf.risk_level)}`}>
                  {(wf.risk_level || "unknown").toLowerCase()} risk
                </span>
                <span className="text-blue-600 text-xs inline-flex items-center gap-1 font-medium">
                  Open Playbook <ArrowRight className="w-3 h-3" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
