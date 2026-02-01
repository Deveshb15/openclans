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
  grass: { top: "#4caf50", variation: ["#43a047", "#66bb6a", "#388e3c"] },
  dirt: { top: "#8d6e63", variation: ["#795548", "#6d4c41", "#a1887f"] },
  stone: { top: "#9e9e9e", variation: ["#757575", "#bdbdbd", "#616161"] },
  water: { top: "#2196f3", variation: ["#1e88e5", "#42a5f5", "#1976d2"] },
  sand: { top: "#fdd835", variation: ["#fbc02d", "#ffee58", "#f9a825"] },
};

export function getTerrainTexture(terrain: TerrainType): Texture {
  return getOrCreate(`terrain_${terrain}`, () => {
    const w = ISO_TILE_WIDTH;
    const h = ISO_TILE_HEIGHT;
    const { canvas, ctx } = makeCanvas(w, h + 4);
    const colors = TERRAIN_COLORS[terrain];

    // Main diamond
    drawIsoDiamond(ctx, w / 2, h / 2, w - 2, h - 2, colors.top);

    // Add some pixel variation for texture
    for (let i = 0; i < 8; i++) {
      const px = Math.random() * (w - 16) + 8;
      const py = Math.random() * (h - 8) + 4;
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
      ctx.moveTo(w / 2, 1);
      ctx.lineTo(w - 1, h / 2);
      ctx.stroke();
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

const BUILDING_PALETTE: Record<BuildingType, BuildingColors> = {
  house: { walls: "#c4956a", roof: "#b83a2a", wallDark: "#a07850", accent: "#deb887" },
  farm: { walls: "#8b6b4a", roof: "#6b8e3a", wallDark: "#6d4c41", accent: "#a5d6a7" },
  lumbermill: { walls: "#5d4037", roof: "#33691e", wallDark: "#3e2723", accent: "#795548" },
  quarry: { walls: "#78909c", roof: "#546e7a", wallDark: "#455a64", accent: "#b0bec5" },
  market: { walls: "#e8c170", roof: "#d32f2f", wallDark: "#c8a050", accent: "#ffeb3b" },
  workshop: { walls: "#6d4c41", roof: "#424242", wallDark: "#4e342e", accent: "#8d6e63" },
  tavern: { walls: "#8d6e63", roof: "#bf360c", wallDark: "#5d4037", accent: "#ff8a65" },
  townhall: { walls: "#d4c5a0", roof: "#1565c0", wallDark: "#b0a080", accent: "#ffd700" },
  wall: { walls: "#9e9e9e", roof: "#9e9e9e", wallDark: "#757575", accent: "#bdbdbd" },
  garden: { walls: "#66bb6a", roof: "#43a047", wallDark: "#388e3c", accent: "#a5d6a7" },
  monument: { walls: "#e0e0e0", roof: "#ffd700", wallDark: "#bdbdbd", accent: "#fff9c4" },
  road: { walls: "#8d8d8d", roof: "#8d8d8d", wallDark: "#616161", accent: "#9e9e9e" },
};

export function getBuildingTexture(type: BuildingType, tileWidth: number, tileHeight: number): Texture {
  const key = `building_${type}_${tileWidth}x${tileHeight}`;
  return getOrCreate(key, () => {
    const isoW = tileWidth * ISO_TILE_WIDTH;
    const isoH = tileHeight * ISO_TILE_HEIGHT;
    const buildingH = type === "wall" || type === "road" ? 4 : type === "townhall" ? 40 : type === "monument" ? 35 : 24;
    const canvasW = isoW + 4;
    const canvasH = isoH + buildingH + 10;
    const { canvas, ctx } = makeCanvas(canvasW, canvasH);

    const cx = canvasW / 2;
    const baseY = canvasH - isoH / 2 - 2;
    const colors = BUILDING_PALETTE[type];

    if (type === "road") {
      drawIsoDiamond(ctx, cx, baseY, isoW - 4, isoH - 2, colors.walls, "#616161");
      return Texture.from(canvas);
    }

    if (type === "wall") {
      drawIsoBox(ctx, cx, baseY - 6, isoW - 4, isoH - 2, 6, colors.roof, colors.wallDark, colors.walls);
      return Texture.from(canvas);
    }

    if (type === "garden") {
      // Flat garden with flowers
      drawIsoDiamond(ctx, cx, baseY, isoW - 4, isoH - 2, "#4caf50");
      // Flowers
      const flowerColors = ["#e91e63", "#ff9800", "#ffeb3b", "#9c27b0", "#f44336"];
      for (let i = 0; i < 12; i++) {
        const fx = cx + (Math.random() - 0.5) * (isoW * 0.5);
        const fy = baseY + (Math.random() - 0.5) * (isoH * 0.4);
        ctx.fillStyle = flowerColors[i % flowerColors.length];
        ctx.fillRect(fx, fy, 3, 3);
      }
      return Texture.from(canvas);
    }

    if (type === "monument") {
      // Tall obelisk
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

    // Generic building: box with roof
    const bodyH = buildingH * 0.6;
    const roofH = buildingH * 0.4;

    // Body
    drawIsoBox(ctx, cx, baseY - bodyH, isoW - 6, isoH - 4, bodyH, colors.walls, colors.wallDark, colors.accent);

    // Roof (slightly wider, offset up)
    const roofW = isoW - 2;
    const roofIsoH = isoH;

    if (type === "townhall") {
      // Peaked roof
      ctx.fillStyle = colors.roof;
      ctx.beginPath();
      ctx.moveTo(cx, baseY - bodyH - roofH - 8);
      ctx.lineTo(cx + roofW / 2, baseY - bodyH);
      ctx.lineTo(cx, baseY - bodyH + roofIsoH / 2);
      ctx.lineTo(cx - roofW / 2, baseY - bodyH);
      ctx.closePath();
      ctx.fill();
      // Flag
      ctx.fillStyle = "#ffd700";
      ctx.fillRect(cx - 1, baseY - bodyH - roofH - 16, 2, 12);
      ctx.fillStyle = "#d32f2f";
      ctx.fillRect(cx + 1, baseY - bodyH - roofH - 16, 8, 5);
    } else {
      // Flat/angled roof
      drawIsoDiamond(ctx, cx, baseY - bodyH - 2, roofW - 4, roofIsoH - 2, colors.roof);
    }

    // Window dots for houses/taverns
    if (type === "house" || type === "tavern" || type === "market") {
      ctx.fillStyle = "#fff8e1";
      ctx.globalAlpha = 0.7;
      ctx.fillRect(cx - 6, baseY - bodyH * 0.5, 3, 3);
      ctx.fillRect(cx + 3, baseY - bodyH * 0.5, 3, 3);
      ctx.globalAlpha = 1;
    }

    // Chimney for house
    if (type === "house") {
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

/** Preload all textures (call at startup) */
export function preloadAllTextures(): void {
  // Preload terrain
  const terrains: TerrainType[] = ["grass", "dirt", "stone", "water", "sand"];
  for (const t of terrains) getTerrainTexture(t);

  // Preload common building types at common sizes
  const types: BuildingType[] = ["house", "farm", "lumbermill", "quarry", "market", "workshop", "tavern", "townhall", "wall", "garden", "monument", "road"];
  for (const t of types) {
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
