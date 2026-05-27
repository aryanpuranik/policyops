"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Upload,
  Play,
  GitBranch,
  BookOpen,
  Settings,
  Bot,
  ChevronRight,
  Activity,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/upload", label: "Upload Policies", icon: Upload },
  { href: "/runs", label: "Agent Runs", icon: Play },
  { href: "/workflows", label: "Workflows", icon: GitBranch },
  { href: "/employee-portal", label: "Employee Portal", icon: BookOpen },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  const navItems = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/upload", label: "Upload Policies", icon: Upload },
    { href: "/runs", label: "Agent Runs", icon: Play },
    { href: "/workflows", label: "Workflows", icon: GitBranch },
    { href: "/execution", label: "Execution", icon: Activity },
    { href: "/employee-portal", label: "Employee Portal", icon: BookOpen },
    { href: "/settings", label: "Settings", icon: Settings },
  ];

  return (
    <aside className="w-64 bg-white border-r border-slate-100 flex flex-col h-screen sticky top-0">
      {/* Logo */}
      <div className="px-6 h-16 flex items-center border-b border-slate-100">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-sm">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-bold text-slate-900 text-sm">PolicyOps</p>
            <p className="text-[10px] text-slate-400 leading-none">Multi-Agent AI</p>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group",
                isActive
                  ? "bg-blue-50 text-blue-700"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              )}
            >
              <item.icon
                className={cn(
                  "w-4.5 h-4.5 flex-shrink-0",
                  isActive ? "text-blue-600" : "text-slate-400 group-hover:text-slate-600"
                )}
                size={18}
              />
              <span className="flex-1">{item.label}</span>
              {isActive && (
                <ChevronRight className="w-3.5 h-3.5 text-blue-400" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-slate-100">
        <div className="px-3 py-3 bg-gradient-to-r from-blue-50 to-violet-50 rounded-xl border border-blue-100">
          <p className="text-xs font-semibold text-blue-700 mb-1">Agentic Pipeline</p>
          <p className="text-xs text-slate-500 leading-relaxed">
            5 AI agents processing your policies using LangGraph orchestration
          </p>
        </div>
      </div>
    </aside>
  );
}
