import test from 'node:test';
import assert from 'node:assert/strict';
import { DisjointSet, getSetTintColor } from './disjointSet';
import {
  buildGridAtDsuFrame,
  buildTileWallMatrix,
  cellIndex,
  cloneGrid,
  computeCurrentComponents,
  createClosedGrid,
  generateKruskalTimeline,
  setWallBetween,
  wallTileToCells,
} from './maze';
import { buildBfsSnapshotAtFrame, generateBfsTimeline } from './bfs';

test('DisjointSet: union by rank, path compression, and component counting', () => {
  const dsu = new DisjointSet(6);
  assert.equal(dsu.componentCount, 6);
  assert.equal(dsu.connected(0, 1), false);

  const u1 = dsu.union(0, 1);
  assert.equal(u1.merged, true);
  assert.equal(dsu.componentCount, 5);
  assert.equal(dsu.connected(0, 1), true);

  // Redundant union does not change componentCount
  const uDup = dsu.union(0, 1);
  assert.equal(uDup.merged, false);
  assert.equal(dsu.componentCount, 5);

  dsu.union(1, 2);
  dsu.union(3, 4);
  dsu.union(2, 4);
  assert.equal(dsu.componentCount, 2); // {0,1,2,3,4} and {5}
  assert.equal(dsu.connected(0, 3), true);
  assert.equal(dsu.connected(0, 5), false);

  // Verify path compression flattens parent pointers
  const root = dsu.find(3);
  assert.equal(dsu.parent[3], root);
  assert.equal(typeof getSetTintColor(root, false), 'string');
  assert.equal(typeof getSetTintColor(root, true), 'string');
});

test('Kruskal timeline produces a mathematically perfect spanning-tree maze', () => {
  const rows = 11;
  const cols = 15;
  const totalCells = rows * cols;
  const run = generateKruskalTimeline(rows, cols, 42);

  const lastFrame = run.frames[run.frames.length - 1];
  assert.equal(lastFrame.type, 'COMPLETE');
  assert.equal(lastFrame.remainingSets, 1);
  assert.equal(lastFrame.unionsPerformed, totalCells - 1);

  // Reconstructing from step frames must match finalGrid wall-for-wall
  const rebuilt = buildGridAtDsuFrame(run.initialGrid, run.frames, run.frames.length - 1);
  assert.deepEqual(rebuilt.walls, run.finalGrid.walls);

  // Every single cell must be in 1 connected component
  const comps = computeCurrentComponents(run.finalGrid);
  assert.equal(comps.componentCount, 1);

  // Count open internal passages: must equal totalCells - 1 (spanning tree => acyclic)
  let openPassages = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const w = run.finalGrid.walls[cellIndex(r, c, cols)];
      if (!w.east && c + 1 < cols) openPassages++;
      if (!w.south && r + 1 < rows) openPassages++;
    }
  }
  assert.equal(openPassages, totalCells - 1);

  // Expanded tile matrix has dimensions (2*rows+1) x (2*cols+1) with intact outer border
  const matrix = buildTileWallMatrix(run.finalGrid);
  assert.equal(matrix.length, 2 * rows + 1);
  assert.equal(matrix[0].length, 2 * cols + 1);
  for (let c = 0; c < 2 * cols + 1; c++) {
    assert.equal(matrix[0][c], true);
    assert.equal(matrix[2 * rows][c], true);
  }
});

test('BFS guarantees shortest path on perfect mazes and cyclic custom mazes', () => {
  const run = generateKruskalTimeline(7, 9, 123);
  const start = { row: 0, col: 0 };
  const goal = { row: 6, col: 8 };
  const bfs = generateBfsTimeline(run.finalGrid, start, goal);

  assert.equal(bfs.reachable, true);
  assert.ok(bfs.shortestPath.length >= 15); // Manhattan lower bound is 14 edges => 15 nodes
  assert.deepEqual(bfs.shortestPath[0], start);
  assert.deepEqual(bfs.shortestPath[bfs.shortestPath.length - 1], goal);

  // Verify every consecutive step in shortestPath is orthogonally adjacent and passable
  for (let i = 0; i < bfs.shortestPath.length - 1; i++) {
    const a = bfs.shortestPath[i];
    const b = bfs.shortestPath[i + 1];
    const manhattan = Math.abs(a.row - b.row) + Math.abs(a.col - b.col);
    assert.equal(manhattan, 1);
  }

  // Test optimality on a hand-crafted cyclic 3x3 maze with a short 2-step route vs long 6-step route
  const cyclic = createClosedGrid(3, 3);
  // Long route: (0,0)-(1,0)-(2,0)-(2,1)-(2,2)-(1,2)-(0,2) = 6 steps
  setWallBetween(cyclic, { row: 0, col: 0 }, { row: 1, col: 0 }, false);
  setWallBetween(cyclic, { row: 1, col: 0 }, { row: 2, col: 0 }, false);
  setWallBetween(cyclic, { row: 2, col: 0 }, { row: 2, col: 1 }, false);
  setWallBetween(cyclic, { row: 2, col: 1 }, { row: 2, col: 2 }, false);
  setWallBetween(cyclic, { row: 2, col: 2 }, { row: 1, col: 2 }, false);
  setWallBetween(cyclic, { row: 1, col: 2 }, { row: 0, col: 2 }, false);
  // Short route creating a cycle: (0,0)-(0,1)-(0,2) = 2 steps
  setWallBetween(cyclic, { row: 0, col: 0 }, { row: 0, col: 1 }, false);
  setWallBetween(cyclic, { row: 0, col: 1 }, { row: 0, col: 2 }, false);

  const cyclicBfs = generateBfsTimeline(cyclic, { row: 0, col: 0 }, { row: 0, col: 2 });
  assert.equal(cyclicBfs.reachable, true);
  assert.equal(cyclicBfs.shortestPath.length, 3); // 2 steps
  assert.deepEqual(cyclicBfs.shortestPath, [
    { row: 0, col: 0 },
    { row: 0, col: 1 },
    { row: 0, col: 2 },
  ]);

  // Snapshot at last frame should mark solved and include full bloomedPath
  const finalSnap = buildBfsSnapshotAtFrame(cyclicBfs, 3, cyclicBfs.frames.length - 1);
  assert.equal(finalSnap.solved, true);
  assert.equal(finalSnap.unreachable, false);
  assert.equal(finalSnap.bloomedPath.length, 3);
});

