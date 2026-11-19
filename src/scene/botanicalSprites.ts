import * as THREE from 'three';

function makeSpriteTexture(
  w: number,
  h: number,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, w, h);
  draw(ctx, w, h);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

/** Draws a crisp pixel circle/blob */
function pxDisk(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  color: string
) {
  ctx.fillStyle = color;
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      if ((x - cx) * (x - cx) + (y - cy) * (y - cy) <= r * r + 0.25) {
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }
}

/** Draws a curved pixel grass blade from base (x0, y0) curving toward (x1, y1) */
function pxBlade(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  cx: number,
  cy: number,
  x1: number,
  y1: number,
  baseCol: string,
  tipCol: string,
  thickness = 1
) {
  const steps = 18;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const inv = 1 - t;
    const x = Math.round(inv * inv * x0 + 2 * inv * t * cx + t * t * x1);
    const y = Math.round(inv * inv * y0 + 2 * inv * t * cy + t * t * y1);
    ctx.fillStyle = t > 0.52 ? tipCol : baseCol;
    const w = t < 0.45 ? thickness : 1;
    ctx.fillRect(x, y, w, 1);
  }
}

export interface BotanicalSpriteSet {
  grassFibres: THREE.CanvasTexture;
  pebbleGrass: THREE.CanvasTexture;
  blueHydrangea: THREE.CanvasTexture;
  poppySunburst: THREE.CanvasTexture;
  marigoldBouquet: THREE.CanvasTexture;
  peonyStems: THREE.CanvasTexture;
  shrubCrown: THREE.CanvasTexture;
  dispose: () => void;
}

