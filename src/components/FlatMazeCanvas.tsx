import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react';
import type { BfsVisualSnapshot } from '../engine/bfs';
import { buildTileWallMatrix, cellIndex } from '../engine/maze';
import type { ActivePhase, CellCoord, MazeGrid } from '../engine/types';
import { audioEngine } from '../utils/audio';
import { triggerHaptic } from '../utils/haptics';

interface FlatMazeCanvasProps {
  grid: MazeGrid;
  start: CellCoord;
  goal: CellCoord;
  phase: ActivePhase;
  bfsSnapshot: BfsVisualSnapshot | null;
  onMoveStart: (cell: CellCoord) => void;
  onMoveGoal: (cell: CellCoord) => void;
}

/**
 * Pure minimalist 2D top-down schematic maze canvas.
 * Zero animations, zero cartoon effects, zero water/birds/flowers — just a clean architectural 2D maze.
 */
export function FlatMazeCanvas({
  grid,
  start,
  goal,
  phase,
  bfsSnapshot,
  onMoveStart,
  onMoveGoal,
}: FlatMazeCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [size, setSize] = useState({ width: 960, height: 640 });
  const [dragging, setDragging] = useState<'none' | 'start' | 'goal'>('none');

  const layoutRef = useRef({
    offsetX: 0,
    offsetY: 0,
    tilePx: 20,
    tileRows: 0,
    tileCols: 0,
  });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setSize({
          width: Math.max(300, Math.floor(entry.contentRect.width)),
          height: Math.max(300, Math.floor(entry.contentRect.height)),
        });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Draw crisp, zero-animation 2D top-down maze whenever state or size changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(size.width * dpr);
    canvas.height = Math.floor(size.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Clean warm schematic paper ground
    ctx.fillStyle = '#F6F5F0';
    ctx.fillRect(0, 0, size.width, size.height);

    const tileRows = 2 * grid.rows + 1;
    const tileCols = 2 * grid.cols + 1;

    // Leave generous breathing room for floating top header and bottom dock
    const padTop = 82;
    const padBottom = 108;
    const padX = 32;
    const availW = Math.max(160, size.width - padX * 2);
    const availH = Math.max(160, size.height - padTop - padBottom);
    const tilePx = Math.max(6, Math.floor(Math.min(availW / tileCols, availH / tileRows)));

    const boardW = tileCols * tilePx;
    const boardH = tileRows * tilePx;
    const offsetX = Math.floor((size.width - boardW) / 2);
    const offsetY = Math.floor(padTop + (availH - boardH) / 2);

    layoutRef.current = { offsetX, offsetY, tilePx, tileRows, tileCols };

    // 1. Crisp open corridor sheet
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(offsetX, offsetY, boardW, boardH);

    // 2. Flat BFS visited & frontier cells (pure 2D blocks, zero animations)
    if (bfsSnapshot) {
      for (const [cIdx] of bfsSnapshot.visitedDistances) {
        const r = Math.floor(cIdx / grid.cols);
        const c = cIdx % grid.cols;
        const tr = 2 * r + 1;
        const tc = 2 * c + 1;
        const isFrontier =
          bfsSnapshot.frontierSet.has(cIdx) || bfsSnapshot.currentCellIdx === cIdx;
        ctx.fillStyle = isFrontier ? '#93C5FD' : '#DBEAFE';
        ctx.fillRect(offsetX + tc * tilePx, offsetY + tr * tilePx, tilePx, tilePx);

        // Fill passable corridor bridges between adjacent visited cells
        const w = grid.walls[cIdx];
        if (
          !w.east &&
          c + 1 < grid.cols &&
          bfsSnapshot.visitedDistances.has(cellIndex(r, c + 1, grid.cols))
        ) {
          ctx.fillStyle = '#DBEAFE';
          ctx.fillRect(offsetX + (tc + 1) * tilePx, offsetY + tr * tilePx, tilePx, tilePx);
        }
        if (
          !w.south &&
          r + 1 < grid.rows &&
          bfsSnapshot.visitedDistances.has(cellIndex(r + 1, c, grid.cols))
        ) {
          ctx.fillStyle = '#DBEAFE';
          ctx.fillRect(offsetX + tc * tilePx, offsetY + (tr + 1) * tilePx, tilePx, tilePx);
        }
      }
    }

    // 3. Flat crisp maze walls
    const matrix = buildTileWallMatrix(grid);
    ctx.fillStyle = '#1E2922';
    for (let tr = 0; tr < tileRows; tr++) {
      for (let tc = 0; tc < tileCols; tc++) {
        if (matrix[tr][tc]) {
          ctx.fillRect(offsetX + tc * tilePx, offsetY + tr * tilePx, tilePx, tilePx);
        }
      }
    }

    // 4. Crisp high-contrast 2D shortest path polyline (crimson-coral with bright sunlit core)
    if (bfsSnapshot && bfsSnapshot.bloomedPath.length > 0) {
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      bfsSnapshot.bloomedPath.forEach((cell, idx) => {
        const cx = offsetX + (2 * cell.col + 1.5) * tilePx;
        const cy = offsetY + (2 * cell.row + 1.5) * tilePx;
        if (idx === 0) ctx.moveTo(cx, cy);
        else ctx.lineTo(cx, cy);
      });
      ctx.strokeStyle = '#E11D48';
      ctx.lineWidth = Math.max(4, Math.round(tilePx * 0.44));
      ctx.stroke();

      ctx.strokeStyle = '#FDE047';
      ctx.lineWidth = Math.max(1.5, Math.round(tilePx * 0.16));
      ctx.stroke();
      ctx.restore();
    }

    // 5. Simple geometric Start (blue circle) & Goal (amber square) markers
    const drawMarker = (cell: CellCoord, kind: 'start' | 'goal') => {
      const cx = offsetX + (2 * cell.col + 1.5) * tilePx;
      const cy = offsetY + (2 * cell.row + 1.5) * tilePx;
      const r = Math.max(4, tilePx * 0.36);

      ctx.save();
      if (kind === 'start') {
        ctx.fillStyle = '#0284C7';
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = '#D97706';
        ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
      }
      if (tilePx >= 16) {
        ctx.fillStyle = '#FFFFFF';
        ctx.font = `700 ${Math.max(9, Math.floor(tilePx * 0.44))}px "JetBrains Mono", monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(kind === 'start' ? 'S' : 'G', cx, cy + 0.5);
      }
      ctx.restore();
    };

    drawMarker(start, 'start');
    drawMarker(goal, 'goal');

    // Outer hairline frame
    ctx.strokeStyle = '#1E2922';
    ctx.lineWidth = 1;
    ctx.strokeRect(offsetX + 0.5, offsetY + 0.5, boardW - 1, boardH - 1);
  }, [grid, start, goal, bfsSnapshot, size]);

  const pointToCell = useCallback(
    (clientX: number, clientY: number): CellCoord | null => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      const { offsetX, offsetY, tilePx, tileRows, tileCols } = layoutRef.current;
      const tc = Math.floor((x - offsetX) / tilePx);
      const tr = Math.floor((y - offsetY) / tilePx);
      if (tc < 0 || tc >= tileCols || tr < 0 || tr >= tileRows) return null;
      const col = Math.max(0, Math.min(grid.cols - 1, Math.floor((tc - 1) / 2)));
      const row = Math.max(0, Math.min(grid.rows - 1, Math.floor((tr - 1) / 2)));
      return { row, col };
    },
    [grid.cols, grid.rows]
  );

  const handlePointerDown = (e: PointerEvent<HTMLCanvasElement>) => {
    const cell = pointToCell(e.clientX, e.clientY);
    if (!cell) return;
    if (cell.row === start.row && cell.col === start.col) {
      setDragging('start');
      e.currentTarget.setPointerCapture(e.pointerId);
      triggerHaptic('dragPickup');
      audioEngine.playSoftClick();
    } else if (cell.row === goal.row && cell.col === goal.col) {
      setDragging('goal');
      e.currentTarget.setPointerCapture(e.pointerId);
      triggerHaptic('dragPickup');
      audioEngine.playSoftClick();
    }
  };

  const handlePointerMove = (e: PointerEvent<HTMLCanvasElement>) => {
    if (dragging === 'none') return;
    const cell = pointToCell(e.clientX, e.clientY);
    if (!cell) return;
    if (
      dragging === 'start' &&
      (cell.row !== start.row || cell.col !== start.col) &&
      !(cell.row === goal.row && cell.col === goal.col)
    ) {
      onMoveStart(cell);
      triggerHaptic('tap', 60);
    } else if (
      dragging === 'goal' &&
      (cell.row !== goal.row || cell.col !== goal.col) &&
      !(cell.row === start.row && cell.col === start.col)
    ) {
      onMoveGoal(cell);
      triggerHaptic('tap', 60);
    }
  };

  const handlePointerUp = () => {
    if (dragging !== 'none') {
      setDragging('none');
      triggerHaptic('dragDrop');
    }
  };

  return (
    <div
      ref={containerRef}
      data-testid="flat-maze-layer"
      className="relative h-full w-full select-none overflow-hidden bg-[#F6F5F0]"
      aria-label="Flat 2D top-down schematic maze view. Drag S or G markers to reposition endpoints."
    >
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className="block h-full w-full touch-none"
        style={{ cursor: dragging !== 'none' ? 'grabbing' : 'default' }}
      />
    </div>
  );
}
