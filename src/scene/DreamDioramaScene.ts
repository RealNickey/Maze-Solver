import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { BfsVisualSnapshot } from '../engine/bfs';
import { buildTileWallMatrix, cellIndex } from '../engine/maze';
import type { ActivePhase, CellCoord, DsuStepFrame, MazeGrid } from '../engine/types';
import { audioEngine } from '../utils/audio';
import { triggerHaptic } from '../utils/haptics';
import { createDreamTextures, type DreamTextureSet } from './pixelTextures';
import {
  createBluebirdGroup,
  createButterflyGroup,
  createGardenLanternGroup,
  createGoalShrineGroup,
  createSanctuaryTreeGroup,
  createStartNestGroup,
  createWaterLilyGroup,
  type ArticulatedBluebird,
  type ArticulatedButterfly,
} from './props';
import { createStylizedWaterMaterial } from './waterShader';

export interface DreamSceneState {
  grid: MazeGrid;
  start: CellCoord;
  goal: CellCoord;
  phase: ActivePhase;
  dsuFrame: DsuStepFrame | null;
  bfsSnapshot: BfsVisualSnapshot | null;
  activeCarveTile: { row: number; col: number } | null;
  activeSkipTile: { row: number; col: number } | null;
  instantSync: boolean;
}

export interface DreamSceneCallbacks {
  onMoveStart: (cell: CellCoord) => void;
  onMoveGoal: (cell: CellCoord) => void;
  onInteractionFeedback?: (label: string) => void;
  onCameraStateChange?: (dragging: boolean, offsetDeg: number, zoom: number) => void;
}

interface Particle {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  rotX: number;
  rotY: number;
  vRot: number;
  size: number;
  age: number;
  life: number;
  color: THREE.Color;
}

interface RippleRing {
  active: boolean;
  x: number;
  y: number;
  z: number;
  age: number;
  life: number;
  maxScale: number;
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
}

interface InteractiveBloom {
  x: number;
  z: number;
  scale: number;
  targetScale: number;
  colorHex: number;
  rotY: number;
  seed: number;
}

interface LilyPadItem {
  group: THREE.Group;
  baseX: number;
  baseZ: number;
  phase: number;
  bobBoost: number;
}

interface BirdFlight {
  bird: ArticulatedBluebird;
  orbitRx: number;
  orbitRz: number;
  baseY: number;
  speed: number;
  phase: number;
  swoop: number;
}

interface ButterflyFlight {
  bf: ArticulatedButterfly;
  centerX: number;
  centerZ: number;
  radius: number;
  baseY: number;
  speed: number;
  phase: number;
}

// Vivid poppy meadow flower palette inspired by sunlit pixel-art wildflower fields
const FLOWER_PALETTE = [
  0xff5d73, // Poppy coral-red
  0xd25bc9, // Orchid magenta
  0xfacb2e, // Sunflower gold
  0xff99c8, // Sakura blush pink
  0x7cc2ff, // Forget-me-not sky
  0xfffdf5, // Daisy ivory
];
const LEAF_PALETTE = [0x61c268, 0x77d674, 0x4ca859, 0x95e888];

function detectSoftwareWebGL(): boolean {
  try {
    const probe = document.createElement('canvas');
    const gl = (probe.getContext('webgl2') ||
      probe.getContext('webgl')) as WebGLRenderingContext | null;
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const rendererStr = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || '') : '';
    const isSoft = /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(rendererStr);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return isSoft;
  } catch {
    return true;
  }
}

function hashCell(a: number, b: number): number {
  let h = (a * 374761393 + b * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/**
 * Builds a plush, rounded-edge pillowy shrub base geometry (zero sharp cube corners!).
 */
function createPillowyShrubGeometry(): THREE.BufferGeometry {
  const half = 0.37;
  const r = 0.19;
  const shape = new THREE.Shape();
  shape.moveTo(-half + r, -half);
  shape.lineTo(half - r, -half);
  shape.quadraticCurveTo(half, -half, half, -half + r);
  shape.lineTo(half, half - r);
  shape.quadraticCurveTo(half, half, half - r, half);
  shape.lineTo(-half + r, half);
  shape.quadraticCurveTo(-half, half, -half, half - r);
  shape.lineTo(-half, -half + r);
  shape.quadraticCurveTo(-half, -half, -half + r, -half);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.54,
    bevelEnabled: true,
    bevelThickness: 0.16,
    bevelSize: 0.14,
    bevelSegments: 2,
    curveSegments: 4,
  });

  // Rotate so extrusion axis (+Z) becomes vertical (+Y) and rests flush on y = 0
  geo.rotateX(-Math.PI / 2);
  geo.computeBoundingBox();
  if (geo.boundingBox) {
    geo.translate(0, -geo.boundingBox.min.y, 0);
  }
  geo.computeVertexNormals();
  return geo;
}

export class DreamDioramaScene {
  private container: HTMLElement;
  private callbacks: DreamSceneCallbacks;
  private isSoftwareGl: boolean;

  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private pmrem: THREE.PMREMGenerator;
  private envRenderTarget: THREE.WebGLRenderTarget;
  private textures: DreamTextureSet;
  private keyLight: THREE.DirectionalLight;

  // Root groups
  private worldGroup = new THREE.Group();
  private islandGroup = new THREE.Group();
  private mazeGroup = new THREE.Group();
  private wildlifeGroup = new THREE.Group();
  private fxGroup = new THREE.Group();

  // Persistent props
  private waterMesh: THREE.Mesh;
  private waterMat: THREE.ShaderMaterial;
  private startNest: THREE.Group;
  private goalShrine: THREE.Group;
  private cursorHalo: THREE.Mesh;
  private lilyPads: LilyPadItem[] = [];
  private birds: BirdFlight[] = [];
  private butterflies: ButterflyFlight[] = [];

  // Dynamic per-grid maze instanced meshes
  private tileRows = 0;
  private tileCols = 0;
  private hedgeBaseMesh: THREE.InstancedMesh | null = null;
  private hedgePuffMesh: THREE.InstancedMesh | null = null;
  private hedgeBudMesh: THREE.InstancedMesh | null = null;
  private mossMesh: THREE.InstancedMesh | null = null;
  private bfsBudStemMesh: THREE.InstancedMesh | null = null;
  private bfsBudHeadMesh: THREE.InstancedMesh | null = null;
  private pathVineMesh: THREE.InstancedMesh | null = null;
  private pathFlowerStemMesh: THREE.InstancedMesh | null = null;
  private pathFlowerPetalMesh: THREE.InstancedMesh | null = null;
  private pathFlowerCoreMesh: THREE.InstancedMesh | null = null;

  // Interactive user-planted + ambient meadow flowers
  private interactiveBlooms: InteractiveBloom[] = [];
  private userFlowerStemMesh: THREE.InstancedMesh;
  private userFlowerPetalMesh: THREE.InstancedMesh;
  private userFlowerCoreMesh: THREE.InstancedMesh;
  private readonly maxUserBlooms = 72;

  // Per-tile animation buffers
  private wallClosedFlags: Uint8Array = new Uint8Array(0);
  private hedgeScale: Float32Array = new Float32Array(0);
  private hedgeWobble: Float32Array = new Float32Array(0);
  private mossTarget: Float32Array = new Float32Array(0);
  private mossScale: Float32Array = new Float32Array(0);
  private frontierFlags: Uint8Array = new Uint8Array(0);
  private pathTarget: Float32Array = new Float32Array(0);
  private pathScale: Float32Array = new Float32Array(0);
  private pathOrder: Float32Array = new Float32Array(0);

  // FX pools
  private particles: Particle[] = [];
  private particleMesh: THREE.InstancedMesh;
  private readonly maxParticles = 180;
  private ripples: RippleRing[] = [];
  private readonly maxRipples = 20;

  // State, camera rig, scroll zoom, & 2.5D <-> 2D morph transition
  private state: DreamSceneState;
  private defaultAzimuth = 0;
  private defaultPolar = 0.64; // Dreamy 2.5D elevated angle
  private topDownPolar = 0.015; // Overhead aligned angle for 2.5D <-> 2D morph
  private defaultDistance = 24;
  private azimuth = 0;
  private polar = 0.64;
  private targetAzimuth = 0;
  private targetPolar = 0.64;
  private zoomFactor = 1.0;
  private targetZoomFactor = 1.0;
  private camDistance = 24;
  private lookTarget = new THREE.Vector3(0, 0.15, 0.4);

  // 2.5D <-> 2D transition blend (0 = full 2.5D, 1 = flattened overhead 2D alignment)
  private projectionMode: '2.5d' | '2d' = '2.5d';
  private viewBlend = 0;
  private paused = false;

  // Pointer, pinch-zoom, & dragging
  private pointerDown = false;
  private dragKind: 'none' | 'camera' | 'start' | 'goal' = 'none';
  private activePointers = new Map<number, { x: number; y: number }>();
  private lastPinchDist: number | null = null;
  private lastPointerX = 0;
  private lastPointerY = 0;
  private pointerMovedDist = 0;
  private lastHoverRippleTime = 0;
  private lastHoverPollenTime = 0;
  private startLift = 0;
  private goalLift = 0;

