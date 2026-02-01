// ============================================================
// MoltClans - Building Factory (3D mesh groups for each type)
// ============================================================

import * as THREE from "three";
import { CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";
import { GAME_CONFIG } from "../config";
import type { Building } from "../shared/types";

const MAT_CACHE: Map<number, THREE.MeshLambertMaterial> = new Map();

function getMat(color: number, opts?: Partial<THREE.MeshLambertMaterialParameters>): THREE.MeshLambertMaterial {
  const key = color + (opts?.transparent ? 0x1000000 : 0);
  if (!opts && MAT_CACHE.has(key)) return MAT_CACHE.get(key)!;
  const mat = new THREE.MeshLambertMaterial({ color, ...opts });
  if (!opts) MAT_CACHE.set(key, mat);
  return mat;
}

function box(w: number, h: number, d: number, color: number): THREE.Mesh {
  const geo = new THREE.BoxGeometry(w, h, d);
  return new THREE.Mesh(geo, getMat(color));
}

function cylinder(rTop: number, rBottom: number, h: number, color: number, segments = 8): THREE.Mesh {
  const geo = new THREE.CylinderGeometry(rTop, rBottom, h, segments);
  return new THREE.Mesh(geo, getMat(color));
}

function sphere(r: number, color: number, segments = 8): THREE.Mesh {
  const geo = new THREE.SphereGeometry(r, segments, segments);
  return new THREE.Mesh(geo, getMat(color));
}

function cone(r: number, h: number, color: number, segments = 8): THREE.Mesh {
  const geo = new THREE.ConeGeometry(r, h, segments);
  return new THREE.Mesh(geo, getMat(color));
}

/**
 * Create a peaked triangular roof using a custom prism shape.
 */
function peakedRoof(w: number, d: number, h: number, color: number): THREE.Mesh {
  const shape = new THREE.Shape();
  shape.moveTo(-w / 2, 0);
  shape.lineTo(w / 2, 0);
  shape.lineTo(0, h);
  shape.closePath();

  const extrudeSettings = { depth: d, bevelEnabled: false };
  const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
  geo.rotateY(Math.PI / 2);
  geo.translate(0, 0, d / 2);
  const mesh = new THREE.Mesh(geo, getMat(color));
  return mesh;
}

// ============================================================
// Building type constructors
// ============================================================

function createHouse(colors: { walls: number; roof: number }): THREE.Group {
  const group = new THREE.Group();
  // Walls: 2x1.0x2 box
  const walls = box(1.8, 1.0, 1.8, colors.walls);
  walls.position.y = 0.5;
  walls.castShadow = true;
  walls.receiveShadow = true;
  group.add(walls);

  // Peaked roof
  const roof = peakedRoof(2.2, 2.2, 0.7, colors.roof);
  roof.position.y = 1.0;
  roof.position.x = -1.1;
  roof.castShadow = true;
  group.add(roof);

  // Door
  const door = box(0.3, 0.5, 0.05, 0x4a3520);
  door.position.set(0, 0.25, 0.93);
  group.add(door);

  // Window
  const win = box(0.25, 0.25, 0.05, 0xadd8e6);
  win.position.set(0.5, 0.65, 0.93);
  group.add(win);

  // Chimney
  const chimney = box(0.2, 0.4, 0.2, 0x666666);
  chimney.position.set(-0.4, 1.5, -0.3);
  chimney.castShadow = true;
  group.add(chimney);

  return group;
}

function createFarm(colors: { walls: number; roof: number }): THREE.Group {
  const group = new THREE.Group();

  // Earth base
  const base = box(1.8, 0.15, 2.8, 0x6b5240);
  base.position.y = 0.075;
  base.receiveShadow = true;
  group.add(base);

  // Crop rows
  for (let i = 0; i < 5; i++) {
    const crop = box(0.15, 0.25, 2.2, colors.roof);
    crop.position.set(-0.6 + i * 0.3, 0.27, -0.2);
    crop.castShadow = true;
    group.add(crop);
  }

  // Small barn in corner
  const barn = box(0.7, 0.6, 0.7, colors.walls);
  barn.position.set(0.5, 0.3, 1.0);
  barn.castShadow = true;
  group.add(barn);

  const barnRoof = peakedRoof(0.9, 0.9, 0.3, colors.roof);
  barnRoof.position.set(0.05, 0.6, 1.45);
  barnRoof.castShadow = true;
  group.add(barnRoof);

  // Fence posts
  const fenceColor = 0x8b6b4a;
  const posts = [
    [-0.9, 0, -1.4], [0.9, 0, -1.4], [-0.9, 0, 1.4], [0.9, 0, 1.4],
    [-0.9, 0, 0], [0.9, 0, 0],
  ];
  for (const [fx, , fz] of posts) {
    const post = cylinder(0.03, 0.03, 0.4, fenceColor);
    post.position.set(fx, 0.2, fz);
    group.add(post);
  }

  return group;
}

function createLumbermill(colors: { walls: number; roof: number }): THREE.Group {
  const group = new THREE.Group();

  // Main building
  const walls = box(2.6, 0.9, 1.6, colors.walls);
  walls.position.y = 0.45;
  walls.castShadow = true;
  walls.receiveShadow = true;
  group.add(walls);

  // Roof
  const roof = peakedRoof(3.0, 2.0, 0.5, colors.roof);
  roof.position.set(-1.5, 0.9, 1.0);
  roof.castShadow = true;
  group.add(roof);

  // Log stack
  for (let i = 0; i < 3; i++) {
    const log = cylinder(0.08, 0.08, 1.2, 0x8b6b4a);
    log.rotation.z = Math.PI / 2;
    log.position.set(1.6, 0.1 + i * 0.18, -0.2 + i * 0.05);
    log.castShadow = true;
    group.add(log);
  }

  // Saw blade (circle on front)
  const sawGeo = new THREE.TorusGeometry(0.2, 0.03, 8, 16);
  const saw = new THREE.Mesh(sawGeo, getMat(0x888888));
  saw.position.set(-0.5, 0.6, 0.82);
  group.add(saw);

  return group;
}

function createQuarry(colors: { walls: number; roof: number }): THREE.Group {
  const group = new THREE.Group();

  // Stepped pit (3 levels)
  const step1 = box(2.8, 0.25, 2.8, colors.walls);
  step1.position.y = 0.125;
  step1.receiveShadow = true;
  group.add(step1);

  const step2 = box(2.0, 0.25, 2.0, colors.roof);
  step2.position.y = -0.05;
  step2.receiveShadow = true;
  group.add(step2);

  const step3 = box(1.2, 0.25, 1.2, 0x546e7a);
  step3.position.y = -0.2;
  step3.receiveShadow = true;
  group.add(step3);

  // Scattered rocks
  for (let i = 0; i < 5; i++) {
    const rock = sphere(0.06 + Math.random() * 0.08, 0x888888);
    rock.position.set(
      (Math.random() - 0.5) * 2.4,
      0.3,
      (Math.random() - 0.5) * 2.4
    );
    rock.castShadow = true;
    group.add(rock);
  }

  // Crane A-frame
  const pole1 = box(0.06, 1.2, 0.06, 0x6d4c41);
  pole1.position.set(1.0, 0.6, 1.0);
  pole1.rotation.z = 0.15;
  pole1.castShadow = true;
  group.add(pole1);

  const pole2 = box(0.06, 1.2, 0.06, 0x6d4c41);
  pole2.position.set(1.0, 0.6, 0.7);
  pole2.rotation.z = -0.15;
  pole2.castShadow = true;
  group.add(pole2);

  const crossbar = box(0.04, 0.04, 0.5, 0x6d4c41);
  crossbar.position.set(1.0, 1.1, 0.85);
  group.add(crossbar);

  return group;
}

function createMarket(colors: { walls: number; roof: number }): THREE.Group {
  const group = new THREE.Group();

  // Tent canopy (cone)
  const canopy = cone(2.0, 1.5, colors.roof, 8);
  canopy.position.y = 1.5;
  canopy.castShadow = true;
  group.add(canopy);

  // Support poles
  const polePositions = [
    [-0.8, 0, -0.8], [0.8, 0, -0.8],
    [-0.8, 0, 0.8], [0.8, 0, 0.8],
  ];
  for (const [px, , pz] of polePositions) {
    const pole = cylinder(0.04, 0.04, 1.5, 0x8b6b4a);
    pole.position.set(px, 0.75, pz);
    group.add(pole);
  }

  // Stall counter
  const counter = box(1.8, 0.15, 0.6, colors.walls);
  counter.position.set(0, 0.5, 0.8);
  counter.castShadow = true;
  group.add(counter);

  // Crates
  for (let i = 0; i < 3; i++) {
    const crate = box(0.25, 0.25, 0.25, 0xa08050);
    crate.position.set(-0.8 + i * 0.5, 0.125, -0.6);
    crate.castShadow = true;
    group.add(crate);
  }

  return group;
}

function createWorkshop(colors: { walls: number; roof: number }): THREE.Group {
  const group = new THREE.Group();

  // Main building
  const walls = box(1.8, 0.9, 1.8, colors.walls);
  walls.position.y = 0.45;
  walls.castShadow = true;
  walls.receiveShadow = true;
  group.add(walls);

  // Dark metal roof
  const roof = box(2.0, 0.12, 2.0, colors.roof);
  roof.position.y = 0.96;
  roof.castShadow = true;
  group.add(roof);

  // Chimney with "smoke"
  const chimney = box(0.25, 0.6, 0.25, 0x555555);
  chimney.position.set(0.5, 1.3, -0.3);
  chimney.castShadow = true;
  group.add(chimney);

  const smoke = sphere(0.15, 0xcccccc);
  smoke.material = new THREE.MeshLambertMaterial({
    color: 0xcccccc,
    transparent: true,
    opacity: 0.4,
  });
  smoke.position.set(0.5, 1.8, -0.3);
  group.add(smoke);

  // Anvil (simplified)
  const anvil = box(0.2, 0.15, 0.12, 0x333333);
  anvil.position.set(-0.5, 0.075, 0.95);
  group.add(anvil);

  // Gear circle on wall
  const gearGeo = new THREE.TorusGeometry(0.15, 0.025, 8, 12);
  const gear = new THREE.Mesh(gearGeo, getMat(0x888888));
  gear.position.set(0, 0.6, 0.92);
  group.add(gear);

  return group;
}

function createTavern(colors: { walls: number; roof: number }): THREE.Group {
  const group = new THREE.Group();

  // Main building
  const walls = box(2.6, 1.1, 1.6, colors.walls);
  walls.position.y = 0.55;
  walls.castShadow = true;
  walls.receiveShadow = true;
  group.add(walls);

  // Roof
  const roof = peakedRoof(3.0, 2.0, 0.5, colors.roof);
  roof.position.set(-1.5, 1.1, 1.0);
  roof.castShadow = true;
  group.add(roof);

  // Hanging sign
  const signPost = cylinder(0.03, 0.03, 0.6, 0x6d4c41);
  signPost.position.set(1.4, 0.9, 0.82);
  group.add(signPost);

  const signPlane = box(0.3, 0.2, 0.02, 0xe8c170);
  signPlane.position.set(1.4, 0.65, 0.82);
  group.add(signPlane);

  // Barrel
  const barrel = cylinder(0.15, 0.15, 0.25, 0x8b6b4a, 12);
  barrel.position.set(-1.0, 0.125, 0.85);
  barrel.castShadow = true;
  group.add(barrel);

  // Door
  const door = box(0.35, 0.6, 0.05, 0x4a3520);
  door.position.set(0.3, 0.3, 0.83);
  group.add(door);

  // Warm point light near door
  const warmLight = new THREE.PointLight(0xffaa44, 0.5, 3);
  warmLight.position.set(0.3, 0.8, 1.2);
  group.add(warmLight);

  return group;
}

function createTownhall(colors: { walls: number; roof: number }): THREE.Group {
  const group = new THREE.Group();

  // Large main building
  const walls = box(3.6, 1.8, 3.6, colors.walls);
  walls.position.y = 0.9;
  walls.castShadow = true;
  walls.receiveShadow = true;
  group.add(walls);

  // Roof
  const roof = box(3.8, 0.2, 3.8, colors.roof);
  roof.position.y = 1.9;
  roof.castShadow = true;
  group.add(roof);

  // Slight peak on top
  const peak = box(2.5, 0.15, 2.5, colors.roof);
  peak.position.y = 2.1;
  group.add(peak);

  // 4 columns at entrance
  for (let i = 0; i < 4; i++) {
    const col = cylinder(0.08, 0.08, 1.8, 0xeeeeee, 8);
    col.position.set(-1.2 + i * 0.8, 0.9, 1.85);
    col.castShadow = true;
    group.add(col);
  }

  // Steps
  for (let i = 0; i < 3; i++) {
    const step = box(3.2 - i * 0.3, 0.1, 0.3, 0xccccbb);
    step.position.set(0, i * 0.1, 2.1 + i * 0.3);
    step.receiveShadow = true;
    group.add(step);
  }

  // Flag pole
  const pole = cylinder(0.03, 0.03, 1.2, 0x8b8b8b);
  pole.position.set(0, 2.8, 0);
  group.add(pole);

  // Flag
  const flag = box(0.4, 0.25, 0.02, 0xe74c3c);
  flag.position.set(0.22, 3.2, 0);
  group.add(flag);

  // Gold trim lines
  const trim = box(3.9, 0.04, 3.9, 0xffd700);
  trim.position.y = 1.82;
  group.add(trim);

  return group;
}

function createWall(colors: { walls: number; roof: number }): THREE.Group {
  const group = new THREE.Group();

  const wallBox = box(0.9, 0.5, 0.9, colors.walls);
  wallBox.position.y = 0.25;
  wallBox.castShadow = true;
  wallBox.receiveShadow = true;
  group.add(wallBox);

  // Darker mortar lines
  const line1 = box(0.92, 0.02, 0.92, 0x666666);
  line1.position.y = 0.25;
  group.add(line1);

  // Slightly varied top surface
  const topCap = box(0.85, 0.06, 0.85, colors.roof);
  topCap.position.y = 0.53;
  group.add(topCap);

  return group;
}

function createGarden(colors: { walls: number; roof: number }): THREE.Group {
  const group = new THREE.Group();

  // Green raised ground
  const base = box(1.8, 0.15, 1.8, colors.walls);
  base.position.y = 0.075;
  base.receiveShadow = true;
  group.add(base);

  // Low hedge border
  const hedgePositions = [
    [0, 0.2, 0.95], [0, 0.2, -0.95], [0.95, 0.2, 0], [-0.95, 0.2, 0],
  ];
  const hedgeSizes: [number, number, number][] = [
    [1.8, 0.15, 0.1], [1.8, 0.15, 0.1], [0.1, 0.15, 1.8], [0.1, 0.15, 1.8],
  ];
  for (let i = 0; i < 4; i++) {
    const hedge = box(hedgeSizes[i][0], hedgeSizes[i][1], hedgeSizes[i][2], 0x2e7d32);
    hedge.position.set(hedgePositions[i][0], hedgePositions[i][1], hedgePositions[i][2]);
    group.add(hedge);
  }

  // Flowers
  const flowerColors = [0xff4444, 0xffdd44, 0xdd44ff, 0xff8844, 0x44aaff, 0xff66aa];
  for (let i = 0; i < 7; i++) {
    const stem = cylinder(0.015, 0.015, 0.2, 0x228b22);
    const fx = (Math.random() - 0.5) * 1.4;
    const fz = (Math.random() - 0.5) * 1.4;
    stem.position.set(fx, 0.25, fz);
    group.add(stem);

    const bloom = sphere(0.05, flowerColors[i % flowerColors.length]);
    bloom.position.set(fx, 0.38, fz);
    group.add(bloom);
  }

  return group;
}

function createMonument(colors: { walls: number; roof: number }): THREE.Group {
  const group = new THREE.Group();

  // Square base
  const base = box(1.6, 0.3, 1.6, 0x888888);
  base.position.y = 0.15;
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);

  // Tall tapered pillar
  const pillarGeo = new THREE.BoxGeometry(0.6, 2.0, 0.6);
  // Taper: slightly narrower at top
  const positions = pillarGeo.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    const y = positions.getY(i);
    if (y > 0) {
      positions.setX(i, positions.getX(i) * 0.7);
      positions.setZ(i, positions.getZ(i) * 0.7);
    }
  }
  pillarGeo.computeVertexNormals();
  const pillar = new THREE.Mesh(pillarGeo, getMat(colors.walls));
  pillar.position.y = 1.3;
  pillar.castShadow = true;
  group.add(pillar);

  // Gold sphere on top
  const goldBall = sphere(0.15, colors.roof, 12);
  goldBall.position.y = 2.45;
  goldBall.castShadow = true;
  group.add(goldBall);

  return group;
}

