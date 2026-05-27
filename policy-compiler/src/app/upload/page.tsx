"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload,
  FileText,
  X,
  CheckCircle,
  AlertCircle,
  Loader2,
  FileType,
  ArrowRight,
} from "lucide-react";
import { uploadPolicy } from "@/lib/api";
import { formatBytes } from "@/lib/utils";

const SAMPLE_POLICIES = [
  {
    title: "Refund Policy",
    description: "Customer refund rules with manager approvals",
    content: `Customer Refund Policy

1. Standard Refunds
All refund requests must be submitted within 30 days of purchase.
Refunds under $100 can be approved by customer service representatives.
Refunds between $100 and $500 require supervisor approval.
Refunds exceeding $500 require manager approval and documentation.

2. VIP Customer Exceptions
VIP customers with Gold or Platinum status may receive expedited refunds up to $1000 without manager approval, provided:
- Account has been active for more than 12 months
- No fraud flags in the last 6 months
- Reason is documented

3. Non-Refundable Items
Digital downloads are non-refundable once accessed.
Custom orders are non-refundable unless defective.
Services already rendered are non-refundable.

4. Fraud Prevention
All refunds over $200 require identity verification.
Customers with more than 3 refunds in 90 days must be flagged for review.
Flagged accounts require fraud team approval for any refund.

5. Escalation
If a customer disputes a refund decision, escalate to the customer success team within 24 hours.
Unresolved disputes after 48 hours escalate to VP Customer Experience.`,
  },
  {
    title: "Employee Onboarding",
    description: "New hire onboarding process and approvals",
    content: `Employee Onboarding Policy

1. Pre-Hire Requirements
All new hires must complete background check before start date.
IT equipment request must be submitted 5 business days before start.
HR must verify all required documents (I-9, W-4, direct deposit).

2. First Day Procedures
New employee must report to HR by 9am on first day.
Manager must complete onboarding checklist within 24 hours.
IT access must be provisioned before employee arrives.

3. Probationary Period
All new employees undergo 90-day probationary period.
Weekly check-ins required during first 30 days.
Manager approval required to extend beyond 90 days.

4. Access Control
System access must follow principle of least privilege.
Access to financial systems requires VP Finance approval.
Admin-level access requires CISO approval and quarterly review.

5. Training Requirements
All employees must complete compliance training within 14 days.
Role-specific training must be completed within 30 days.
Manager certification required before managing direct reports.`,
  },
  {
    title: "Loan Approval Policy",
    description: "Credit and loan approval workflow",
    content: `Loan Approval Policy

1. Eligibility Criteria
Applicant must have credit score of 650 or above for standard loans.
Income must be at least 3x the monthly loan payment.
Debt-to-income ratio must not exceed 43%.

2. Approval Levels
Loans under $10,000: Loan officer can approve independently.
Loans $10,000-$50,000: Requires branch manager approval.
Loans $50,000-$250,000: Requires regional director approval.
Loans above $250,000: Requires credit committee approval.

3. Documentation Requirements
All loans require: proof of income, 3 months bank statements, government ID.
Loans above $50,000 additionally require: 2 years tax returns, asset documentation.
Business loans require: business plan, 3 years financial statements.

4. Risk Assessment
High-risk applicants (score 650-680) require additional collateral.
Applications from restricted countries require compliance review.
Applicants with previous defaults require CEO approval.

5. Exception Handling
Exceptions to credit score minimum require risk committee approval.
VIP clients (assets > $1M) may qualify for relationship-based exceptions.
All exceptions must be documented and reviewed quarterly.`,
  },
];

