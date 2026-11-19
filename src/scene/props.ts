import * as THREE from 'three';

/**
 * Composite multi-part 3D pixel-art botanical props for Hedgerow.
 * Every prop pivots at bottom-center (y = 0) so it rests flush on the garden or water.
 */

export function createStartNestGroup(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'StartNest';

  // 1. Sculpted mossy garden dais (elevates nest above corridor walls for 2.5D readability)
  const padMat = new THREE.MeshStandardMaterial({ color: 0xd9d5c5, roughness: 0.86, metalness: 0.04 });
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.48, 0.36, 8), padMat);
  pad.position.y = 0.18;
  pad.receiveShadow = true;
  group.add(pad);

  // 2. Woven twig nest outer ring
  const twigMat = new THREE.MeshStandardMaterial({ color: 0x875229, roughness: 0.9, metalness: 0.02 });
  const nestRing = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.12, 6, 10), twigMat);
  nestRing.rotation.x = Math.PI / 2;
  nestRing.position.y = 0.46;
  nestRing.castShadow = true;
  group.add(nestRing);

  // 3. Soft moss inner cushion
  const mossMat = new THREE.MeshStandardMaterial({ color: 0x5ca33d, roughness: 0.85, metalness: 0.0 });
  const cushion = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.24, 0.1, 8), mossMat);
  cushion.position.y = 0.44;
  group.add(cushion);

  // 4. Three luminous sky-blue speckled eggs
  const eggMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x0284c7,
    emissiveIntensity: 0.28,
    roughness: 0.28,
    metalness: 0.08,
  });
  const eggOffsets: [number, number, number][] = [
    [-0.1, 0.56, 0.05],
    [0.1, 0.58, 0.03],
    [0.0, 0.55, -0.1],
  ];
  for (const [ex, ey, ez] of eggOffsets) {
    const egg = new THREE.Mesh(new THREE.SphereGeometry(0.105, 8, 8), eggMat);
    egg.scale.set(0.88, 1.22, 0.88);
    egg.position.set(ex, ey, ez);
    egg.castShadow = true;
    group.add(egg);
  }

  // 5. Sky-blue glowing beacon halo at base
  const haloMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.72,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const halo = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.56, 16), haloMat);
  halo.rotation.x = -Math.PI / 2;
  halo.position.y = 0.035;
  halo.name = 'BeaconHalo';
  group.add(halo);

  return group;
}

