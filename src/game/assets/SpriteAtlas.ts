// ============================================================
// MoltClans - Sprite Atlas (procedural sprite generation)
// Generates isometric sprites via Canvas until real Kenney
// asset packs are downloaded. Drop-in replaceable.
// ============================================================

import { Texture } from "pixi.js";
import type { BuildingType, TerrainType } from "../../shared/types";
import { ISO_TILE_WIDTH, ISO_TILE_HEIGHT } from "../../shared/constants";

const textureCache = new Map<string, Texture>();

function getOrCreate(key: string, factory: () => Texture): Texture {
  let tex = textureCache.get(key);
  if (!tex) {
    tex = factory();
    textureCache.set(key, tex);
  }
  return tex;
}

/** Create a canvas and 2D context */
function makeCanvas(w: number, h: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  return { canvas, ctx };
}

/** Draw an isometric diamond (tile footprint) */
function drawIsoDiamond(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number, h: number, fill: string, stroke?: string): void {
  ctx.beginPath();
  ctx.moveTo(cx, cy - h / 2);
  ctx.lineTo(cx + w / 2, cy);
  ctx.lineTo(cx, cy + h / 2);
  ctx.lineTo(cx - w / 2, cy);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

/** Draw an isometric box (base + sides) */
function drawIsoBox(
  ctx: CanvasRenderingContext2D,
  cx: number, baseY: number,
  w: number, h: number, depth: number,
  topColor: string, leftColor: string, rightColor: string,
): void {
  const hw = w / 2;
  const hh = h / 2;

  // Left face
  ctx.beginPath();
  ctx.moveTo(cx - hw, baseY);
  ctx.lineTo(cx, baseY + hh);
  ctx.lineTo(cx, baseY + hh + depth);
  ctx.lineTo(cx - hw, baseY + depth);
  ctx.closePath();
  ctx.fillStyle = leftColor;
  ctx.fill();

  // Right face
  ctx.beginPath();
  ctx.moveTo(cx + hw, baseY);
  ctx.lineTo(cx, baseY + hh);
  ctx.lineTo(cx, baseY + hh + depth);
  ctx.lineTo(cx + hw, baseY + depth);
  ctx.closePath();
  ctx.fillStyle = rightColor;
  ctx.fill();

  // Top face
  drawIsoDiamond(ctx, cx, baseY, w, h, topColor);
}

// ============================================================
// Terrain Tiles
// ============================================================

const TERRAIN_COLORS: Record<TerrainType, { top: string; variation: string[] }> = {
  plains: { top: "#4caf50", variation: ["#43a047", "#66bb6a", "#388e3c"] },
  fertile: { top: "#2e7d32", variation: ["#1b5e20", "#388e3c", "#4caf50"] },
  forest: { top: "#1b5e20", variation: ["#0d4710", "#2e7d32", "#145214"] },
  mountain: { top: "#78909c", variation: ["#607d8b", "#90a4ae", "#546e7a"] },
  water: { top: "#2196f3", variation: ["#1e88e5", "#42a5f5", "#1976d2"] },
  riverbank: { top: "#8d6e63", variation: ["#795548", "#6d4c41", "#a1887f"] },
  desert: { top: "#fdd835", variation: ["#fbc02d", "#ffee58", "#f9a825"] },
};

/** Draw small tree sprites on a terrain tile (for forest overlay) */
function drawTreeOverlay(ctx: CanvasRenderingContext2D, cx: number, cy: number, tileW: number, tileH: number): void {
  const treePositions = [
    { x: cx - tileW * 0.15, y: cy - tileH * 0.1 },
    { x: cx + tileW * 0.1, y: cy + tileH * 0.05 },
    { x: cx - tileW * 0.05, y: cy + tileH * 0.15 },
  ];
  for (const pos of treePositions) {
    // Trunk
    ctx.fillStyle = "#5d4037";
    ctx.fillRect(pos.x - 1, pos.y - 4, 2, 6);
    // Canopy (triangle)
    ctx.fillStyle = "#2e7d32";
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y - 10);
    ctx.lineTo(pos.x + 4, pos.y - 3);
    ctx.lineTo(pos.x - 4, pos.y - 3);
    ctx.closePath();
    ctx.fill();
    // Second layer
    ctx.fillStyle = "#1b5e20";
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y - 8);
    ctx.lineTo(pos.x + 3, pos.y - 2);
    ctx.lineTo(pos.x - 3, pos.y - 2);
    ctx.closePath();
    ctx.fill();
  }
}

