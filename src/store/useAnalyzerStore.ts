import { create } from "zustand";
import {
  AxisStretchState,
  CameraPreset,
  DataFeedMode,
  IndicatorInstanceConfig,
  MarketBar,
  ReplayTraceMode,
  SubPaneMode,
  TimeframeId,
  TriadPairId,
  WorkspaceSnapshot,
} from "@/types/market";
import { createDefaultIndicatorConfigs } from "@/lib/quant/plugins";

export interface AnalyzerState {
  triadPair: TriadPairId;
  timeframe: TimeframeId;
  dataSeries: MarketBar[];
  isLoading: boolean;
  mode: DataFeedMode;
  isLivePlaying: boolean;
  trailLength: number;
  stretch: AxisStretchState;
  cameraPreset: CameraPreset;
  autoRotate: boolean;
  indicators: Record<string, IndicatorInstanceConfig>;
  subPaneMode: SubPaneMode;
  sidebarOpen: boolean;
  activeSidebarTab: "indicators" | "scene" | "stats";
  guideModalOpen: boolean;

  // Timelapse Replay State
  isReplaying: boolean;
  replayIndex: number;
  replaySpeed: number;
  replayTraceMode: ReplayTraceMode;
  isReplayLoop: boolean;

  // Actions
  setTriadPair: (pair: TriadPairId) => void;
  setTimeframe: (tf: TimeframeId) => void;
  setDataSeries: (bars: MarketBar[]) => void;
  setIsLoading: (loading: boolean) => void;
  appendLiveBar: (bar: MarketBar) => void;
  setMode: (mode: DataFeedMode) => void;
  toggleLivePlaying: () => void;
  setTrailLength: (len: number) => void;
  setStretch: (partial: Partial<AxisStretchState>) => void;
  applyStretchPreset: (
    preset: "time_long" | "wide_phase" | "equal" | "reset"
  ) => void;
  setCameraPreset: (preset: CameraPreset) => void;
  toggleAutoRotate: () => void;
  toggleIndicator: (id: string) => void;
  setIndicatorParam: (
    id: string,
    key: string,
    value: number | string | boolean
  ) => void;
  resetIndicators: () => void;
  setSubPaneMode: (mode: SubPaneMode) => void;
  setSidebarOpen: (open: boolean) => void;
  setActiveSidebarTab: (tab: "indicators" | "scene" | "stats") => void;
  setGuideModalOpen: (open: boolean) => void;

  // Replay Actions
  setIsReplaying: (playing: boolean) => void;
  toggleReplay: () => void;
  setReplayIndex: (idx: number) => void;
  stepReplay: (delta: number) => void;
  restartReplay: () => void;
  jumpToLive: () => void;
  setReplaySpeed: (speed: number) => void;
  setReplayTraceMode: (mode: ReplayTraceMode) => void;
  toggleReplayLoop: () => void;

  // Workspace Snapshot Export/Import
  createWorkspaceSnapshot: (name: string) => WorkspaceSnapshot;
  applyWorkspaceSnapshot: (snap: WorkspaceSnapshot) => void;
}

