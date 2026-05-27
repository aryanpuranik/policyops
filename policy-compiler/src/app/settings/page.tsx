"use client";

import { useState } from "react";
import { Save, Bot, Key, Database, Shield } from "lucide-react";

export default function SettingsPage() {
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("gpt-4o-mini");
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-slate-500 text-sm mt-1">Configure your Policy-to-Operations Compiler</p>
      </div>

      <div className="space-y-6">
        {/* API Configuration */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center">
              <Key className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-900">AI Configuration</h2>
              <p className="text-xs text-slate-500">OpenAI API settings for agent reasoning</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">OpenAI API Key</label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-..."
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              />
              <p className="text-xs text-slate-400 mt-1">Set in backend .env file: OPENAI_API_KEY</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Model</label>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="gpt-4o-mini">GPT-4o Mini (Recommended)</option>
                <option value="gpt-4o">GPT-4o (Higher quality, higher cost)</option>
                <option value="gpt-4-turbo">GPT-4 Turbo</option>
              </select>
            </div>
          </div>
        </div>

        {/* Agent Pipeline */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 bg-purple-50 rounded-xl flex items-center justify-center">
              <Bot className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-900">Agent Pipeline</h2>
              <p className="text-xs text-slate-500">LangGraph multi-agent configuration</p>
            </div>
          </div>

          <div className="space-y-3">
            {[
              { name: "Policy Analysis Agent", enabled: true },
              { name: "Workflow Builder Agent", enabled: true },
              { name: "Exception Generation Agent", enabled: true },
              { name: "Simulation Agent", enabled: true },
              { name: "Human Review Agent", enabled: true },
            ].map((agent) => (
              <div key={agent.name} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                <span className="text-sm text-slate-700">{agent.name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-green-600 font-medium">Active</span>
                  <div className="w-8 h-5 bg-green-500 rounded-full cursor-pointer" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Backend Connection */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 bg-green-50 rounded-xl flex items-center justify-center">
              <Database className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-900">Backend Configuration</h2>
              <p className="text-xs text-slate-500">FastAPI server connection settings</p>
            </div>
          </div>

          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 font-mono text-sm">
            <p className="text-slate-600">API URL: <span className="text-blue-600">http://localhost:8000</span></p>
            <p className="text-slate-600 mt-1">Database: <span className="text-green-600">SQLite (policy_compiler.db)</span></p>
            <p className="text-slate-600 mt-1">Vector Store: <span className="text-purple-600">ChromaDB (./chroma_db)</span></p>
          </div>
        </div>

        <button
          onClick={handleSave}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-all shadow-sm"
        >
          <Save className="w-4 h-4" />
          {saved ? "Saved!" : "Save Settings"}
        </button>
      </div>
    </div>
  );
}
