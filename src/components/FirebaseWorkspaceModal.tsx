"use client";

import React, { useEffect, useState } from "react";
import { useAnalyzerStore } from "@/store/useAnalyzerStore";
import {
  clearRuntimeFirebaseConfig,
  saveRuntimeFirebaseConfig,
  signInGuestCloud,
  signInWithGoogle,
  signOutFirebase,
} from "@/lib/firebase/client";
import {
  deleteWorkspace,
  listWorkspaces,
  saveWorkspace,
} from "@/lib/firebase/workspaces";
import { createDefaultIndicatorConfigs } from "@/lib/quant/plugins";
import { WorkspaceSnapshot } from "@/types/market";
import {
  CheckCircle2,
  Cloud,
  Database,
  FolderOpen,
  LogIn,
  LogOut,
  Save,
  Settings,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";

interface FirebaseWorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId?: string | null;
  userEmail?: string | null;
  isFirebaseConfigured: boolean;
  onFirebaseConfigUpdated: () => void;
}

const BUILTIN_TEMPLATES: WorkspaceSnapshot[] = [
  {
    id: "tpl_scalp",
    name: "Intraday Microstructure (9 EMA + 3D Volatility Tube)",
    updatedAt: 0,
    timeframe: "1m",
    trailLength: 200,
    stretch: { x: 1.4, y: 1.4, z: 1.2 },
    cameraPreset: "orbit",
    subPaneMode: "displacement",
    replaySpeed: 10,
    replayTraceMode: "window",
    indicators: {
      ...createDefaultIndicatorConfigs(),
      "vector-ma": {
        id: "vector-ma",
        enabled: true,
        params: { period: 9, maType: "EMA", showSpineShadow: true, width: 5.5 },
      },
      "bollinger-3d": {
        id: "bollinger-3d",
        enabled: true,
        params: { period: 20, stdMult: 2.0, showRings: true },
      },
    },
  },
  {
    id: "tpl_dual_regime",
    name: "Dual-MA 3D Crossover (20 EMA + 50 Slow EMA)",
    updatedAt: 0,
    timeframe: "15m",
    trailLength: 350,
    stretch: { x: 1.2, y: 1.2, z: 1.6 },
    cameraPreset: "orbit",
    subPaneMode: "correlation",
    replaySpeed: 5,
    replayTraceMode: "accumulate",
    indicators: {
      ...createDefaultIndicatorConfigs(),
      "vector-ma": {
        id: "vector-ma",
        enabled: true,
        params: { period: 20, maType: "EMA", showSpineShadow: true, width: 5.5 },
      },
      "slow-ma": {
        id: "slow-ma",
        enabled: true,
        params: { period: 50, maType: "EMA" },
      },
    },
  },
  {
    id: "tpl_macro_daily",
    name: "Macro Regime Ribbon (Daily 50 SMA + Elongated Time)",
    updatedAt: 0,
    timeframe: "1d",
    trailLength: 225,
    stretch: { x: 1.0, y: 1.0, z: 2.6 },
    cameraPreset: "orbit",
    subPaneMode: "basis",
    replaySpeed: 5,
    replayTraceMode: "accumulate",
    indicators: {
      ...createDefaultIndicatorConfigs(),
      "vector-ma": {
        id: "vector-ma",
        enabled: true,
        params: { period: 50, maType: "SMA", showSpineShadow: true, width: 5.5 },
      },
    },
  },
];

