import { cellIndex, formatCoord, indexToCell } from './maze';
import type { BfsStepFrame, CellCoord, MazeGrid } from './types';

export interface BfsRunResult {
  reachable: boolean;
  frames: BfsStepFrame[];
  shortestPath: CellCoord[];
  /** Distance from start to each cell index (-1 if unvisited) */
  distances: number[];
  /** Parent cell index for each cell (-1 if start or unvisited) */
  parents: number[];
  /** Discovery order of cell indices */
  visitedOrder: number[];
}

/**
 * Returns passable orthogonal neighbors of a cell in deterministic N, E, S, W order.
 */
export function getPassableNeighbors(grid: MazeGrid, cell: CellCoord): CellCoord[] {
  const neighbors: CellCoord[] = [];
  const idx = cellIndex(cell.row, cell.col, grid.cols);
  const w = grid.walls[idx];

  if (!w.north && cell.row > 0) {
    neighbors.push({ row: cell.row - 1, col: cell.col });
  }
  if (!w.east && cell.col + 1 < grid.cols) {
    neighbors.push({ row: cell.row, col: cell.col + 1 });
  }
  if (!w.south && cell.row + 1 < grid.rows) {
    neighbors.push({ row: cell.row + 1, col: cell.col });
  }
  if (!w.west && cell.col > 0) {
    neighbors.push({ row: cell.row, col: cell.col - 1 });
  }
  return neighbors;
}

/**
 * Runs Breadth-First Search from start to goal on any MazeGrid (perfect or cyclic/edited)
 * and records every discrete FIFO queue operation and shortest-path bloom frame.
 */
export function generateBfsTimeline(
  grid: MazeGrid,
  start: CellCoord,
  goal: CellCoord
): BfsRunResult {
  const total = grid.rows * grid.cols;
  const startIdx = cellIndex(start.row, start.col, grid.cols);
  const goalIdx = cellIndex(goal.row, goal.col, grid.cols);

  const distances = new Array<number>(total).fill(-1);
  const parents = new Array<number>(total).fill(-1);
  const visitedOrder: number[] = [];
  const frames: BfsStepFrame[] = [];

  const queue: number[] = [startIdx];
  distances[startIdx] = 0;
  visitedOrder.push(startIdx);

  frames.push({
    stepIndex: 1,
    type: 'BFS_INIT',
    currentCell: start,
    newlyDiscovered: [start],
    queue: [...queue],
    visitedCount: 1,
    currentDepth: 0,
    bloomCell: null,
    bloomProgress: 0,
    pathLength: 0,
    narration: `Enqueue start ${formatCoord(start)} at distance 0. FIFO queue initialized.`,
  });

  let found = startIdx === goalIdx;
  if (found) {
    frames.push({
      stepIndex: frames.length + 1,
      type: 'BFS_FOUND',
      currentCell: goal,
      newlyDiscovered: [],
      queue: [],
      visitedCount: 1,
      currentDepth: 0,
      bloomCell: null,
      bloomProgress: 0,
      pathLength: 0,
      narration: `Start and Goal share ${formatCoord(goal)} — distance is 0 steps.`,
    });
    frames.push({
      stepIndex: frames.length + 1,
      type: 'PATH_BLOOM',
      currentCell: goal,
      newlyDiscovered: [],
      queue: [],
      visitedCount: 1,
      currentDepth: 0,
      bloomCell: goal,
      bloomProgress: 1,
      pathLength: 0,
      narration: `Shortest path bloomed: 0 steps (already at destination).`,
    });
    return {
      reachable: true,
      frames,
      shortestPath: [start],
      distances,
      parents,
      visitedOrder,
    };
  }

  let head = 0;
  while (head < queue.length) {
    const currIdx = queue[head++];
    const currCell = indexToCell(currIdx, grid.cols);
    const currDist = distances[currIdx];

    const neighbors = getPassableNeighbors(grid, currCell);
    const newlyDiscovered: CellCoord[] = [];

    for (const nb of neighbors) {
      const nbIdx = cellIndex(nb.row, nb.col, grid.cols);
      if (distances[nbIdx] === -1) {
        distances[nbIdx] = currDist + 1;
        parents[nbIdx] = currIdx;
        queue.push(nbIdx);
        visitedOrder.push(nbIdx);
        newlyDiscovered.push(nb);

        if (nbIdx === goalIdx) {
          found = true;
        }
      }
    }

    const activeQueue = queue.slice(head);

    frames.push({
      stepIndex: frames.length + 1,
      type: 'BFS_STEP',
      currentCell: currCell,
      newlyDiscovered,
      queue: activeQueue,
      visitedCount: visitedOrder.length,
      currentDepth: currDist,
      bloomCell: null,
      bloomProgress: 0,
      pathLength: 0,
      narration:
        newlyDiscovered.length > 0
          ? `Dequeue ${formatCoord(currCell)} (d=${currDist}) → enqueue ${newlyDiscovered.map(formatCoord).join(', ')} at d=${currDist + 1}.`
          : `Dequeue ${formatCoord(currCell)} (d=${currDist}) — dead end, no unvisited neighbors.`,
    });

    if (found) {
      break;
    }
  }

  if (!found) {
    frames.push({
      stepIndex: frames.length + 1,
      type: 'BFS_UNREACHABLE',
      currentCell: null,
      newlyDiscovered: [],
      queue: [],
      visitedCount: visitedOrder.length,
      currentDepth: Math.max(0, ...distances),
      bloomCell: null,
      bloomProgress: 0,
      pathLength: 0,
      narration: `Queue exhausted after visiting ${visitedOrder.length} cells. Goal ${formatCoord(goal)} is walled off — no path exists.`,
    });

    return {
      reachable: false,
      frames,
      shortestPath: [],
      distances,
      parents,
      visitedOrder,
    };
  }

  // Reconstruct shortest path via parent pointers (Start -> Goal)
  const shortestPath: CellCoord[] = [];
  let trace = goalIdx;
  while (trace !== -1) {
    shortestPath.push(indexToCell(trace, grid.cols));
    trace = parents[trace];
  }
  shortestPath.reverse();
  const pathSteps = Math.max(0, shortestPath.length - 1);

  frames.push({
    stepIndex: frames.length + 1,
    type: 'BFS_FOUND',
    currentCell: goal,
    newlyDiscovered: [],
    queue: [],
    visitedCount: visitedOrder.length,
    currentDepth: pathSteps,
    bloomCell: null,
    bloomProgress: 0,
    pathLength: pathSteps,
    narration: `Goal ${formatCoord(goal)} reached at wave depth ${pathSteps}! Tracing parent pointers back to start.`,
  });

  // Emit smooth bloom frames along the path from Start to Goal
  for (let i = 0; i < shortestPath.length; i++) {
    const cell = shortestPath[i];
    frames.push({
      stepIndex: frames.length + 1,
      type: 'PATH_BLOOM',
      currentCell: cell,
      newlyDiscovered: [],
      queue: [],
      visitedCount: visitedOrder.length,
      currentDepth: pathSteps,
      bloomCell: cell,
      bloomProgress: (i + 1) / shortestPath.length,
      pathLength: pathSteps,
      narration:
        i === shortestPath.length - 1
          ? `Optimal path bloomed: ${pathSteps} steps (${visitedOrder.length} cells explored).`
          : `Blooming shortest path tile ${i + 1}/${shortestPath.length} at ${formatCoord(cell)}.`,
    });
  }

  return {
    reachable: true,
    frames,
    shortestPath,
    distances,
    parents,
    visitedOrder,
  };
}

