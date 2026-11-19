import * as THREE from 'three';

function makePixelCanvas(
  width: number,
  height: number,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  draw(ctx, width, height);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

function hash2(x: number, y: number, seed: number): number {
  let h = (x * 374761393 + y * 668265263 + seed * 1442695041) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export interface DreamTextureSet {
  grass: THREE.CanvasTexture;
  shrubSoft: THREE.CanvasTexture;
  stoneWall: THREE.CanvasTexture;
  mossPath: THREE.CanvasTexture;
  contactShadow: THREE.CanvasTexture;
  skyBackdrop: THREE.CanvasTexture;
  dispose: () => void;
}

export function createDreamTextures(): DreamTextureSet {
  // 1. Bright poppy spring-meadow grass (32x32) inspired by sunlit Ghibli pixel meadows
  const grass = makePixelCanvas(32, 32, (ctx, w, h) => {
    const palette = ['#7AE052', '#70D649', '#84E85B', '#67CC41', '#8DF066'];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        // Soft clustered grass patches instead of sharp noisy static
        const cx = Math.floor(x / 2);
        const cy = Math.floor(y / 2);
        const patch = hash2(cx, cy, 11);
        const grain = hash2(x, y, 17);
        const v = patch * 0.7 + grain * 0.3;
        const idx = v < 0.25 ? 3 : v < 0.5 ? 1 : v < 0.76 ? 0 : v < 0.9 ? 2 : 4;
        ctx.fillStyle = palette[idx];
        ctx.fillRect(x, y, 1, 1);
      }
    }
    // Delicate sunlit meadow grass wisps
    for (let i = 0; i < 16; i++) {
      const gx = Math.floor(hash2(i, 1, 21) * (w - 2)) + 1;
      const gy = Math.floor(hash2(i, 2, 21) * (h - 3)) + 2;
      ctx.fillStyle = '#58B638';
      ctx.fillRect(gx, gy, 1, 2);
      ctx.fillStyle = '#A7F67C';
      ctx.fillRect(gx, gy - 1, 1, 1);
    }
    // Tiny white & sunshine meadow clover/daisy flecks (like reference meadow!)
    ctx.fillStyle = '#FAFFF5';
    ctx.fillRect(6, 9, 1, 1);
    ctx.fillRect(22, 18, 1, 1);
    ctx.fillRect(14, 27, 1, 1);
    ctx.fillStyle = '#FDE047';
    ctx.fillRect(26, 6, 1, 1);
  });

  // 2. Soft velvety painterly shrub foliage (24x24) — rounded low-contrast sage-emerald puffs
  const shrubSoft = makePixelCanvas(24, 24, (ctx, w, h) => {
    // Soft sage-meadow base
    ctx.fillStyle = '#53AF5E';
    ctx.fillRect(0, 0, w, h);

    // Paint overlapping rounded pixel-art leaf puff clusters (soft, zero harsh outlines!)
    const puffs: Array<[number, number, number, string]> = [
      [5, 6, 5, '#469C53'],
      [15, 5, 5, '#48A054'],
      [10, 14, 6, '#449850'],
      [20, 16, 5, '#469C53'],
      [4, 19, 5, '#4A9F55'],
      // Mid sunlit leaf pillows
      [6, 5, 4, '#5EBC66'],
      [16, 6, 4, '#63C169'],
      [11, 13, 4, '#5DBB65'],
      [19, 15, 3, '#63C169'],
      [5, 18, 3, '#5DBB65'],
      // Creamy sunlit crown dabs
      [7, 4, 2, '#80D978'],
      [16, 5, 2, '#86DF7D'],
      [11, 11, 2, '#7CD675'],
      [19, 14, 2, '#86DF7D'],
    ];

    for (const [px, py, r, color] of puffs) {
      ctx.fillStyle = color;
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (dx * dx + dy * dy <= r * r) {
            const tx = (px + dx + w) % w;
            const ty = (py + dy + h) % h;
            ctx.fillRect(tx, ty, 1, 1);
          }
        }
      }
    }

    // Occasional dainty pastel flower buds tucked into the soft shrubbery
    ctx.fillStyle = '#FFA6CE';
    ctx.fillRect(6, 5, 1, 1);
    ctx.fillStyle = '#FFF9C4';
    ctx.fillRect(17, 13, 1, 1);
    ctx.fillStyle = '#BAE6FD';
    ctx.fillRect(12, 20, 1, 1);
  });

  // 3. Warm sunlit limestone garden plinth wall (32x16) with soft minty overhanging moss
  const stoneWall = makePixelCanvas(32, 16, (ctx, w, h) => {
    const stones = ['#EAE3D2', '#DDD5C2', '#F3EDE0', '#D0C7B4'];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const row = Math.floor(y / 5);
        const offset = (row % 2) * 5;
        const isMortar = y % 5 === 0 || (x + offset) % 10 === 0;
        if (isMortar) {
          ctx.fillStyle = '#ABA392';
        } else {
          const blockHash = hash2(Math.floor((x + offset) / 10), row, 71);
          const grain = hash2(x, y, 73);
          const base = Math.floor(blockHash * stones.length);
          ctx.fillStyle = grain > 0.85 ? '#FAF6EB' : stones[base];
        }
        ctx.fillRect(x, y, 1, 1);
      }
    }
    // Soft bright overhanging spring moss fringe
    for (let x = 0; x < w; x++) {
      const hang = 2 + Math.floor(hash2(x, 0, 89) * 4);
      for (let y = 0; y < hang; y++) {
        ctx.fillStyle = y === 0 ? '#81E35A' : y < hang - 1 ? '#5DC15A' : '#469C53';
        ctx.fillRect(x, y, 1, 1);
      }
    }
  });

  // 4. Dreamy turquoise-mint creeping dew moss tile for BFS exploration (16x16)
  const mossPath = makePixelCanvas(16, 16, (ctx, w, h) => {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const v = hash2(Math.floor(x / 2), Math.floor(y / 2), 131);
        ctx.fillStyle =
          v < 0.3 ? '#46D49B' : v < 0.65 ? '#39C490' : v < 0.88 ? '#64E3AE' : '#84F0C2';
        ctx.fillRect(x, y, 1, 1);
      }
    }
    // Luminous sky-dew sparkles
    ctx.fillStyle = '#B8F6FF';
    ctx.fillRect(3, 4, 2, 1);
    ctx.fillRect(10, 11, 2, 1);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(4, 4, 1, 1);
    ctx.fillRect(11, 11, 1, 1);
  });

  // 5. Soft radial contact shadow (32x32)
  const contactShadow = makePixelCanvas(32, 32, (ctx, w, h) => {
    const grad = ctx.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2);
    grad.addColorStop(0, 'rgba(28, 72, 42, 0.36)');
    grad.addColorStop(0.55, 'rgba(28, 72, 42, 0.16)');
    grad.addColorStop(1, 'rgba(28, 72, 42, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  });
  contactShadow.magFilter = THREE.LinearFilter;
  contactShadow.minFilter = THREE.LinearFilter;

  // 6. Vibrant cerulean pixel-art summer sky with towering white & periwinkle cumulus clouds!
  const skyBackdrop = makePixelCanvas(160, 96, (ctx, w, h) => {
    // Rich cerulean-to-sky-blue pixel gradient bands (like reference image 2!)
    const bands = [
      '#4680E5',
      '#4F8AE9',
      '#5B96EE',
      '#69A4F3',
      '#7AB3F6',
      '#8EC3F9',
      '#A6D4FB',
      '#C2E5FC',
    ];
    const bandH = Math.ceil(h / bands.length);
    bands.forEach((col, i) => {
      ctx.fillStyle = col;
      ctx.fillRect(0, i * bandH, w, bandH + 1);
    });

    // Helper to stamp chunky pixel-art cumulus cloud puffs
    const drawCloudPuff = (cx: number, cy: number, rx: number, ry: number, color: string) => {
      ctx.fillStyle = color;
      for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
        for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
          const dx = (x - cx) / rx;
          const dy = (y - cy) / ry;
          if (dx * dx + dy * dy <= 1.0 && x >= 0 && x < w && y >= 0 && y < h) {
            ctx.fillRect(x, y, 1, 1);
          }
        }
      }
    };

    // Towering left-center Ghibli pixel cumulus cloud (periwinkle base shadow + bright white crown)
    const cloudClusters = [
      { x: 34, y: 58, s: 1.05 },
      { x: 124, y: 54, s: 1.15 },
      { x: 80, y: 66, s: 0.85 },
    ];
    for (const c of cloudClusters) {
      // Lavender-periwinkle undersides
      drawCloudPuff(c.x - 10 * c.s, c.y + 5 * c.s, 15 * c.s, 10 * c.s, '#B0C0F8');
      drawCloudPuff(c.x + 8 * c.s, c.y + 6 * c.s, 16 * c.s, 9 * c.s, '#B9C8FA');
      drawCloudPuff(c.x - 3 * c.s, c.y - 4 * c.s, 13 * c.s, 11 * c.s, '#C9D6FC');
      // Crisp sunlit white cumulus tops
      drawCloudPuff(c.x + 2 * c.s, c.y - 10 * c.s, 12 * c.s, 10 * c.s, '#F5F9FF');
      drawCloudPuff(c.x - 9 * c.s, c.y - 3 * c.s, 10 * c.s, 8 * c.s, '#EBF3FF');
      drawCloudPuff(c.x + 12 * c.s, c.y - 1 * c.s, 11 * c.s, 8 * c.s, '#FFFFFF');
      drawCloudPuff(c.x + 1 * c.s, c.y - 16 * c.s, 8 * c.s, 7 * c.s, '#FFFFFF');
    }

    // Subtle crisp pixel contrail diagonal across upper sky (delightful nod to reference!)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.82)';
    for (let i = 0; i < 42; i++) {
      ctx.fillRect(14 + i * 2, 26 - Math.floor(i * 0.45), 2, 1);
    }
  });
  skyBackdrop.wrapS = THREE.ClampToEdgeWrapping;
  skyBackdrop.wrapT = THREE.ClampToEdgeWrapping;

  return {
    grass,
    shrubSoft,
    stoneWall,
    mossPath,
    contactShadow,
    skyBackdrop,
    dispose: () => {
      grass.dispose();
      shrubSoft.dispose();
      stoneWall.dispose();
      mossPath.dispose();
      contactShadow.dispose();
      skyBackdrop.dispose();
    },
  };
}