export function createGoalShrineGroup(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'GoalShrine';

  const stoneMat = new THREE.MeshStandardMaterial({ color: 0xe6e1d3, roughness: 0.82, metalness: 0.04 });
  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xf4be2c,
    roughness: 0.28,
    metalness: 0.35,
    emissive: 0x6b4700,
    emissiveIntensity: 0.25,
  });
  const petalMat = new THREE.MeshStandardMaterial({ color: 0xfff8e2, roughness: 0.5, metalness: 0.02 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x4ca144, roughness: 0.78, metalness: 0.0 });

  // 1. Stepped octagonal dais
  const base1 = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.5, 0.1, 8), stoneMat);
  base1.position.y = 0.05;
  base1.receiveShadow = true;
  group.add(base1);

  // 2. Sculpted stone pedestal column
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 0.56, 6), stoneMat);
  stem.position.y = 0.36;
  stem.castShadow = true;
  group.add(stem);

  // 3. Leafy floral wreath collar
  const wreath = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.07, 5, 8), leafMat);
  wreath.rotation.x = Math.PI / 2;
  wreath.position.y = 0.66;
  group.add(wreath);

  // 4. Radiant sun-marigold blossom crown (rotates gently in animation loop)
  const crown = new THREE.Group();
  crown.name = 'SunCrown';
  crown.position.y = 0.84;

  const center = new THREE.Mesh(new THREE.OctahedronGeometry(0.2, 0), goldMat);
  center.castShadow = true;
  crown.add(center);

  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    const petal = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.09, 0.28), petalMat);
    petal.position.set(Math.cos(angle) * 0.27, 0, Math.sin(angle) * 0.27);
    petal.rotation.y = -angle;
    petal.castShadow = true;
    crown.add(petal);
  }
  group.add(crown);

  // 5. Warm marigold ground aura ring
  const haloMat = new THREE.MeshBasicMaterial({
    color: 0xf59e0b,
    transparent: true,
    opacity: 0.72,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const halo = new THREE.Mesh(new THREE.RingGeometry(0.44, 0.58, 16), haloMat);
  halo.rotation.x = -Math.PI / 2;
  halo.position.y = 0.035;
  halo.name = 'BeaconHalo';
  group.add(halo);

  return group;
}

export interface ArticulatedBluebird {
  group: THREE.Group;
  leftWing: THREE.Group;
  rightWing: THREE.Group;
}

export function createBluebirdGroup(): ArticulatedBluebird {
  const group = new THREE.Group();

  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x3b9ae8, roughness: 0.55, metalness: 0.05 });
  const bellyMat = new THREE.MeshStandardMaterial({ color: 0xe6f5ff, roughness: 0.68, metalness: 0.0 });
  const wingMat = new THREE.MeshStandardMaterial({ color: 0x1d68ad, roughness: 0.5, metalness: 0.06 });
  const beakMat = new THREE.MeshStandardMaterial({ color: 0xf5ba2c, roughness: 0.35, metalness: 0.1 });

  // Torso
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.22, 0.44), bodyMat);
  body.castShadow = true;
  group.add(body);

  // Cream belly
  const belly = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.1, 0.32), bellyMat);
  belly.position.set(0, -0.09, 0.02);
  group.add(belly);

  // Head
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.22, 0.24), bodyMat);
  head.position.set(0, 0.12, 0.22);
  group.add(head);

  // Beak
  const beak = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.14), beakMat);
  beak.position.set(0, 0.1, 0.38);
  group.add(beak);

  // Tail fan
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.05, 0.24), wingMat);
  tail.position.set(0, 0.03, -0.3);
  tail.rotation.x = 0.2;
  group.add(tail);

  // Articulated left wing
  const leftWing = new THREE.Group();
  leftWing.position.set(-0.16, 0.04, 0.02);
  const lwMesh = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.05, 0.24), wingMat);
  lwMesh.position.set(-0.17, 0, 0);
  lwMesh.castShadow = true;
  leftWing.add(lwMesh);
  group.add(leftWing);

  // Articulated right wing
  const rightWing = new THREE.Group();
  rightWing.position.set(0.16, 0.04, 0.02);
  const rwMesh = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.05, 0.24), wingMat);
  rwMesh.position.set(0.17, 0, 0);
  rwMesh.castShadow = true;
  rightWing.add(rwMesh);
  group.add(rightWing);

  return { group, leftWing, rightWing };
}

export interface ArticulatedButterfly {
  group: THREE.Group;
  leftWing: THREE.Mesh;
  rightWing: THREE.Mesh;
}

export function createButterflyGroup(colorHex: number): ArticulatedButterfly {
  const group = new THREE.Group();
  const wingMat = new THREE.MeshStandardMaterial({
    color: colorHex,
    roughness: 0.45,
    metalness: 0.04,
    side: THREE.DoubleSide,
  });
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x3b2f2f, roughness: 0.8 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.16), bodyMat);
  group.add(body);

  const wingGeo = new THREE.PlaneGeometry(0.18, 0.16);
  wingGeo.translate(-0.09, 0, 0);
  const leftWing = new THREE.Mesh(wingGeo, wingMat);
  leftWing.rotation.x = -Math.PI / 2;
  group.add(leftWing);

  const rightGeo = new THREE.PlaneGeometry(0.18, 0.16);
  rightGeo.translate(0.09, 0, 0);
  const rightWing = new THREE.Mesh(rightGeo, wingMat);
  rightWing.rotation.x = -Math.PI / 2;
  group.add(rightWing);

  return { group, leftWing, rightWing };
}

export function createGardenLanternGroup(): THREE.Group {
  const group = new THREE.Group();
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0xd6d2c2, roughness: 0.86, metalness: 0.04 });
  const mossMat = new THREE.MeshStandardMaterial({ color: 0x5c9e42, roughness: 0.88 });
  const glowMat = new THREE.MeshStandardMaterial({
    color: 0xffefc2,
    emissive: 0xffc857,
    emissiveIntensity: 0.75,
    roughness: 0.35,
  });

  const base = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.16, 0.46), stoneMat);
  base.position.y = 0.08;
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);

  const stem = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.42, 0.22), stoneMat);
  stem.position.y = 0.36;
  stem.castShadow = true;
  group.add(stem);

  const lanternBox = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.3, 0.32), glowMat);
  lanternBox.position.y = 0.72;
  group.add(lanternBox);

  const roof = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.26, 4), stoneMat);
  roof.position.y = 0.99;
  roof.rotation.y = Math.PI / 4;
  roof.castShadow = true;
  group.add(roof);

  const mossCap = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.06, 0.24), mossMat);
  mossCap.position.y = 1.07;
  group.add(mossCap);

  return group;
}

