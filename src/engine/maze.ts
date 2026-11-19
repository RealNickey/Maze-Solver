import { DisjointSet } from './disjointSet';
import type { CellCoord, CellWalls, DsuStepFrame, MazeGrid, WallEdge } from './types';

/**
 * Deterministic mulberry32 PRNG when a numeric seed is provided; falls back to Math.random otherwise.
 */
export function createRng(seed?: number): () => number {
  if (seed === undefined) {
    return () => Math.random();
  }
  let state = seed >>> 0;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function cellIndex(row: number, col: number, cols: number): number {
  return row * cols + col;
}

export function indexToCell(index: number, cols: number): CellCoord {
  return {
    row: Math.floor(index / cols),
    col: index % cols,
  };
}

export function formatCoord(cell: CellCoord): string {
  return `(${cell.row}, ${cell.col})`;
}

export function createClosedGrid(rows: number, cols: number): MazeGrid {
  const walls: CellWalls[] = Array.from({ length: rows * cols }, () => ({
    north: true,
    east: true,
    south: true,
    west: true,
  }));
  return { rows, cols, walls };
}

export function cloneGrid(grid: MazeGrid): MazeGrid {
  return {
    rows: grid.rows,
    cols: grid.cols,
    walls: grid.walls.map((w) => ({ ...w })),
  };
}

export function listInternalEdges(rows: number, cols: number): WallEdge[] {
  const edges: WallEdge[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (c + 1 < cols) {
        edges.push({
          id: `${r},${c}-E`,
          a: { row: r, col: c },
          b: { row: r, col: c + 1 },
          direction: 'east',
          wallTileRow: 2 * r + 1,
          wallTileCol: 2 * c + 2,
        });
      }
      if (r + 1 < rows) {
        edges.push({
          id: `${r},${c}-S`,
          a: { row: r, col: c },
          b: { row: r + 1, col: c },
          direction: 'south',
          wallTileRow: 2 * r + 2,
          wallTileCol: 2 * c + 1,
        });
      }
    }
  }
  return edges;
}

export function shuffleEdges(edges: WallEdge[], rng: () => number): WallEdge[] {
  const copy = [...edges];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }
  return copy;
}

/**
 * Sets or removes the wall separating two orthogonally adjacent cells.
 */
export function setWallBetween(
  grid: MazeGrid,
  a: CellCoord,
  b: CellCoord,
  closed: boolean
): boolean {
  if (
    a.row < 0 || a.row >= grid.rows || a.col < 0 || a.col >= grid.cols ||
    b.row < 0 || b.row >= grid.rows || b.col < 0 || b.col >= grid.cols
  ) {
    return false;
  }
  const idxA = cellIndex(a.row, a.col, grid.cols);
  const idxB = cellIndex(b.row, b.col, grid.cols);

  if (a.row === b.row && a.col + 1 === b.col) {
    grid.walls[idxA].east = closed;
    grid.walls[idxB].west = closed;
    return true;
  }
  if (a.row === b.row && a.col - 1 === b.col) {
    grid.walls[idxA].west = closed;
    grid.walls[idxB].east = closed;
    return true;
  }
  if (a.col === b.col && a.row + 1 === b.row) {
    grid.walls[idxA].south = closed;
    grid.walls[idxB].north = closed;
    return true;
  }
  if (a.col === b.col && a.row - 1 === b.row) {
    grid.walls[idxA].north = closed;
    grid.walls[idxB].south = closed;
    return true;
  }
  return false;
}

/**
 * Maps an internal wall tile coordinate (tr, tc) in the (2*rows+1) x (2*cols+1) render matrix
 * back to the two logical cells it separates, or null if it's an outer border, pillar, or meadow cell.
 */
export function wallTileToCells(
  tileRow: number,
  tileCol: number,
  rows: number,
  cols: number
): { a: CellCoord; b: CellCoord; direction: 'east' | 'south' } | null {
  const maxTileRow = 2 * rows;
  const maxTileCol = 2 * cols;
  if (tileRow <= 0 || tileRow >= maxTileRow || tileCol <= 0 || tileCol >= maxTileCol) {
    return null;
  }
  // Vertical wall separating (r, c) and (r, c+1): odd tileRow, even tileCol
  if (tileRow % 2 === 1 && tileCol % 2 === 0) {
    const r = (tileRow - 1) / 2;
    const c = tileCol / 2 - 1;
    if (r >= 0 && r < rows && c >= 0 && c + 1 < cols) {
      return {
        a: { row: r, col: c },
        b: { row: r, col: c + 1 },
        direction: 'east',
      };
    }
  }
  // Horizontal wall separating (r, c) and (r+1, c): even tileRow, odd tileCol
  if (tileRow % 2 === 0 && tileCol % 2 === 1) {
    const r = tileRow / 2 - 1;
    const c = (tileCol - 1) / 2;
    if (r >= 0 && r + 1 < rows && c >= 0 && c < cols) {
      return {
        a: { row: r, col: c },
        b: { row: r + 1, col: c },
        direction: 'south',
      };
    }
  }
  return null;
}

export function isWallTileClosed(grid: MazeGrid, tileRow: number, tileCol: number): boolean {
  const pair = wallTileToCells(tileRow, tileCol, grid.rows, grid.cols);
  if (!pair) return true;
  const idx = cellIndex(pair.a.row, pair.a.col, grid.cols);
  return pair.direction === 'east' ? grid.walls[idx].east : grid.walls[idx].south;
}

/**
 * Generates the complete deterministic Kruskal + Disjoint Set step timeline.
 * Returns the initial closed grid, final perfect maze grid, and all inspectable frames.
 */
export interface KruskalRunResult {
  initialGrid: MazeGrid;
  finalGrid: MazeGrid;
  frames: DsuStepFrame[];
}

