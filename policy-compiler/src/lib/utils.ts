import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

export function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString();
}

export function getRiskColor(level: string): string {
  switch (level?.toLowerCase()) {
    case "critical": return "text-red-600 bg-red-50 border-red-200";
    case "high": return "text-orange-600 bg-orange-50 border-orange-200";
    case "medium": return "text-yellow-600 bg-yellow-50 border-yellow-200";
    case "low": return "text-green-600 bg-green-50 border-green-200";
    default: return "text-slate-600 bg-slate-50 border-slate-200";
  }
}

export function getStatusColor(status: string): string {
  switch (status?.toLowerCase()) {
    case "completed": case "approved": case "passed": return "text-green-700 bg-green-50 border-green-200";
    case "published": return "text-emerald-700 bg-emerald-50 border-emerald-200";
    case "archived": return "text-slate-700 bg-slate-100 border-slate-300";
    case "running": case "processing": return "text-blue-700 bg-blue-50 border-blue-200";
    case "awaiting_review": case "pending_review": case "pending": return "text-amber-700 bg-amber-50 border-amber-200";
    case "failed": case "rejected": return "text-red-700 bg-red-50 border-red-200";
    case "draft": return "text-slate-700 bg-slate-50 border-slate-200";
    default: return "text-slate-700 bg-slate-50 border-slate-200";
  }
}
