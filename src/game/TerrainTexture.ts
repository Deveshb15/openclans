// ============================================================
// MoltClans - Terrain Texture Generator
// Generates a 2048×2048 canvas texture from 128×128 grid
// ============================================================

import * as THREE from "three";
import { GAME_CONFIG } from "../config";
import { GRID_WIDTH, GRID_HEIGHT } from "../shared/constants";
import type { GridCell } from "../shared/types";

const TEX_SIZE = 2048;
const PIXELS_PER_TILE = TEX_SIZE / GRID_WIDTH; // 16

function hexToRgb(hex: number): [number, number, number] {
  return [(hex >> 16) & 0xff, (hex >> 8) & 0xff, hex & 0xff];
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function lerpColor(
  r1: number, g1: number, b1: number,
  r2: number, g2: number, b2: number,
  t: number
): [number, number, number] {
  return [
    Math.round(r1 + (r2 - r1) * t),
    Math.round(g1 + (g2 - g1) * t),
    Math.round(b1 + (b2 - b1) * t),
  ];
}

/**
 * Generate a lush 2048×2048 terrain texture from the grid data.
 */
export function generateTerrainTexture(grid: GridCell[][]): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = TEX_SIZE;
  canvas.height = TEX_SIZE;
  const ctx = canvas.getContext("2d")!;

  // First pass: fill each tile with its terrain base color + variation
  for (let gy = 0; gy < GRID_HEIGHT; gy++) {
    for (let gx = 0; gx < GRID_WIDTH; gx++) {
      if (!grid[gy] || !grid[gy][gx]) continue;
      const cell = grid[gy][gx];
      const terrain = cell.terrain;
      const colors = GAME_CONFIG.TERRAIN_COLORS_3D[terrain];
      if (!colors || colors.length === 0) continue;

      const px = gx * PIXELS_PER_TILE;
      const py = gy * PIXELS_PER_TILE;

      // Base fill with random variation from palette
      const baseColor = pickRandom(colors);
      const [br, bg, bb] = hexToRgb(baseColor);
      ctx.fillStyle = `rgb(${br},${bg},${bb})`;
      ctx.fillRect(px, py, PIXELS_PER_TILE, PIXELS_PER_TILE);

      // Add sub-tile variation patches
      for (let i = 0; i < 3; i++) {
        const patchColor = pickRandom(colors);
        const [pr, pg, pb] = hexToRgb(patchColor);
        const patchX = px + Math.random() * (PIXELS_PER_TILE - 4);
        const patchY = py + Math.random() * (PIXELS_PER_TILE - 4);
        const patchW = 2 + Math.random() * 6;
        const patchH = 2 + Math.random() * 6;
        ctx.fillStyle = `rgba(${pr},${pg},${pb},0.6)`;
        ctx.fillRect(patchX, patchY, patchW, patchH);
      }

      // Terrain-specific details
      if (terrain === "grass") {
        drawGrassDetails(ctx, px, py);
      } else if (terrain === "dirt") {
        drawDirtDetails(ctx, px, py);
      } else if (terrain === "water") {
        drawWaterDetails(ctx, px, py);
      } else if (terrain === "stone") {
        drawStoneDetails(ctx, px, py);
      } else if (terrain === "sand") {
        drawSandDetails(ctx, px, py);
      }
    }
  }

  // Second pass: edge blending between different terrain types
  blendEdges(ctx, grid);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;

  return texture;
}

function drawGrassDetails(ctx: CanvasRenderingContext2D, px: number, py: number): void {
  // Grass blade strokes
  for (let i = 0; i < 4; i++) {
    const x = px + 2 + Math.random() * (PIXELS_PER_TILE - 4);
    const y = py + 4 + Math.random() * (PIXELS_PER_TILE - 6);
    ctx.strokeStyle = `rgba(30,${100 + Math.floor(Math.random() * 60)},30,0.5)`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (Math.random() - 0.5) * 2, y - 2 - Math.random() * 2);
    ctx.stroke();
  }

  // Scattered flower dots
  if (Math.random() < 0.3) {
    const flowerColors = ["rgba(255,80,80,0.8)", "rgba(255,255,100,0.8)", "rgba(255,255,255,0.7)"];
    const fx = px + 3 + Math.random() * (PIXELS_PER_TILE - 6);
    const fy = py + 3 + Math.random() * (PIXELS_PER_TILE - 6);
    ctx.fillStyle = pickRandom(flowerColors);
    ctx.fillRect(fx, fy, 1, 1);
  }
}