/** Draw rock/crag overlay for mountain terrain */
function drawRockOverlay(ctx: CanvasRenderingContext2D, cx: number, cy: number, tileW: number, tileH: number): void {
  const rockPositions = [
    { x: cx - tileW * 0.12, y: cy - tileH * 0.05 },
    { x: cx + tileW * 0.08, y: cy + tileH * 0.1 },
  ];
  for (const pos of rockPositions) {
    ctx.fillStyle = "#607d8b";
    ctx.beginPath();
    ctx.moveTo(pos.x - 4, pos.y + 2);
    ctx.lineTo(pos.x - 2, pos.y - 5);
    ctx.lineTo(pos.x + 3, pos.y - 3);
    ctx.lineTo(pos.x + 5, pos.y + 2);
    ctx.closePath();
    ctx.fill();
    // Highlight edge
    ctx.fillStyle = "#90a4ae";
    ctx.beginPath();
    ctx.moveTo(pos.x - 2, pos.y - 5);
    ctx.lineTo(pos.x + 3, pos.y - 3);
    ctx.lineTo(pos.x + 1, pos.y - 1);
    ctx.closePath();
    ctx.fill();
  }
}

export function getTerrainTexture(terrain: TerrainType): Texture {
  return getOrCreate(`terrain_${terrain}`, () => {
    const w = ISO_TILE_WIDTH;
    const h = ISO_TILE_HEIGHT;
    const { canvas, ctx } = makeCanvas(w, h + 16); // extra room for overlays
    const colors = TERRAIN_COLORS[terrain];

    // Main diamond
    drawIsoDiamond(ctx, w / 2, h / 2 + 6, w - 2, h - 2, colors.top);

    // Add some pixel variation for texture
    for (let i = 0; i < 8; i++) {
      const px = Math.random() * (w - 16) + 8;
      const py = Math.random() * (h - 8) + 4 + 6;
      ctx.fillStyle = colors.variation[Math.floor(Math.random() * colors.variation.length)];
      ctx.globalAlpha = 0.4;
      ctx.fillRect(px, py, 2, 2);
    }
    ctx.globalAlpha = 1;

    // Edge highlight
    if (terrain !== "water") {
      ctx.strokeStyle = "rgba(255,255,255,0.1)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(w / 2, 1 + 6);
      ctx.lineTo(w - 1, h / 2 + 6);
      ctx.stroke();
    }

    // Forest: add tree overlays
    if (terrain === "forest") {
      drawTreeOverlay(ctx, w / 2, h / 2 + 6, w, h);
    }

    // Mountain: add rock/crag overlays
    if (terrain === "mountain") {
      drawRockOverlay(ctx, w / 2, h / 2 + 6, w, h);
    }

    return Texture.from(canvas);
  });
}

// ============================================================
// Building Sprites
// ============================================================

interface BuildingColors {
  walls: string;
  roof: string;
  wallDark: string;
  accent: string;
}

/** Tier-based building height in pixels */
const TIER_HEIGHTS: Record<number, number> = {
  1: 20,
  2: 28,
  3: 36,
  4: 48,
};