export default function UploadPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback((f: File) => {
    const allowed = [".pdf", ".docx", ".doc", ".txt", ".md"];
    const ext = "." + f.name.split(".").pop()?.toLowerCase();
    if (!allowed.includes(ext)) {
      setError(`File type ${ext} not supported. Allowed: PDF, DOCX, TXT, MD`);
      return;
    }
    setFile(f);
    setError(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const f = e.dataTransfer.files[0];
      if (f) handleFile(f);
    },
    [handleFile]
  );

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setUploadProgress(0);
    setError(null);

    try {
      // Simulate progress
      const progressInterval = setInterval(() => {
        setUploadProgress((p) => Math.min(p + 15, 85));
      }, 300);

      const res = await uploadPolicy(file);
      clearInterval(progressInterval);
      setUploadProgress(100);

      await new Promise((r) => setTimeout(r, 500));
      router.push(`/runs/${res.data.run_id}`);
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Upload failed. Please try again.");
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleSampleUpload = async (sample: typeof SAMPLE_POLICIES[0]) => {
    const blob = new Blob([sample.content], { type: "text/plain" });
    const f = new File([blob], `${sample.title.replace(/ /g, "_")}_Policy.txt`, {
      type: "text/plain",
    });
    setFile(f);
    setError(null);
  };

  const fileTypeIcon = (filename: string) => {
    const ext = filename.split(".").pop()?.toLowerCase();
    if (ext === "pdf") return "📄";
    if (ext === "docx" || ext === "doc") return "📝";
    return "📃";
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Upload Policy</h1>
        <p className="text-slate-500 text-sm mt-1">
          Upload a policy document to start the multi-agent compilation pipeline
        </p>
      </div>

      {/* Upload Zone */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6">
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => !file && fileInputRef.current?.click()}
          className={`relative border-2 border-dashed rounded-xl p-10 text-center transition-all cursor-pointer ${
            dragOver
              ? "border-blue-400 bg-blue-50"
              : file
              ? "border-green-300 bg-green-50 cursor-default"
              : "border-slate-200 hover:border-blue-300 hover:bg-slate-50"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".pdf,.docx,.doc,.txt,.md"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />

          <AnimatePresence mode="wait">
            {file ? (
              <motion.div
                key="file"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center gap-3"
              >
                <div className="w-14 h-14 bg-green-100 rounded-2xl flex items-center justify-center">
                  <CheckCircle className="w-7 h-7 text-green-600" />
                </div>
                <div>
                  <p className="font-semibold text-slate-900">
                    {fileTypeIcon(file.name)} {file.name}
                  </p>
                  <p className="text-sm text-slate-500 mt-1">{formatBytes(file.size)}</p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); setFile(null); }}
                  className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                  Remove
                </button>
              </motion.div>
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center gap-3"
              >
                <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center">
                  <Upload className="w-7 h-7 text-slate-400" />
                </div>
                <div>
                  <p className="font-semibold text-slate-700">
                    Drop your policy here, or click to browse
                  </p>
                  <p className="text-sm text-slate-400 mt-1">
                    PDF, DOCX, DOC, TXT, MD — up to 50MB
                  </p>
                </div>
                <div className="flex items-center gap-4 text-xs text-slate-400 mt-2">
                  {["PDF", "DOCX", "TXT"].map((t) => (
                    <span key={t} className="px-2 py-1 bg-slate-100 rounded-md font-mono">
                      .{t.toLowerCase()}
                    </span>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Error */}
        {error && (
          <div className="mt-4 flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Upload Progress */}
        {uploading && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                <span className="text-sm font-medium text-slate-700">
                  {uploadProgress < 100 ? "Uploading and starting agents..." : "Redirecting to pipeline..."}
                </span>
              </div>
              <span className="text-sm text-slate-500">{uploadProgress}%</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2">
              <motion.div
                className="bg-blue-600 h-2 rounded-full"
                initial={{ width: "0%" }}
                animate={{ width: `${uploadProgress}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
          </div>
        )}

        {/* Upload Button */}
        {file && !uploading && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 flex gap-3"
          >
            <button
              onClick={handleUpload}
              className="flex-1 flex items-center justify-center gap-2 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-all shadow-sm"
            >
              <ArrowRight className="w-5 h-5" />
              Start Agent Pipeline
            </button>
          </motion.div>
        )}
      </div>

      {/* Pipeline Overview */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6">
        <h2 className="font-semibold text-slate-900 mb-4">What happens after upload?</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { icon: "🔍", label: "Policy Analysis Agent", desc: "Extracts rules, detects conflicts, and scores risk" },
            { icon: "🗺️", label: "Workflow Builder Agent", desc: "Builds decision trees & flows" },
            { icon: "🔮", label: "Exception Generator", desc: "Creates edge case handling" },
            { icon: "🧪", label: "Simulation Agent", desc: "Tests scenarios through workflow" },
            { icon: "👤", label: "Human Review Agent", desc: "Routes uncertain items to you" },
          ].map((step) => (
            <div key={step.label} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
              <span className="text-lg">{step.icon}</span>
              <div>
                <p className="text-sm font-medium text-slate-800">{step.label}</p>
                <p className="text-xs text-slate-500">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Sample Policies */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <h2 className="font-semibold text-slate-900 mb-1">Try a Sample Policy</h2>
        <p className="text-sm text-slate-500 mb-4">
          Don't have a policy? Use one of these examples to see the agents in action.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {SAMPLE_POLICIES.map((sample) => (
            <button
              key={sample.title}
              onClick={() => handleSampleUpload(sample)}
              className="text-left p-4 border border-slate-200 rounded-xl hover:border-blue-300 hover:bg-blue-50 transition-all group"
            >
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center mb-3 group-hover:bg-blue-200 transition-colors">
                <FileText className="w-4 h-4 text-blue-600" />
              </div>
              <p className="font-medium text-slate-900 text-sm">{sample.title}</p>
              <p className="text-xs text-slate-500 mt-1">{sample.description}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