function createRoad(colors: { walls: number; roof: number }): THREE.Group {
  const group = new THREE.Group();

  // Thin flat gray box
  const road = box(0.95, 0.05, 0.95, colors.walls);
  road.position.y = 0.025;
  road.receiveShadow = true;
  group.add(road);

  // Cobblestone texture: slightly different shade patches
  for (let i = 0; i < 4; i++) {
    const cobble = box(0.2, 0.02, 0.2, 0x777777);
    cobble.position.set(
      (Math.random() - 0.5) * 0.6,
      0.06,
      (Math.random() - 0.5) * 0.6
    );
    group.add(cobble);
  }

  return group;
}

// ============================================================
// Factory map
// ============================================================

const BUILDERS: Record<string, (colors: { walls: number; roof: number }) => THREE.Group> = {
  house: createHouse,
  farm: createFarm,
  lumbermill: createLumbermill,
  quarry: createQuarry,
  market: createMarket,
  workshop: createWorkshop,
  tavern: createTavern,
  townhall: createTownhall,
  wall: createWall,
  garden: createGarden,
  monument: createMonument,
  road: createRoad,
};

// ============================================================
// Public API
// ============================================================

export interface BuildingMesh {
  group: THREE.Group;
  buildingId: string;
  buildingData: Building;
  progressBar: THREE.Group | null;
  levelLabel: CSS2DObject | null;
  ownerRing: THREE.Line | null;
}