export function createBotanicalSprites(): BotanicalSpriteSet {
  // 1. Arching meadow grass fibres (28x24) — delicate tapered blades that sway in the breeze
  const grassFibres = makeSpriteTexture(28, 24, (ctx) => {
    pxBlade(ctx, 7, 23, 5, 16, 2, 10, '#2F7A22', '#7BE34C', 2);
    pxBlade(ctx, 11, 23, 10, 14, 8, 4, '#296E1E', '#72D946', 2);
    pxBlade(ctx, 14, 23, 15, 13, 17, 3, '#378928', '#8BEC5C', 2);
    pxBlade(ctx, 18, 23, 20, 15, 24, 8, '#307D23', '#7AE04E', 2);
    pxBlade(ctx, 21, 23, 23, 18, 26, 13, '#3E942C', '#97F06A', 1);
    pxBlade(ctx, 13, 23, 11, 17, 6, 13, '#439A30', '#8BE95B', 1);
    // Soft mossy root tuft
    ctx.fillStyle = '#2E7520';
    ctx.fillRect(6, 21, 16, 3);
    ctx.fillStyle = '#4CA636';
    ctx.fillRect(8, 20, 12, 2);
  });

  // 2. Mossy garden pebbles & arching grass blades (32x28) — Reference #2
  const pebbleGrass = makeSpriteTexture(32, 28, (ctx) => {
    // Arching grass behind rocks
    pxBlade(ctx, 11, 25, 7, 15, 3, 10, '#368224', '#7AD138', 2);
    pxBlade(ctx, 13, 24, 11, 12, 12, 4, '#2F751E', '#6DC432', 2);
    pxBlade(ctx, 19, 24, 20, 12, 16, 4, '#347D22', '#76CD36', 2);
    pxBlade(ctx, 21, 25, 24, 15, 29, 10, '#368224', '#7AD138', 2);
    pxBlade(ctx, 22, 25, 25, 19, 29, 17, '#48962C', '#8BDF48', 1);

    // Large smooth pebble right-center
    pxDisk(ctx, 19, 19, 5.2, '#8F887E');
    pxDisk(ctx, 19, 18, 4.6, '#C4BDB2');
    pxDisk(ctx, 18, 17, 3.3, '#DFD8CE');
    ctx.fillStyle = '#F5F2EB';
    ctx.fillRect(16, 15, 3, 2);

    // Smaller smooth pebble left
    pxDisk(ctx, 11, 22, 3.7, '#8E887E');
    pxDisk(ctx, 11, 21, 3.1, '#C7C0B6');
    pxDisk(ctx, 10, 20, 2.0, '#E6E0D6');

    // Foreground blades hugging the stones
    pxBlade(ctx, 18, 26, 20, 21, 23, 17, '#4C9B2E', '#8BDF48', 2);
    pxBlade(ctx, 14, 26, 16, 22, 15, 18, '#3B8325', '#6FC534', 1);

    // Lush moss bed at base
    ctx.fillStyle = '#4B9926';
    ctx.fillRect(5, 24, 22, 3);
    ctx.fillStyle = '#6DC132';
    ctx.fillRect(7, 23, 18, 2);
  });

  // 3. Vibrant Blue Hydrangea / Forget-Me-Not Mound (32x28) — Reference #1 (BFS Living Wave!)
  const blueHydrangea = makeSpriteTexture(32, 28, (ctx) => {
    // Rich dark-emerald pixel leaf cushion for crisp contrast against blue tiles
    pxDisk(ctx, 10, 21, 6.2, '#1F5C17');
    pxDisk(ctx, 22, 21, 6.2, '#1F5C17');
    pxDisk(ctx, 16, 20, 7.4, '#327B20');
    pxDisk(ctx, 10, 22, 4.6, '#4FA32B');
    pxDisk(ctx, 22, 22, 4.6, '#4FA32B');
    pxDisk(ctx, 16, 22, 5.6, '#64B934');

    // Dense vibrant sapphire, cobalt, and luminous cyan-sky blossoms with warm golden centers!
    const blooms: Array<[number, number, string, string, boolean]> = [
      [7, 15, '#07459E', '#1E88F5', true],
      [12, 13, '#0B5AC2', '#38B6FF', true],
      [17, 11, '#084FB0', '#2EA8FF', true],
      [24, 14, '#0D62CC', '#52C8FF', true],
      [10, 17, '#1170DB', '#66D2FF', true],
      [16, 15, '#0954B8', '#42BEFF', true],
      [21, 17, '#1277E3', '#7AE0FF', true],
      [14, 8, '#0D65D0', '#5CCBFF', true],
      [21, 9, '#084CAE', '#34B0FF', true],
      [26, 11, '#1070DB', '#6CD6FF', false],
      [6, 12, '#074296', '#2194F8', true],
      [18, 6, '#147BE8', '#8BE6FF', true],
    ];
    for (const [bx, by, dark, light, hasEye] of blooms) {
      pxDisk(ctx, bx, by, 2.7, dark);
      pxDisk(ctx, bx, by - 0.5, 1.9, light);
      if (hasEye) {
        ctx.fillStyle = '#FBBF24';
        ctx.fillRect(bx, by, 1, 1);
      }
    }
  });

  // 4. Poppy Red & Sunburst Yellow Wildflower Hedge Bed (32x28) — Reference #3 (Optimal Path!)
  const poppySunburst = makeSpriteTexture(32, 28, (ctx) => {
    // Rich dark soil & lush emerald base framing the bright crimson/gold blooms
    ctx.fillStyle = '#5C3216';
    ctx.fillRect(5, 20, 22, 6);
    ctx.fillStyle = '#4AA32A';
    ctx.fillRect(4, 23, 24, 4);
    ctx.fillStyle = '#7EE044';
    ctx.fillRect(6, 25, 20, 2);

    // Leafy vertical stems
    const stems = [6, 10, 13, 16, 19, 22, 26];
    for (const sx of stems) {
      ctx.fillStyle = '#2B7520';
      ctx.fillRect(sx, 11, 2, 13);
      ctx.fillStyle = '#55B330';
      ctx.fillRect(sx - 1, 15, 1, 5);
    }

    // Ultra-vibrant scarlet-crimson poppies & glowing golden sunburst crowns
    const flowers: Array<[number, number, string, string, string]> = [
      [7, 12, '#DC143C', '#FF4D6D', '#FFF5F5'],
      [12, 9, '#F59E0B', '#FDE047', '#FFFFFF'],
      [17, 7, '#E11D48', '#FF5C7A', '#FFE4E6'],
      [22, 9, '#F59E0B', '#FDE047', '#FFFFFF'],
      [26, 13, '#DC143C', '#FF5272', '#FFF1F2'],
      [10, 16, '#F59E0B', '#FEF08A', '#FFFFFF'],
      [19, 14, '#E11D48', '#FF4D6D', '#FFE4E6'],
      [15, 17, '#FACC15', '#FEF08A', '#FFFFFF'],
      [23, 17, '#DC143C', '#FF5C7A', '#FFF5F5'],
    ];
    for (const [fx, fy, outer, mid, core] of flowers) {
      pxDisk(ctx, fx, fy, 3.0, outer);
      pxDisk(ctx, fx, fy - 0.5, 2.0, mid);
      ctx.fillStyle = core;
      ctx.fillRect(fx, fy, 1, 1);
    }
  });

  // 5. Marigold, White Daisy & Cobalt Delphinium Bouquet (32x28) — Reference #4 (Optimal Path!)
  const marigoldBouquet = makeSpriteTexture(32, 28, (ctx) => {
    // Rich deep-forest fern backing so orange & white petals pop brilliantly!
    pxBlade(ctx, 8, 24, 5, 17, 2, 11, '#174E22', '#307E34', 2);
    pxBlade(ctx, 18, 23, 19, 12, 20, 3, '#164920', '#2E7831', 2);
    pxBlade(ctx, 24, 24, 27, 18, 30, 14, '#174E22', '#307E34', 2);
    pxDisk(ctx, 14, 19, 7.6, '#1E5E2A');
    pxDisk(ctx, 20, 19, 6.4, '#287232');
    ctx.fillStyle = '#4CA624';
    ctx.fillRect(5, 24, 22, 3);
    ctx.fillStyle = '#72CE34';
    ctx.fillRect(8, 25, 16, 2);

    // Tall vibrant sky-cobalt delphinium spike on right
    for (let y = 5; y <= 19; y += 2) {
      ctx.fillStyle = y % 4 === 1 ? '#3B82F6' : '#7DD3FC';
      ctx.fillRect(24 + ((y % 3) - 1), y, 3, 2);
    }

    // Fiery tangerine-orange marigolds
    const marigolds: Array<[number, number, number]> = [
      [13, 9, 3.4],
      [9, 14, 2.8],
      [20, 14, 3.4],
      [17, 20, 2.7],
    ];
    for (const [mx, my, mr] of marigolds) {
      pxDisk(ctx, mx, my, mr, '#EA580C');
      pxDisk(ctx, mx, my - 0.5, mr * 0.72, '#FBBF24');
      ctx.fillStyle = '#7C2D12';
      ctx.fillRect(mx, my, 1, 1);
    }

    // Crisp snow-white daisies with warm orange centers
    const daisies: Array<[number, number]> = [
      [15, 14],
      [8, 19],
      [13, 20],
    ];
    for (const [dx, dy] of daisies) {
      pxDisk(ctx, dx, dy, 2.2, '#FFFFFF');
      ctx.fillStyle = '#F97316';
      ctx.fillRect(dx, dy, 1, 1);
    }
  });

  // 6. Tall Hot-Magenta Peony & Golden Buttercup Stems (32x30) — Reference #5 (Optimal Path!)
  const peonyStems = makeSpriteTexture(32, 30, (ctx) => {
    // Deep lush mossy base
    pxDisk(ctx, 11, 26, 5.4, '#3D8720');
    pxDisk(ctx, 21, 26, 5.4, '#3D8720');
    pxDisk(ctx, 16, 25, 6.2, '#5DB82D');

    // Slender dark stems with serrated pixel side leaves
    const stemSpecs: Array<[number, number, number]> = [
      [6, 9, 25],
      [11, 11, 25],
      [17, 5, 25],
      [22, 12, 25],
      [27, 10, 25],
    ];
    for (const [sx, topY, botY] of stemSpecs) {
      ctx.fillStyle = '#17402E';
      ctx.fillRect(sx, topY, 1, botY - topY);
      ctx.fillStyle = '#25603C';
      ctx.fillRect(sx - 2, topY + 6, 2, 1);
      ctx.fillRect(sx + 1, topY + 8, 2, 1);
      ctx.fillStyle = '#5FB82E';
      ctx.fillRect(sx - 3, botY - 5, 3, 2);
      ctx.fillRect(sx + 1, botY - 4, 3, 2);
    }

    // Rich rose-magenta peony globes & bright golden buttercups
    const peonies: Array<[number, number, number]> = [
      [6, 9, 3.1],
      [17, 6, 3.7],
      [16, 17, 3.2],
      [27, 10, 3.1],
    ];
    for (const [px, py, pr] of peonies) {
      pxDisk(ctx, px, py, pr, '#BE185D');
      pxDisk(ctx, px, py - 0.5, pr * 0.78, '#F43F8E');
      pxDisk(ctx, px + 0.6, py - 1.0, pr * 0.45, '#FFC2DF');
    }

    const buttercups: Array<[number, number, number]> = [
      [11, 11, 2.9],
      [9, 19, 2.2],
      [22, 12, 2.5],
    ];
    for (const [bx, by, br] of buttercups) {
      pxDisk(ctx, bx, by, br, '#F59E0B');
      pxDisk(ctx, bx, by - 0.4, br * 0.72, '#FDE047');
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(bx, by - 1, 1, 1);
    }
  });

  // 7. Intricate Leafy Shrub Crown & Blossom Sprigs (32x24) — rich handcrafted pixel leaves on every shrub!
  const shrubCrown = makeSpriteTexture(32, 24, (ctx) => {
    // Layered scalloped pixel leaf tufts with clear light-to-shadow botanical clustering
    const leafClusters: Array<[number, number, number, string]> = [
      [7, 17, 5.5, '#2E7238'],
      [16, 15, 6.6, '#357E3F'],
      [25, 17, 5.5, '#2E7238'],
      [10, 12, 5.0, '#469A4B'],
      [22, 12, 5.0, '#469A4B'],
      [16, 10, 5.2, '#57B056'],
      // Sunlit spring-lime crown leaves
      [9, 10, 2.8, '#77D269'],
      [16, 7, 3.2, '#8CE37A'],
      [23, 10, 2.7, '#77D269'],
      [13, 14, 2.4, '#6CC662'],
      [20, 15, 2.3, '#6CC662'],
    ];
    for (const [lx, ly, lr, col] of leafClusters) {
      pxDisk(ctx, lx, ly, lr, col);
    }
    // Crisp individual pixel leaf tips poking organically out of the shrub silhouette
    pxBlade(ctx, 6, 16, 3, 12, 1, 8, '#327B3B', '#7FD86E', 2);
    pxBlade(ctx, 26, 16, 29, 12, 30, 8, '#327B3B', '#7FD86E', 2);
    pxBlade(ctx, 15, 8, 13, 4, 11, 2, '#469A4B', '#98EC84', 2);
    pxBlade(ctx, 18, 8, 20, 4, 23, 3, '#469A4B', '#98EC84', 2);
    pxBlade(ctx, 11, 10, 8, 6, 5, 5, '#3C8B44', '#86DF74', 1);

    // Delicate dainty pixel blossoms tucked naturally inside the shrubbery
    ctx.fillStyle = '#FF99C8';
    ctx.fillRect(9, 12, 2, 2);
    ctx.fillStyle = '#FFFDE7';
    ctx.fillRect(21, 12, 2, 2);
    ctx.fillStyle = '#BAE6FD';
    ctx.fillRect(16, 15, 2, 1);
  });

  return {
    grassFibres,
    pebbleGrass,
    blueHydrangea,
    poppySunburst,
    marigoldBouquet,
    peonyStems,
    shrubCrown,
    dispose: () => {
      grassFibres.dispose();
      pebbleGrass.dispose();
      blueHydrangea.dispose();
      poppySunburst.dispose();
      marigoldBouquet.dispose();
      peonyStems.dispose();
      shrubCrown.dispose();
    },
  };
}