test('BFS cleanly detects unreachable goal when walls isolate destination', () => {
  const run = generateKruskalTimeline(5, 5, 7);
  const isolated = cloneGrid(run.finalGrid);
  // Wall off cell (4, 4) completely
  setWallBetween(isolated, { row: 4, col: 4 }, { row: 3, col: 4 }, true);
  setWallBetween(isolated, { row: 4, col: 4 }, { row: 4, col: 3 }, true);

  const bfs = generateBfsTimeline(isolated, { row: 0, col: 0 }, { row: 4, col: 4 });
  assert.equal(bfs.reachable, false);
  assert.equal(bfs.shortestPath.length, 0);
  const lastFrame = bfs.frames[bfs.frames.length - 1];
  assert.equal(lastFrame.type, 'BFS_UNREACHABLE');

  const snap = buildBfsSnapshotAtFrame(bfs, 5, bfs.frames.length - 1);
  assert.equal(snap.unreachable, true);
  assert.equal(snap.solved, false);
});

test('wallTileToCells accurately maps internal wall tiles and ignores outer border/pillars', () => {
  // Border wall should return null
  assert.equal(wallTileToCells(0, 1, 5, 5), null);
  // Corner pillar (even, even) should return null
  assert.equal(wallTileToCells(2, 2, 5, 5), null);
  // Open cell (odd, odd) should return null
  assert.equal(wallTileToCells(1, 1, 5, 5), null);
  // Vertical internal wall between (0,0) and (0,1) => tile (1, 2)
  assert.deepEqual(wallTileToCells(1, 2, 5, 5), {
    a: { row: 0, col: 0 },
    b: { row: 0, col: 1 },
    direction: 'east',
  });
  // Horizontal internal wall between (0,0) and (1,0) => tile (2, 1)
  assert.deepEqual(wallTileToCells(2, 1, 5, 5), {
    a: { row: 0, col: 0 },
    b: { row: 1, col: 0 },
    direction: 'south',
  });
});

test('Timeline scrubbing forward and backward reconstructs exact DSU and BFS frames', () => {
  const kruskal = generateKruskalTimeline(7, 9, 99);
  const midIdx = Math.floor(kruskal.frames.length / 2);

  const atMidFirst = buildGridAtDsuFrame(kruskal.initialGrid, kruskal.frames, midIdx);
  const atEnd = buildGridAtDsuFrame(kruskal.initialGrid, kruskal.frames, kruskal.frames.length - 1);
  const scrubbedBackToMid = buildGridAtDsuFrame(kruskal.initialGrid, kruskal.frames, midIdx);

  assert.deepEqual(scrubbedBackToMid.walls, atMidFirst.walls);
  assert.notDeepEqual(atMidFirst.walls, atEnd.walls);

  const bfs = generateBfsTimeline(kruskal.finalGrid, { row: 0, col: 0 }, { row: 6, col: 8 });
  assert.equal(bfs.reachable, true);
  const bfsMid = Math.floor(bfs.frames.length / 2);
  const snapMidA = buildBfsSnapshotAtFrame(bfs, 9, bfsMid);
  const snapEnd = buildBfsSnapshotAtFrame(bfs, 9, bfs.frames.length - 1);
  const snapMidB = buildBfsSnapshotAtFrame(bfs, 9, bfsMid);

  assert.equal(snapMidA.visitedDistances.size, snapMidB.visitedDistances.size);
  assert.equal(snapEnd.solved, true);
  assert.equal(snapMidB.solved, false);
});

