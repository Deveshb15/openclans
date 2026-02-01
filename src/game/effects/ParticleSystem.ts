// ============================================================
// MoltClans - Particle System (PixiJS)
// ============================================================

import { Container, Sprite } from "pixi.js";
import { getCircleTexture, getSquareTexture } from "../assets/SpriteAtlas";

interface Particle {
  sprite: Sprite;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  fadeStart: number; // fraction of life at which fading begins
  gravity: number;
  scaleDecay: number;
}

const MAX_PARTICLES = 200;

export class ParticleSystem {
  public container: Container;
  private particles: Particle[] = [];

  constructor() {
    this.container = new Container();
  }

  /** Emit particles at a position */
  emit(
    x: number,
    y: number,
    count: number,
    config: {
      color: string;
      shape?: "circle" | "square";
      size?: number;
      speedMin?: number;
      speedMax?: number;
      life?: number;
      gravity?: number;
      spread?: number;
      scaleDecay?: number;
    },
  ): void {
    const {
      color,
      shape = "circle",
      size = 3,
      speedMin = 0.3,
      speedMax = 1.5,
      life = 1500,
      gravity = 0,
      spread = Math.PI * 2,
      scaleDecay = 0,
    } = config;

    for (let i = 0; i < count; i++) {
      if (this.particles.length >= MAX_PARTICLES) {
        // Recycle oldest
        const oldest = this.particles.shift()!;
        this.container.removeChild(oldest.sprite);
      }

      const texture = shape === "circle"
        ? getCircleTexture(color, size)
        : getSquareTexture(color, size);

      const sprite = new Sprite(texture);
      sprite.anchor.set(0.5, 0.5);
      sprite.position.set(x, y);

      const angle = Math.random() * spread - spread / 2 - Math.PI / 2;
      const speed = speedMin + Math.random() * (speedMax - speedMin);

      const particle: Particle = {
        sprite,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life,
        maxLife: life,
        fadeStart: 0.6,
        gravity,
        scaleDecay,
      };

      this.container.addChild(sprite);
      this.particles.push(particle);
    }
  }

  /** Update all particles */
  update(dt: number): void {
    const dtMs = dt * 1000;
    let i = this.particles.length;

    while (i--) {
      const p = this.particles[i];
      p.life -= dtMs;

      if (p.life <= 0) {
        this.container.removeChild(p.sprite);
        this.particles.splice(i, 1);
        continue;
      }

      p.vy += p.gravity * dt;
      p.sprite.position.x += p.vx;
      p.sprite.position.y += p.vy;

      // Fade
      const lifeRatio = p.life / p.maxLife;
      if (lifeRatio < p.fadeStart) {
        p.sprite.alpha = lifeRatio / p.fadeStart;
      }

      // Scale decay
      if (p.scaleDecay > 0) {
        const s = Math.max(0.1, 1 - (1 - lifeRatio) * p.scaleDecay);
        p.sprite.scale.set(s);
      }
    }
  }

  /** Clear all particles */
  clear(): void {
    for (const p of this.particles) {
      this.container.removeChild(p.sprite);
    }
    this.particles = [];
  }
}
