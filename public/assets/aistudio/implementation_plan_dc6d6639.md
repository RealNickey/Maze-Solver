# Hedgerow — Interactive Maze Generator & Solver

An interactive visual laboratory for **Disjoint Set (Union-Find)** maze generation and **Breadth-First Search (BFS)** shortest-path finding, rendered as a living 2.5D pixel-art botanical hedge maze inspired by your reference artwork.

## User Review & Critical Decisions

> [!IMPORTANT]
> You asked to proceed directly to the plan, so the following choices use the recommended defaults tailored to your reference artwork and educational goals. Let me know if you want to adjust any of these before building.

- **Visual Direction (Default)**: Crisp 2.5D pixel-art botanical hedge maze modeled closely after your reference image—layered forest-green hedges with shadowed south faces, sunlit meadow paths, pixel daisies, and animated bluebirds on a clean bright canvas.
- **Educational Depth (Default)**: A balanced two-zone layout combining a large interactive maze canvas with a live **Disjoint Set & BFS Inspector** showing active operations, union count, BFS frontier queue, and step-by-step narration.
- **Interactive Capabilities (Default)**: Step-by-step playback (Play, Pause, Step Forward, Instant Finish, Speed slider), draggable Start and Goal markers, optional color-coded Disjoint Set region overlay, and an optional Hedge Brush mode to manually carve or regrow walls and test custom scenarios.
- **Ambient Garden Polish (Default)**: Gentle animated bluebirds gliding and perching on hedges, swaying pixel wildflowers, leaf-scatter particles when Union-Find merges two regions, and an optional muted-by-default Web Audio chime toggle.

---

## 1. Overview & Core Concept

- **What It Does**: Generates mathematically perfect random mazes (every cell reachable with a unique simple path and zero cycles) step by step using **Randomized Kruskal's Algorithm backed by a Disjoint Set (Union-Find)** data structure, then solves for the guaranteed shortest path between any Start and Goal cell using **Breadth-First Search (BFS)**.
- **Target Audience / Persona**: Computer science students, educators, and algorithm enthusiasts who want to see abstract graph theory concepts—equivalence classes, path compression, union-by-rank, and level-order BFS waves—expressed with unmistakable visual clarity and craft.
- **Key Value**: Transforms two foundational graph algorithms from dry textbook grids into a tactile, memorable visual experience where every `union(a, b)` physically trims a hedge between two distinct meadow regions and every BFS wave ripples visibly outward before blooming into the optimal path.

---

## 2. User Experience & Visual Design

### Key User Flows

1. **Immediate Arrival & Living First Impression**:
   - The app opens directly into the two-zone sandbox with a freshly generated medium hedge maze ready on the sunlit canvas, Start (bluebird nest marker) and Goal (golden daisy marker) placed on opposite quadrants, and ambient bluebirds gliding gently above the hedges.
2. **Watching Disjoint Set (Union-Find) Maze Generation**:
   - Clicking **Generate Maze** fills the grid with dense hedge walls separating isolated grass chambers, each belonging to its own singleton set (`Sets = N`).
   - Step by step, the algorithm picks a randomized wall separating cells `A` and `B`:
     - If `find(A) ≠ find(B)`, the wall trims away with a crisp leaf-burst animation, `union(A, B)` merges their sets, and the live inspector records the union and decrements the remaining set count.
     - If `find(A) === find(B)`, the wall briefly highlights as **Cycle Avoided** and stays intact, demonstrating visually why the resulting maze is always a spanning tree.
   - Toggling **Show Sets** overlays soft botanical tints keyed to each cell's Disjoint Set root so users watch dozens of isolated colors coalesce into one unified garden.
3. **Watching BFS Shortest-Path Discovery**:
   - Clicking **Solve with BFS** enqueues the Start cell at distance `0`.
   - Each step pops the front of the FIFO queue, inspects passable orthogonal neighbors, and expands a luminous sky-blue dew wave across the grass with subtle distance rings and frontier highlights.
   - The inspector displays the live FIFO queue peek, explored count, current wave distance, and parent pointer trail.
   - Upon reaching the Goal, parent pointers backtrack smoothly to bloom a golden wildflower path along the exact shortest route. If custom wall edits make the Goal unreachable, BFS cleanly finishes with an explicit **No Path Exists** banner and visual highlight.