export const useAnalyzerStore = create<AnalyzerState>((set, get) => ({
  triadPair: "EUR",
  timeframe: "1m",
  dataSeries: [],
  isLoading: true,
  mode: "yahoo",
  isLivePlaying: true,
  trailLength: 250,
  stretch: { x: 1.2, y: 1.2, z: 1.0 },
  cameraPreset: "orbit",
  autoRotate: false,
  indicators: createDefaultIndicatorConfigs(),
  subPaneMode: "displacement",
  sidebarOpen: true,
  activeSidebarTab: "indicators",
  guideModalOpen: false,

  isReplaying: false,
  replayIndex: 0,
  replaySpeed: 5,
  replayTraceMode: "accumulate",
  isReplayLoop: false,

  setTriadPair: (pair) =>
    set({
      triadPair: pair,
      isReplaying: false,
    }),

  setTimeframe: (tf) =>
    set((state) => {
      const nextTrail =
        tf === "1d" && state.trailLength > 250 ? 200 : state.trailLength;
      return {
        timeframe: tf,
        trailLength: nextTrail,
        isReplaying: false,
      };
    }),

  setDataSeries: (bars) =>
    set({
      dataSeries: bars,
      replayIndex: bars.length,
    }),

  setIsLoading: (loading) => set({ isLoading: loading }),

  appendLiveBar: (bar) =>
    set((state) => {
      const current = state.dataSeries;
      if (
        current.length > 0 &&
        current[current.length - 1].timestamp === bar.timestamp
      ) {
        const updated = [...current.slice(0, -1), bar];
        return { dataSeries: updated };
      }
      const nextSeries = [...current, bar];
      if (nextSeries.length > 2000) nextSeries.shift();
      return {
        dataSeries: nextSeries,
        replayIndex: state.isReplaying ? state.replayIndex : nextSeries.length,
      };
    }),

  setMode: (mode) => set({ mode }),

  toggleLivePlaying: () =>
    set((state) => ({ isLivePlaying: !state.isLivePlaying })),

  setTrailLength: (len) =>
    set({ trailLength: Math.max(30, Math.min(800, len)) }),

  setStretch: (partial) =>
    set((state) => ({
      stretch: {
        x: Math.max(0.3, Math.min(3.5, partial.x ?? state.stretch.x)),
        y: Math.max(0.3, Math.min(3.5, partial.y ?? state.stretch.y)),
        z: Math.max(0.2, Math.min(4.0, partial.z ?? state.stretch.z)),
      },
    })),

  applyStretchPreset: (preset) => {
    if (preset === "time_long") {
      set({ stretch: { x: 1.0, y: 1.0, z: 2.8 } });
    } else if (preset === "wide_phase") {
      set({ stretch: { x: 2.2, y: 2.2, z: 0.5 } });
    } else if (preset === "equal") {
      set({ stretch: { x: 1.0, y: 1.0, z: 1.0 } });
    } else {
      set({ stretch: { x: 1.2, y: 1.2, z: 1.0 } });
    }
  },

  setCameraPreset: (preset) => set({ cameraPreset: preset }),

  toggleAutoRotate: () =>
    set((state) => ({ autoRotate: !state.autoRotate })),

  toggleIndicator: (id) =>
    set((state) => {
      const curr = state.indicators[id];
      if (!curr) return state;
      return {
        indicators: {
          ...state.indicators,
          [id]: { ...curr, enabled: !curr.enabled },
        },
      };
    }),

  setIndicatorParam: (id, key, value) =>
    set((state) => {
      const curr = state.indicators[id];
      if (!curr) return state;
      return {
        indicators: {
          ...state.indicators,
          [id]: {
            ...curr,
            params: {
              ...curr.params,
              [key]: value,
            },
          },
        },
      };
    }),

  resetIndicators: () =>
    set({ indicators: createDefaultIndicatorConfigs() }),

  setSubPaneMode: (mode) => set({ subPaneMode: mode }),

  setSidebarOpen: (open) => set({ sidebarOpen: open }),

  setActiveSidebarTab: (tab) => set({ activeSidebarTab: tab }),

  setGuideModalOpen: (open) => set({ guideModalOpen: open }),

  setIsReplaying: (playing) => set({ isReplaying: playing }),

  toggleReplay: () =>
    set((state) => {
      const nextPlaying = !state.isReplaying;
      let nextIdx = state.replayIndex;
      if (nextPlaying && nextIdx >= state.dataSeries.length) {
        nextIdx = 1;
      }
      return {
        isReplaying: nextPlaying,
        replayIndex: nextIdx,
      };
    }),

  setReplayIndex: (idx) =>
    set((state) => ({
      replayIndex: Math.max(1, Math.min(state.dataSeries.length || 1, idx)),
    })),

  stepReplay: (delta) =>
    set((state) => ({
      isReplaying: false,
      replayIndex: Math.max(
        1,
        Math.min(state.dataSeries.length || 1, state.replayIndex + delta)
      ),
    })),

  restartReplay: () =>
    set({
      replayIndex: 1,
      isReplaying: true,
    }),

  jumpToLive: () =>
    set((state) => ({
      isReplaying: false,
      replayIndex: state.dataSeries.length,
    })),

  setReplaySpeed: (speed) => set({ replaySpeed: speed }),

  setReplayTraceMode: (mode) => set({ replayTraceMode: mode }),

  toggleReplayLoop: () =>
    set((state) => ({ isReplayLoop: !state.isReplayLoop })),

  createWorkspaceSnapshot: (name) => {
    const s = get();
    return {
      id: `ws_${Date.now().toString(36)}`,
      name: name.trim() || "Custom Quant Workspace",
      updatedAt: Date.now(),
      triadPair: s.triadPair,
      timeframe: s.timeframe,
      trailLength: s.trailLength,
      stretch: { ...s.stretch },
      cameraPreset: s.cameraPreset,
      subPaneMode: s.subPaneMode,
      replaySpeed: s.replaySpeed,
      replayTraceMode: s.replayTraceMode,
      indicators: JSON.parse(JSON.stringify(s.indicators)),
    };
  },

  applyWorkspaceSnapshot: (snap) =>
    set((state) => ({
      triadPair: snap.triadPair ?? state.triadPair,
      timeframe: snap.timeframe ?? state.timeframe,
      trailLength: snap.trailLength ?? state.trailLength,
      stretch: snap.stretch ?? state.stretch,
      cameraPreset: snap.cameraPreset ?? state.cameraPreset,
      subPaneMode: snap.subPaneMode ?? state.subPaneMode,
      replaySpeed: snap.replaySpeed ?? state.replaySpeed,
      replayTraceMode: snap.replayTraceMode ?? state.replayTraceMode,
      indicators: {
        ...createDefaultIndicatorConfigs(),
        ...(snap.indicators ?? {}),
      },
    })),
}));
