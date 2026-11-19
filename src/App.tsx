import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DreamDioramaCanvas } from './components/DreamDioramaCanvas';
import { FlatMazeCanvas } from './components/FlatMazeCanvas';
import { FloatingDock, type ViewMode } from './components/FloatingDock';
import { buildBfsSnapshotAtFrame, generateBfsTimeline, type BfsRunResult } from './engine/bfs';
import {
  buildGridAtDsuFrame,
  defaultEndpoints,
  generateKruskalTimeline,
  type KruskalRunResult,
} from './engine/maze';
import {
  GRID_PRESETS,
  type ActivePhase,
  type CellCoord,
  type GridPresetKey,
  type MazeGrid,
} from './engine/types';
import { audioEngine } from './utils/audio';
import { triggerHaptic } from './utils/haptics';

type TimelineKind = 'generate' | 'solve';

function createInitialSession(presetKey: GridPresetKey) {
  const preset = GRID_PRESETS[presetKey];
  const kruskal = generateKruskalTimeline(preset.rows, preset.cols);
  const endpoints = defaultEndpoints(preset.rows, preset.cols);
  return { kruskal, endpoints };
}

export default function App() {
  const [presetKey, setPresetKey] = useState<GridPresetKey>('medium');
  const [viewMode, setViewMode] = useState<ViewMode>('2.5d');
  const [flatOverlayVisible, setFlatOverlayVisible] = useState(false);
  const [threePaused, setThreePaused] = useState(false);
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);

  const initialSession = useMemo(() => createInitialSession('medium'), []);

  const [kruskalRun, setKruskalRun] = useState<KruskalRunResult>(initialSession.kruskal);
  const [bfsRun, setBfsRun] = useState<BfsRunResult | null>(null);
  const [start, setStart] = useState<CellCoord>(initialSession.endpoints.start);
  const [goal, setGoal] = useState<CellCoord>(initialSession.endpoints.goal);

  const [timelineKind, setTimelineKind] = useState<TimelineKind>('generate');
  const [frameIndex, setFrameIndex] = useState<number>(
    Math.max(0, initialSession.kruskal.frames.length - 1)
  );
  const [isPlaying, setIsPlaying] = useState(false);
  const [instantSync, setInstantSync] = useState(true);
  const [interactionNote, setInteractionNote] = useState<string | null>(null);
  const [resetCameraSeq, setResetCameraSeq] = useState(0);

  const noteTimerRef = useRef<number | null>(null);
  const viewTimersRef = useRef<number[]>([]);

  const clearViewTimers = useCallback(() => {
    for (const id of viewTimersRef.current) {
      window.clearTimeout(id);
    }
    viewTimersRef.current = [];
  }, []);

  const showInteractionNote = useCallback((msg: string) => {
    setInteractionNote(msg);
    if (noteTimerRef.current !== null) {
      window.clearTimeout(noteTimerRef.current);
    }
    noteTimerRef.current = window.setTimeout(() => {
      setInteractionNote(null);
    }, 2600);
  }, []);

  useEffect(() => {
    return () => {
      if (noteTimerRef.current !== null) {
        window.clearTimeout(noteTimerRef.current);
      }
      clearViewTimers();
    };
  }, [clearViewTimers]);

  const totalFrames = useMemo(() => {
    if (timelineKind === 'generate') return kruskalRun.frames.length;
    return bfsRun ? bfsRun.frames.length : 0;
  }, [timelineKind, kruskalRun, bfsRun]);

  // Derived MazeGrid at current frame (supports full forward & backward scrubbing!)
  const displayedGrid: MazeGrid = useMemo(() => {
    if (timelineKind === 'generate') {
      return buildGridAtDsuFrame(kruskalRun.initialGrid, kruskalRun.frames, frameIndex);
    }
    return kruskalRun.finalGrid;
  }, [timelineKind, kruskalRun, frameIndex]);

  const currentDsuFrame = useMemo(() => {
    if (timelineKind !== 'generate') return null;
    return kruskalRun.frames[Math.min(frameIndex, kruskalRun.frames.length - 1)] ?? null;
  }, [timelineKind, kruskalRun, frameIndex]);

  const bfsSnapshot = useMemo(() => {
    if (timelineKind !== 'solve' || !bfsRun) return null;
    return buildBfsSnapshotAtFrame(bfsRun, kruskalRun.finalGrid.cols, frameIndex);
  }, [timelineKind, bfsRun, kruskalRun.finalGrid.cols, frameIndex]);

  const activePhase: ActivePhase = useMemo(() => {
    if (timelineKind === 'generate') {
      return frameIndex >= kruskalRun.frames.length - 1 ? 'idle' : 'generating';
    }
    if (!bfsSnapshot) return 'idle';
    if (bfsSnapshot.unreachable) return 'unreachable';
    if (bfsSnapshot.solved) return 'solved';
    return 'solving';
  }, [timelineKind, frameIndex, kruskalRun.frames.length, bfsSnapshot]);

  const activeCarveTile = useMemo(() => {
    if (
      timelineKind === 'generate' &&
      !instantSync &&
      currentDsuFrame?.type === 'UNION_CARVE' &&
      currentDsuFrame.edge
    ) {
      return {
        row: currentDsuFrame.edge.wallTileRow,
        col: currentDsuFrame.edge.wallTileCol,
      };
    }
    return null;
  }, [timelineKind, instantSync, currentDsuFrame]);

  const activeSkipTile = useMemo(() => {
    if (
      timelineKind === 'generate' &&
      !instantSync &&
      currentDsuFrame?.type === 'CYCLE_SKIP' &&
      currentDsuFrame.edge
    ) {
      return {
        row: currentDsuFrame.edge.wallTileRow,
        col: currentDsuFrame.edge.wallTileCol,
      };
    }
    return null;
  }, [timelineKind, instantSync, currentDsuFrame]);

  // Quiet single-line status copy
  const statusLine = useMemo(() => {
    if (interactionNote) return interactionNote;
    if (timelineKind === 'generate') {
      if (frameIndex >= kruskalRun.frames.length - 1) {
        return viewMode === '2.5d'
          ? 'Drag to orbit · Right-drag to pan · Scroll to zoom'
          : '2D top-down schematic · Drag S/G · Scrub timeline';
      }
      return `Growing hedgerow · ${frameIndex + 1} / ${kruskalRun.frames.length}`;
    }
    if (bfsRun && bfsSnapshot) {
      if (bfsSnapshot.solved) {
        const steps = Math.max(0, bfsRun.shortestPath.length - 1);
        return `Wildflower path bloomed · ${steps} steps`;
      }
      if (bfsSnapshot.unreachable) {
        return 'No open garden path to shrine';
      }
      const f = bfsRun.frames[Math.min(frameIndex, bfsRun.frames.length - 1)];
      if (f?.type === 'PATH_BLOOM') {
        return `Blooming optimal path · ${bfsSnapshot.bloomedPath.length}/${bfsRun.shortestPath.length}`;
      }
      return `Living foliage exploring · ${bfsSnapshot.visitedDistances.size} chambers`;
    }
    return 'Hedgerow garden ready';
  }, [
    interactionNote,
    timelineKind,
    frameIndex,
    kruskalRun.frames.length,
    viewMode,
    bfsRun,
    bfsSnapshot,
  ]);

  // Playback timer
  useEffect(() => {
    if (!isPlaying || totalFrames <= 1) return;

    const delayMs =
      timelineKind === 'generate'
        ? presetKey === 'large'
          ? 18
          : presetKey === 'medium'
            ? 28
            : 44
        : presetKey === 'large'
          ? 24
          : presetKey === 'medium'
            ? 36
            : 52;

    const id = window.setTimeout(() => {
      setInstantSync(false);
      setFrameIndex((prev) => {
        const next = prev + 1;
        if (next >= totalFrames - 1) {
          setIsPlaying(false);
          if (timelineKind === 'solve') {
            audioEngine.playPathComplete();
            triggerHaptic('solveSuccess');
          }
          return totalFrames - 1;
        }

        if (timelineKind === 'generate') {
          const fr = kruskalRun.frames[next];
          if (fr?.type === 'UNION_CARVE') {
            audioEngine.playUnionCarve(next / Math.max(1, totalFrames - 1));
            triggerHaptic('carve', 90);
          } else if (fr?.type === 'CYCLE_SKIP') {
            audioEngine.playCycleSkip();
          }
        } else if (bfsRun) {
          const fr = bfsRun.frames[next];
          if (fr?.type === 'PATH_BLOOM') {
            audioEngine.playFlowerBloom(fr.bloomProgress);
            triggerHaptic('bloom', 75);
          } else if (fr?.type === 'BFS_STEP') {
            audioEngine.playBfsSprout(fr.currentDepth);
          }
        }
        return next;
      });
    }, delayMs);

    return () => window.clearTimeout(id);
  }, [isPlaying, frameIndex, totalFrames, timelineKind, presetKey, kruskalRun, bfsRun]);

  // Actions
  const handleStartGenerate = useCallback(() => {
    const preset = GRID_PRESETS[presetKey];
    const nextRun = generateKruskalTimeline(preset.rows, preset.cols);
    setKruskalRun(nextRun);
    setBfsRun(null);
    setTimelineKind('generate');
    setInstantSync(true);
    setFrameIndex(0);
    setIsPlaying(true);
    triggerHaptic('tap');
    audioEngine.playSoftClick();
  }, [presetKey]);

  const handleStartSolve = useCallback(() => {
    const run = generateBfsTimeline(kruskalRun.finalGrid, start, goal);
    setBfsRun(run);
    setTimelineKind('solve');
    setInstantSync(true);
    setFrameIndex(0);
    setIsPlaying(true);
    triggerHaptic('tap');
    audioEngine.playInteractiveBloom();
  }, [kruskalRun.finalGrid, start, goal]);

  const handleTogglePlay = useCallback(() => {
    if (totalFrames <= 1) return;
    triggerHaptic('tap');
    audioEngine.playSoftClick();
    if (isPlaying) {
      setIsPlaying(false);
    } else {
      if (frameIndex >= totalFrames - 1) {
        setInstantSync(true);
        setFrameIndex(0);
      }
      setIsPlaying(true);
    }
  }, [isPlaying, frameIndex, totalFrames]);

  const handleScrub = useCallback(
    (nextIndex: number) => {
      setIsPlaying(false);
      setInstantSync(true);
      setFrameIndex(nextIndex);
      if (totalFrames > 1) {
        audioEngine.playScrubTick(nextIndex / (totalFrames - 1));
      }
      triggerHaptic('scrubTick', 45);
    },
    [totalFrames]
  );

  const handleNewMaze = useCallback(() => {
    const preset = GRID_PRESETS[presetKey];
    const nextRun = generateKruskalTimeline(preset.rows, preset.cols);
    const ep = defaultEndpoints(preset.rows, preset.cols);
    setKruskalRun(nextRun);
    setBfsRun(null);
    setStart(ep.start);
    setGoal(ep.goal);
    setTimelineKind('generate');
    setInstantSync(true);
    setFrameIndex(nextRun.frames.length - 1);
    setIsPlaying(false);
    triggerHaptic('tap');
    audioEngine.playInteractiveBloom();
    showInteractionNote('Fresh botanical maze grown');
  }, [presetKey, showInteractionNote]);

  const handleChangePreset = useCallback(
    (nextKey: GridPresetKey) => {
      if (nextKey === presetKey) return;
      const preset = GRID_PRESETS[nextKey];
      const nextRun = generateKruskalTimeline(preset.rows, preset.cols);
      const ep = defaultEndpoints(preset.rows, preset.cols);
      setPresetKey(nextKey);
      setKruskalRun(nextRun);
      setBfsRun(null);
      setStart(ep.start);
      setGoal(ep.goal);
      setTimelineKind('generate');
      setInstantSync(true);
      setFrameIndex(nextRun.frames.length - 1);
      setIsPlaying(false);
      triggerHaptic('tap');
      audioEngine.playSoftClick();
    },
    [presetKey]
  );

  const handleMoveStart = useCallback(
    (nextStart: CellCoord) => {
      setStart(nextStart);
      if (timelineKind === 'solve') {
        const nextBfs = generateBfsTimeline(kruskalRun.finalGrid, nextStart, goal);
        setBfsRun(nextBfs);
        setInstantSync(true);
        setIsPlaying(false);
        setFrameIndex(nextBfs.frames.length - 1);
      }
    },
    [timelineKind, kruskalRun.finalGrid, goal]
  );

  const handleMoveGoal = useCallback(
    (nextGoal: CellCoord) => {
      setGoal(nextGoal);
      if (timelineKind === 'solve') {
        const nextBfs = generateBfsTimeline(kruskalRun.finalGrid, start, nextGoal);
        setBfsRun(nextBfs);
        setInstantSync(true);
        setIsPlaying(false);
        setFrameIndex(nextBfs.frames.length - 1);
      }
    },
    [timelineKind, kruskalRun.finalGrid, start]
  );

  const handleToggleSound = useCallback(() => {
    setSoundEnabled((prev) => {
      const next = !prev;
      audioEngine.setEnabled(next);
      if (next) {
        audioEngine.playInteractiveBloom();
      }
      return next;
    });
    triggerHaptic('tap');
  }, []);

  const handleResetCamera = useCallback(() => {
    setResetCameraSeq((seq) => seq + 1);
    triggerHaptic('tap');
    audioEngine.playSoftClick();
    showInteractionNote('View recentered');
  }, [showInteractionNote]);

  // Animated 2.5D <-> 2D Top camera glide + schematic cross-fade
  const handleChangeViewMode = useCallback(
    (mode: ViewMode) => {
      if (mode === viewMode) return;
      clearViewTimers();
      triggerHaptic('tap');
      audioEngine.playSoftClick();

      if (mode === '2d') {
        // 1. Glide Three.js camera overhead & flatten shrubs smoothly
        setThreePaused(false);
        setViewMode('2d');
        // 2. Cross-fade pure flat 2D schematic in as camera arrives directly overhead
        const t1 = window.setTimeout(() => {
          setFlatOverlayVisible(true);
        }, 420);
        // 3. Pause WebGL loop cleanly once flat 2D view is fully opaque
        const t2 = window.setTimeout(() => {
          setThreePaused(true);
        }, 820);
        viewTimersRef.current.push(t1, t2);
      } else {
        // 1. Resume Three.js from aligned overhead pose & fade flat 2D out smoothly
        setThreePaused(false);
        setFlatOverlayVisible(false);
        // 2. Sweep Three.js camera gracefully down into 2.5D diorama perspective
        const t1 = window.setTimeout(() => {
          setViewMode('2.5d');
        }, 40);
        viewTimersRef.current.push(t1);
      }
    },
    [viewMode, clearViewTimers]
  );

  // Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.metaKey ||
        e.ctrlKey ||
        e.altKey
      ) {
        return;
      }
      if (e.code === 'Space') {
        e.preventDefault();
        handleTogglePlay();
      } else if (e.key.toLowerCase() === 'g') {
        handleStartGenerate();
      } else if (e.key.toLowerCase() === 's') {
        handleStartSolve();
      } else if (e.key.toLowerCase() === 'v') {
        handleChangeViewMode(viewMode === '2.5d' ? '2d' : '2.5d');
      } else if (e.key.toLowerCase() === 'h') {
        setDockCollapsed((prev) => !prev);
      } else if (e.key.toLowerCase() === 'r' && viewMode === '2.5d') {
        handleResetCamera();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    handleTogglePlay,
    handleStartGenerate,
    handleStartSolve,
    handleChangeViewMode,
    handleResetCamera,
    viewMode,
  ]);

  return (
    <main
      data-testid="maze-stage"
      data-view={viewMode === '2d' ? '2d-flat' : '2.5d'}
      data-phase={activePhase}
      className="relative h-screen w-screen overflow-hidden bg-[#7AB3F6]"
    >
      {/* Persistent Three.js 2.5D Dreamy Diorama (glides overhead during 2.5D <-> 2D morph) */}
      <DreamDioramaCanvas
        grid={displayedGrid}
        start={start}
        goal={goal}
        phase={activePhase}
        dsuFrame={currentDsuFrame}
        bfsSnapshot={bfsSnapshot}
        activeCarveTile={activeCarveTile}
        activeSkipTile={activeSkipTile}
        instantSync={instantSync}
        projectionMode={viewMode}
        paused={threePaused}
        resetCameraSeq={resetCameraSeq}
        onMoveStart={handleMoveStart}
        onMoveGoal={handleMoveGoal}
        onInteractionFeedback={showInteractionNote}
      />

      {/* Smoothly cross-faded pure static Flat 2D Top-Down schematic overlay */}
      <div
        aria-hidden={!flatOverlayVisible}
        className={`absolute inset-0 z-10 transition-opacity duration-300 ease-out ${
          flatOverlayVisible
            ? 'pointer-events-auto opacity-100'
            : 'pointer-events-none opacity-0'
        }`}
      >
        <FlatMazeCanvas
          grid={displayedGrid}
          start={start}
          goal={goal}
          phase={activePhase}
          bfsSnapshot={bfsSnapshot}
          onMoveStart={handleMoveStart}
          onMoveGoal={handleMoveGoal}
        />
      </div>

      <FloatingDock
        viewMode={viewMode}
        onChangeViewMode={handleChangeViewMode}
        presetKey={presetKey}
        onChangePreset={handleChangePreset}
        statusLine={statusLine}
        timelineKind={timelineKind}
        isPlaying={isPlaying}
        canPlay={totalFrames > 1}
        frameIndex={frameIndex}
        totalFrames={totalFrames}
        soundEnabled={soundEnabled}
        dockCollapsed={dockCollapsed}
        onToggleDock={() => setDockCollapsed((prev) => !prev)}
        onGenerate={handleStartGenerate}
        onSolve={handleStartSolve}
        onTogglePlay={handleTogglePlay}
        onScrub={handleScrub}
        onToggleSound={handleToggleSound}
        onNewMaze={handleNewMaze}
        onResetCamera={handleResetCamera}
      />
    </main>
  );
}