export function createWaterLilyGroup(hasLotus: boolean): THREE.Group {
  const group = new THREE.Group();

  const padMat = new THREE.MeshStandardMaterial({ color: 0x52c45e, roughness: 0.72, metalness: 0.02 });
  const padGeo = new THREE.CylinderGeometry(0.45, 0.43, 0.05, 11, 1, false, 0.35, Math.PI * 1.82);
  const pad = new THREE.Mesh(padGeo, padMat);
  pad.position.y = 0.025;
  pad.receiveShadow = true;
  group.add(pad);

  if (hasLotus) {
    const pinkMat = new THREE.MeshStandardMaterial({
      color: 0xff7eb6,
      roughness: 0.42,
      metalness: 0.02,
      emissive: 0x4d0d2c,
      emissiveIntensity: 0.14,
    });
    const coreMat = new THREE.MeshStandardMaterial({ color: 0xfde047, roughness: 0.34 });

    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const p = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 5), pinkMat);
      p.scale.set(0.85, 0.9, 1.35);
      p.position.set(Math.cos(a) * 0.13, 0.11, Math.sin(a) * 0.13);
      p.rotation.y = -a;
      p.rotation.x = 0.3;
      group.add(p);
    }
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), coreMat);
    core.position.y = 0.14;
    group.add(core);
  }

  return group;
}

export function createSanctuaryTreeGroup(variant: 'blossom' | 'cypress'): THREE.Group {
  const group = new THREE.Group();

  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8b5e3c, roughness: 0.9 });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.22, 0.92, 8), trunkMat);
  trunk.position.y = 0.46;
  trunk.castShadow = true;
  group.add(trunk);

  if (variant === 'blossom') {
    const pinkDeep = new THREE.MeshStandardMaterial({ color: 0xff77b7, roughness: 0.78 });
    const pinkMid = new THREE.MeshStandardMaterial({ color: 0xffa6d1, roughness: 0.72 });
    const pinkCream = new THREE.MeshStandardMaterial({ color: 0xffd6ea, roughness: 0.68 });
    const leaves = new THREE.MeshStandardMaterial({ color: 0x5cc764, roughness: 0.84 });

    // Soft pillowy foliage base
    const basePuff = new THREE.Mesh(new THREE.IcosahedronGeometry(0.72, 1), leaves);
    basePuff.scale.set(1.1, 0.52, 1.1);
    basePuff.position.y = 0.92;
    basePuff.castShadow = true;
    group.add(basePuff);

    // Rounded layered sakura blossom cloud puffs
    const puffs: Array<[number, number, number, number, THREE.Material]> = [
      [0, 1.35, 0, 0.78, pinkDeep],
      [-0.45, 1.25, 0.22, 0.54, pinkMid],
      [0.44, 1.28, -0.18, 0.56, pinkMid],
      [0.08, 1.72, 0.1, 0.58, pinkCream],
    ];
    for (const [x, y, z, r, mat] of puffs) {
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), mat);
      m.scale.set(1.06, 0.76, 1.06);
      m.position.set(x, y, z);
      m.castShadow = true;
      group.add(m);
    }
  } else {
    const sage1 = new THREE.MeshStandardMaterial({ color: 0x45a358, roughness: 0.85 });
    const sage2 = new THREE.MeshStandardMaterial({ color: 0x5ec268, roughness: 0.82 });
    const sage3 = new THREE.MeshStandardMaterial({ color: 0x82df7a, roughness: 0.78 });

    const b1 = new THREE.Mesh(new THREE.IcosahedronGeometry(0.74, 1), sage1);
    b1.scale.set(1.05, 0.78, 1.05);
    b1.position.y = 1.04;
    b1.castShadow = true;
    group.add(b1);

    const b2 = new THREE.Mesh(new THREE.IcosahedronGeometry(0.58, 1), sage2);
    b2.scale.set(1.02, 0.82, 1.02);
    b2.position.y = 1.54;
    b2.castShadow = true;
    group.add(b2);

    const b3 = new THREE.Mesh(new THREE.IcosahedronGeometry(0.38, 1), sage3);
    b3.scale.set(1.0, 0.88, 1.0);
    b3.position.y = 1.98;
    b3.castShadow = true;
    group.add(b3);
  }

  return group;
}
