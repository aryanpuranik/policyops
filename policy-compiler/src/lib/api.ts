import axios from "axios";

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");

export const api = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
});

// ─── Dashboard ────────────────────────────────────────────────────────────────
export const getDashboardStats = () => api.get("/api/dashboard/stats");
export const getActivityFeed = (limit = 20) => api.get(`/api/dashboard/activity?limit=${limit}`);
export const getRecentRuns = () => api.get("/api/dashboard/recent-runs");
export const getPublishedWorkflows = (limit = 20) => api.get(`/api/dashboard/published-workflows?limit=${limit}`);

// ─── Policies ─────────────────────────────────────────────────────────────────
export const listPolicies = () => api.get("/api/policies/");
export const getPolicy = (id: string) => api.get(`/api/policies/${id}`);
export const deletePolicy = (id: string) => api.delete(`/api/policies/${id}`);
export const uploadPolicy = (file: File) => {
  const formData = new FormData();
  formData.append("file", file);
  return api.post("/api/policies/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" },
    onUploadProgress: undefined,
  });
};

// ─── Agent Runs ───────────────────────────────────────────────────────────────
export const listRuns = () => api.get("/api/runs/");
export const getRun = (id: string) => api.get(`/api/runs/${id}`);

// ─── Workflows ────────────────────────────────────────────────────────────────
export const listWorkflows = () => api.get("/api/workflows/");
export const getWorkflow = (id: string) => api.get(`/api/workflows/${id}`);
export const getWorkflowByRun = (runId: string) => api.get(`/api/workflows/by-run/${runId}`);
export const getWorkflowExecution = (workflowId: string) => api.get(`/api/workflows/${workflowId}/execution`);
export const startWorkflowExecution = (workflowId: string) => api.post(`/api/workflows/${workflowId}/execution/start`);
export const submitWorkflowExecutionInputs = (
  workflowId: string,
  runId: string,
  payload: { recipient_type?: string; recipient_email?: string; values?: Record<string, any> }
) => api.post(`/api/workflows/${workflowId}/execution/${runId}/submit-inputs`, payload);
export const checkWorkflowExecutionReply = (workflowId: string, runId: string) =>
  api.post(`/api/workflows/${workflowId}/execution/${runId}/check-reply`);
export const updateWorkflow = (id: string, data: object) => api.patch(`/api/workflows/${id}`, data);
export const approveWorkflow = (id: string, notes?: string) =>
  api.post(`/api/workflows/${id}/approve`, { notes });
export const rejectWorkflow = (id: string, notes?: string) =>
  api.post(`/api/workflows/${id}/reject`, { notes });
export const publishWorkflow = (id: string, payload: { published_by?: string; version?: string } = {}) =>
  api.post(`/api/workflows/${id}/publish`, payload);
export const archiveWorkflow = (id: string) => api.post(`/api/workflows/${id}/archive`);
export const listPublishedWorkflowLibrary = (search = "") =>
  api.get(`/api/workflows/published${search ? `?search=${encodeURIComponent(search)}` : ""}`);
export const handoffWorkflow = (id: string, action: string, actor = "Operations Lead") =>
  api.post(`/api/workflows/${id}/handoff`, { action, actor });
export const exportWorkflowFile = async (id: string, format: "pdf" | "docx" | "json") => {
  const response = await api.get(`/api/workflows/${id}/export/${format}`, { responseType: "blob" });
  return response;
};

// ─── Reviews ──────────────────────────────────────────────────────────────────
export const listReviews = () => api.get("/api/reviews/");
export const getPendingReviews = () => api.get("/api/reviews/pending");
export const getWorkflowReview = (workflowId: string) =>
  api.get(`/api/reviews/workflow/${workflowId}`);
export const resolveWorkflowReview = (workflowId: string, action: string, notes: string, modifications?: object) =>
  api.post(`/api/reviews/workflow/${workflowId}/resolve`, { action, notes, modifications });
