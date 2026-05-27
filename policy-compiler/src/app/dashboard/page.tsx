"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  FileText,
  Play,
  GitBranch,
  Clock,
  TrendingUp,
  Upload,
  CheckCircle,
  AlertCircle,
  Loader2,
  ArrowRight,
  Users,
} from "lucide-react";
import { getDashboardStats, getActivityFeed, getRecentRuns, getPublishedWorkflows } from "@/lib/api";
import { formatRelativeTime, getRiskColor, getStatusColor } from "@/lib/utils";

interface Stats {
  total_policies: number;
  total_runs: number;
  total_workflows: number;
  pending_reviews: number;
  success_rate: number;
  approved_workflows: number;
  published_workflows: number;
}

interface Activity {
  id: string;
  type: string;
  title: string;
  description: string;
  status: string;
  timestamp: string;
  link: string;
}

interface RecentRun {
  id: string;
  policy_name: string;
  status: string;
  current_agent: string;
  progress: number;
  created_at: string;
}

interface PublishedWorkflow {
  id: string;
  workflow_name: string;
  version: string;
  approved_by: string;
  date_published: string;
  risk_level: string;
  source_document: string;
  current_status: string;
}

const AGENT_ORDER = [
  "Policy Analysis Agent",
  "Workflow Builder Agent",
  "Exception Generation Agent",
  "Simulation Agent",
  "Human Review Agent",
];

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [runs, setRuns] = useState<RecentRun[]>([]);
  const [published, setPublished] = useState<PublishedWorkflow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [statsRes, actRes, runsRes, publishedRes] = await Promise.all([
          getDashboardStats(),
          getActivityFeed(15),
          getRecentRuns(),
          getPublishedWorkflows(8),
        ]);
        setStats(statsRes.data);
        setActivity(actRes.data);
        setRuns(runsRes.data);
        setPublished(publishedRes.data || []);
      } catch (err) {
        // Backend may not be ready yet — fail silently, show empty state
        console.warn("Dashboard load failed, retrying...", err);
      } finally {
        setLoading(false);
      }
    }
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, []);

  const statCards = [
    {
      label: "Total Policies",
      value: stats?.total_policies ?? 0,
      icon: FileText,
      color: "text-blue-600",
      bg: "bg-blue-50",
      link: "/upload",
    },
    {
      label: "Agent Runs",
      value: stats?.total_runs ?? 0,
      icon: Play,
      color: "text-violet-600",
      bg: "bg-violet-50",
      link: "/runs",
    },
    {
      label: "Workflows Generated",
      value: stats?.total_workflows ?? 0,
      icon: GitBranch,
      color: "text-green-600",
      bg: "bg-green-50",
      link: "/workflows",
    },
    {
      label: "Human Reviews Pending",
      value: stats?.pending_reviews ?? 0,
      icon: Users,
      color: "text-amber-600",
      bg: "bg-amber-50",
      link: "/workflows",
    },
  ];

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-500 text-sm mt-1">
            Monitor your policy compilation pipeline
          </p>
        </div>
        <Link
          href="/upload"
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-all shadow-sm"
        >
          <Upload className="w-4 h-4" />
          Upload Policy
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        {statCards.map((card, i) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
          >
            <Link
              href={card.link}
              className="block bg-white rounded-2xl border border-slate-200 p-6 hover:border-blue-200 hover:shadow-md transition-all group"
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`w-10 h-10 ${card.bg} rounded-xl flex items-center justify-center`}>
                  <card.icon className={`w-5 h-5 ${card.color}`} />
                </div>
                <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-slate-400 transition-colors" />
              </div>
              {loading ? (
                <div className="h-8 w-16 bg-slate-100 rounded animate-pulse" />
              ) : (
                <p className="text-3xl font-bold text-slate-900">{card.value}</p>
              )}
              <p className="text-sm text-slate-500 mt-1">{card.label}</p>
            </Link>
          </motion.div>
        ))}
      </div>

      {/* Main content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Activity Feed */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Activity Feed</h2>
            <span className="text-xs text-slate-400">Auto-refreshes every 15s</span>
          </div>
          <div className="divide-y divide-slate-50">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="px-6 py-4 flex items-center gap-3">
                  <div className="w-8 h-8 bg-slate-100 rounded-lg animate-pulse" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 bg-slate-100 rounded animate-pulse w-48" />
                    <div className="h-3 bg-slate-100 rounded animate-pulse w-72" />
                  </div>
                </div>
              ))
            ) : activity.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <Play className="w-8 h-8 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500 text-sm">No activity yet</p>
                <p className="text-slate-400 text-xs mt-1">Upload a policy to get started</p>
              </div>
            ) : (
              activity.map((item) => (
                <Link
                  key={item.id}
                  href={item.link}
                  className="flex items-start gap-3 px-6 py-4 hover:bg-slate-50 transition-colors"
                >
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${
                      item.status === "success"
                        ? "bg-green-50"
                        : item.status === "warning"
                        ? "bg-amber-50"
                        : item.status === "error"
                        ? "bg-red-50"
                        : "bg-blue-50"
                    }`}
                  >
                    {item.status === "success" ? (
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    ) : item.status === "warning" ? (
                      <Clock className="w-4 h-4 text-amber-600" />
                    ) : item.status === "error" ? (
                      <AlertCircle className="w-4 h-4 text-red-600" />
                    ) : (
                      <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900">{item.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5 truncate">{item.description}</p>
                  </div>
                  <span className="text-xs text-slate-400 flex-shrink-0">
                    {formatRelativeTime(item.timestamp)}
                  </span>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Recent Runs */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Recent Runs</h2>
            <Link href="/runs" className="text-xs text-blue-600 hover:text-blue-700">
              View all
            </Link>
          </div>
          <div className="divide-y divide-slate-50">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="px-4 py-4 space-y-2">
                  <div className="h-3.5 bg-slate-100 rounded animate-pulse w-32" />
                  <div className="h-3 bg-slate-100 rounded animate-pulse w-24" />
                </div>
              ))
            ) : runs.length === 0 ? (
              <div className="px-6 py-10 text-center">
                <p className="text-slate-400 text-sm">No runs yet</p>
              </div>
            ) : (
              runs.map((run) => (
                <Link
                  key={run.id}
                  href={`/runs/${run.id}`}
                  className="block px-4 py-4 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-slate-900 truncate">{run.policy_name}</p>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full border font-medium ${getStatusColor(run.status)}`}
                    >
                      {run.status.replace("_", " ")}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mb-2">
                    {run.current_agent || "Queued"}
                  </p>
                  {run.status === "running" && (
                    <div className="w-full bg-slate-100 rounded-full h-1.5">
                      <div
                        className="bg-blue-500 h-1.5 rounded-full transition-all agent-running"
                        style={{ width: `${run.progress || 30}%` }}
                      />
                    </div>
                  )}
                  <p className="text-xs text-slate-400 mt-1.5">
                    {formatRelativeTime(run.created_at)}
                  </p>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="mt-6 bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">Published Workflows</h2>
          <Link href="/employee-portal" className="text-xs text-blue-600 hover:text-blue-700">
            Open Employee Portal
          </Link>
        </div>
        {loading ? (
          <div className="p-6 text-sm text-slate-400">Loading published workflows...</div>
        ) : published.length === 0 ? (
          <div className="p-6 text-sm text-slate-500">No published workflows yet.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-5">
            {published.map((wf) => (
              <Link
                key={wf.id}
                href={`/workflows/${wf.id}`}
                className="rounded-xl border border-slate-200 p-4 hover:border-blue-200 hover:shadow-sm transition-all"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium text-slate-900 truncate">{wf.workflow_name}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${getStatusColor(wf.current_status)}`}>
                    {wf.current_status}
                  </span>
                </div>
                <div className="mt-2 text-xs text-slate-500 space-y-1">
                  <p>Version: {wf.version}</p>
                  <p>Approved by: {wf.approved_by || "Internal Reviewer"}</p>
                  <p>Published: {wf.date_published ? formatRelativeTime(wf.date_published) : "—"}</p>
                  <p>Source: {wf.source_document || "Uploaded Policy"}</p>
                </div>
                <span className={`inline-flex mt-3 text-xs px-2 py-0.5 rounded-full border font-medium ${getRiskColor(wf.risk_level)}`}>
                  {(wf.risk_level || "unknown").toLowerCase()} risk
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Success rate metric */}
      {stats && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mt-6 bg-gradient-to-r from-blue-600 to-violet-600 rounded-2xl p-6 text-white"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm font-medium mb-1">Pipeline Success Rate</p>
              <p className="text-4xl font-bold">{stats.success_rate}%</p>
              <p className="text-blue-100 text-sm mt-1">
                {stats.approved_workflows} workflows approved
              </p>
            </div>
            <TrendingUp className="w-16 h-16 text-white/20" />
          </div>
        </motion.div>
      )}
    </div>
  );
}