export default function FirebaseWorkspaceModal({
  isOpen,
  onClose,
  userId,
  userEmail,
  isFirebaseConfigured,
  onFirebaseConfigUpdated,
}: FirebaseWorkspaceModalProps) {
  const createWorkspaceSnapshot = useAnalyzerStore(
    (s) => s.createWorkspaceSnapshot
  );
  const applyWorkspaceSnapshot = useAnalyzerStore(
    (s) => s.applyWorkspaceSnapshot
  );

  const [workspaceName, setWorkspaceName] = useState("");
  const [savedList, setSavedList] = useState<WorkspaceSnapshot[]>([]);
  const [storageSource, setStorageSource] = useState<"firestore" | "local">(
    "local"
  );
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [showConfigForm, setShowConfigForm] = useState(false);
  const [configJsonText, setConfigJsonText] = useState("");

  const refreshList = async () => {
    const res = await listWorkspaces(userId);
    setSavedList(res.workspaces);
    setStorageSource(res.source);
  };

  useEffect(() => {
    if (isOpen) {
      refreshList();
      setStatusMsg(null);
    }
  }, [isOpen, userId]);

  if (!isOpen) return null;

  const handleSaveCurrent = async () => {
    const snap = createWorkspaceSnapshot(
      workspaceName || `Workspace ${new Date().toLocaleTimeString()}`
    );
    const target = await saveWorkspace(snap, userId);
    setWorkspaceName("");
    setStatusMsg(
      target === "firestore"
        ? "Saved workspace to Firebase Cloud Firestore!"
        : "Saved workspace to Local Workstation Storage."
    );
    await refreshList();
  };

  const handleDelete = async (id: string) => {
    await deleteWorkspace(id, userId);
    await refreshList();
  };

  const handleLoad = (snap: WorkspaceSnapshot) => {
    applyWorkspaceSnapshot(snap);
    setStatusMsg(`Loaded "${snap.name}"`);
  };

  const handleSaveRuntimeConfig = () => {
    try {
      const parsed = JSON.parse(configJsonText);
      if (!parsed.apiKey || !parsed.projectId) {
        setStatusMsg("Error: JSON must include 'apiKey' and 'projectId'.");
        return;
      }
      saveRuntimeFirebaseConfig(parsed);
      setShowConfigForm(false);
      onFirebaseConfigUpdated();
      setStatusMsg("Firebase runtime configuration connected!");
    } catch {
      setStatusMsg("Invalid JSON format. Paste a valid Firebase config object.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 select-none">
      <div className="w-full max-w-2xl bg-[#111827] border border-[#24324b] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh]">
        {/* Header */}
        <div className="px-5 py-3.5 bg-[#0b101b] border-b border-[#1f293d] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Cloud className="w-5 h-5 text-amber-400" />
            <div>
              <h3 className="text-sm font-bold text-white">
                Firebase Cloud Workspaces & Quant Presets
              </h3>
              <p className="text-[11px] text-slate-400">
                Persist custom indicator stacks, axis stretch ratios, and timeframes via Firestore or Local Storage
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-5 text-xs">
          {statusMsg && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{statusMsg}</span>
            </div>
          )}

          {/* Firebase Connection & Auth Status Bar */}
          <div className="bg-[#0b101b] border border-[#1f293d] rounded-lg p-3.5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Database
                className={`w-4 h-4 ${
                  storageSource === "firestore"
                    ? "text-emerald-400"
                    : "text-sky-400"
                }`}
              />
              <div>
                <div className="font-bold text-slate-200">
                  Storage Engine:{" "}
                  <span
                    className={
                      storageSource === "firestore"
                        ? "text-emerald-400"
                        : "text-sky-400"
                    }
                  >
                    {storageSource === "firestore"
                      ? "Firebase Cloud Firestore (Synced)"
                      : "Local Workstation Storage (Active)"}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400">
                  {isFirebaseConfigured
                    ? userId
                      ? `Authenticated as ${userEmail || `UID: ${userId.slice(0, 8)}...`}`
                      : "Firebase configured — Sign in to enable Cloud Firestore sync"
                    : "No .env.local Firebase keys detected — running with automatic local persistence"}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {isFirebaseConfigured ? (
                userId ? (
                  <button
                    onClick={async () => {
                      await signOutFirebase();
                      await refreshList();
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 font-semibold cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                ) : (
                  <>
                    <button
                      onClick={async () => {
                        try {
                          await signInWithGoogle();
                          await refreshList();
                        } catch (e) {
                          setStatusMsg(`Auth notice: ${(e as Error).message}`);
                        }
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold cursor-pointer"
                    >
                      <LogIn className="w-3.5 h-3.5" />
                      <span>Google Sign-In</span>
                    </button>
                    <button
                      onClick={async () => {
                        try {
                          await signInGuestCloud();
                          await refreshList();
                        } catch (e) {
                          setStatusMsg(`Auth notice: ${(e as Error).message}`);
                        }
                      }}
                      className="px-2.5 py-1.5 rounded bg-[#1e293b] hover:bg-[#283548] text-slate-200 font-semibold cursor-pointer"
                    >
                      Guest Cloud
                    </button>
                  </>
                )
              ) : null}

              <button
                onClick={() => setShowConfigForm(!showConfigForm)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded bg-[#1a2234] hover:bg-[#253048] text-slate-300 border border-[#28354f] cursor-pointer"
              >
                <Settings className="w-3.5 h-3.5" />
                <span>Firebase Keys</span>
              </button>
            </div>
          </div>

          {/* Optional Runtime Firebase Config Input */}
          {showConfigForm && (
            <div className="bg-[#090d16] border border-amber-500/30 rounded-lg p-3.5 space-y-2.5">
              <div className="font-bold text-amber-400">
                Connect Firebase Project Config (JSON)
              </div>
              <p className="text-[11px] text-slate-400">
                You can either set <code>NEXT_PUBLIC_FIREBASE_*</code> in{" "}
                <code>.env.local</code> or paste your Firebase Web App JSON config
                below:
              </p>
              <textarea
                rows={4}
                placeholder='{"apiKey": "AIza...", "authDomain": "your-app.firebaseapp.com", "projectId": "your-app"}'
                value={configJsonText}
                onChange={(e) => setConfigJsonText(e.target.value)}
                className="w-full rounded bg-[#111827] border border-[#28354f] p-2 font-mono text-[11px] text-white"
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => {
                    clearRuntimeFirebaseConfig();
                    onFirebaseConfigUpdated();
                    setShowConfigForm(false);
                    setStatusMsg("Cleared runtime Firebase config.");
                  }}
                  className="px-2.5 py-1 rounded bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
                >
                  Clear Keys
                </button>
                <button
                  onClick={handleSaveRuntimeConfig}
                  className="px-3 py-1 rounded bg-amber-500 text-slate-950 font-bold cursor-pointer"
                >
                  Save & Connect
                </button>
              </div>
            </div>
          )}

          {/* Save Current Snapshot */}
          <div className="space-y-2">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Save Current Workstation State
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="e.g., London Session 5m Arbitrage Setup..."
                value={workspaceName}
                onChange={(e) => setWorkspaceName(e.target.value)}
                className="flex-1 bg-[#090d16] border border-[#263248] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
              />
              <button
                onClick={handleSaveCurrent}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 hover:opacity-95 text-white font-bold cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Workspace</span>
              </button>
            </div>
          </div>

          {/* Built-in Quant Templates */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-amber-400">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Built-in Quantitative Templates</span>
            </div>
            <div className="grid grid-cols-1 gap-2">
              {BUILTIN_TEMPLATES.map((tpl) => (
                <div
                  key={tpl.id}
                  className="flex items-center justify-between bg-[#0b101b] border border-[#1f293d] rounded-lg px-3 py-2"
                >
                  <div>
                    <div className="font-bold text-slate-100">{tpl.name}</div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      TF: {tpl.timeframe.toUpperCase()} • Stretch: ({tpl.stretch.x}x,{" "}
                      {tpl.stretch.y}x, {tpl.stretch.z}x) • 2D Pane: {tpl.subPaneMode}
                    </div>
                  </div>
                  <button
                    onClick={() => handleLoad(tpl)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded bg-sky-600/20 hover:bg-sky-600/30 text-sky-300 border border-sky-500/30 font-semibold cursor-pointer"
                  >
                    <FolderOpen className="w-3.5 h-3.5" />
                    <span>Load</span>
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* User Saved Workspaces */}
          <div className="space-y-2">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Saved Workspaces ({savedList.length})
            </div>
            {savedList.length === 0 ? (
              <div className="text-center py-5 bg-[#0b101b] border border-dashed border-[#1f293d] rounded-lg text-slate-500">
                No custom workspaces saved yet. Configure your indicators and click &ldquo;Save Workspace&rdquo; above.
              </div>
            ) : (
              <div className="space-y-2">
                {savedList.map((ws) => (
                  <div
                    key={ws.id}
                    className="flex items-center justify-between bg-[#0b101b] border border-[#1f293d] rounded-lg px-3 py-2"
                  >
                    <div>
                      <div className="font-bold text-white">{ws.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        TF: {ws.timeframe.toUpperCase()} • Trail: {ws.trailLength} bars •{" "}
                        {new Date(ws.updatedAt).toLocaleString()}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleLoad(ws)}
                        className="px-2.5 py-1 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 font-semibold cursor-pointer"
                      >
                        Apply
                      </button>
                      <button
                        onClick={() => handleDelete(ws.id)}
                        className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                        title="Delete Workspace"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