/**
 * Single clean bottom-anchored billboard quad (centered at x=0, y=0..height, z=0).
 * Paired with createWindSpriteMaterial, it faces the camera smoothly with zero X-card cross seams!
 */
export function createBillboardCardGeometry(width: number, height: number): THREE.BufferGeometry {
  const hw = width / 2;
  const positions = new Float32Array([
    -hw, 0, 0,
     hw, 0, 0,
     hw, height, 0,
    -hw, 0, 0,
     hw, height, 0,
    -hw, height, 0,
  ]);

  const uvs = new Float32Array([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1]);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.computeVertexNormals();
  return geo;
}

/**
 * Instanced GPU camera-facing billboard material with world-space traveling wind sway!
 * Roots stay anchored at vUv.y = 0 while stems/blossoms face the viewer cleanly and sway in rolling gusts.
 */
export function createWindSpriteMaterial(
  map: THREE.CanvasTexture,
  windAmp = 0.16,
  sunBoost = 1.0,
  camUpTilt = 0.34
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: map },
      uTime: { value: 0 },
      uWindAmp: { value: windAmp },
      uSunBoost: { value: sunBoost },
      uCamUpTilt: { value: camUpTilt },
      uFogColor: { value: new THREE.Color(0x9bcdf9) },
      uFogNear: { value: 65.0 },
      uFogFar: { value: 185.0 },
    },
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform float uWindAmp;
      uniform float uCamUpTilt;
      varying vec2 vUv;
      varying float vFogDepth;

      void main() {
        vUv = uv;

        #ifdef USE_INSTANCING
          vec4 worldOrigin = modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
          float scaleX = length(instanceMatrix[0].xyz);
          float scaleY = length(instanceMatrix[1].xyz);
        #else
          vec4 worldOrigin = modelMatrix * vec4(0.0, 0.0, 0.0, 1.0);
          float scaleX = 1.0;
          float scaleY = 1.0;
        #endif

        // Extract camera right & up axes in world space for seamless 360° camera-facing pixel art!
        vec3 camRight = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
        vec3 camUp = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
        // Blend world-up with camera-up so sprites look upright AND never foreshorten at 2.5D angles
        vec3 billboardUp = normalize(mix(vec3(0.0, 1.0, 0.0), camUp, uCamUpTilt));

        vec3 worldPos = worldOrigin.xyz
          + camRight * (position.x * scaleX)
          + billboardUp * (position.y * scaleY);

        // Traveling spatial wind gust wave across the entire island!
        float bend = uv.y * uv.y;
        float gustPrimary = sin(uTime * 2.15 + worldOrigin.x * 0.36 + worldOrigin.z * 0.27);
        float gustFlutter = sin(uTime * 4.3 + worldOrigin.x * 0.9 - worldOrigin.z * 0.65) * 0.32;
        float sway = (gustPrimary + gustFlutter) * uWindAmp * bend * scaleY;

        worldPos.x += sway;
        worldPos.z += sway * 0.55;
        worldPos.y -= abs(sway) * 0.16;

        vec4 mvPosition = viewMatrix * vec4(worldPos, 1.0);
        vFogDepth = -mvPosition.z;
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap;
      uniform float uSunBoost;
      uniform vec3 uFogColor;
      uniform float uFogNear;
      uniform float uFogFar;
      varying vec2 vUv;
      varying float vFogDepth;

      void main() {
        vec4 tex = texture2D(uMap, vUv);
        if (tex.a < 0.45) discard;

        // Crisp vertical botanical lighting (warm sunlit tips, slightly richer shaded roots)
        float vertLight = mix(0.88, 1.08, vUv.y) * uSunBoost;
        vec3 col = tex.rgb * vertLight;

        float fogFactor = smoothstep(uFogNear, uFogFar, vFogDepth);
        col = mix(col, uFogColor, fogFactor * 0.68);

        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    side: THREE.DoubleSide,
  });
}
