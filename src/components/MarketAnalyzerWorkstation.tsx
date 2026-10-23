"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useAnalyzerStore } from "@/store/useAnalyzerStore";
import TopCommandBar from "./TopCommandBar";
import PhaseSpace3DCanvas from "./PhaseSpace3DCanvas";
import SynchronizedSubPane2D from "./SynchronizedSubPane2D";
import InspectorSidebar from "./InspectorSidebar";
import ReplayTransportBar from "./ReplayTransportBar";
import FirebaseWorkspaceModal from "./FirebaseWorkspaceModal";
import { subscribeAuthState } from "@/lib/firebase/client";
import { MarketBar } from "@/types/market";

export default function MarketAnalyzerWorkstation() {
  const timeframe = useAnalyzerStore((s) => s.timeframe);
  const mode = useAnalyzerStore((s) => s.mode);
  const isLivePlaying = useAnalyzerStore((s) => s.isLivePlaying);
  const setDataSeries = useAnalyzerStore((s) => s.setDataSeries);
  const setIsLoading = useAnalyzerStore((s) => s.setIsLoading);
  const appendLiveBar = useAnalyzerStore((s) => s.appendLiveBar);

  const [workspaceModalOpen, setWorkspaceModalOpen] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isFirebaseConfigured, setIsFirebaseConfigured] = useState(false);
  const [fbConfigTick, setFbConfigTick] = useState(0);

  const lastSimPriceRef = useRef({ xauusd: 2720.0, eurusd: 1.085 });

  // Subscribe to Firebase Auth
  useEffect(() => {
    const unsub = subscribeAuthState((user, configured) => {
      setIsFirebaseConfigured(configured);
      setUserId(user?.uid ?? null);
      setUserEmail(user?.email ?? null);
    });
    return () => unsub();
  }, [fbConfigTick]);

  // Client-side fallback generator if network fails completely
  const generateLocalFallback = useCallback((tf: string): MarketBar[] => {
    const count = tf === "1d" ? 200 : 250;
    const intervalSec =
      { "1m": 60, "5m": 300, "15m": 900, "1h": 3600, "1d": 86400 }[tf] ?? 60;
    const now = Math.floor(Date.now() / 1000);
    let xau = 2720.0;
    let eur = 1.085;
    const out: MarketBar[] = [];

    for (let i = count; i >= 0; i--) {
      const t = now - i * intervalSec;
      xau += (Math.random() - 0.49) * 2.0;
      eur += (Math.random() - 0.49) * 0.0008;
      const xae = xau / eur;
      out.push({
        timestamp: t,
        datetime:
          tf === "1d"
            ? new Date(t * 1000).toISOString().slice(0, 10)
            : new Date(t * 1000).toISOString().slice(11, 19),
        xauusd: Number(xau.toFixed(2)),
        eurusd: Number(eur.toFixed(5)),
        xaueur: Number(xae.toFixed(2)),
        usdeur: Number((1 / eur).toFixed(5)),
        source: "simulated",
      });
    }
    lastSimPriceRef.current = { xauusd: xau, eurusd: eur };
    return out;
  }, []);

  // Fetch timeframe history
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/history?timeframe=${timeframe}`);
        const json = await res.json();
        if (!cancelled && Array.isArray(json.data) && json.data.length > 0) {
          setDataSeries(json.data);
          const latest = json.data[json.data.length - 1];
          lastSimPriceRef.current = {
            xauusd: latest.xauusd,
            eurusd: latest.eurusd,
          };
        } else if (!cancelled) {
          setDataSeries(generateLocalFallback(timeframe));
        }
      } catch {
        if (!cancelled) {
          setDataSeries(generateLocalFallback(timeframe));
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [timeframe, setDataSeries, setIsLoading, generateLocalFallback]);

  // Yahoo Live Feed Polling (5s)
  useEffect(() => {
    if (!isLivePlaying || mode !== "yahoo") return;
    const id = setInterval(async () => {
      try {
        const res = await fetch(`/api/live?timeframe=${timeframe}`);
        const json = await res.json();
        if (json?.latest) {
          appendLiveBar(json.latest);
          lastSimPriceRef.current = {
            xauusd: json.latest.xauusd,
            eurusd: json.latest.eurusd,
          };
        }
      } catch {
        // ignore transient poll errors
      }
    }, 5000);
    return () => clearInterval(id);
  }, [timeframe, isLivePlaying, mode, appendLiveBar]);

  // High-Frequency Simulation Feed (650ms / ~2Hz)
  useEffect(() => {
    if (!isLivePlaying || mode !== "sim") return;
    const id = setInterval(() => {
      const z1 = (Math.random() + Math.random() + Math.random() - 1.5) * 0.6;
      const z2 =
        0.35 * z1 +
        Math.sqrt(1 - 0.35 * 0.35) *
          (Math.random() + Math.random() + Math.random() - 1.5) *
          0.4;

      lastSimPriceRef.current.xauusd *= Math.exp(0.00015 * z1);
      lastSimPriceRef.current.eurusd *= Math.exp(0.00008 * z2);

      const xau = lastSimPriceRef.current.xauusd;
      const eur = lastSimPriceRef.current.eurusd;
      const xae = xau / eur;
      const nowTs = Math.floor(Date.now() / 1000);

      appendLiveBar({
        timestamp: nowTs,
        datetime: new Date().toLocaleTimeString(),
        xauusd: Number(xau.toFixed(2)),
        eurusd: Number(eur.toFixed(5)),
        xaueur: Number(xae.toFixed(2)),
        usdeur: Number((1 / eur).toFixed(5)),
        source: "simulated",
      });
    }, 650);
    return () => clearInterval(id);
  }, [isLivePlaying, mode, appendLiveBar]);

  // Global Workstation Keyboard Shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      const s = useAnalyzerStore.getState();
      if (e.code === "Space") {
        e.preventDefault();
        s.toggleReplay();
      } else if (e.key === "m" || e.key === "M") {
        s.toggleIndicator("vector-ma");
      } else if (e.key === "ArrowRight") {
        s.stepReplay(e.shiftKey ? 10 : 1);
      } else if (e.key === "ArrowLeft") {
        s.stepReplay(e.shiftKey ? -10 : -1);
      } else if (e.key === "l" || e.key === "L") {
        s.toggleReplayLoop();
      } else if (e.key === "]" || e.key === "}") {
        s.setStretch({ z: s.stretch.z + 0.2 });
      } else if (e.key === "[" || e.key === "{") {
        s.setStretch({ z: s.stretch.z - 0.2 });
      } else if (e.key === "+" || e.key === "=") {
        s.setStretch({ x: s.stretch.x + 0.2, y: s.stretch.y + 0.2 });
      } else if (e.key === "-" || e.key === "_") {
        s.setStretch({ x: s.stretch.x - 0.2, y: s.stretch.y - 0.2 });
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#0a0e17] text-[#f3f4f6]">
      <TopCommandBar
        onOpenWorkspaceModal={() => setWorkspaceModalOpen(true)}
        cloudUserEmail={userEmail}
        isFirebaseConfigured={isFirebaseConfigured}
      />

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Center Multi-Panel Viewport (3D Phase Space + Synchronized 2D Sub-Pane) */}
        <div className="flex flex-col flex-1 min-w-0 h-full overflow-hidden">
          <PhaseSpace3DCanvas />
          <SynchronizedSubPane2D />
        </div>

        {/* Right Docked Quant Inspector Sidebar */}
        <InspectorSidebar />
      </div>

      <ReplayTransportBar />

      <FirebaseWorkspaceModal
        isOpen={workspaceModalOpen}
        onClose={() => setWorkspaceModalOpen(false)}
        userId={userId}
        userEmail={userEmail}
        isFirebaseConfigured={isFirebaseConfigured}
        onFirebaseConfigUpdated={() => setFbConfigTick((t) => t + 1)}
      />
    </div>
  );
}
