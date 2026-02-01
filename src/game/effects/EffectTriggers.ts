// ============================================================
// MoltClans - Effect Triggers (maps game events to particles)
// ============================================================

import { ParticleSystem } from "./ParticleSystem";
import { gridToScreen } from "../iso/IsoMath";

export class EffectTriggers {
  private particles: ParticleSystem;

  constructor(particles: ParticleSystem) {
    this.particles = particles;
  }

  /** Building completion confetti burst */
  buildingCompleted(gridX: number, gridY: number, w: number, h: number): void {
    const screen = gridToScreen(gridX + w / 2, gridY + h / 2);
    const colors = ["#ffd700", "#ff6347", "#4caf50", "#2196f3", "#e91e63", "#ff9800"];

    for (const color of colors) {
      this.particles.emit(screen.x, screen.y - 20, 4, {
        color,
        shape: "square",
        size: 3,
        speedMin: 0.5,
        speedMax: 2,
        life: 2000,
        gravity: 0.03,
        spread: Math.PI * 2,
      });
    }
  }

  /** Construction dust */
  constructionDust(gridX: number, gridY: number): void {
    const screen = gridToScreen(gridX + 0.5, gridY + 0.5);
    this.particles.emit(screen.x, screen.y - 10, 4, {
      color: "#a0855a",
      shape: "circle",
      size: 2,
      speedMin: 0.2,
      speedMax: 0.8,
      life: 1000,
      gravity: 0.01,
      spread: Math.PI,
    });
  }

  /** Hammer sparks during building */
  hammerSparks(gridX: number, gridY: number): void {
    const screen = gridToScreen(gridX + 0.5, gridY + 0.5);
    this.particles.emit(screen.x, screen.y - 15, 3, {
      color: "#ffd700",
      shape: "square",
      size: 2,
      speedMin: 0.5,
      speedMax: 1.5,
      life: 600,
      gravity: 0.05,
      spread: Math.PI,
    });
  }

  /** Resource collection sparkles */
  resourceCollected(gridX: number, gridY: number, resourceType: string): void {
    const screen = gridToScreen(gridX + 0.5, gridY + 0.5);
    const colorMap: Record<string, string> = {
      wood: "#8b4513",
      stone: "#9e9e9e",
      food: "#4caf50",
      gold: "#ffd700",
    };
    this.particles.emit(screen.x, screen.y - 10, 5, {
      color: colorMap[resourceType] ?? "#ffffff",
      shape: "circle",
      size: 2,
      speedMin: 0.3,
      speedMax: 1,
      life: 1200,
      gravity: -0.01,
      spread: Math.PI * 2,
    });
  }

  /** Ambient fireflies for night */
  spawnFirefly(worldWidth: number, worldHeight: number): void {
    const x = Math.random() * worldWidth - worldWidth / 2;
    const y = Math.random() * worldHeight;
    this.particles.emit(x, y, 1, {
      color: "#adff2f",
      shape: "circle",
      size: 2,
      speedMin: 0.05,
      speedMax: 0.15,
      life: 5000,
      gravity: -0.002,
      spread: Math.PI * 2,
      scaleDecay: 0.5,
    });
  }
}