/** Map building types to their tier */
const BUILDING_TIER: Record<BuildingType, number> = {
  // Tier 1
  wooden_hut: 1, farm: 1, sawmill: 1, storage_shed: 1, dirt_road: 1, well: 1,
  // Tier 2
  kiln: 2, stone_house: 2, marketplace: 2, stone_wall: 2, warehouse: 2,
  paved_road: 2, workshop: 2, inn: 2,
  // Tier 3
  cement_works: 3, town_hall: 3, apartment_block: 3, bank: 3, university: 3,
  hospital: 3, commercial_tower: 3, forge: 3, embassy: 3,
  // Tier 4
  skyscraper: 4, grand_bazaar: 4, mint: 4, monument: 4, spaceport: 4,
};

const BUILDING_PALETTE: Record<BuildingType, BuildingColors> = {
  // Tier 1
  wooden_hut: { walls: "#c4956a", roof: "#b83a2a", wallDark: "#a07850", accent: "#deb887" },
  farm: { walls: "#8b6b4a", roof: "#6b8e3a", wallDark: "#6d4c41", accent: "#a5d6a7" },
  sawmill: { walls: "#5d4037", roof: "#33691e", wallDark: "#3e2723", accent: "#795548" },
  storage_shed: { walls: "#8b7b5a", roof: "#6d4c41", wallDark: "#6d5b3a", accent: "#a1887f" },
  dirt_road: { walls: "#8d8d8d", roof: "#8d8d8d", wallDark: "#616161", accent: "#9e9e9e" },
  well: { walls: "#78909c", roof: "#546e7a", wallDark: "#455a64", accent: "#42a5f5" },
  // Tier 2
  kiln: { walls: "#bf360c", roof: "#e64a19", wallDark: "#8b2500", accent: "#ff8a65" },
  stone_house: { walls: "#a09880", roof: "#8d6e63", wallDark: "#7a7060", accent: "#bcaaa4" },
  marketplace: { walls: "#e8c170", roof: "#d32f2f", wallDark: "#c8a050", accent: "#ffeb3b" },
  stone_wall: { walls: "#9e9e9e", roof: "#9e9e9e", wallDark: "#757575", accent: "#bdbdbd" },
  warehouse: { walls: "#6d4c41", roof: "#5d4037", wallDark: "#4e342e", accent: "#8d6e63" },
  paved_road: { walls: "#757575", roof: "#757575", wallDark: "#545454", accent: "#8a8a8a" },
  workshop: { walls: "#6d4c41", roof: "#424242", wallDark: "#4e342e", accent: "#8d6e63" },
  inn: { walls: "#8d6e63", roof: "#bf360c", wallDark: "#5d4037", accent: "#ff8a65" },
  // Tier 3
  cement_works: { walls: "#757575", roof: "#616161", wallDark: "#545454", accent: "#9e9e9e" },
  town_hall: { walls: "#d4c5a0", roof: "#1565c0", wallDark: "#b0a080", accent: "#ffd700" },
  apartment_block: { walls: "#90a4ae", roof: "#78909c", wallDark: "#607d8b", accent: "#b0bec5" },
  bank: { walls: "#ffc107", roof: "#f57f17", wallDark: "#c8a000", accent: "#fff8e1" },
  university: { walls: "#c5cae9", roof: "#1565c0", wallDark: "#9fa8da", accent: "#e8eaf6" },
  hospital: { walls: "#ffffff", roof: "#f44336", wallDark: "#e0e0e0", accent: "#ef9a9a" },
  commercial_tower: { walls: "#80cbc4", roof: "#00897b", wallDark: "#4db6ac", accent: "#b2dfdb" },
  forge: { walls: "#ff6f00", roof: "#e65100", wallDark: "#bf360c", accent: "#ffb74d" },
  embassy: { walls: "#ce93d8", roof: "#7b1fa2", wallDark: "#ab47bc", accent: "#e1bee7" },
  // Tier 4
  skyscraper: { walls: "#78909c", roof: "#455a64", wallDark: "#546e7a", accent: "#b0bec5" },
  grand_bazaar: { walls: "#e65100", roof: "#bf360c", wallDark: "#b34100", accent: "#ffcc80" },
  mint: { walls: "#ffd700", roof: "#c8a000", wallDark: "#b8960a", accent: "#fff9c4" },
  monument: { walls: "#e0e0e0", roof: "#ffd700", wallDark: "#bdbdbd", accent: "#fff9c4" },
  spaceport: { walls: "#37474f", roof: "#263238", wallDark: "#1c2e36", accent: "#90a4ae" },
};