4. **Interactive Manipulation & Playback Mastery**:
   - Users can **drag Start or Goal markers** to any open meadow tile at any time—if a solution is already visible, re-solving updates immediately.
   - Users can pause at any frame, click **Step Forward** to examine a single Union-Find check or BFS pop, scrub the **Animation Speed** slider (`1` to `120 steps/sec`), switch **Grid Size** (`Small 9×7`, `Medium 15×11`, `Large 21×15`), or toggle **Edit Hedges** to draw/erase custom walls and loops (testing how BFS still guarantees the shortest path even in imperfect mazes with cycles).
5. **Concise Algorithm Guide Below the Fold**:
   - Scrolling down reveals a compact, two-column visual reference explaining **Disjoint Set (Union-Find)** (`find` with path compression, `union` by rank, `O(α(n))` amortized time) and **Breadth-First Search** (FIFO queue wave, optimality on unweighted grids, `O(V + E)` complexity), paired with an interactive visual legend.

### Visual Identity & Theme

- **Aesthetic Direction**: Tactile 2.5D pixel-art botanical garden framed inside a crisp, airy daylight editorial workspace. Crisp pixel art renders inside the canvas with nearest-neighbor scaling (`imageSmoothingEnabled = false`) while the surrounding UI uses clean, modern Swiss-style precision.
- **Color Palette & Mood (60-30-10 Budget)**:
  - **60% Dominant Canvas (`--background: #F6F8F4`)**: Clean bright botanical paper backdrop with soft sage-tinted hairlines (`--border: #DCE5D5`) so the rich green hedge maze commands attention as the sole focal anchor.
  - **30% Structural Surfaces (`--surface: #FFFFFF`, `--surface-muted: #EEF3EA`, `--foreground: #142616`, `--muted-foreground: #4C634F`)**: Crisp single-elevation side inspector panel and hairline-bordered controls.
  - **10% Curated Reference Palette & Semantic Accents**:
    - *Hedge Canopy & Depth*: Canopy Top `#3B7A28`, Sunlit Grass `#5E9E1E`, Shadowed South Hedge Wall `#1F5B1B`, Deep Pixel Outline `#122D14`.
    - *BFS Frontier & Water Wave (`--primary: #1E73B8` / `#49A6E6`)*: Echoes the bluebirds from the reference palette; paired with ripple pattern and `"Frontier"` / `"Visited"` legend labels.
    - *Shortest Path & Goal (`--accent: #EAB924`)*: Warm marigold yellow matching the daisy centers, blooming white-and-gold flowers along the optimal route.
    - *Cycle Rejected / Blocked*: Soft terracotta-coral flash (`#C9553D`) accompanied by an explicit `"Cycle skipped"` status label (never color-only signaling).
- **Typography & Hierarchy**:
  - *Display Headings*: **Bricolage Grotesque** (SemiBold 600–700, `text-wrap: balance`) for friendly editorial character.
  - *Body & Controls*: **Plus Jakarta Sans** (Regular 400 / Medium 500, 14px–16px) with single-line non-wrapping controls (`whitespace-nowrap`).
  - *Metrics & Algorithm Data*: **JetBrains Mono** with `tabular-nums` for step counters, coordinates `(r, c)`, set IDs, and BFS queue snapshots.
- **Component Styling & Layout**:
  - **Top Bar Contract**: Strict single-row 3-zone header: `Hedgerow` wordmark on the left, four single-line navigation actions (`Sandbox`, `Disjoint Set`, `BFS Solver`, `Legend`) in the center, and one primary button (`New Maze`) on the right.
  - **Two-Zone Sandbox Stage**: Desktop `1440px` layout gives ~66% width to the framed 2.5D pixel-art maze stage (with bottom compact playback dock) and ~34% width to the live **Algorithm Inspector** panel.
  - **Zero-Pill Discipline**: All stats (`Sets: 1 · Walls Carved: 164 · Path: 38 steps`) render as crisp unboxed tabular text separated by typographic `·` dividers and hairline rules—no pill capsules, no decorative pulsing dots, and no nested card-inside-card boxes.

