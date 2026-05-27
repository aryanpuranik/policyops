"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { getWorkflow } from "@/lib/api";
import { ExecutionWorkspace } from "@/components/execution/ExecutionWorkspace";

export default function WorkflowExecutionPage() {
  const { id } = useParams<{ id: string }>();
  const [workflow, setWorkflow] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    getWorkflow(id)
      .then((r) => {
        if (active) setWorkflow(r.data);
      })
      .catch(console.error)
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (!workflow) return null;

  return <ExecutionWorkspace workflow={workflow} workflowId={id} backHref={`/workflows/${id}`} />;
}