/** Flat types that have no vertical building height */
const FLAT_TYPES: BuildingType[] = ["dirt_road", "paved_road"];

/** Wall types - low box */
const WALL_TYPES: BuildingType[] = ["stone_wall"];

export function getBuildingTexture(type: BuildingType, tileWidth: number, tileHeight: number): Texture {
  const key = `building_${type}_${tileWidth}x${tileHeight}`;
  return getOrCreate(key, () => {
    const isoW = tileWidth * ISO_TILE_WIDTH;
    const isoH = tileHeight * ISO_TILE_HEIGHT;
    const tier = BUILDING_TIER[type] ?? 1;
    const tierH = TIER_HEIGHTS[tier] ?? 24;

    // Flat roads have minimal height
    const isFlat = FLAT_TYPES.includes(type);
    const isWall = WALL_TYPES.includes(type);
    const buildingH = isFlat ? 4 : isWall ? 8 : type === "monument" ? tierH + 10 : tierH;

    const canvasW = isoW + 4;
    const canvasH = isoH + buildingH + 20;
    const { canvas, ctx } = makeCanvas(canvasW, canvasH);

    const cx = canvasW / 2;
    const baseY = canvasH - isoH / 2 - 2;
    const colors = BUILDING_PALETTE[type];

    // --- Flat road types ---
    if (isFlat) {
      drawIsoDiamond(ctx, cx, baseY, isoW - 4, isoH - 2, colors.walls, "#616161");
      // Paved road: add lane markings
      if (type === "paved_road") {
        ctx.fillStyle = "#bdbdbd";
        ctx.globalAlpha = 0.5;
        ctx.fillRect(cx - 1, baseY - 2, 2, 4);
        ctx.globalAlpha = 1;
      }
      return Texture.from(canvas);
    }

    // --- Stone wall ---
    if (isWall) {
      drawIsoBox(ctx, cx, baseY - 8, isoW - 4, isoH - 2, 8, colors.roof, colors.wallDark, colors.walls);
      return Texture.from(canvas);
    }

    // --- Well ---
    if (type === "well") {
      // Circular stone base with water
      drawIsoDiamond(ctx, cx, baseY, isoW - 6, isoH - 4, "#78909c", "#546e7a");
      // Water inner
      drawIsoDiamond(ctx, cx, baseY, isoW * 0.4, isoH * 0.4, "#42a5f5");
      // Roof support posts
      ctx.fillStyle = "#5d4037";
      ctx.fillRect(cx - isoW * 0.2, baseY - 14, 2, 14);
      ctx.fillRect(cx + isoW * 0.2 - 2, baseY - 14, 2, 14);
      // Small roof
      ctx.fillStyle = "#8d6e63";
      ctx.fillRect(cx - isoW * 0.25, baseY - 16, isoW * 0.5, 3);
      return Texture.from(canvas);
    }

    // --- Monument (Tier 4 obelisk) ---
    if (type === "monument") {
      const obelW = isoW * 0.3;
      const obelH = buildingH;
      ctx.fillStyle = colors.walls;
      ctx.fillRect(cx - obelW / 2, baseY - obelH, obelW, obelH);
      ctx.fillStyle = colors.wallDark;
      ctx.fillRect(cx - obelW / 2, baseY - obelH, obelW * 0.4, obelH);
      // Gold cap
      ctx.fillStyle = colors.roof;
      ctx.beginPath();
      ctx.moveTo(cx - obelW / 2 - 2, baseY - obelH);
      ctx.lineTo(cx, baseY - obelH - 10);
      ctx.lineTo(cx + obelW / 2 + 2, baseY - obelH);
      ctx.closePath();
      ctx.fill();
      // Base
      drawIsoDiamond(ctx, cx, baseY, isoW - 4, isoH - 2, "#bdbdbd", "#9e9e9e");
      return Texture.from(canvas);
    }

    // --- Spaceport (special Tier 4) ---
    if (type === "spaceport") {
      // Launch pad base
      drawIsoDiamond(ctx, cx, baseY, isoW - 4, isoH - 2, "#546e7a", "#37474f");
      // Rocket body
      const rocketW = isoW * 0.15;
      const rocketH = buildingH;
      ctx.fillStyle = "#eceff1";
      ctx.fillRect(cx - rocketW / 2, baseY - rocketH, rocketW, rocketH);
      // Nose cone
      ctx.fillStyle = "#f44336";
      ctx.beginPath();
      ctx.moveTo(cx, baseY - rocketH - 8);
      ctx.lineTo(cx - rocketW / 2, baseY - rocketH);
      ctx.lineTo(cx + rocketW / 2, baseY - rocketH);
      ctx.closePath();
      ctx.fill();
      // Fins
      ctx.fillStyle = "#90a4ae";
      ctx.beginPath();
      ctx.moveTo(cx - rocketW / 2, baseY);
      ctx.lineTo(cx - rocketW / 2 - 4, baseY + 2);
      ctx.lineTo(cx - rocketW / 2, baseY - 6);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(cx + rocketW / 2, baseY);
      ctx.lineTo(cx + rocketW / 2 + 4, baseY + 2);
      ctx.lineTo(cx + rocketW / 2, baseY - 6);
      ctx.closePath();
      ctx.fill();
      // Flame
      ctx.fillStyle = "#ff9800";
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      ctx.moveTo(cx - 3, baseY);
      ctx.lineTo(cx, baseY + 8);
      ctx.lineTo(cx + 3, baseY);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
      return Texture.from(canvas);
    }

    // --- Farm (cropland) ---
    if (type === "farm") {
      drawIsoDiamond(ctx, cx, baseY, isoW - 4, isoH - 2, "#6d4c41");
      // Crop rows
      ctx.fillStyle = "#8bc34a";
      for (let i = -2; i <= 2; i++) {
        const rx = cx + i * (isoW * 0.1);
        ctx.fillRect(rx - 1, baseY - 4, 2, 6);
        ctx.fillStyle = "#4caf50";
        ctx.fillRect(rx - 2, baseY - 6, 4, 3);
        ctx.fillStyle = "#8bc34a";
      }
      // Small barn
      const barnH = tierH * 0.6;
      drawIsoBox(ctx, cx + isoW * 0.2, baseY - barnH - 2, isoW * 0.35, isoH * 0.35, barnH, colors.roof, colors.wallDark, colors.walls);
      return Texture.from(canvas);
    }

    // --- Generic building: box with roof ---
    const bodyH = buildingH * 0.6;
    const roofH = buildingH * 0.4;

    // Body
    drawIsoBox(ctx, cx, baseY - bodyH, isoW - 6, isoH - 4, bodyH, colors.walls, colors.wallDark, colors.accent);

    // Roof
    const roofW = isoW - 2;
    const roofIsoH = isoH;

    // Special roof styles per type
    if (type === "town_hall" || type === "embassy" || type === "university") {
      // Peaked/gabled roof
      ctx.fillStyle = colors.roof;
      ctx.beginPath();
      ctx.moveTo(cx, baseY - bodyH - roofH - 8);
      ctx.lineTo(cx + roofW / 2, baseY - bodyH);
      ctx.lineTo(cx, baseY - bodyH + roofIsoH / 2);
      ctx.lineTo(cx - roofW / 2, baseY - bodyH);
      ctx.closePath();
      ctx.fill();
      // Flag
      if (type === "town_hall" || type === "embassy") {
        ctx.fillStyle = "#ffd700";
        ctx.fillRect(cx - 1, baseY - bodyH - roofH - 16, 2, 12);
        ctx.fillStyle = type === "embassy" ? "#7b1fa2" : "#d32f2f";
        ctx.fillRect(cx + 1, baseY - bodyH - roofH - 16, 8, 5);
      }
    } else if (type === "skyscraper" || type === "commercial_tower" || type === "apartment_block") {
      // Flat modern roof with antenna/detail
      drawIsoDiamond(ctx, cx, baseY - bodyH - 2, roofW - 4, roofIsoH - 2, colors.roof);
      // Antenna for skyscraper
      if (type === "skyscraper") {
        ctx.fillStyle = "#bdbdbd";
        ctx.fillRect(cx - 1, baseY - bodyH - 12, 2, 10);
      }
      // Windows grid for tall buildings
      ctx.fillStyle = "#fff8e1";
      ctx.globalAlpha = 0.5;
      for (let row = 0; row < 3; row++) {
        for (let col = -1; col <= 1; col++) {
          ctx.fillRect(cx + col * 6 - 1, baseY - bodyH * 0.3 - row * 6, 3, 3);
        }
      }
      ctx.globalAlpha = 1;
    } else if (type === "grand_bazaar") {
      // Domed roof
      ctx.fillStyle = colors.roof;
      ctx.beginPath();
      ctx.arc(cx, baseY - bodyH - 4, roofW * 0.3, Math.PI, 0);
      ctx.closePath();
      ctx.fill();
    } else {
      // Standard flat/angled roof
      drawIsoDiamond(ctx, cx, baseY - bodyH - 2, roofW - 4, roofIsoH - 2, colors.roof);
    }

    // --- Per-type decorations ---

    // Windows for residential/commercial
    if (["wooden_hut", "stone_house", "inn", "marketplace", "bank"].includes(type)) {
      ctx.fillStyle = "#fff8e1";
      ctx.globalAlpha = 0.7;
      ctx.fillRect(cx - 6, baseY - bodyH * 0.5, 3, 3);
      ctx.fillRect(cx + 3, baseY - bodyH * 0.5, 3, 3);
      ctx.globalAlpha = 1;
    }

    // Chimney for huts and inns
    if (type === "wooden_hut" || type === "inn") {
      ctx.fillStyle = "#795548";
      ctx.fillRect(cx + isoW * 0.15, baseY - bodyH - 8, 4, 8);
    }

    // Gear for workshop
    if (type === "workshop") {
      ctx.fillStyle = "#ffc107";
      ctx.beginPath();
      ctx.arc(cx, baseY - bodyH * 0.6, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Forge: flame glow
    if (type === "forge") {
      ctx.fillStyle = "#ff6f00";
      ctx.globalAlpha = 0.8;
      ctx.beginPath();
      ctx.arc(cx - 4, baseY - bodyH * 0.3, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffeb3b";
      ctx.beginPath();
      ctx.arc(cx - 4, baseY - bodyH * 0.3, 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // Kiln: glow at base
    if (type === "kiln") {
      ctx.fillStyle = "#ff5722";
      ctx.globalAlpha = 0.6;
      ctx.fillRect(cx - 3, baseY - 4, 6, 4);
      ctx.globalAlpha = 1;
    }

    // Hospital: red cross
    if (type === "hospital") {
      ctx.fillStyle = "#f44336";
      ctx.fillRect(cx - 1, baseY - bodyH * 0.7, 2, 8);
      ctx.fillRect(cx - 4, baseY - bodyH * 0.55, 8, 2);
    }

    // Bank: coin symbol
    if (type === "bank" || type === "mint") {
      ctx.fillStyle = "#ffd700";
      ctx.beginPath();
      ctx.arc(cx, baseY - bodyH * 0.5, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#f57f17";
      ctx.font = "bold 5px monospace";
      ctx.textAlign = "center";
      ctx.fillText("$", cx, baseY - bodyH * 0.45);
    }

    // Sawmill: log detail
    if (type === "sawmill") {
      ctx.fillStyle = "#5d4037";
      ctx.fillRect(cx - 8, baseY - 2, 6, 3);
      ctx.fillRect(cx + 2, baseY - 2, 6, 3);
    }

    // Storage / warehouse: crate detail
    if (type === "storage_shed" || type === "warehouse") {
      ctx.fillStyle = "#8d6e63";
      ctx.fillRect(cx - 4, baseY - bodyH * 0.3, 5, 5);
      ctx.strokeStyle = "#5d4037";
      ctx.lineWidth = 0.5;
      ctx.strokeRect(cx - 4, baseY - bodyH * 0.3, 5, 5);
    }

    // Cement works: smokestack
    if (type === "cement_works") {
      ctx.fillStyle = "#616161";
      ctx.fillRect(cx + isoW * 0.12, baseY - bodyH - 12, 4, 12);
    }

    return Texture.from(canvas);
  });
}

/** Get a construction/scaffolding texture for an under-construction building */
export function getScaffoldingTexture(tileWidth: number, tileHeight: number): Texture {
  const key = `scaffolding_${tileWidth}x${tileHeight}`;
  return getOrCreate(key, () => {
    const isoW = tileWidth * ISO_TILE_WIDTH;
    const isoH = tileHeight * ISO_TILE_HEIGHT;
    const canvasW = isoW + 4;
    const canvasH = isoH + 30;
    const { canvas, ctx } = makeCanvas(canvasW, canvasH);

    const cx = canvasW / 2;
    const baseY = canvasH - isoH / 2 - 2;

    // Foundation
    drawIsoDiamond(ctx, cx, baseY, isoW - 4, isoH - 2, "rgba(139,115,85,0.5)", "#8b7355");

    // Scaffolding poles
    ctx.strokeStyle = "#8b7355";
    ctx.lineWidth = 2;
    const poles = [
      [cx - isoW * 0.2, baseY],
      [cx + isoW * 0.2, baseY],
      [cx, baseY - isoH * 0.2],
      [cx, baseY + isoH * 0.2],
    ];
    for (const [px, py] of poles) {
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px, py - 20);
      ctx.stroke();
    }

    // Cross braces
    ctx.strokeStyle = "#a0855a";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - isoW * 0.2, baseY - 5);
    ctx.lineTo(cx + isoW * 0.2, baseY - 15);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + isoW * 0.2, baseY - 5);
    ctx.lineTo(cx - isoW * 0.2, baseY - 15);
    ctx.stroke();

    return Texture.from(canvas);
  });
}

// ============================================================
// Agent / Character Sprites
// ============================================================

/**
 * Generate a character sprite frame for a given direction and animation frame.
 * Returns a simple isometric humanoid character.
 */
export function getAgentTexture(direction: number, frame: number, action: "idle" | "walk" | "action"): Texture {
  const key = `agent_${direction}_${frame}_${action}`;
  return getOrCreate(key, () => {
    const w = 32;
    const h = 48;
    const { canvas, ctx } = makeCanvas(w, h);

    const cx = w / 2;

    // Walk bob
    const bobY = action === "walk" ? Math.sin(frame * Math.PI) * 2 : 0;
    // Action raise
    const armRaise = action === "action" ? -4 : 0;

    // Shadow
    ctx.fillStyle = "rgba(0,0,0,0.2)";
    ctx.beginPath();
    ctx.ellipse(cx, h - 4, 10, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Body
    const bodyY = h - 22 - bobY;
    ctx.fillStyle = "#ddd";
    ctx.fillRect(cx - 6, bodyY, 12, 14);

    // Head
    ctx.fillStyle = "#ffe0b2";
    ctx.beginPath();
    ctx.arc(cx, bodyY - 5, 7, 0, Math.PI * 2);
    ctx.fill();

    // Eyes (direction-based)
    ctx.fillStyle = "#333";
    if (direction >= 2 && direction <= 6) {
      // Facing some left component
      ctx.fillRect(cx - 4, bodyY - 6, 2, 2);
    }
    if (direction <= 2 || direction >= 6) {
      // Facing some right component
      ctx.fillRect(cx + 2, bodyY - 6, 2, 2);
    }
    if (direction === 0 || direction === 4) {
      // Straight S or N — both eyes
      ctx.fillRect(cx - 3, bodyY - 6, 2, 2);
      ctx.fillRect(cx + 1, bodyY - 6, 2, 2);
    }

    // Legs
    ctx.fillStyle = "#5d4037";
    const legSpread = action === "walk" ? (frame === 0 ? 3 : -3) : 0;
    ctx.fillRect(cx - 4 - legSpread, bodyY + 14, 4, 8);
    ctx.fillRect(cx + legSpread, bodyY + 14, 4, 8);

    // Arms
    ctx.fillStyle = "#ffe0b2";
    ctx.fillRect(cx - 9, bodyY + 2 + armRaise, 3, 8);
    ctx.fillRect(cx + 6, bodyY + 2, 3, 8);

    return Texture.from(canvas);
  });
}

/** Get a shadow texture */
export function getShadowTexture(): Texture {
  return getOrCreate("shadow", () => {
    const { canvas, ctx } = makeCanvas(24, 12);
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.beginPath();
    ctx.ellipse(12, 6, 10, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    return Texture.from(canvas);
  });
}

// ============================================================
// UI / Effect Sprites
// ============================================================

/** Get a small colored circle sprite (for resource indicators, particles) */
export function getCircleTexture(color: string, radius: number): Texture {
  const key = `circle_${color}_${radius}`;
  return getOrCreate(key, () => {
    const size = radius * 2 + 2;
    const { canvas, ctx } = makeCanvas(size, size);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(radius + 1, radius + 1, radius, 0, Math.PI * 2);
    ctx.fill();
    return Texture.from(canvas);
  });
}

/** Get a small square texture for particles */
export function getSquareTexture(color: string, size: number): Texture {
  const key = `square_${color}_${size}`;
  return getOrCreate(key, () => {
    const { canvas, ctx } = makeCanvas(size, size);
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, size, size);
    return Texture.from(canvas);
  });
}

/** All building types for preloading */
const ALL_BUILDING_TYPES: BuildingType[] = [
  // Tier 1
  "wooden_hut", "farm", "sawmill", "storage_shed", "dirt_road", "well",
  // Tier 2
  "kiln", "stone_house", "marketplace", "stone_wall", "warehouse", "paved_road", "workshop", "inn",
  // Tier 3
  "cement_works", "town_hall", "apartment_block", "bank", "university", "hospital", "commercial_tower", "forge", "embassy",
  // Tier 4
  "skyscraper", "grand_bazaar", "mint", "monument", "spaceport",
];

/** All terrain types for preloading */
const ALL_TERRAIN_TYPES: TerrainType[] = ["plains", "fertile", "forest", "mountain", "water", "riverbank", "desert"];

/** Preload all textures (call at startup) */
export function preloadAllTextures(): void {
  // Preload terrain
  for (const t of ALL_TERRAIN_TYPES) getTerrainTexture(t);

  // Preload common building types at common sizes
  for (const t of ALL_BUILDING_TYPES) {
    getBuildingTexture(t, 1, 1);
    getBuildingTexture(t, 2, 2);
    getBuildingTexture(t, 3, 3);
  }

  // Preload agent frames
  for (let dir = 0; dir < 8; dir++) {
    for (let frame = 0; frame < 2; frame++) {
      getAgentTexture(dir, frame, "idle");
      getAgentTexture(dir, frame, "walk");
      getAgentTexture(dir, frame, "action");
    }
  }

  getShadowTexture();
}
