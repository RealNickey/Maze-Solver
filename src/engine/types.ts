export type Direction = 'north' | 'east' | 'south' | 'west';

export interface CellCoord {
  row: number;
  col: number;
}

export interface CellWalls {
  north: boolean;
  east: boolean;
  south: boolean;
  west: boolean;
}

export interface WallEdge {
  id: string;
  a: CellCoord;
  b: CellCoord;
  /** Direction from a to b ('east' or 'south') */
  direction: 'east' | 'south';
  /** Tile coordinate of the separating wall in the (2*rows+1) x (2*cols+1) render matrix */
  wallTileRow: number;
  wallTileCol: number;
}

export interface MazeGrid {
  rows: number;
  cols: number;
  /** Row-major array of length rows * cols */
  walls: CellWalls[];
}

export type GridPresetKey = 'small' | 'medium' | 'large';

export interface GridPreset {
  key: GridPresetKey;
  label: string;
  cols: number;
  rows: number;
}

export const GRID_PRESETS: Record<GridPresetKey, GridPreset> = {
  small: { key: 'small', label: 'Small 9×7', cols: 9, rows: 7 },
  medium: { key: 'medium', label: 'Medium 15×11', cols: 15, rows: 11 },
  large: { key: 'large', label: 'Large 21×15', cols: 21, rows: 15 },
};

export type DsuFrameType = 'UNION_CARVE' | 'CYCLE_SKIP' | 'COMPLETE';

export interface DsuStepFrame {
  stepIndex: number;
  type: DsuFrameType;
  edge: WallEdge | null;
  rootA: number;
  rootB: number;
  mergedRoot: number;
  remainingSets: number;
  unionsPerformed: number;
  cyclesSkipped: number;
  /** Snapshot of root ID for every cell (length rows * cols) for instant coloring */
  cellRoots: number[];
  narration: string;
}

export type BfsFrameType =
  | 'BFS_INIT'
  | 'BFS_STEP'
  | 'BFS_FOUND'
  | 'PATH_BLOOM'
  | 'BFS_UNREACHABLE';

export interface BfsStepFrame {
  stepIndex: number;
  type: BfsFrameType;
  currentCell: CellCoord | null;
  newlyDiscovered: CellCoord[];
  /** Ordered FIFO queue snapshot (cell indices) */
  queue: number[];
  /** Visited cell indices in discovery order */
  visitedCount: number;
  currentDepth: number;
  /** Newly bloomed cell along shortest path (for PATH_BLOOM) */
  bloomCell: CellCoord | null;
  bloomProgress: number;
  pathLength: number;
  narration: string;
}

export type ActivePhase = 'idle' | 'generating' | 'solving' | 'solved' | 'unreachable';
export type PlaybackStatus = 'idle' | 'playing' | 'paused' | 'complete';
export type InteractionMode = 'explore' | 'edit';
export type ThemeMode = 'light' | 'dark';