/**
 * Computes visual BFS state (visited map, frontier set, bloomed path cells) at a specific frame index.
 */
export interface BfsVisualSnapshot {
  visitedDistances: Map<number, number>;
  frontierSet: Set<number>;
  currentCellIdx: number | null;
  bloomedPath: CellCoord[];
  unreachable: boolean;
  solved: boolean;
}

export function buildBfsSnapshotAtFrame(
  run: BfsRunResult,
  cols: number,
  frameIndex: number
): BfsVisualSnapshot {
  const visitedDistances = new Map<number, number>();
  const frontierSet = new Set<number>();
  const bloomedPath: CellCoord[] = [];
  let currentCellIdx: number | null = null;
  let unreachable = false;
  let solved = false;

  const limit = Math.min(frameIndex, run.frames.length - 1);
  for (let i = 0; i <= limit; i++) {
    const frame = run.frames[i];
    for (const c of frame.newlyDiscovered) {
      const idx = cellIndex(c.row, c.col, cols);
      visitedDistances.set(idx, run.distances[idx]);
    }
    if (frame.type === 'PATH_BLOOM' && frame.bloomCell) {
      bloomedPath.push(frame.bloomCell);
    }
    if (frame.type === 'BFS_UNREACHABLE') {
      unreachable = true;
    }
    if (i === limit) {
      for (const qIdx of frame.queue) {
        frontierSet.add(qIdx);
      }
      if (frame.currentCell) {
        currentCellIdx = cellIndex(frame.currentCell.row, frame.currentCell.col, cols);
      }
      if (frame.type === 'PATH_BLOOM' && i === run.frames.length - 1) {
        solved = true;
      }
    }
  }

  return {
    visitedDistances,
    frontierSet,
    currentCellIdx,
    bloomedPath,
    unreachable,
    solved,
  };
}
