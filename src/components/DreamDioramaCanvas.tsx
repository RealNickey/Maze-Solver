import { useEffect, useRef, useState } from 'react';
import type { BfsVisualSnapshot } from '../engine/bfs';
import type { ActivePhase, CellCoord, DsuStepFrame, MazeGrid } from '../engine/types';
import { DreamDioramaScene, type DreamSceneState } from '../scene/DreamDioramaScene';

interface DreamDioramaCanvasProps {
  grid: MazeGrid;
  start: CellCoord;
  goal: CellCoord;
  phase: ActivePhase;
  dsuFrame: DsuStepFrame | null;
  bfsSnapshot: BfsVisualSnapshot | null;
  activeCarveTile: { row: number; col: number } | null;
  activeSkipTile: { row: number; col: number } | null;
  instantSync: boolean;
  projectionMode: '2.5d' | '2d';
  paused: boolean;
  resetCameraSeq: number;
  onMoveStart: (cell: CellCoord) => void;
  onMoveGoal: (cell: CellCoord) => void;
  onInteractionFeedback?: (label: string) => void;
}

export function DreamDioramaCanvas({
  grid,
  start,
  goal,
  phase,
  dsuFrame,
  bfsSnapshot,
  activeCarveTile,
  activeSkipTile,
  instantSync,
  projectionMode,
  paused,
  resetCameraSeq,
  onMoveStart,
  onMoveGoal,
  onInteractionFeedback,
}: DreamDioramaCanvasProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<DreamDioramaScene | null>(null);

  const [cameraDragging, setCameraDragging] = useState(false);
  const [cameraOffsetDeg, setCameraOffsetDeg] = useState(0);
  const [cameraZoom, setCameraZoom] = useState(1);
  const [cameraPan, setCameraPan] = useState({ x: 0, z: 0 });

  const callbacksRef = useRef({
    onMoveStart,
    onMoveGoal,
    onInteractionFeedback,
  });
  callbacksRef.current = {
    onMoveStart,
    onMoveGoal,
    onInteractionFeedback,
  };

  const initialStateRef = useRef<DreamSceneState>({
    grid,
    start,
    goal,
    phase,
    dsuFrame,
    bfsSnapshot,
    activeCarveTile,
    activeSkipTile,
    instantSync,
  });

  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;

    const diorama = new DreamDioramaScene(el, initialStateRef.current, {
      onMoveStart: (c) => callbacksRef.current.onMoveStart(c),
      onMoveGoal: (c) => callbacksRef.current.onMoveGoal(c),
      onInteractionFeedback: (msg) => callbacksRef.current.onInteractionFeedback?.(msg),
      onCameraStateChange: (dragging, deg, zoom, panX, panZ) => {
        setCameraDragging(dragging);
        setCameraOffsetDeg(deg);
        setCameraZoom(zoom);
        setCameraPan({ x: panX, z: panZ });
      },
    });
    sceneRef.current = diorama;

    return () => {
      diorama.dispose();
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    sceneRef.current?.setProjectionMode(projectionMode);
  }, [projectionMode]);

  useEffect(() => {
    sceneRef.current?.setPaused(paused);
  }, [paused]);

  useEffect(() => {
    if (resetCameraSeq > 0) {
      sceneRef.current?.resetCamera();
    }
  }, [resetCameraSeq]);

  useEffect(() => {
    sceneRef.current?.updateState({
      grid,
      start,
      goal,
      phase,
      dsuFrame,
      bfsSnapshot,
      activeCarveTile,
      activeSkipTile,
      instantSync,
    });
  }, [
    grid,
    start,
    goal,
    phase,
    dsuFrame,
    bfsSnapshot,
    activeCarveTile,
    activeSkipTile,
    instantSync,
  ]);

  return (
    <div
      data-testid="dream-diorama-layer"
      data-camera-dragging={cameraDragging ? 'true' : 'false'}
      data-camera-azimuth={cameraOffsetDeg}
      data-camera-zoom={cameraZoom}
      data-camera-pan-x={cameraPan.x}
      data-camera-pan-z={cameraPan.z}
      className="absolute inset-0 h-full w-full select-none overflow-hidden"
      style={{ cursor: cameraDragging ? 'grabbing' : 'grab' }}
      aria-label="2.5D dreamy pixel-art botanical maze diorama. Drag to orbit, right-drag or Shift-drag to pan freely, scroll to zoom, click meadow to bloom flowers, or drag start and goal markers."
    >
      <div ref={mountRef} className="h-full w-full" />
    </div>
  );
}