function drawDirtDetails(ctx: CanvasRenderingContext2D, px: number, py: number): void {
  // Pebble dots
  for (let i = 0; i < 2; i++) {
    const x = px + 2 + Math.random() * (PIXELS_PER_TILE - 4);
    const y = py + 2 + Math.random() * (PIXELS_PER_TILE - 4);
    ctx.fillStyle = `rgba(${140 + Math.floor(Math.random() * 40)},${120 + Math.floor(Math.random() * 30)},${100 + Math.floor(Math.random() * 20)},0.5)`;
    ctx.beginPath();
    ctx.arc(x, y, 0.8 + Math.random() * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Subtle crack lines
  if (Math.random() < 0.3) {
    const cx = px + Math.random() * PIXELS_PER_TILE;
    const cy = py + Math.random() * PIXELS_PER_TILE;
    ctx.strokeStyle = "rgba(80,60,40,0.3)";
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + (Math.random() - 0.5) * 6, cy + (Math.random() - 0.5) * 6);
    ctx.stroke();
  }
}

function drawWaterDetails(ctx: CanvasRenderingContext2D, px: number, py: number): void {
  // Wave patterns - lighter curved strokes
  for (let i = 0; i < 2; i++) {
    const wx = px + 2 + Math.random() * (PIXELS_PER_TILE - 6);
    const wy = py + 3 + Math.random() * (PIXELS_PER_TILE - 6);
    ctx.strokeStyle = `rgba(150,210,255,${0.3 + Math.random() * 0.3})`;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(wx, wy);
    ctx.quadraticCurveTo(wx + 3, wy - 1.5, wx + 6, wy);
    ctx.stroke();
  }

  // White foam spots
  if (Math.random() < 0.2) {
    const fx = px + 2 + Math.random() * (PIXELS_PER_TILE - 4);
    const fy = py + 2 + Math.random() * (PIXELS_PER_TILE - 4);
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.fillRect(fx, fy, 1, 1);
  }
}

function drawStoneDetails(ctx: CanvasRenderingContext2D, px: number, py: number): void {
  // Crack line patterns
  if (Math.random() < 0.4) {
    const cx = px + 2 + Math.random() * (PIXELS_PER_TILE - 4);
    const cy = py + 2 + Math.random() * (PIXELS_PER_TILE - 4);
    ctx.strokeStyle = "rgba(60,60,60,0.3)";
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + (Math.random() - 0.5) * 8, cy + (Math.random() - 0.5) * 8);
    ctx.stroke();
  }

  // Varied shade patches
  for (let i = 0; i < 2; i++) {
    const shade = 100 + Math.floor(Math.random() * 80);
    const sx = px + Math.random() * (PIXELS_PER_TILE - 3);
    const sy = py + Math.random() * (PIXELS_PER_TILE - 3);
    ctx.fillStyle = `rgba(${shade},${shade},${shade},0.3)`;
    ctx.fillRect(sx, sy, 2 + Math.random() * 3, 2 + Math.random() * 3);
  }
}

function drawSandDetails(ctx: CanvasRenderingContext2D, px: number, py: number): void {
  // Dune ripple lines
  if (Math.random() < 0.4) {
    const ry = py + 3 + Math.random() * (PIXELS_PER_TILE - 6);
    ctx.strokeStyle = `rgba(${200 + Math.floor(Math.random() * 50)},${180 + Math.floor(Math.random() * 40)},50,0.2)`;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(px + 1, ry);
    ctx.lineTo(px + PIXELS_PER_TILE - 1, ry + (Math.random() - 0.5) * 2);
    ctx.stroke();
  }
}

function blendEdges(ctx: CanvasRenderingContext2D, grid: GridCell[][]): void {
  // For each tile, if its neighbor has a different terrain type, blend the edge
  const blendSize = 3;

  for (let gy = 0; gy < GRID_HEIGHT; gy++) {
    for (let gx = 0; gx < GRID_WIDTH; gx++) {
      if (!grid[gy] || !grid[gy][gx]) continue;
      const terrain = grid[gy][gx].terrain;

      // Check right neighbor
      if (gx + 1 < GRID_WIDTH && grid[gy][gx + 1] && grid[gy][gx + 1].terrain !== terrain) {
        const neighborColors = GAME_CONFIG.TERRAIN_COLORS_3D[grid[gy][gx + 1].terrain];
        if (neighborColors && neighborColors.length > 0) {
          const [nr, ng, nb] = hexToRgb(neighborColors[0]);
          const edgeX = (gx + 1) * PIXELS_PER_TILE;
          for (let i = 0; i < blendSize; i++) {
            const t = (blendSize - i) / (blendSize * 2);
            ctx.fillStyle = `rgba(${nr},${ng},${nb},${t * 0.4})`;
            ctx.fillRect(edgeX - blendSize + i, gy * PIXELS_PER_TILE, 1, PIXELS_PER_TILE);
          }
        }
      }

      // Check bottom neighbor
      if (gy + 1 < GRID_HEIGHT && grid[gy + 1] && grid[gy + 1][gx] && grid[gy + 1][gx].terrain !== terrain) {
        const neighborColors = GAME_CONFIG.TERRAIN_COLORS_3D[grid[gy + 1][gx].terrain];
        if (neighborColors && neighborColors.length > 0) {
          const [nr, ng, nb] = hexToRgb(neighborColors[0]);
          const edgeY = (gy + 1) * PIXELS_PER_TILE;
          for (let i = 0; i < blendSize; i++) {
            const t = (blendSize - i) / (blendSize * 2);
            ctx.fillStyle = `rgba(${nr},${ng},${nb},${t * 0.4})`;
            ctx.fillRect(gx * PIXELS_PER_TILE, edgeY - blendSize + i, PIXELS_PER_TILE, 1);
          }
        }
      }
    }
  }
}