/**
 * Create a 3D mesh group for a building.
 */
export function createBuildingMesh(building: Building, ownerColor: string): BuildingMesh {
  const colors = GAME_CONFIG.BUILDING_COLORS_3D[building.type] ?? { walls: 0x888888, roof: 0x666666 };
  const builder = BUILDERS[building.type];

  const buildingGroup = builder ? builder(colors) : createDefaultBuilding(colors, building);
  const group = new THREE.Group();
  group.add(buildingGroup);

  // Position in 3D world: center of footprint
  const cx = building.x + building.width / 2;
  const cz = building.y + building.height / 2;
  group.position.set(cx, 0, cz);

  // Under construction: 50% opacity
  if (!building.completed) {
    group.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshLambertMaterial) {
        child.material = child.material.clone();
        child.material.transparent = true;
        child.material.opacity = 0.5;
      }
    });
  }

  // Owner color ring on ground
  const ownerRing = createOwnerRing(building.width, building.height, ownerColor);
  group.add(ownerRing);

  // Progress bar (if under construction)
  let progressBar: THREE.Group | null = null;
  if (building.progress < 100) {
    progressBar = createProgressBar(building, building.width);
    group.add(progressBar);
  }

  // Level label
  let levelLabel: CSS2DObject | null = null;
  if (building.level > 1) {
    levelLabel = createLevelLabel(building.level);
    const bh = getBuildingHeight(building.type);
    levelLabel.position.set(building.width / 2 * 0.4, bh + 0.3, 0);
    group.add(levelLabel);
  }

  // Store building data for raycasting
  group.userData = { type: "building", buildingId: building.id };
  buildingGroup.traverse((child) => {
    child.userData = { type: "building", buildingId: building.id };
  });

  return { group, buildingId: building.id, buildingData: building, progressBar, levelLabel, ownerRing };
}