  // Scratch math objects (zero allocations in animation loop)
  private readonly scratchObj = new THREE.Object3D();
  private readonly scratchVec = new THREE.Vector3();
  private readonly scratchColor = new THREE.Color();
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointerNdc = new THREE.Vector2();
  private readonly groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private readonly waterPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0.62);

  // Loop & lifecycle
  private disposed = false;
  private contextLost = false;
  private rafId = 0;
  private timerId = 0;
  private lastTimeMs = 0;
  private elapsed = 0;
  private resizeObserver: ResizeObserver;
  private boundPointerDown: (e: PointerEvent) => void;
  private boundPointerMove: (e: PointerEvent) => void;
  private boundPointerUp: (e: PointerEvent) => void;
  private boundWheel: (e: WheelEvent) => void;
  private boundContextLost: (e: Event) => void;
  private boundContextRestored: () => void;

  constructor(
    container: HTMLElement,
    initialState: DreamSceneState,
    callbacks: DreamSceneCallbacks
  ) {
    this.container = container;
    this.state = initialState;
    this.callbacks = callbacks;
    this.isSoftwareGl = detectSoftwareWebGL();

    const width = Math.max(container.clientWidth, 320);
    const height = Math.max(container.clientHeight, 320);

    // 1. Renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
      alpha: false,
    });
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(width, height);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.98;
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.renderer.domElement.style.touchAction = 'none';
    this.container.appendChild(this.renderer.domElement);

    // 2. Scene, vibrant pixel cumulus sky backdrop & RoomEnvironment IBL
    this.scene = new THREE.Scene();
    this.textures = createDreamTextures();
    this.scene.background = this.textures.skyBackdrop;
    this.scene.fog = new THREE.Fog(0x9bcdf9, 60, 180);

    this.pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envRenderTarget = this.pmrem.fromScene(new RoomEnvironment(), 0.04);
    this.scene.environment = this.envRenderTarget.texture;
    this.scene.environmentIntensity = 0.36;

    // 3. Camera
    this.camera = new THREE.PerspectiveCamera(34, width / height, 0.5, 280);

    // 4. Soft sunlit dreamy lighting (creamy bounce keeps shrubs plush & soft!)
    const hemi = new THREE.HemisphereLight(0xcde7ff, 0x73c962, 1.05);
    this.scene.add(hemi);

    this.keyLight = new THREE.DirectionalLight(0xfff5d8, 1.65);
    this.keyLight.position.set(16, 28, 18);
    this.keyLight.castShadow = !this.isSoftwareGl;
    this.keyLight.shadow.mapSize.set(1024, 1024);
    this.keyLight.shadow.camera.near = 6;
    this.keyLight.shadow.camera.far = 75;
    this.keyLight.shadow.camera.left = -26;
    this.keyLight.shadow.camera.right = 26;
    this.keyLight.shadow.camera.top = 26;
    this.keyLight.shadow.camera.bottom = -26;
    this.keyLight.shadow.bias = -0.0008;
    this.scene.add(this.keyLight);

    const rimLight = new THREE.DirectionalLight(0xffd4e5, 0.52);
    rimLight.position.set(-18, 14, -14);
    this.scene.add(rimLight);

    // 5. Scene hierarchy
    this.scene.add(this.worldGroup);
    this.worldGroup.add(this.islandGroup, this.mazeGroup, this.wildlifeGroup, this.fxGroup);

    // 6. Realistic stylized pixel-art Voronoi caustic water plane
    const waterGeo = new THREE.PlaneGeometry(180, 180);
    this.waterMat = createStylizedWaterMaterial(16, 12);
    this.waterMesh = new THREE.Mesh(waterGeo, this.waterMat);
    this.waterMesh.rotation.x = -Math.PI / 2;
    this.waterMesh.position.y = -0.62;
    this.worldGroup.add(this.waterMesh);

    // 7. Start Nest & Goal Sun Shrine props
    this.startNest = createStartNestGroup();
    this.goalShrine = createGoalShrineGroup();
    this.worldGroup.add(this.startNest, this.goalShrine);

    // 8. Cursor sunlit halo ring
    const haloGeo = new THREE.RingGeometry(0.32, 0.44, 16);
    const haloMat = new THREE.MeshBasicMaterial({
      color: 0xfff6c2,
      transparent: true,
      opacity: 0.78,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.cursorHalo = new THREE.Mesh(haloGeo, haloMat);
    this.cursorHalo.rotation.x = -Math.PI / 2;
    this.cursorHalo.position.y = 0.045;
    this.cursorHalo.visible = false;
    this.fxGroup.add(this.cursorHalo);

    // 9. Interactive user-planted + ambient meadow wildflower instanced meshes
    const uStemGeo = new THREE.BoxGeometry(0.06, 0.28, 0.06);
    uStemGeo.translate(0, 0.14, 0);
    const uStemMat = new THREE.MeshStandardMaterial({ color: 0x45ad4b, roughness: 0.8 });
    this.userFlowerStemMesh = new THREE.InstancedMesh(uStemGeo, uStemMat, this.maxUserBlooms * 2);
    this.userFlowerStemMesh.frustumCulled = false;

    const uPetalGeo = new THREE.BoxGeometry(0.28, 0.09, 0.28);
    const uPetalMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.42,
      emissive: 0x1a0c14,
      emissiveIntensity: 0.08,
    });
    this.userFlowerPetalMesh = new THREE.InstancedMesh(uPetalGeo, uPetalMat, this.maxUserBlooms * 2);
    this.userFlowerPetalMesh.frustumCulled = false;

    const uCoreGeo = new THREE.BoxGeometry(0.11, 0.11, 0.11);
    const uCoreMat = new THREE.MeshStandardMaterial({ color: 0xfde047, roughness: 0.3 });
    this.userFlowerCoreMesh = new THREE.InstancedMesh(uCoreGeo, uCoreMat, this.maxUserBlooms * 2);
    this.userFlowerCoreMesh.frustumCulled = false;
    this.fxGroup.add(this.userFlowerStemMesh, this.userFlowerPetalMesh, this.userFlowerCoreMesh);

    // 10. 3D pixel particle pool
    const partGeo = new THREE.BoxGeometry(0.13, 0.13, 0.07);
    const partMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
    this.particleMesh = new THREE.InstancedMesh(partGeo, partMat, this.maxParticles);
    this.particleMesh.frustumCulled = false;
    this.fxGroup.add(this.particleMesh);
    for (let i = 0; i < this.maxParticles; i++) {
      this.particles.push({
        active: false,
        x: 0,
        y: -10,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        rotX: 0,
        rotY: 0,
        vRot: 0,
        size: 1,
        age: 0,
        life: 1,
        color: new THREE.Color(0xffffff),
      });
    }

    // 11. Water & dew ripple pool
    const ripGeo = new THREE.RingGeometry(0.32, 0.44, 24);
    for (let i = 0; i < this.maxRipples; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(ripGeo, mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.visible = false;
      this.fxGroup.add(mesh);
      this.ripples.push({
        active: false,
        x: 0,
        y: -0.59,
        z: 0,
        age: 0,
        life: 1,
        maxScale: 3,
        mesh,
        mat,
      });
    }

    // 12. Build grid-dependent island, soft shrubs, & wildlife
    this.rebuildForGrid(initialState.grid);
    this.syncStateToTargets(initialState, true);
    this.fitCameraForViewport(width, height);
    this.updateCameraTransform();

    // 13. Event listeners
    this.boundPointerDown = this.onPointerDown.bind(this);
    this.boundPointerMove = this.onPointerMove.bind(this);
    this.boundPointerUp = this.onPointerUp.bind(this);
    this.boundWheel = this.onWheel.bind(this);
    this.boundContextLost = (e: Event) => {
      e.preventDefault();
      this.contextLost = true;
    };
    this.boundContextRestored = () => {
      this.contextLost = false;
      this.scheduleNextFrame();
    };

    const dom = this.renderer.domElement;
    dom.addEventListener('pointerdown', this.boundPointerDown);
    dom.addEventListener('wheel', this.boundWheel, { passive: false });
    window.addEventListener('pointermove', this.boundPointerMove);
    window.addEventListener('pointerup', this.boundPointerUp);
    window.addEventListener('pointercancel', this.boundPointerUp);
    dom.addEventListener('webglcontextlost', this.boundContextLost, false);
    dom.addEventListener('webglcontextrestored', this.boundContextRestored, false);

    this.resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = Math.max(Math.floor(entry.contentRect.width), 320);
        const h = Math.max(Math.floor(entry.contentRect.height), 320);
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(w, h);
        this.fitCameraForViewport(w, h);
        this.updateCameraTransform();
      }
    });
    this.resizeObserver.observe(this.container);

    // 14. Start render loop
    this.lastTimeMs = performance.now();
    this.renderFrame();
    this.scheduleNextFrame();
  }

  /**
   * Triggers smooth 2.5D <-> 2D top-down morph transition!
   */
  public setProjectionMode(mode: '2.5d' | '2d'): void {
    this.projectionMode = mode;
    if (mode === '2d') {
      this.targetAzimuth = 0;
      this.targetPolar = this.topDownPolar;
      this.targetZoomFactor = 1.0;
    } else {
      this.targetAzimuth = this.defaultAzimuth;
      this.targetPolar = this.defaultPolar;
    }
    this.callbacks.onCameraStateChange?.(
      false,
      Math.round(THREE.MathUtils.radToDeg(this.targetAzimuth)),
      Number(this.targetZoomFactor.toFixed(2))
    );
  }

  /**
   * Pauses or resumes the Three.js loop (used when completely settled in flat 2D Top view).
   */
  public setPaused(paused: boolean): void {
    if (this.paused === paused) return;
    this.paused = paused;
    if (paused) {
      cancelAnimationFrame(this.rafId);
      window.clearTimeout(this.timerId);
    } else if (!this.disposed && !this.contextLost) {
      this.lastTimeMs = performance.now();
      this.renderFrame();
      this.scheduleNextFrame();
    }
  }

  public updateState(next: DreamSceneState): void {
    const prev = this.state;
    this.state = next;

    const dimsChanged =
      next.grid.rows !== prev.grid.rows || next.grid.cols !== prev.grid.cols;
    if (dimsChanged) {
      this.rebuildForGrid(next.grid);
      this.fitCameraForViewport(
        Math.max(this.container.clientWidth, 320),
        Math.max(this.container.clientHeight, 320)
      );
    }

    if (next.activeCarveTile && !next.instantSync) {
      const pos = this.tileToWorld(next.activeCarveTile.row, next.activeCarveTile.col);
      this.spawnParticles(pos.x, 0.55, pos.z, 10, LEAF_PALETTE, 2.2);
    }
    if (next.activeSkipTile && !next.instantSync) {
      const idx = next.activeSkipTile.row * this.tileCols + next.activeSkipTile.col;
      if (idx >= 0 && idx < this.hedgeWobble.length) {
        this.hedgeWobble[idx] = 1.0;
      }
    }

    const prevBloomLen = prev.bfsSnapshot?.bloomedPath.length ?? 0;
    const nextBloomLen = next.bfsSnapshot?.bloomedPath.length ?? 0;
    if (nextBloomLen > prevBloomLen && next.bfsSnapshot && !next.instantSync) {
      const newest = next.bfsSnapshot.bloomedPath[nextBloomLen - 1];
      if (newest) {
        const pos = this.cellToWorld(newest);
        this.spawnParticles(pos.x, 0.38, pos.z, 9, FLOWER_PALETTE, 2.0);
        this.spawnRipple(pos.x, 0.05, pos.z, 1.25, 0xfef08a);
      }
    }

    this.syncStateToTargets(next, next.instantSync || dimsChanged);
  }

  private tileToWorld(tr: number, tc: number): { x: number; z: number } {
    return {
      x: tc - (this.tileCols - 1) / 2,
      z: tr - (this.tileRows - 1) / 2,
    };
  }

  private cellToWorld(cell: CellCoord): { x: number; z: number } {
    return this.tileToWorld(2 * cell.row + 1, 2 * cell.col + 1);
  }

  private worldToTile(x: number, z: number): { tr: number; tc: number } | null {
    const tc = Math.round(x + (this.tileCols - 1) / 2);
    const tr = Math.round(z + (this.tileRows - 1) / 2);
    if (tr < 0 || tr >= this.tileRows || tc < 0 || tc >= this.tileCols) return null;
    return { tr, tc };
  }

  private worldToCell(x: number, z: number): CellCoord | null {
    const tile = this.worldToTile(x, z);
    if (!tile) return null;
    const row = Math.max(0, Math.min(this.state.grid.rows - 1, Math.floor((tile.tr - 1) / 2)));
    const col = Math.max(0, Math.min(this.state.grid.cols - 1, Math.floor((tile.tc - 1) / 2)));
    return { row, col };
  }

  private disposeGroupChildren(group: THREE.Group): void {
    while (group.children.length > 0) {
      const child = group.children[0];
      group.remove(child);
      child.traverse((obj) => {
        if ((obj as THREE.Mesh).geometry) {
          (obj as THREE.Mesh).geometry.dispose();
        }
        const mat = (obj as THREE.Mesh).material;
        if (Array.isArray(mat)) {
          mat.forEach((m) => m.dispose());
        } else if (mat) {
          mat.dispose();
        }
      });
    }
  }

  private rebuildForGrid(grid: MazeGrid): void {
    this.tileRows = 2 * grid.rows + 1;
    this.tileCols = 2 * grid.cols + 1;
    const totalTiles = this.tileRows * this.tileCols;

    this.disposeGroupChildren(this.islandGroup);
    this.disposeGroupChildren(this.mazeGroup);
    this.disposeGroupChildren(this.wildlifeGroup);
    this.lilyPads = [];
    this.birds = [];
    this.butterflies = [];
    this.interactiveBlooms = [];

    // 1. Warm Sunlit Limestone Garden Island Plinth
    const padW = this.tileCols + 1.4;
    const padD = this.tileRows + 1.4;
    this.waterMat.uniforms.uIslandHalf.value.set(padW / 2, padD / 2);

    const grassTex = this.textures.grass.clone();
    grassTex.needsUpdate = true;
    grassTex.repeat.set(Math.ceil(padW / 2), Math.ceil(padD / 2));

    const stoneSideX = this.textures.stoneWall.clone();
    stoneSideX.needsUpdate = true;
    stoneSideX.repeat.set(Math.ceil(padW / 2.2), 1);

    const stoneSideZ = this.textures.stoneWall.clone();
    stoneSideZ.needsUpdate = true;
    stoneSideZ.repeat.set(Math.ceil(padD / 2.2), 1);

    const plinthTopMat = new THREE.MeshStandardMaterial({
      map: grassTex,
      roughness: 0.9,
      metalness: 0.0,
    });
    const plinthSideXMat = new THREE.MeshStandardMaterial({
      map: stoneSideX,
      roughness: 0.86,
      metalness: 0.02,
    });
    const plinthSideZMat = new THREE.MeshStandardMaterial({
      map: stoneSideZ,
      roughness: 0.86,
      metalness: 0.02,
    });
    const plinthBottomMat = new THREE.MeshStandardMaterial({ color: 0x3b4d3f, roughness: 1 });

    const plinthGeo = new THREE.BoxGeometry(padW, 0.86, padD);
    const plinth = new THREE.Mesh(plinthGeo, [
      plinthSideZMat,
      plinthSideZMat,
      plinthTopMat,
      plinthBottomMat,
      plinthSideXMat,
      plinthSideXMat,
    ]);
    plinth.position.y = -0.43;
    plinth.receiveShadow = true;
    this.islandGroup.add(plinth);

    // 2. Four Stone Garden Lanterns on Island Corners
    const lx = padW / 2 - 0.36;
    const lz = padD / 2 - 0.36;
    const lanternCorners: [number, number][] = [
      [-lx, -lz],
      [lx, -lz],
      [-lx, lz],
      [lx, lz],
    ];
    for (const [cx, cz] of lanternCorners) {
      const lantern = createGardenLanternGroup();
      lantern.position.set(cx, 0, cz);
      this.islandGroup.add(lantern);
    }

    // 3. Perimeter Mossy Satellite Islets with Soft Pillowy Blossom & Cypress Trees
    const halfW = padW / 2;
    const halfD = padD / 2;
    const isletSpecs: Array<{
      x: number;
      z: number;
      r: number;
      tree: 'blossom' | 'cypress';
      scale: number;
    }> = [
      { x: -halfW - 2.6, z: -halfD - 1.2, r: 1.48, tree: 'blossom', scale: 1.18 },
      { x: halfW + 2.7, z: -halfD - 0.8, r: 1.38, tree: 'cypress', scale: 1.12 },
      { x: -halfW - 2.4, z: halfD + 1.4, r: 1.32, tree: 'cypress', scale: 1.02 },
      { x: halfW + 2.5, z: halfD + 1.1, r: 1.52, tree: 'blossom', scale: 1.2 },
      { x: -halfW - 3.3, z: 0.4, r: 1.12, tree: 'blossom', scale: 0.9 },
      { x: halfW + 3.2, z: -0.3, r: 1.16, tree: 'cypress', scale: 0.94 },
    ];
    const isletStoneMat = new THREE.MeshStandardMaterial({ color: 0xe2dac7, roughness: 0.88 });
    const isletGrassMat = new THREE.MeshStandardMaterial({ color: 0x76dd52, roughness: 0.86 });
    const isletFoamMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.68,
    });

    for (const spec of isletSpecs) {
      const base = new THREE.Mesh(
        new THREE.CylinderGeometry(spec.r, spec.r * 1.18, 0.72, 9),
        isletStoneMat
      );
      base.position.set(spec.x, -0.44, spec.z);
      base.receiveShadow = true;
      this.islandGroup.add(base);

      const cap = new THREE.Mesh(
        new THREE.CylinderGeometry(spec.r * 0.96, spec.r * 1.04, 0.14, 9),
        isletGrassMat
      );
      cap.position.set(spec.x, -0.02, spec.z);
      cap.receiveShadow = true;
      this.islandGroup.add(cap);

      const isletFoam = new THREE.Mesh(
        new THREE.RingGeometry(spec.r * 1.1, spec.r * 1.36, 14),
        isletFoamMat
      );
      isletFoam.rotation.x = -Math.PI / 2;
      isletFoam.position.set(spec.x, -0.602, spec.z);
      this.islandGroup.add(isletFoam);

      const tree = createSanctuaryTreeGroup(spec.tree);
      tree.position.set(spec.x, 0.04, spec.z);
      tree.scale.setScalar(spec.scale);
      tree.rotation.y = hashCell(Math.round(spec.x * 10), Math.round(spec.z * 10)) * Math.PI * 2;
      this.islandGroup.add(tree);
    }

    // Charming curved stepping stones in front cove
    const stepStoneGeo = new THREE.CylinderGeometry(0.42, 0.48, 0.18, 8);
    const stepStoneMat = new THREE.MeshStandardMaterial({ color: 0xf2ece0, roughness: 0.84 });
    const stepCoords: [number, number][] = [
      [-1.15, halfD + 1.15],
      [0.05, halfD + 1.78],
      [1.28, halfD + 1.28],
    ];
    for (const [sx, sz] of stepCoords) {
      const stone = new THREE.Mesh(stepStoneGeo, stepStoneMat);
      stone.position.set(sx, -0.56, sz);
      stone.receiveShadow = true;
      this.islandGroup.add(stone);
    }

    // 4. Floating Water Lilies & Poppy Pink Lotuses around the turquoise moat
    const lilySpots: [number, number, boolean][] = [
      [-halfW - 1.4, -halfD + 2.4, true],
      [-halfW - 1.9, 2.8, false],
      [-halfW + 3.2, halfD + 1.4, true],
      [halfW - 3.0, halfD + 1.6, false],
      [halfW + 1.6, halfD - 2.6, true],
      [halfW + 1.9, -2.5, false],
      [halfW - 3.2, -halfD - 1.4, true],
      [-halfW + 3.6, -halfD - 1.5, false],
      [-halfW - 4.4, halfD - 1.0, true],
      [halfW + 4.3, halfD - 0.5, false],
      [0.4, -halfD - 1.9, true],
      [-2.8, halfD + 2.2, false],
    ];
    lilySpots.forEach(([lxPos, lzPos, lotus], i) => {
      const lily = createWaterLilyGroup(lotus);
      lily.position.set(lxPos, -0.61, lzPos);
      lily.rotation.y = (i * 1.17) % (Math.PI * 2);
      this.islandGroup.add(lily);
      this.lilyPads.push({
        group: lily,
        baseX: lxPos,
        baseZ: lzPos,
        phase: i * 0.9,
        bobBoost: 0,
      });
    });

    // 5. SOFT, PILLOWY Rounded Maze Shrub Instanced Meshes (velvety matte finish, zero sharp highlights!)
    const shrubBaseGeo = createPillowyShrubGeometry();
    const shrubBaseMat = new THREE.MeshStandardMaterial({
      map: this.textures.shrubSoft,
      color: 0xdff7dc,
      roughness: 0.99,
      metalness: 0.0,
    });
    this.hedgeBaseMesh = new THREE.InstancedMesh(shrubBaseGeo, shrubBaseMat, totalTiles);
    this.hedgeBaseMesh.castShadow = !this.isSoftwareGl;
    this.hedgeBaseMesh.receiveShadow = true;
    this.hedgeBaseMesh.frustumCulled = false;

    // Soft organic crown bush puffs nestled on top of every shrub tile
    const puffGeo = new THREE.IcosahedronGeometry(0.43, 1);
    puffGeo.scale(1.16, 0.52, 1.16);
    puffGeo.translate(0, 0.82, 0);
    const puffMat = new THREE.MeshStandardMaterial({
      map: this.textures.shrubSoft,
      color: 0xeefce9,
      roughness: 0.99,
      metalness: 0.0,
    });
    this.hedgePuffMesh = new THREE.InstancedMesh(puffGeo, puffMat, totalTiles);
    this.hedgePuffMesh.castShadow = !this.isSoftwareGl;
    this.hedgePuffMesh.receiveShadow = true;
    this.hedgePuffMesh.frustumCulled = false;

    // Tiny poppy pastel blossom accents nestled on ~35% of soft shrub tops
    const shrubBudGeo = new THREE.BoxGeometry(0.14, 0.1, 0.14);
    const shrubBudMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.45,
      emissive: 0x221018,
      emissiveIntensity: 0.12,
    });
    this.hedgeBudMesh = new THREE.InstancedMesh(shrubBudGeo, shrubBudMat, totalTiles);
    this.hedgeBudMesh.frustumCulled = false;

    // BFS Living Mint-Dew Moss Carpet
    const mossGeo = new THREE.BoxGeometry(0.94, 0.06, 0.94);
    mossGeo.translate(0, 0.03, 0);
    const mossMat = new THREE.MeshStandardMaterial({
      map: this.textures.mossPath,
      roughness: 0.72,
      metalness: 0.02,
    });
    this.mossMesh = new THREE.InstancedMesh(mossGeo, mossMat, totalTiles);
    this.mossMesh.receiveShadow = true;
    this.mossMesh.frustumCulled = false;

    // BFS Forget-me-not Sky-Blue Dew Buds
    const budStemGeo = new THREE.BoxGeometry(0.07, 0.24, 0.07);
    budStemGeo.translate(0, 0.12, 0);
    const budStemMat = new THREE.MeshStandardMaterial({ color: 0x2fa067, roughness: 0.8 });
    this.bfsBudStemMesh = new THREE.InstancedMesh(budStemGeo, budStemMat, totalTiles);
    this.bfsBudStemMesh.frustumCulled = false;

    const budHeadGeo = new THREE.BoxGeometry(0.22, 0.16, 0.22);
    budHeadGeo.translate(0, 0.26, 0);
    const budHeadMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.35,
      emissive: 0x38bdf8,
      emissiveIntensity: 0.25,
    });
    this.bfsBudHeadMesh = new THREE.InstancedMesh(budHeadGeo, budHeadMat, totalTiles);
    this.bfsBudHeadMesh.frustumCulled = false;

    // Shortest Path Living Vines + Bold Poppy Multi-Bloom Wildflowers (3 per path tile)
    const vineGeo = new THREE.BoxGeometry(0.92, 0.14, 0.92);
    vineGeo.translate(0, 0.07, 0);
    const vineMat = new THREE.MeshStandardMaterial({
      color: 0x38c765,
      roughness: 0.68,
      emissive: 0x166534,
      emissiveIntensity: 0.16,
    });
    this.pathVineMesh = new THREE.InstancedMesh(vineGeo, vineMat, totalTiles);
    this.pathVineMesh.frustumCulled = false;

    const pStemGeo = new THREE.BoxGeometry(0.08, 0.42, 0.08);
    pStemGeo.translate(0, 0.21, 0);
    const pStemMat = new THREE.MeshStandardMaterial({ color: 0x2d9946, roughness: 0.78 });
    this.pathFlowerStemMesh = new THREE.InstancedMesh(pStemGeo, pStemMat, totalTiles * 3);
    this.pathFlowerStemMesh.frustumCulled = false;

    const pPetalGeo = new THREE.BoxGeometry(0.4, 0.14, 0.4);
    const pPetalMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.38,
      emissive: 0x241016,
      emissiveIntensity: 0.14,
    });
    this.pathFlowerPetalMesh = new THREE.InstancedMesh(pPetalGeo, pPetalMat, totalTiles * 3);
    this.pathFlowerPetalMesh.frustumCulled = false;

    const pCoreGeo = new THREE.BoxGeometry(0.16, 0.17, 0.16);
    const pCoreMat = new THREE.MeshStandardMaterial({
      color: 0xfde047,
      roughness: 0.26,
      emissive: 0xca8a04,
      emissiveIntensity: 0.28,
    });
    this.pathFlowerCoreMesh = new THREE.InstancedMesh(pCoreGeo, pCoreMat, totalTiles * 3);
    this.pathFlowerCoreMesh.frustumCulled = false;

    this.mazeGroup.add(
      this.hedgeBaseMesh,
      this.hedgePuffMesh,
      this.hedgeBudMesh,
      this.mossMesh,
      this.bfsBudStemMesh,
      this.bfsBudHeadMesh,
      this.pathVineMesh,
      this.pathFlowerStemMesh,
      this.pathFlowerPetalMesh,
      this.pathFlowerCoreMesh
    );

    // Initialize tile animation buffers
    this.wallClosedFlags = new Uint8Array(totalTiles);
    this.hedgeScale = new Float32Array(totalTiles);
    this.hedgeWobble = new Float32Array(totalTiles);
    this.mossTarget = new Float32Array(totalTiles);
    this.mossScale = new Float32Array(totalTiles);
    this.frontierFlags = new Uint8Array(totalTiles);
    this.pathTarget = new Float32Array(totalTiles);
    this.pathScale = new Float32Array(totalTiles);
    this.pathOrder = new Float32Array(totalTiles);

    // Soft velvety sage-emerald harmonies across shrubs (slightly richer than bright meadow grass for clear maze reading!)
    for (let i = 0; i < totalTiles; i++) {
      const tr = Math.floor(i / this.tileCols);
      const tc = i % this.tileCols;
      const h = hashCell(tr, tc);
      this.scratchColor.setRGB(0.72 + h * 0.14, 0.88 + h * 0.09, 0.74 + h * 0.12);
      this.hedgeBaseMesh.setColorAt(i, this.scratchColor);
      this.scratchColor.setRGB(0.84 + h * 0.12, 0.96 + h * 0.06, 0.82 + h * 0.1);
      this.hedgePuffMesh.setColorAt(i, this.scratchColor);

      const budCol = FLOWER_PALETTE[Math.floor(h * FLOWER_PALETTE.length)];
      this.scratchColor.setHex(budCol);
      this.hedgeBudMesh.setColorAt(i, this.scratchColor);
    }
    if (this.hedgeBaseMesh.instanceColor) this.hedgeBaseMesh.instanceColor.needsUpdate = true;
    if (this.hedgePuffMesh.instanceColor) this.hedgePuffMesh.instanceColor.needsUpdate = true;
    if (this.hedgeBudMesh.instanceColor) this.hedgeBudMesh.instanceColor.needsUpdate = true;

    // 6. Gliding Articulated Bluebirds (3)
    const birdSpecs = [
      { rx: halfW * 0.72, rz: halfD * 0.68, y: 3.1, speed: 0.42, phase: 0.4 },
      { rx: halfW * 0.92, rz: halfD * 0.52, y: 3.85, speed: -0.34, phase: 2.6 },
      { rx: halfW * 0.56, rz: halfD * 0.88, y: 2.75, speed: 0.5, phase: 4.5 },
    ];
    for (const bs of birdSpecs) {
      const bird = createBluebirdGroup();
      this.wildlifeGroup.add(bird.group);
      this.birds.push({
        bird,
        orbitRx: bs.rx,
        orbitRz: bs.rz,
        baseY: bs.y,
        speed: bs.speed,
        phase: bs.phase,
        swoop: 0,
      });
    }

    // 7. Fluttering Poppy Pastel Butterflies (4)
    const bfColors = [0xfde047, 0xff7eb6, 0x7cc2ff, 0xd884fc];
    for (let i = 0; i < 4; i++) {
      const bf = createButterflyGroup(bfColors[i]);
      this.wildlifeGroup.add(bf.group);
      const cx = (i % 2 === 0 ? -1 : 1) * (halfW * 0.35);
      const cz = (i < 2 ? -1 : 1) * (halfD * 0.35);
      this.butterflies.push({
        bf,
        centerX: cx,
        centerZ: cz,
        radius: 2.2 + i * 0.45,
        baseY: 1.35 + (i % 2) * 0.35,
        speed: 0.85 + i * 0.14,
        phase: i * 1.6,
      });
    }

    // 8. Seed vibrant poppy meadow wildflowers across open chambers (like reference image 2!)
    const seedCount = Math.min(22, Math.floor((grid.rows * grid.cols) / 6));
    for (let i = 0; i < seedCount; i++) {
      const r = Math.floor(hashCell(i, 17) * grid.rows);
      const c = Math.floor(hashCell(i, 31) * grid.cols);
      if ((r === 0 && c === 0) || (r === grid.rows - 1 && c === grid.cols - 1)) continue;
      const p = this.cellToWorld({ row: r, col: c });
      this.interactiveBlooms.push({
        x: p.x + (hashCell(i, 41) - 0.5) * 0.44,
        z: p.z + (hashCell(i, 43) - 0.5) * 0.44,
        scale: 1,
        targetScale: 1,
        colorHex: FLOWER_PALETTE[i % FLOWER_PALETTE.length],
        rotY: hashCell(i, 53) * Math.PI * 2,
        seed: i * 1.3,
      });
    }
  }

  private syncStateToTargets(st: DreamSceneState, immediate: boolean): void {
    const matrix = buildTileWallMatrix(st.grid);
    const total = this.tileRows * this.tileCols;

    this.mossTarget.fill(0);
    this.frontierFlags.fill(0);
    this.pathTarget.fill(0);
    this.pathOrder.fill(0);

    for (let tr = 0; tr < this.tileRows; tr++) {
      for (let tc = 0; tc < this.tileCols; tc++) {
        const idx = tr * this.tileCols + tc;
        const closed = matrix[tr][tc] ? 1 : 0;
        this.wallClosedFlags[idx] = closed;
        if (immediate) {
          this.hedgeScale[idx] = closed;
        }
      }
    }

    if (st.bfsSnapshot) {
      const snap = st.bfsSnapshot;
      const cols = st.grid.cols;
      for (const [cIdx] of snap.visitedDistances) {
        const r = Math.floor(cIdx / cols);
        const c = cIdx % cols;
        const tr = 2 * r + 1;
        const tc = 2 * c + 1;
        const tileIdx = tr * this.tileCols + tc;
        this.mossTarget[tileIdx] = 1;
        if (snap.frontierSet.has(cIdx) || snap.currentCellIdx === cIdx) {
          this.frontierFlags[tileIdx] = 1;
        }

        const w = st.grid.walls[cIdx];
        if (!w.east && c + 1 < cols && snap.visitedDistances.has(cellIndex(r, c + 1, cols))) {
          const bridgeIdx = tr * this.tileCols + (tc + 1);
          this.mossTarget[bridgeIdx] = 1;
        }
        if (!w.south && r + 1 < st.grid.rows && snap.visitedDistances.has(cellIndex(r + 1, c, cols))) {
          const bridgeIdx = (tr + 1) * this.tileCols + tc;
          this.mossTarget[bridgeIdx] = 1;
        }
      }

      const path = snap.bloomedPath;
      for (let i = 0; i < path.length; i++) {
        const cell = path[i];
        const tr = 2 * cell.row + 1;
        const tc = 2 * cell.col + 1;
        const tileIdx = tr * this.tileCols + tc;
        this.pathTarget[tileIdx] = 1;
        this.pathOrder[tileIdx] = i / Math.max(1, path.length - 1);

        if (i + 1 < path.length) {
          const next = path[i + 1];
          const bTr = tr + (next.row - cell.row);
          const bTc = tc + (next.col - cell.col);
          const bIdx = bTr * this.tileCols + bTc;
          this.pathTarget[bIdx] = 1;
          this.pathOrder[bIdx] = (i + 0.5) / Math.max(1, path.length - 1);
        }
      }
    }

    if (immediate) {
      for (let i = 0; i < total; i++) {
        this.mossScale[i] = this.mossTarget[i];
        this.pathScale[i] = this.pathTarget[i];
      }
    }

    const sPos = this.cellToWorld(st.start);
    this.startNest.position.set(sPos.x, this.startLift, sPos.z);

    const gPos = this.cellToWorld(st.goal);
    this.goalShrine.position.set(gPos.x, this.goalLift, gPos.z);
  }

  private fitCameraForViewport(width: number, height: number): void {
    const aspect = width / height;
    const isPortrait = aspect < 0.85;
    const targetFov = isPortrait ? 44 : 34;
    if (this.camera.fov !== targetFov) {
      this.camera.fov = targetFov;
    }

    const islandW = this.tileCols + (isPortrait ? 3.5 : 6.5);
    const islandD = this.tileRows + (isPortrait ? 4.0 : 5.5);
    const vFovRad = THREE.MathUtils.degToRad(this.camera.fov);
    const hFovRad = 2 * Math.atan(Math.tan(vFovRad / 2) * aspect);

    const distForH = (islandD * 0.58) / Math.tan(vFovRad / 2);
    const distForW = (islandW * 0.56) / Math.tan(hFovRad / 2);
    this.defaultDistance = Math.max(distForH, distForW, 17);
    this.camDistance = this.defaultDistance * this.zoomFactor;

    this.camera.far = Math.max(260, this.defaultDistance * 8);
    this.camera.updateProjectionMatrix();
    this.updateFogForDistance();

    this.lookTarget.set(0, 0.1, isPortrait ? 0.2 : 0.42);
  }

  private updateFogForDistance(): void {
    if (this.scene.fog instanceof THREE.Fog) {
      const refDist = Math.max(this.defaultDistance, this.camDistance);
      this.scene.fog.near = refDist * 2.0;
      this.scene.fog.far = refDist * 4.8;
    }
  }

  private updateCameraTransform(): void {
    const sinP = Math.sin(this.polar);
    const cosP = Math.cos(this.polar);
    const sinA = Math.sin(this.azimuth);
    const cosA = Math.cos(this.azimuth);

    this.camera.position.set(
      this.lookTarget.x + this.camDistance * sinP * sinA,
      this.lookTarget.y + this.camDistance * cosP,
      this.lookTarget.z + this.camDistance * sinP * cosA
    );
    this.camera.lookAt(this.lookTarget);
  }

  private spawnParticles(
    x: number,
    y: number,
    z: number,
    count: number,
    palette: number[],
    speed = 1.8
  ): void {
    let spawned = 0;
    for (let i = 0; i < this.particles.length && spawned < count; i++) {
      const p = this.particles[i];
      if (!p.active) {
        p.active = true;
        const a = Math.random() * Math.PI * 2;
        const spd = (0.35 + Math.random() * 0.85) * speed;
        p.x = x + (Math.random() - 0.5) * 0.35;
        p.y = y + Math.random() * 0.25;
        p.z = z + (Math.random() - 0.5) * 0.35;
        p.vx = Math.cos(a) * spd;
        p.vy = 1.4 + Math.random() * 1.9;
        p.vz = Math.sin(a) * spd;
        p.rotX = Math.random() * Math.PI;
        p.rotY = Math.random() * Math.PI;
        p.vRot = (Math.random() - 0.5) * 8;
        p.size = 0.78 + Math.random() * 0.78;
        p.age = 0;
        p.life = 0.72 + Math.random() * 0.55;
        p.color.setHex(palette[Math.floor(Math.random() * palette.length)]);
        spawned++;
      }
    }
  }

  private spawnRipple(x: number, y: number, z: number, maxScale = 3.2, colorHex = 0xffffff): void {
    for (let i = 0; i < this.ripples.length; i++) {
      const r = this.ripples[i];
      if (!r.active) {
        r.active = true;
        r.x = x;
        r.y = y;
        r.z = z;
        r.age = 0;
        r.life = 1.05;
        r.maxScale = maxScale;
        r.mat.color.setHex(colorHex);
        r.mesh.position.set(x, y, z);
        r.mesh.scale.setScalar(0.35);
        r.mesh.visible = true;
        return;
      }
    }
  }

  private plantInteractiveFlower(x: number, z: number): void {
    const colorHex = FLOWER_PALETTE[Math.floor(Math.random() * FLOWER_PALETTE.length)];
    const bloom: InteractiveBloom = {
      x,
      z,
      scale: 0.05,
      targetScale: 1.05 + Math.random() * 0.28,
      colorHex,
      rotY: Math.random() * Math.PI * 2,
      seed: Math.random() * 10,
    };
    if (this.interactiveBlooms.length >= this.maxUserBlooms) {
      this.interactiveBlooms.shift();
    }
    this.interactiveBlooms.push(bloom);
  }

  private setPointerNdc(e: PointerEvent): void {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  }

  private intersectPlane(plane: THREE.Plane): THREE.Vector3 | null {
    this.raycaster.setFromCamera(this.pointerNdc, this.camera);
    const hit = this.raycaster.ray.intersectPlane(plane, this.scratchVec);
    return hit ? hit.clone() : null;
  }

  private onWheel(e: WheelEvent): void {
    if (this.projectionMode !== '2.5d') return;
    e.preventDefault();
    const step = Math.sign(e.deltaY) * Math.min(0.14, Math.abs(e.deltaY) * 0.0012);
    this.targetZoomFactor = THREE.MathUtils.clamp(this.targetZoomFactor + step, 0.48, 1.6);
    this.callbacks.onCameraStateChange?.(
      this.dragKind === 'camera' && this.pointerDown,
      Math.round(THREE.MathUtils.radToDeg(this.targetAzimuth)),
      Number(this.targetZoomFactor.toFixed(2))
    );
  }

  private onPointerDown(e: PointerEvent): void {
    if (this.projectionMode !== '2.5d') return;
    if (e.button !== 0 && e.pointerType === 'mouse') return;

    this.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.activePointers.size === 2) {
      const pts = Array.from(this.activePointers.values());
      this.lastPinchDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      this.dragKind = 'none';
      return;
    }

    this.setPointerNdc(e);
    this.pointerDown = true;
    this.lastPointerX = e.clientX;
    this.lastPointerY = e.clientY;
    this.pointerMovedDist = 0;

    const hitGround = this.intersectPlane(this.groundPlane);
    if (hitGround) {
      const sDist = Math.hypot(
        hitGround.x - this.startNest.position.x,
        hitGround.z - this.startNest.position.z
      );
      const gDist = Math.hypot(
        hitGround.x - this.goalShrine.position.x,
        hitGround.z - this.goalShrine.position.z
      );
      if (sDist < 0.78) {
        this.dragKind = 'start';
        triggerHaptic('dragPickup');
        audioEngine.playSoftClick();
        return;
      }
      if (gDist < 0.78) {
        this.dragKind = 'goal';
        triggerHaptic('dragPickup');
        audioEngine.playSoftClick();
        return;
      }
    }

    this.dragKind = 'camera';
  }

  private onPointerMove(e: PointerEvent): void {
    if (this.projectionMode !== '2.5d') return;

    // Two-finger pinch zoom on touch devices
    if (this.activePointers.has(e.pointerId)) {
      this.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.activePointers.size === 2 && this.lastPinchDist !== null) {
        const pts = Array.from(this.activePointers.values());
        const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        const delta = this.lastPinchDist - dist;
        this.lastPinchDist = dist;
        this.targetZoomFactor = THREE.MathUtils.clamp(
          this.targetZoomFactor + delta * 0.003,
          0.48,
          1.6
        );
        this.callbacks.onCameraStateChange?.(
          false,
          Math.round(THREE.MathUtils.radToDeg(this.targetAzimuth)),
          Number(this.targetZoomFactor.toFixed(2))
        );
        return;
      }
    }

    this.setPointerNdc(e);

    if (this.pointerDown) {
      const dx = e.clientX - this.lastPointerX;
      const dy = e.clientY - this.lastPointerY;
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;
      this.pointerMovedDist += Math.hypot(dx, dy);

      if (this.dragKind === 'camera') {
        this.targetAzimuth = THREE.MathUtils.clamp(
          this.targetAzimuth - dx * 0.0068,
          -1.08,
          1.08
        );
        this.targetPolar = THREE.MathUtils.clamp(
          this.targetPolar - dy * 0.0052,
          0.32,
          1.12
        );
        if (this.pointerMovedDist > 6) {
          this.callbacks.onCameraStateChange?.(
            true,
            Math.round(THREE.MathUtils.radToDeg(this.targetAzimuth)),
            Number(this.targetZoomFactor.toFixed(2))
          );
        }
        return;
      }

      if (this.dragKind === 'start' || this.dragKind === 'goal') {
        const hit = this.intersectPlane(this.groundPlane);
        if (hit) {
          const cell = this.worldToCell(hit.x, hit.z);
          if (cell) {
            if (
              this.dragKind === 'start' &&
              (cell.row !== this.state.start.row || cell.col !== this.state.start.col) &&
              !(cell.row === this.state.goal.row && cell.col === this.state.goal.col)
            ) {
              this.callbacks.onMoveStart(cell);
              triggerHaptic('tap', 60);
            } else if (
              this.dragKind === 'goal' &&
              (cell.row !== this.state.goal.row || cell.col !== this.state.goal.col) &&
              !(cell.row === this.state.start.row && cell.col === this.state.start.col)
            ) {
              this.callbacks.onMoveGoal(cell);
              triggerHaptic('tap', 60);
            }
          }
        }
        return;
      }
    }

    // Hover feedback (meadow halo + pollen motes, water crystal ripples)
    const now = performance.now();
    const hitGround = this.intersectPlane(this.groundPlane);
    if (hitGround) {
      const tile = this.worldToTile(hitGround.x, hitGround.z);
      if (tile) {
        const pos = this.tileToWorld(tile.tr, tile.tc);
        const idx = tile.tr * this.tileCols + tile.tc;
        const isWall = this.wallClosedFlags[idx] === 1;
        this.cursorHalo.visible = !isWall;
        this.cursorHalo.position.set(pos.x, 0.045, pos.z);

        if (!isWall && now - this.lastHoverPollenTime > 160) {
          this.lastHoverPollenTime = now;
          this.spawnParticles(hitGround.x, 0.14, hitGround.z, 1, [0xfef08a, 0xff99c8, 0xffffff], 0.55);
        }
        return;
      }
    }

    this.cursorHalo.visible = false;
    const hitWater = this.intersectPlane(this.waterPlane);
    if (hitWater && now - this.lastHoverRippleTime > 190) {
      this.lastHoverRippleTime = now;
      this.spawnRipple(hitWater.x, -0.59, hitWater.z, 2.4, 0xffffff);
      audioEngine.playWaterDrop(0.95);
    }
  }

  private onPointerUp(e: PointerEvent): void {
    this.activePointers.delete(e.pointerId);
    if (this.activePointers.size < 2) {
      this.lastPinchDist = null;
    }

    if (!this.pointerDown) return;
    const wasClick = this.pointerMovedDist < 7;
    const kind = this.dragKind;

    this.pointerDown = false;
    this.dragKind = 'none';

    if (kind === 'start' || kind === 'goal') {
      triggerHaptic('dragDrop');
      audioEngine.playInteractiveBloom();
    }

    // Spring-back camera lock on release (preserves user scroll zoom!)
    if (kind === 'camera' && this.projectionMode === '2.5d') {
      this.targetAzimuth = this.defaultAzimuth;
      this.targetPolar = this.defaultPolar;
      this.callbacks.onCameraStateChange?.(false, 0, Number(this.targetZoomFactor.toFixed(2)));
    }

    if (wasClick && kind === 'camera' && this.projectionMode === '2.5d') {
      this.handleSceneClick(e);
    }
  }

  private handleSceneClick(e: PointerEvent): void {
    this.setPointerNdc(e);

    // 1. Clicking near a gliding bluebird
    this.raycaster.setFromCamera(this.pointerNdc, this.camera);
    for (const bf of this.birds) {
      const dist = this.raycaster.ray.distanceToPoint(bf.bird.group.position);
      if (dist < 0.98) {
        bf.swoop = 1.0;
        this.spawnParticles(
          bf.bird.group.position.x,
          bf.bird.group.position.y,
          bf.bird.group.position.z,
          10,
          [0x7cc2ff, 0xffffff, 0xfde047],
          2.0
        );
        audioEngine.playBirdChirp();
        triggerHaptic('birdChirp');
        this.callbacks.onInteractionFeedback?.('Bluebird swoops over the hedges');
        return;
      }
    }

    // 2. Clicking garden tile (open meadow -> bloom wildflower; soft shrub -> bounce + leaves)
    const hitGround = this.intersectPlane(this.groundPlane);
    if (hitGround) {
      const tile = this.worldToTile(hitGround.x, hitGround.z);
      if (tile) {
        const idx = tile.tr * this.tileCols + tile.tc;
        const pos = this.tileToWorld(tile.tr, tile.tc);
        if (this.wallClosedFlags[idx] === 1) {
          this.hedgeWobble[idx] = 1.0;
          this.spawnParticles(pos.x, 0.85, pos.z, 12, LEAF_PALETTE, 2.1);
          audioEngine.playLeafRustle(0.06);
          triggerHaptic('hedgeShake');
          this.callbacks.onInteractionFeedback?.('Soft shrubs rustle in the breeze');
          return;
        } else {
          this.plantInteractiveFlower(hitGround.x, hitGround.z);
          this.spawnParticles(hitGround.x, 0.25, hitGround.z, 12, FLOWER_PALETTE, 2.0);
          this.spawnRipple(hitGround.x, 0.05, hitGround.z, 1.4, 0xfef08a);
          audioEngine.playInteractiveBloom();
          triggerHaptic('bloom');
          this.callbacks.onInteractionFeedback?.('Poppy wildflowers bloomed in the meadow');
          return;
        }
      }
    }

    // 3. Clicking floating water lilies or open turquoise caustic water
    const hitWater = this.intersectPlane(this.waterPlane);
    if (hitWater) {
      for (const pad of this.lilyPads) {
        if (Math.hypot(hitWater.x - pad.baseX, hitWater.z - pad.baseZ) < 0.95) {
          pad.bobBoost = 1.0;
          this.spawnRipple(pad.baseX, -0.585, pad.baseZ, 3.6, 0xffffff);
          this.spawnParticles(pad.baseX, -0.45, pad.baseZ, 7, [0xff7eb6, 0xcaf7ff], 1.5);
          audioEngine.playWaterDrop(1.22);
          triggerHaptic('waterRipple');
          this.callbacks.onInteractionFeedback?.('Lotus lily ripples across the cove');
          return;
        }
      }

      this.spawnRipple(hitWater.x, -0.59, hitWater.z, 3.8, 0xffffff);
      audioEngine.playWaterDrop(1.0);
      triggerHaptic('waterRipple');
      this.callbacks.onInteractionFeedback?.('Ripples drift across the sunlit water');
    }
  }

  private renderFrame(): void {
    if (this.disposed || this.contextLost || this.paused) return;

    const now = performance.now();
    const dt = Math.min((now - this.lastTimeMs) / 1000, 0.05);
    this.lastTimeMs = now;
    this.elapsed += dt;
    const t = this.elapsed;

    // 1. Smooth 2.5D <-> 2D morph blend, orbit spring-back, and scroll zoom damping
    const blendTarget = this.projectionMode === '2d' ? 1 : 0;
    this.viewBlend += (blendTarget - this.viewBlend) * (1 - Math.exp(-8.5 * dt));

    const camLerp = this.dragKind === 'camera' ? 1 - Math.exp(-16 * dt) : 1 - Math.exp(-8.0 * dt);
    this.azimuth += (this.targetAzimuth - this.azimuth) * camLerp;
    this.polar += (this.targetPolar - this.polar) * camLerp;
    this.zoomFactor += (this.targetZoomFactor - this.zoomFactor) * (1 - Math.exp(-11 * dt));

    if (this.dragKind !== 'camera' && this.projectionMode === '2.5d') {
      if (Math.abs(this.azimuth - this.defaultAzimuth) < 0.001) {
        this.azimuth = this.defaultAzimuth;
      }
      if (Math.abs(this.polar - this.defaultPolar) < 0.001) {
        this.polar = this.defaultPolar;
      }
    }

    this.camDistance = this.defaultDistance * this.zoomFactor;
    this.updateFogForDistance();
    this.updateCameraTransform();

    // 2. Animate Realistic Pixel Voronoi Caustic Water Shader
    this.waterMat.uniforms.uTime.value = t;

    // 3. Bobbing Water Lilies
    for (const pad of this.lilyPads) {
      pad.bobBoost = Math.max(0, pad.bobBoost - dt * 2.2);
      const bob =
        Math.sin(t * 1.8 + pad.phase) * 0.028 +
        Math.sin(pad.bobBoost * Math.PI * 3) * pad.bobBoost * 0.13;
      pad.group.position.y = -0.61 + bob;
      pad.group.rotation.z = Math.sin(t * 1.4 + pad.phase) * 0.05;
    }

    // 4. Start Nest & Goal Sun Shrine living animations
    const targetStartLift = this.dragKind === 'start' ? 0.45 : 0;
    const targetGoalLift = this.dragKind === 'goal' ? 0.45 : 0;
    this.startLift += (targetStartLift - this.startLift) * Math.min(1, dt * 14);
    this.goalLift += (targetGoalLift - this.goalLift) * Math.min(1, dt * 14);
    this.startNest.position.y = this.startLift;
    this.goalShrine.position.y = this.goalLift;

    const sunCrown = this.goalShrine.getObjectByName('SunCrown');
    if (sunCrown) {
      sunCrown.rotation.y = t * 0.75;
      sunCrown.position.y = 0.84 + Math.sin(t * 2.4) * 0.05;
    }
    const startHalo = this.startNest.getObjectByName('BeaconHalo');
    if (startHalo) {
      startHalo.scale.setScalar(1 + Math.sin(t * 2.6) * 0.06 + this.startLift * 0.4);
    }
    const goalHalo = this.goalShrine.getObjectByName('BeaconHalo');
    if (goalHalo) {
      goalHalo.scale.setScalar(1 + Math.cos(t * 2.6) * 0.06 + this.goalLift * 0.4);
    }

    // 5. Update Soft Pillowy Shrubs, BFS Moss/Buds, and Poppy Blooming Wildflowers
    const total = this.tileRows * this.tileCols;
    const growthRate = Math.min(1, dt * 12);
    // Gently flatten shrubs vertically during 2.5D -> 2D morph for seamless transition
    const morphHeightMul = 1.0 - this.viewBlend * 0.72;

    if (
      this.hedgeBaseMesh &&
      this.hedgePuffMesh &&
      this.hedgeBudMesh &&
      this.mossMesh &&
      this.bfsBudStemMesh &&
      this.bfsBudHeadMesh &&
      this.pathVineMesh &&
      this.pathFlowerStemMesh &&
      this.pathFlowerPetalMesh &&
      this.pathFlowerCoreMesh
    ) {
      for (let i = 0; i < total; i++) {
        const tr = Math.floor(i / this.tileCols);
        const tc = i % this.tileCols;
        const wx = tc - (this.tileCols - 1) / 2;
        const wz = tr - (this.tileRows - 1) / 2;

        const targetH = this.wallClosedFlags[i];
        this.hedgeScale[i] += (targetH - this.hedgeScale[i]) * growthRate;
        if (this.hedgeWobble[i] > 0.001) {
          this.hedgeWobble[i] = Math.max(0, this.hedgeWobble[i] - dt * 2.6);
        }

        const hs = this.hedgeScale[i];
        if (hs > 0.02) {
          const wob = this.hedgeWobble[i];
          const squash = wob > 0 ? Math.sin(wob * Math.PI * 5) * wob * 0.16 : 0;
          const sway = Math.sin(t * 1.4 + tr * 0.7 + tc * 0.5) * 0.014;
          const hRand = hashCell(tr, tc);
          const heightVar = 0.92 + hRand * 0.16;

          // Pillowy rounded shrub cushion base
          this.scratchObj.position.set(wx, 0, wz);
          this.scratchObj.rotation.set(sway, 0, sway * 0.7 + squash * 0.5);
          this.scratchObj.scale.set(
            1 + squash * 0.45,
            hs * heightVar * morphHeightMul * (1 - squash * 0.35),
            1 + squash * 0.45
          );
          this.scratchObj.updateMatrix();
          this.hedgeBaseMesh.setMatrixAt(i, this.scratchObj.matrix);

          // Organic rounded puff crown (slightly rotated per tile for soft lush variety)
          this.scratchObj.position.set(
            wx + (hRand - 0.5) * 0.08,
            0,
            wz + (hashCell(tc, tr) - 0.5) * 0.08
          );
          this.scratchObj.rotation.set(sway, hRand * Math.PI * 2, sway * 0.6 + squash * 0.5);
          this.scratchObj.scale.set(
            (0.95 + hRand * 0.14) * (1 + squash * 0.5),
            hs * heightVar * morphHeightMul * (1 - squash * 0.35),
            (0.95 + hashCell(tc, tr) * 0.14) * (1 + squash * 0.5)
          );
          this.scratchObj.updateMatrix();
          this.hedgePuffMesh.setMatrixAt(i, this.scratchObj.matrix);

          // Occasional dainty poppy flower bud tucked on top of soft shrubs
          if (hRand > 0.66) {
            const budY = 1.04 * hs * heightVar * morphHeightMul;
            this.scratchObj.position.set(
              wx + (hRand - 0.8) * 0.55,
              budY,
              wz + (hashCell(tc + 3, tr) - 0.5) * 0.36
            );
            this.scratchObj.rotation.set(0, hRand * 6.28, 0);
            this.scratchObj.scale.setScalar(hs * (1 - this.viewBlend * 0.8));
            this.scratchObj.updateMatrix();
            this.hedgeBudMesh.setMatrixAt(i, this.scratchObj.matrix);
          } else {
            this.scratchObj.position.set(wx, -10, wz);
            this.scratchObj.scale.setScalar(0.0001);
            this.scratchObj.updateMatrix();
            this.hedgeBudMesh.setMatrixAt(i, this.scratchObj.matrix);
          }
        } else {
          this.scratchObj.position.set(wx, -10, wz);
          this.scratchObj.scale.setScalar(0.0001);
          this.scratchObj.updateMatrix();
          this.hedgeBaseMesh.setMatrixAt(i, this.scratchObj.matrix);
          this.hedgePuffMesh.setMatrixAt(i, this.scratchObj.matrix);
          this.hedgeBudMesh.setMatrixAt(i, this.scratchObj.matrix);
        }

        // BFS Living Mint Moss & Forget-Me-Not Dew Buds
        this.mossScale[i] += (this.mossTarget[i] - this.mossScale[i]) * growthRate;
        const ms = this.mossScale[i];
        if (ms > 0.02) {
          const isFront = this.frontierFlags[i] === 1;
          const pulse = isFront ? 1.0 + Math.sin(t * 6.0 + i) * 0.12 : 1.0;

          this.scratchObj.position.set(wx, 0, wz);
          this.scratchObj.rotation.set(0, 0, 0);
          this.scratchObj.scale.set(ms, ms * pulse, ms);
          this.scratchObj.updateMatrix();
          this.mossMesh.setMatrixAt(i, this.scratchObj.matrix);

          const h = hashCell(tr, tc);
          const bx = wx + (h - 0.5) * 0.42;
          const bz = wz + (hashCell(tc, tr) - 0.5) * 0.42;
          const bSway = Math.sin(t * 2.8 + i) * 0.1;
          this.scratchObj.position.set(bx, 0.03, bz);
          this.scratchObj.rotation.set(bSway, h * Math.PI * 2, bSway * 0.6);
          const budS = ms * (isFront ? 1.25 : 0.94);
          this.scratchObj.scale.setScalar(budS);
          this.scratchObj.updateMatrix();
          this.bfsBudStemMesh.setMatrixAt(i, this.scratchObj.matrix);
          this.bfsBudHeadMesh.setMatrixAt(i, this.scratchObj.matrix);

          this.scratchColor.setHex(isFront ? 0x7dd3fc : h > 0.5 ? 0x93c5fd : 0x6ee7b7);
          this.bfsBudHeadMesh.setColorAt(i, this.scratchColor);
        } else {
          this.scratchObj.position.set(wx, -10, wz);
          this.scratchObj.scale.setScalar(0.0001);
          this.scratchObj.updateMatrix();
          this.mossMesh.setMatrixAt(i, this.scratchObj.matrix);
          this.bfsBudStemMesh.setMatrixAt(i, this.scratchObj.matrix);
          this.bfsBudHeadMesh.setMatrixAt(i, this.scratchObj.matrix);
        }

        // Shortest Path Living Vines & Bold Poppy Wildflowers
        this.pathScale[i] += (this.pathTarget[i] - this.pathScale[i]) * Math.min(1, dt * 10);
        const ps = this.pathScale[i];
        if (ps > 0.02) {
          const elastic = ps < 0.98 ? ps * (1 + Math.sin(ps * Math.PI) * 0.25) : 1.0;
          this.scratchObj.position.set(wx, 0.02, wz);
          this.scratchObj.rotation.set(0, 0, 0);
          this.scratchObj.scale.set(elastic, elastic, elastic);
          this.scratchObj.updateMatrix();
          this.pathVineMesh.setMatrixAt(i, this.scratchObj.matrix);

          for (let f = 0; f < 3; f++) {
            const slot = i * 3 + f;
            const fh1 = hashCell(tr * 3 + f, tc * 5 + 1);
            const fh2 = hashCell(tc * 7 + f, tr * 3 + 2);
            const fx = wx + (fh1 - 0.5) * 0.58;
            const fz = wz + (fh2 - 0.5) * 0.58;
            const sway = Math.sin(t * 2.4 + slot * 0.7) * 0.12;
            const fHeight = (0.85 + fh1 * 0.45) * elastic;

            this.scratchObj.position.set(fx, 0.06, fz);
            this.scratchObj.rotation.set(sway, fh2 * Math.PI * 2, sway * 0.6);
            this.scratchObj.scale.set(elastic, fHeight, elastic);
            this.scratchObj.updateMatrix();
            this.pathFlowerStemMesh.setMatrixAt(slot, this.scratchObj.matrix);

            this.scratchObj.position.set(fx, 0.06 + 0.41 * fHeight, fz);
            this.scratchObj.rotation.set(sway, t * 0.4 + fh1 * 6.28, sway * 0.5);
            this.scratchObj.scale.setScalar(elastic * (0.94 + fh2 * 0.36));
            this.scratchObj.updateMatrix();
            this.pathFlowerPetalMesh.setMatrixAt(slot, this.scratchObj.matrix);

            this.scratchObj.position.set(fx, 0.11 + 0.41 * fHeight, fz);
            this.scratchObj.scale.setScalar(elastic);
            this.scratchObj.updateMatrix();
            this.pathFlowerCoreMesh.setMatrixAt(slot, this.scratchObj.matrix);

            const colIdx =
              Math.floor((fh1 + this.pathOrder[i]) * FLOWER_PALETTE.length) %
              FLOWER_PALETTE.length;
            this.scratchColor.setHex(FLOWER_PALETTE[colIdx]);
            this.pathFlowerPetalMesh.setColorAt(slot, this.scratchColor);
          }
        } else {
          this.scratchObj.position.set(wx, -10, wz);
          this.scratchObj.scale.setScalar(0.0001);
          this.scratchObj.updateMatrix();
          this.pathVineMesh.setMatrixAt(i, this.scratchObj.matrix);
          for (let f = 0; f < 3; f++) {
            const slot = i * 3 + f;
            this.pathFlowerStemMesh.setMatrixAt(slot, this.scratchObj.matrix);
            this.pathFlowerPetalMesh.setMatrixAt(slot, this.scratchObj.matrix);
            this.pathFlowerCoreMesh.setMatrixAt(slot, this.scratchObj.matrix);
          }
        }
      }

      this.hedgeBaseMesh.instanceMatrix.needsUpdate = true;
      this.hedgePuffMesh.instanceMatrix.needsUpdate = true;
      this.hedgeBudMesh.instanceMatrix.needsUpdate = true;
      this.mossMesh.instanceMatrix.needsUpdate = true;
      this.bfsBudStemMesh.instanceMatrix.needsUpdate = true;
      this.bfsBudHeadMesh.instanceMatrix.needsUpdate = true;
      if (this.bfsBudHeadMesh.instanceColor) this.bfsBudHeadMesh.instanceColor.needsUpdate = true;
      this.pathVineMesh.instanceMatrix.needsUpdate = true;
      this.pathFlowerStemMesh.instanceMatrix.needsUpdate = true;
      this.pathFlowerPetalMesh.instanceMatrix.needsUpdate = true;
      this.pathFlowerCoreMesh.instanceMatrix.needsUpdate = true;
      if (this.pathFlowerPetalMesh.instanceColor) {
        this.pathFlowerPetalMesh.instanceColor.needsUpdate = true;
      }
    }

    // 6. Interactive & Ambient Meadow Wildflowers
    for (let i = 0; i < this.maxUserBlooms * 2; i++) {
      const bloomIdx = Math.floor(i / 2);
      const sub = i % 2;
      const b = this.interactiveBlooms[bloomIdx];
      if (b) {
        if (sub === 0) {
          b.scale += (b.targetScale - b.scale) * Math.min(1, dt * 11);
        }
        const ox = sub === 0 ? 0 : Math.cos(b.rotY) * 0.22;
        const oz = sub === 0 ? 0 : Math.sin(b.rotY) * 0.22;
        const s = b.scale * (sub === 0 ? 1.05 : 0.82);
        const sway = Math.sin(t * 2.5 + b.seed + sub) * 0.1;

        this.scratchObj.position.set(b.x + ox, 0.01, b.z + oz);
        this.scratchObj.rotation.set(sway, b.rotY + sub, sway * 0.5);
        this.scratchObj.scale.setScalar(s);
        this.scratchObj.updateMatrix();
        this.userFlowerStemMesh.setMatrixAt(i, this.scratchObj.matrix);

        this.scratchObj.position.set(b.x + ox, 0.27 * s, b.z + oz);
        this.scratchObj.updateMatrix();
        this.userFlowerPetalMesh.setMatrixAt(i, this.scratchObj.matrix);

        this.scratchObj.position.set(b.x + ox, 0.3 * s, b.z + oz);
        this.scratchObj.updateMatrix();
        this.userFlowerCoreMesh.setMatrixAt(i, this.scratchObj.matrix);

        this.scratchColor.setHex(b.colorHex);
        this.userFlowerPetalMesh.setColorAt(i, this.scratchColor);
      } else {
        this.scratchObj.position.set(0, -10, 0);
        this.scratchObj.scale.setScalar(0.0001);
        this.scratchObj.updateMatrix();
        this.userFlowerStemMesh.setMatrixAt(i, this.scratchObj.matrix);
        this.userFlowerPetalMesh.setMatrixAt(i, this.scratchObj.matrix);
        this.userFlowerCoreMesh.setMatrixAt(i, this.scratchObj.matrix);
      }
    }
    this.userFlowerStemMesh.instanceMatrix.needsUpdate = true;
    this.userFlowerPetalMesh.instanceMatrix.needsUpdate = true;
    this.userFlowerCoreMesh.instanceMatrix.needsUpdate = true;
    if (this.userFlowerPetalMesh.instanceColor) {
      this.userFlowerPetalMesh.instanceColor.needsUpdate = true;
    }

    // 7. Articulated Gliding Bluebirds
    for (const bf of this.birds) {
      bf.swoop = Math.max(0, bf.swoop - dt * 1.4);
      const ang = t * bf.speed + bf.phase;
      const nx = Math.cos(ang) * bf.orbitRx;
      const nz = Math.sin(ang * 1.5) * bf.orbitRz;
      const ny = bf.baseY + Math.sin(t * 1.6 + bf.phase) * 0.28 + Math.sin(bf.swoop * Math.PI) * 1.4;

      const prevX = bf.bird.group.position.x;
      const prevZ = bf.bird.group.position.z;
      bf.bird.group.position.set(nx, ny, nz);

      const dx = nx - prevX;
      const dz = nz - prevZ;
      if (Math.hypot(dx, dz) > 0.0005) {
        bf.bird.group.rotation.y = Math.atan2(dx, dz);
      }
      const flapSpeed = 10 + bf.swoop * 14;
      const flap = Math.sin(t * flapSpeed + bf.phase) * 0.55;
      bf.bird.leftWing.rotation.z = flap;
      bf.bird.rightWing.rotation.z = -flap;
    }

    // 8. Fluttering Pastel Butterflies
    for (const b of this.butterflies) {
      const a = t * b.speed + b.phase;
      const bx = b.centerX + Math.cos(a) * b.radius;
      const bz = b.centerZ + Math.sin(a * 2) * (b.radius * 0.55);
      const by = b.baseY + Math.sin(t * 3.2 + b.phase) * 0.22;
      const prevX = b.bf.group.position.x;
      const prevZ = b.bf.group.position.z;
      b.bf.group.position.set(bx, by, bz);
      if (Math.hypot(bx - prevX, bz - prevZ) > 0.0005) {
        b.bf.group.rotation.y = Math.atan2(bx - prevX, bz - prevZ);
      }
      const flap = Math.sin(t * 18 + b.phase) * 0.72;
      b.bf.leftWing.rotation.y = flap;
      b.bf.rightWing.rotation.y = -flap;
    }

    // 9. Update 3D Pixel Particles
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      if (p.active) {
        p.age += dt;
        if (p.age >= p.life) {
          p.active = false;
          this.scratchObj.position.set(0, -10, 0);
          this.scratchObj.scale.setScalar(0.0001);
          this.scratchObj.updateMatrix();
          this.particleMesh.setMatrixAt(i, this.scratchObj.matrix);
        } else {
          p.vy -= 4.2 * dt;
          p.vx *= 0.97;
          p.vz *= 0.97;
          p.x += p.vx * dt;
          p.y = Math.max(0.05, p.y + p.vy * dt);
          p.z += p.vz * dt;
          p.rotX += p.vRot * dt;
          p.rotY += p.vRot * 0.8 * dt;
          const fade = 1 - p.age / p.life;
          this.scratchObj.position.set(p.x, p.y, p.z);
          this.scratchObj.rotation.set(p.rotX, p.rotY, 0);
          this.scratchObj.scale.setScalar(p.size * fade);
          this.scratchObj.updateMatrix();
          this.particleMesh.setMatrixAt(i, this.scratchObj.matrix);
          this.particleMesh.setColorAt(i, p.color);
        }
      } else {
        this.scratchObj.position.set(0, -10, 0);
        this.scratchObj.scale.setScalar(0.0001);
        this.scratchObj.updateMatrix();
        this.particleMesh.setMatrixAt(i, this.scratchObj.matrix);
      }
    }
    this.particleMesh.instanceMatrix.needsUpdate = true;
    if (this.particleMesh.instanceColor) this.particleMesh.instanceColor.needsUpdate = true;

    // 10. Update Expanding Water/Dew Ripples
    for (const r of this.ripples) {
      if (!r.active) continue;
      r.age += dt;
      if (r.age >= r.life) {
        r.active = false;
        r.mesh.visible = false;
      } else {
        const progress = r.age / r.life;
        const eased = 1 - Math.pow(1 - progress, 2.2);
        r.mesh.scale.setScalar(0.35 + eased * r.maxScale);
        r.mat.opacity = (1 - progress) * 0.78;
      }
    }

    // 11. Subtle pulse on meadow cursor halo
    if (this.cursorHalo.visible) {
      this.cursorHalo.scale.setScalar(1 + Math.sin(t * 4.5) * 0.08);
    }

    this.renderer.render(this.scene, this.camera);
  }

  private scheduleNextFrame(): void {
    if (this.disposed || this.contextLost || this.paused) return;

    if (!this.isSoftwareGl) {
      this.rafId = requestAnimationFrame(() => {
        this.renderFrame();
        this.scheduleNextFrame();
      });
      return;
    }

    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    if (gl && typeof gl.fenceSync === 'function') {
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (this.disposed || this.contextLost || this.paused) {
          if (sync) gl.deleteSync(sync);
          return;
        }
        if (!sync || gl.clientWaitSync(sync, 0, 0) !== gl.TIMEOUT_EXPIRED) {
          if (sync) gl.deleteSync(sync);
          this.timerId = window.setTimeout(() => {
            this.renderFrame();
            this.scheduleNextFrame();
          }, 80);
        } else {
          this.timerId = window.setTimeout(poll, 16);
        }
      };
      poll();
    } else {
      this.timerId = window.setTimeout(() => {
        this.renderFrame();
        this.scheduleNextFrame();
      }, 90);
    }
  }

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.rafId);
    window.clearTimeout(this.timerId);
    this.resizeObserver.disconnect();

    const dom = this.renderer.domElement;
    dom.removeEventListener('pointerdown', this.boundPointerDown);
    dom.removeEventListener('wheel', this.boundWheel);
    window.removeEventListener('pointermove', this.boundPointerMove);
    window.removeEventListener('pointerup', this.boundPointerUp);
    window.removeEventListener('pointercancel', this.boundPointerUp);
    dom.removeEventListener('webglcontextlost', this.boundContextLost);
    dom.removeEventListener('webglcontextrestored', this.boundContextRestored);

    this.disposeGroupChildren(this.islandGroup);
    this.disposeGroupChildren(this.mazeGroup);
    this.disposeGroupChildren(this.wildlifeGroup);
    this.disposeGroupChildren(this.fxGroup);
    this.disposeGroupChildren(this.startNest);
    this.disposeGroupChildren(this.goalShrine);
    this.waterMesh.geometry.dispose();
    this.waterMat.dispose();

    this.textures.dispose();
    this.envRenderTarget.dispose();
    this.pmrem.dispose();
    this.renderer.dispose();
    if (dom.parentElement) {
      dom.parentElement.removeChild(dom);
    }
  }
}
