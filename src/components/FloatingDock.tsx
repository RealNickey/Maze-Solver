import {
  ChevronDown,
  ChevronUp,
  Compass,
  Flower2,
  Grid2x2,
  Layers,
  Pause,
  Play,
  RefreshCw,
  Sprout,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { GRID_PRESETS, type GridPresetKey } from '../engine/types';

export type ViewMode = '2.5d' | '2d';

interface FloatingDockProps {
  viewMode: ViewMode;
  onChangeViewMode: (mode: ViewMode) => void;
  presetKey: GridPresetKey;
  onChangePreset: (key: GridPresetKey) => void;
  statusLine: string;
  timelineKind: 'generate' | 'solve';
  isPlaying: boolean;
  canPlay: boolean;
  frameIndex: number;
  totalFrames: number;
  soundEnabled: boolean;
  dockCollapsed: boolean;
  onToggleDock: () => void;
  onGenerate: () => void;
  onSolve: () => void;
  onTogglePlay: () => void;
  onScrub: (index: number) => void;
  onToggleSound: () => void;
  onNewMaze: () => void;
  onResetCamera: () => void;
}

/** Crisp custom pixel-art botanical sprig emblem (16x16 SVG grid) */
function PixelBotanicalEmblem() {
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      shapeRendering="crispEdges"
      className="shrink-0"
    >
      {/* Stone pot / island base */}
      <rect x="4" y="13" width="8" height="2" fill="#929182" />
      <rect x="5" y="12" width="6" height="1" fill="#CFCAB8" />
      {/* Stems & leaves */}
      <rect x="7" y="6" width="2" height="6" fill="#2E6C2B" />
      <rect x="4" y="8" width="3" height="2" fill="#49943E" />
      <rect x="3" y="7" width="2" height="2" fill="#6BB853" />
      <rect x="9" y="9" width="3" height="2" fill="#49943E" />
      <rect x="11" y="8" width="2" height="2" fill="#6BB853" />
      {/* Pixel blossom crown */}
      <rect x="6" y="2" width="4" height="2" fill="#FACC15" />
      <rect x="5" y="4" width="6" height="2" fill="#F9A8D4" />
      <rect x="7" y="4" width="2" height="2" fill="#FFFBEB" />
      {/* Sky dewdrop pixel */}
      <rect x="12" y="3" width="2" height="2" fill="#38BDF8" />
    </svg>
  );
}

const PRESET_SHORT: Record<GridPresetKey, string> = {
  small: '9×7',
  medium: '15×11',
  large: '21×15',
};