/**
 * Update a building mesh with new data.
 */
export function updateBuildingMesh(bm: BuildingMesh, building: Building, ownerColor: string): void {
  bm.buildingData = building;

  // Handle completion
  if (building.completed) {
    // Restore full opacity
    bm.group.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshLambertMaterial) {
        if (child.material.transparent && child.material.opacity < 1) {
          child.material.opacity = 1;
          child.material.transparent = false;
        }
      }
    });

    // Remove progress bar
    if (bm.progressBar) {
      bm.group.remove(bm.progressBar);
      bm.progressBar = null;
    }
  } else if (bm.progressBar) {
    // Update progress bar fill
    updateProgressBar(bm.progressBar, building);
  }

  // Update level label
  if (building.level > 1) {
    if (!bm.levelLabel) {
      bm.levelLabel = createLevelLabel(building.level);
      const bh = getBuildingHeight(building.type);
      bm.levelLabel.position.set(building.width / 2 * 0.4, bh + 0.3, 0);
      bm.group.add(bm.levelLabel);
    } else {
      bm.levelLabel.element.textContent = `L${building.level}`;
    }
  }

  // Update owner ring color
  if (bm.ownerRing) {
    bm.group.remove(bm.ownerRing);
  }
  bm.ownerRing = createOwnerRing(building.width, building.height, ownerColor);
  bm.group.add(bm.ownerRing);
}