export function generateKruskalTimeline(
  rows: number,
  cols: number,
  seed?: number
): KruskalRunResult {
  const rng = createRng(seed);
  const initialGrid = createClosedGrid(rows, cols);
  const workingGrid = cloneGrid(initialGrid);
  const totalCells = rows * cols;
  const dsu = new DisjointSet(totalCells);
  const edges = shuffleEdges(listInternalEdges(rows, cols), rng);

  const frames: DsuStepFrame[] = [];
  let unionsPerformed = 0;
  let cyclesSkipped = 0;

  for (const edge of edges) {
    const idxA = cellIndex(edge.a.row, edge.a.col, cols);
    const idxB = cellIndex(edge.b.row, edge.b.col, cols);
    const result = dsu.union(idxA, idxB);

    if (result.merged) {
      setWallBetween(workingGrid, edge.a, edge.b, false);
      unionsPerformed += 1;
      frames.push({
        stepIndex: frames.length + 1,
        type: 'UNION_CARVE',
        edge,
        rootA: result.rootA,
        rootB: result.rootB,
        mergedRoot: result.newRoot,
        remainingSets: dsu.componentCount,
        unionsPerformed,
        cyclesSkipped,
        cellRoots: dsu.snapshotRoots(),
        narration: `find${formatCoord(edge.a)}=#${result.rootA} ≠ find${formatCoord(edge.b)}=#${result.rootB} — union(#${result.rootA}, #${result.rootB}) trims hedge.`,
      });
    } else {
      cyclesSkipped += 1;
      frames.push({
        stepIndex: frames.length + 1,
        type: 'CYCLE_SKIP',
        edge,
        rootA: result.rootA,
        rootB: result.rootB,
        mergedRoot: result.newRoot,
        remainingSets: dsu.componentCount,
        unionsPerformed,
        cyclesSkipped,
        cellRoots: dsu.snapshotRoots(),
        narration: `find${formatCoord(edge.a)} = find${formatCoord(edge.b)} = #${result.rootA} — cycle avoided, hedge preserved.`,
      });
    }

    // Early exit once spanning tree is complete (all N cells in 1 component)
    if (dsu.componentCount === 1) {
      break;
    }
  }

  frames.push({
    stepIndex: frames.length + 1,
    type: 'COMPLETE',
    edge: null,
    rootA: dsu.find(0),
    rootB: dsu.find(0),
    mergedRoot: dsu.find(0),
    remainingSets: dsu.componentCount,
    unionsPerformed,
    cyclesSkipped,
    cellRoots: dsu.snapshotRoots(),
    narration: `Spanning tree complete: 1 unified set across ${totalCells} cells (${unionsPerformed} hedges trimmed, ${cyclesSkipped} cycles avoided).`,
  });

  return {
    initialGrid,
    finalGrid: workingGrid,
    frames,
  };
}

/**
 * Reconstructs the MazeGrid state at a given frame index (inclusive) in a Kruskal timeline.
 */
export function buildGridAtDsuFrame(
  initialGrid: MazeGrid,
  frames: DsuStepFrame[],
  frameIndex: number
): MazeGrid {
  const grid = cloneGrid(initialGrid);
  const limit = Math.min(frameIndex, frames.length - 1);
  for (let i = 0; i <= limit; i++) {
    const frame = frames[i];
    if (frame.type === 'UNION_CARVE' && frame.edge) {
      setWallBetween(grid, frame.edge.a, frame.edge.b, false);
    }
  }
  return grid;
}

/**
 * Computes the expanded (2*rows+1) x (2*cols+1) boolean matrix where `true` = hedge wall, `false` = open meadow path.
 */
export function buildTileWallMatrix(grid: MazeGrid): boolean[][] {
  const tileRows = 2 * grid.rows + 1;
  const tileCols = 2 * grid.cols + 1;
  const matrix: boolean[][] = Array.from({ length: tileRows }, () =>
    new Array<boolean>(tileCols).fill(true)
  );

  for (let r = 0; r < grid.rows; r++) {
    for (let c = 0; c < grid.cols; c++) {
      const tr = 2 * r + 1;
      const tc = 2 * c + 1;
      matrix[tr][tc] = false; // open cell chamber
      const w = grid.walls[cellIndex(r, c, grid.cols)];
      if (!w.east && c + 1 < grid.cols) {
        matrix[tr][tc + 1] = false;
      }
      if (!w.south && r + 1 < grid.rows) {
        matrix[tr + 1][tc] = false;
      }
    }
  }

  return matrix;
}

/**
 * Computes connected components on any edited MazeGrid using Disjoint Set (for Show Sets after manual edits).
 */
export function computeCurrentComponents(grid: MazeGrid): {
  componentCount: number;
  cellRoots: number[];
} {
  const total = grid.rows * grid.cols;
  const dsu = new DisjointSet(total);
  for (let r = 0; r < grid.rows; r++) {
    for (let c = 0; c < grid.cols; c++) {
      const idx = cellIndex(r, c, grid.cols);
      const w = grid.walls[idx];
      if (!w.east && c + 1 < grid.cols) {
        dsu.union(idx, cellIndex(r, c + 1, grid.cols));
      }
      if (!w.south && r + 1 < grid.rows) {
        dsu.union(idx, cellIndex(r + 1, c, grid.cols));
      }
    }
  }
  return {
    componentCount: dsu.componentCount,
    cellRoots: dsu.snapshotRoots(),
  };
}

/**
 * Default Start & Goal positions placed in balanced opposite quadrants.
 */
export function defaultEndpoints(rows: number, cols: number): {
  start: CellCoord;
  goal: CellCoord;
} {
  return {
    start: { row: 0, col: 0 },
    goal: { row: rows - 1, col: cols - 1 },
  };
}
