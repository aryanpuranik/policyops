import Link from "next/link";
import { Activity, ArrowRight } from "lucide-react";

export default function ExecutionHomePage() {
  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold mb-4">
          <Activity className="w-3.5 h-3.5" />
          Execution
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Workflow Execution</h1>
        <p className="text-sm text-slate-500 mt-2 max-w-2xl">
          Execution is ready as a foundation. Open a workflow, then use the Execution tab to start a run.
        </p>

        <div className="mt-6">
          <Link
            href="/workflows"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-all"
          >
            Go to Workflows
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}