/**
 * Play a completion flash effect.
 */
export function playCompletionFlash(bm: BuildingMesh): void {
  bm.group.traverse((child) => {
    if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshLambertMaterial) {
      const mat = child.material;
      mat.emissive.setHex(0xffffff);
      mat.emissiveIntensity = 0.8;

      // Fade emissive back to 0
      const start = performance.now();
      const duration = 600;
      function animate() {
        const elapsed = performance.now() - start;
        const t = Math.min(elapsed / duration, 1);
        mat.emissiveIntensity = 0.8 * (1 - t);
        if (t < 1) requestAnimationFrame(animate);
        else {
          mat.emissive.setHex(0x000000);
          mat.emissiveIntensity = 0;
        }
      }
      requestAnimationFrame(animate);
    }
  });
}

// ============================================================
// Helpers
// ============================================================

function createDefaultBuilding(colors: { walls: number; roof: number }, building: Building): THREE.Group {
  const group = new THREE.Group();
  const w = building.width * 0.9;
  const d = building.height * 0.9;
  const walls = box(w, 0.8, d, colors.walls);
  walls.position.y = 0.4;
  walls.castShadow = true;
  walls.receiveShadow = true;
  group.add(walls);

  const roof = box(w + 0.1, 0.1, d + 0.1, colors.roof);
  roof.position.y = 0.85;
  roof.castShadow = true;
  group.add(roof);
  return group;
}