export function FloatingDock({
  viewMode,
  onChangeViewMode,
  presetKey,
  onChangePreset,
  statusLine,
  timelineKind,
  isPlaying,
  canPlay,
  frameIndex,
  totalFrames,
  soundEnabled,
  dockCollapsed,
  onToggleDock,
  onGenerate,
  onSolve,
  onTogglePlay,
  onScrub,
  onToggleSound,
  onNewMaze,
  onResetCamera,
}: FloatingDockProps) {
  const maxIdx = Math.max(0, totalFrames - 1);
  const clampedIdx = Math.max(0, Math.min(maxIdx, frameIndex));
  const scrubPct = maxIdx > 0 ? Math.round((clampedIdx / maxIdx) * 100) : 100;

  return (
    <>
      {/* TOP FLOATING BAR — minimal, unboxed brand left, crisp controls right, zero backdrop-filter */}
      <header className="pointer-events-none fixed inset-x-0 top-0 z-20 flex items-start justify-between gap-3 px-4 pt-3.5 sm:px-6 sm:pt-4">
        {/* Top-Left Brand + Quiet Status */}
        <div className="pointer-events-auto flex min-w-0 items-center gap-2.5 rounded-lg border border-[#1E3A2A]/15 bg-[#FCFBF6]/95 px-3 py-1.5 shadow-sm">
          <PixelBotanicalEmblem />
          <div className="min-w-0">
            <h1 className="font-display text-base font-bold leading-tight tracking-tight text-[#1A2E22] sm:text-lg">
              Hedgerow
            </h1>
            <p
              data-testid="status-line"
              className="max-w-[180px] truncate text-[11px] font-medium text-[#4A6355] sm:max-w-[300px]"
            >
              {statusLine}
            </p>
          </div>
        </div>

        {/* Top-Right View Mode + Grid Size */}
        <div className="pointer-events-auto flex shrink-0 items-center gap-2">
          {/* 2.5D Dream / 2D Flat Toggle */}
          <div
            role="group"
            aria-label="View perspective"
            className="flex items-center rounded-lg border border-[#1E3A2A]/15 bg-[#FCFBF6]/95 p-0.5 shadow-sm"
          >
            <button
              type="button"
              data-testid="view-25d-btn"
              onClick={() => onChangeViewMode('2.5d')}
              aria-pressed={viewMode === '2.5d'}
              className={`flex items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                viewMode === '2.5d'
                  ? 'bg-[#2C6B37] text-white'
                  : 'text-[#314A3B] hover:bg-[#EBF4EA]'
              }`}
            >
              <Layers className="h-3.5 w-3.5 shrink-0" />
              <span>2.5D</span>
            </button>
            <button
              type="button"
              data-testid="view-2d-btn"
              onClick={() => onChangeViewMode('2d')}
              aria-pressed={viewMode === '2d'}
              className={`flex items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                viewMode === '2d'
                  ? 'bg-[#1E2922] text-white'
                  : 'text-[#314A3B] hover:bg-[#EBF4EA]'
              }`}
            >
              <Grid2x2 className="h-3.5 w-3.5 shrink-0" />
              <span>2D Top</span>
            </button>
          </div>

          {/* Compact Grid Presets */}
          <div
            role="group"
            aria-label="Maze grid size"
            className="hidden items-center rounded-lg border border-[#1E3A2A]/15 bg-[#FCFBF6]/95 p-0.5 shadow-sm sm:flex"
          >
            {(Object.keys(GRID_PRESETS) as GridPresetKey[]).map((key) => (
              <button
                key={key}
                type="button"
                data-testid={`preset-${key}`}
                onClick={() => onChangePreset(key)}
                aria-pressed={presetKey === key}
                className={`whitespace-nowrap rounded-md px-2 py-1.5 font-mono text-[11px] font-medium transition-colors ${
                  presetKey === key
                    ? 'bg-[#2C6B37] text-white'
                    : 'text-[#425A4C] hover:bg-[#EBF4EA]'
                }`}
              >
                {PRESET_SHORT[key]}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* BOTTOM FLOATING TIMELINE & ACTION DOCK — Play + Scrub only (zero Step/Finish/Edit/Dark) */}
      <footer className="pointer-events-none fixed inset-x-0 bottom-0 z-20 flex flex-col items-center px-3 pb-3.5 sm:px-6 sm:pb-5">
        {dockCollapsed ? (
          <button
            type="button"
            data-testid="dock-expand-btn"
            onClick={onToggleDock}
            className="pointer-events-auto flex items-center gap-1.5 rounded-lg border border-[#1E3A2A]/18 bg-[#FCFBF6]/95 px-3.5 py-2 text-xs font-semibold text-[#1E3829] shadow-md transition-colors hover:bg-white"
          >
            <ChevronUp className="h-3.5 w-3.5" />
            <span>Controls</span>
          </button>
        ) : (
          <div
            data-testid="playback-dock"
            className="pointer-events-auto flex w-full max-w-[780px] flex-col gap-2 rounded-xl border border-[#1E3A2A]/16 bg-[#FCFBF6]/95 px-3 py-2.5 shadow-lg sm:flex-row sm:items-center sm:gap-2.5 sm:px-3.5"
          >
            {/* Row 1 on mobile / Left cluster on desktop: Generate, Solve, Play */}
            <div className="flex items-center justify-between gap-1.5 sm:justify-start">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  data-testid="btn-generate"
                  onClick={onGenerate}
                  className={`flex shrink-0 items-center gap-1 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors sm:gap-1.5 sm:px-3 ${
                    timelineKind === 'generate'
                      ? 'bg-[#2C6B37] text-white'
                      : 'border border-[#1E3A2A]/15 bg-white text-[#1E3829] hover:bg-[#EDF5EC]'
                  }`}
                >
                  <Sprout className="h-3.5 w-3.5 shrink-0" />
                  <span>Generate</span>
                </button>

                <button
                  type="button"
                  data-testid="btn-solve"
                  onClick={onSolve}
                  className={`flex shrink-0 items-center gap-1 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors sm:gap-1.5 sm:px-3 ${
                    timelineKind === 'solve'
                      ? 'bg-[#D97706] text-white'
                      : 'border border-[#1E3A2A]/15 bg-white text-[#1E3829] hover:bg-[#FEF6E6]'
                  }`}
                >
                  <Flower2 className="h-3.5 w-3.5 shrink-0" />
                  <span className="hidden sm:inline">Bloom Path</span>
                  <span className="sm:hidden">Bloom</span>
                </button>

                <button
                  type="button"
                  data-testid="btn-play-pause"
                  onClick={onTogglePlay}
                  disabled={!canPlay}
                  aria-label={isPlaying ? 'Pause playback' : 'Play timeline'}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#1E3A2A]/15 bg-[#1D3B28] text-white transition-colors hover:bg-[#285036] disabled:opacity-40"
                >
                  {isPlaying ? (
                    <Pause className="h-3.5 w-3.5" />
                  ) : (
                    <Play className="h-3.5 w-3.5 translate-x-[0.5px]" />
                  )}
                </button>
              </div>

              {/* Mobile-only utility icons right aligned */}
              <div className="flex shrink-0 items-center gap-1 sm:hidden">
                {viewMode === '2.5d' && (
                  <button
                    type="button"
                    onClick={onResetCamera}
                    aria-label="Recenter camera view"
                    className="flex h-8 w-7 items-center justify-center rounded-lg border border-[#1E3A2A]/15 bg-white text-[#294434]"
                  >
                    <Compass className="h-3.5 w-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={onToggleSound}
                  aria-label={soundEnabled ? 'Mute sound' : 'Enable sound'}
                  aria-pressed={soundEnabled}
                  className="flex h-8 w-7 items-center justify-center rounded-lg border border-[#1E3A2A]/15 bg-white text-[#294434]"
                >
                  {soundEnabled ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
                </button>
                <button
                  type="button"
                  onClick={onNewMaze}
                  aria-label="New maze"
                  className="flex h-8 w-7 items-center justify-center rounded-lg border border-[#1E3A2A]/15 bg-white text-[#294434]"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={onToggleDock}
                  aria-label="Hide controls"
                  className="flex h-8 w-7 items-center justify-center rounded-lg border border-[#1E3A2A]/15 bg-white text-[#294434]"
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Interactive Playback Scrub Slider */}
            <div className="flex min-w-0 flex-1 items-center gap-2.5 px-1">
              <input
                type="range"
                data-testid="timeline-scrubber"
                aria-label="Scrub algorithm timeline"
                min={0}
                max={maxIdx}
                value={clampedIdx}
                disabled={totalFrames <= 1}
                onChange={(e) => onScrub(Number(e.target.value))}
                style={{ '--scrub-pct': `${scrubPct}%` } as React.CSSProperties}
                className="hedgerow-scrub w-full"
              />
              <span
                data-testid="timeline-counter"
                className="w-[54px] shrink-0 text-right font-mono text-[11px] font-medium tabular-nums text-[#3F594A]"
              >
                {totalFrames > 0 ? `${clampedIdx + 1}/${totalFrames}` : '0/0'}
              </span>
            </div>

            {/* Desktop utility icons: Recenter, Sound, New Maze, Collapse */}
            <div className="hidden shrink-0 items-center gap-1 sm:flex">
              {viewMode === '2.5d' && (
                <button
                  type="button"
                  data-testid="btn-reset-camera"
                  onClick={onResetCamera}
                  title="Recenter view (R)"
                  aria-label="Recenter camera view"
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#1E3A2A]/15 bg-white text-[#294434] transition-colors hover:bg-[#EDF5EC]"
                >
                  <Compass className="h-3.5 w-3.5" />
                </button>
              )}

              <button
                type="button"
                data-testid="btn-sound"
                onClick={onToggleSound}
                title={soundEnabled ? 'Mute botanical sound' : 'Enable botanical sound'}
                aria-label={soundEnabled ? 'Mute sound' : 'Enable sound'}
                aria-pressed={soundEnabled}
                className={`flex h-8 w-8 items-center justify-center rounded-lg border transition-colors ${
                  soundEnabled
                    ? 'border-[#2C6B37]/30 bg-[#E6F4E8] text-[#22582C]'
                    : 'border-[#1E3A2A]/15 bg-white text-[#4A6355] hover:bg-[#F1F5F1]'
                }`}
              >
                {soundEnabled ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
              </button>

              <button
                type="button"
                data-testid="btn-new-maze"
                onClick={onNewMaze}
                title="Grow a fresh maze"
                aria-label="New maze"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#1E3A2A]/15 bg-white text-[#294434] transition-colors hover:bg-[#EDF5EC]"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>

              <button
                type="button"
                data-testid="dock-collapse-btn"
                onClick={onToggleDock}
                title="Hide controls (H)"
                aria-label="Hide controls"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#1E3A2A]/15 bg-white text-[#4A6355] transition-colors hover:bg-[#F1F5F1]"
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </footer>
    </>
  );
}