### Interactive Feedback & Motion

- **Smooth 60fps Canvas Loop**: Decouples the simulation tick rate (driven by the user's speed slider) from the `requestAnimationFrame` visual renderer so tile carve animations, leaf-poof particles, BFS dew ripples, daisy bloom pop-ins, and gliding bluebirds animate smoothly at 60fps even when stepping one operation at a time.
- **Micro-Interactions**: Buttons and segmented controls settle within `150ms` using `cubic-bezier(0.16, 1, 0.3, 1)` on compositor-only properties (`transform`, `opacity`).
- **Accessibility & Reduced Motion**: Respects `prefers-reduced-motion` (pauses ambient bird flight and flower sway while keeping clear algorithmic state transitions), ensures $\ge 4.5:1$ text contrast, and provides dual-coded icons/patterns + text labels for every algorithm state.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: HTML5 2D Canvas with Custom Pixel-Art Tile Renderer vs. DOM CSS Grid**
  - *Chosen Approach*: Render the maze on a crisp high-DPI HTML5 `<canvas>` using procedural 2.5D pixel-art tiles (auto-tiled hedge outlines, north-to-south extruded wall depth, cast drop shadows onto grass below hedges, pixel grass tufts, swaying daisies, particle bursts, and animated bluebird sprites).
  - *Why*: Achieves the authentic pixel-art botanical craftsmanship of your reference image—complete with continuous rounded hedge corners, cast shadows, and smooth 60fps animations—without DOM layout thrashing on larger grids.
  - *Alternatives Considered*: Standard DOM `<div>` grid (easier to wire, but looks flat and boxy, and lags when animating ripples + shadows + particles across hundreds of cells).

- **Decision 2: Pre-Recorded Step Timeline vs. Coupled Live Timer Loops**
  - *Chosen Approach*: Run deterministic step generators for both Disjoint Set (Randomized Kruskal) and BFS that emit discrete, inspectable operation frames (`EVALUATE_WALL`, `UNION_CARVE`, `CYCLE_SKIP`, `BFS_DEQUEUE`, `BFS_ENQUEUE`, `PATH_BLOOM`), allowing instant scrubbing, single-step stepping, pause/resume, and speed changes mid-animation without losing algorithmic integrity.
  - *Why*: Guarantees exact synchronization between the visual canvas, the live DSU/BFS inspector metrics, and step-by-step controls, while preventing stale timer leaks or half-mutated states.
  - *Alternatives Considered*: Async `setTimeout` loops mutating React state directly (prone to race conditions when users rapidly change grid size, drag markers, or click reset mid-run).

- **Decision 3: Client-Side Architecture with Zero Backend Overhead**
  - *Chosen Approach*: Pure client-side React + TypeScript state and deterministic algorithm engine.
  - *Why*: Instantaneous zero-latency maze generation, BFS solving, and wall editing with no network round-trips or external dependencies.

---

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

### Architecture & Component Diagram

```
┌───────────────────────────────────────────────────────────────────────────┐
│                              Hedgerow App                                 │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │ Top Bar: [Hedgerow] ─── [Sandbox | Disjoint Set | BFS | Legend] ─── [New Maze] │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                                                           │
│  ┌───────────────────────────────────────┐  ┌──────────────────────────┐  │
│  │        Interactive Maze Stage         │  │   Algorithm Inspector    │  │
│  │  ┌─────────────────────────────────┐  │  │  • Active Phase Header   │  │
│  │  │   2.5D Pixel Botanical Canvas   │  │  │  • Live Narration Box    │  │
│  │  │   • Auto-tiled Hedge Walls      │  │  │  • DSU Metrics:          │  │
│  │  │   • Cast Shadows & Daisies      │  │  │    Sets, Unions, Skips   │  │
│  │  │   • DSU Set Tint Overlay        │  │  │  • BFS Metrics:          │  │
│  │  │   • BFS Dew Wave & Bloom Path   │  │  │    Visited, Depth, Path  │  │
│  │  │   • Draggable Start/Goal & Birds│  │  │  • Live FIFO Queue Peek  │  │
│  │  └─────────────────────────────────┘  │  │  • Grid Size & Visual    │  │
│  │  ┌─────────────────────────────────┐  │  │    Layer Toggles         │  │
│  │  │ Playback & Mode Dock            │  │  └──────────────────────────┘  │
│  │  │ [Generate] [Solve] [Play/Pause] │  │                                │
│  │  │ [Step] [Instant] [Speed Slider] │  │                                │
│  │  └─────────────────────────────────┘  │                                │
│  └───────────────────────────────────────┘                                │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │     Algorithm Reference & Visual Legend (Disjoint Set + BFS)        │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────┬────────────────────────────────────────┘
                                   │ drives & subscribes to
                                   ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                     Pure TypeScript Algorithm Engine                      │
│  ┌──────────────────────────────┐    ┌─────────────────────────────────┐  │
│  │  Disjoint Set (Union-Find)   │    │    Breadth-First Search (BFS)   │  │
│  │  • parent[], rank[], size[]  │    │    • FIFO Queue, visited[]      │  │
│  │  • find() w/ path compression│───▶│    • distance[], parentCell[]   │  │
│  │  • union() by rank           │    │    • Step frame generator       │  │
│  │  • Randomized Kruskal walls  │    │    • Shortest-path backtracker  │  │
│  └──────────────────────────────┘    └─────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────────────┘
```

### Data Model & State

- **Maze Grid Representation**: A 2D logical cell grid (`cols × rows`) paired with wall connectivity flags (`north`, `east`, `south`, `west`), mapped onto an expanded `(2*cols + 1) × (2*rows + 1)` tile render matrix so walls and meadow corridors share uniform 2.5D pixel-art tile thickness matching the reference artwork.
- **Disjoint Set State**: Tracks `parent` array, `rank` array, `componentCount`, deterministic harmonious botanical color assignment per root set, `unionsPerformed`, `cyclesSkipped`, and the currently evaluated wall edge `(cellA, cellB)`.
- **BFS Solver State**: Tracks `startCell`, `goalCell`, `queue` (ordered FIFO cell coordinates), `visited` set, `distances` map, `parents` map, `shortestPath` ordered cell array, and terminal status (`idle | running | solved | unreachable`).
- **Playback & Interaction State**: Manages `mode` (`generate | solve | edit`), `playbackStatus` (`idle | playing | paused | complete`), `speed` (steps per second), `showSetColors` (boolean), `showDistances` (boolean), `ambientGarden` (boolean), `soundEnabled` (boolean), and pointer drag state for moving Start/Goal markers or painting/erasing hedge walls.

### Interactive Component & State Mapping

- **New Maze / Generate Button**: Initializes a fresh fully-walled grid, resets the Disjoint Set to `cols × rows` singleton sets, shuffles all internal edges via Fisher-Yates, clears any prior BFS state, and starts stepping through Kruskal's generation.
- **Solve with BFS Button**: If generation is still in progress, snaps remaining DSU steps to completion first so the maze is valid, then clears previous BFS overlays and runs BFS from the current `startCell` to `goalCell`.
- **Play / Pause / Step Forward / Instant Finish**: Advances the active algorithm frame buffer smoothly at the chosen speed, advances exactly one frame on Step Forward, or flushes all remaining frames immediately on Instant Finish without freezing the UI.
- **Canvas Pointer Handlers (Hover, Click, Drag)**:
  - Hit-tests pixel coordinates back to logical tile coordinates.
  - Grabbing the Start or Goal tile enters drag mode, updating coordinates live over open meadow tiles and auto-recomputing the BFS solution cleanly if previously solved.
  - When **Edit Hedges** is active, clicking or dragging over internal wall tiles toggles walls open or closed (allowing custom loops or dead-end blocks) and clears stale BFS state so the user can re-solve immediately.
- **Grid Size & Layer Toggles**: Changing grid preset cleanly cancels running animation loops, resets Start/Goal to opposite corners, and builds a new centered canvas layout. Toggling **Show Sets**, **Show Distances**, **Ambient Birds**, or **Audio Chimes** updates rendering and Web Audio output immediately with zero state reset.