function createOwnerRing(w: number, h: number, colorStr: string): THREE.Line {
  const hw = w / 2 + 0.1;
  const hh = h / 2 + 0.1;
  const points = [
    new THREE.Vector3(-hw, 0.02, -hh),
    new THREE.Vector3(hw, 0.02, -hh),
    new THREE.Vector3(hw, 0.02, hh),
    new THREE.Vector3(-hw, 0.02, hh),
    new THREE.Vector3(-hw, 0.02, -hh),
  ];
  const geo = new THREE.BufferGeometry().setFromPoints(points);
  const color = new THREE.Color(colorStr);
  const mat = new THREE.LineBasicMaterial({ color, linewidth: 2 });
  return new THREE.Line(geo, mat);
}

function createProgressBar(building: Building, w: number): THREE.Group {
  const group = new THREE.Group();
  const bh = getBuildingHeight(building.type);
  const barWidth = w * 0.8;

  // Background
  const bg = box(barWidth, 0.08, 0.15, 0x333333);
  bg.position.set(0, bh + 0.2, 0);
  group.add(bg);

  // Fill
  const fillWidth = Math.max(0.01, (building.progress / 100) * barWidth);
  const fill = box(fillWidth, 0.08, 0.15, 0x4caf50);
  fill.position.set(-(barWidth - fillWidth) / 2, bh + 0.2, 0.01);
  fill.name = "progress-fill";
  group.add(fill);

  group.name = "progress-bar";
  return group;
}

function updateProgressBar(progressGroup: THREE.Group, building: Building): void {
  const fill = progressGroup.getObjectByName("progress-fill") as THREE.Mesh | undefined;
  if (!fill) return;

  const barWidth = building.width * 0.8;
  const fillWidth = Math.max(0.01, (building.progress / 100) * barWidth);

  fill.geometry.dispose();
  fill.geometry = new THREE.BoxGeometry(fillWidth, 0.08, 0.15);
  fill.position.x = -(barWidth - fillWidth) / 2;
}

function createLevelLabel(level: number): CSS2DObject {
  const div = document.createElement("div");
  div.textContent = `L${level}`;
  div.style.cssText =
    "color:#ffd700;font-size:10px;font-weight:bold;" +
    "text-shadow: -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000;" +
    "font-family:monospace;pointer-events:none;";
  return new CSS2DObject(div);
}

function getBuildingHeight(type: string): number {
  const heights: Record<string, number> = {
    house: 1.5,
    farm: 0.5,
    lumbermill: 1.2,
    quarry: 0.8,
    market: 1.5,
    workshop: 1.2,
    tavern: 1.4,
    townhall: 2.5,
    wall: 0.6,
    garden: 0.3,
    monument: 2.5,
    road: 0.05,
  };
  return heights[type] ?? 1.0;
}
