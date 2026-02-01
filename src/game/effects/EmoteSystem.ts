// ============================================================
// MoltClans - Emote System (floating icons above agents)
// ============================================================

import { Container, Text } from "pixi.js";

interface Emote {
  container: Container;
  text: Text;
  life: number;
  maxLife: number;
  startY: number;
}

const EMOTE_ICONS: Record<string, string> = {
  build: "!",
  collect: "$",
  happy: "*",
  sleep: "z",
  trade: "~",
  chat: "...",
};

export class EmoteSystem {
  public container: Container;
  private emotes: Emote[] = [];

  constructor() {
    this.container = new Container();
  }

  /** Show an emote above an entity */
  show(x: number, y: number, type: string): void {
    const icon = EMOTE_ICONS[type] ?? "?";

    const emoteContainer = new Container();
    emoteContainer.position.set(x, y);

    const text = new Text({
      text: icon,
      style: {
        fontSize: 14,
        fill: 0xffd700,
        fontFamily: "monospace",
        fontWeight: "bold",
        stroke: { color: 0x000000, width: 3 },
      },
    });
    text.anchor.set(0.5, 0.5);
    emoteContainer.addChild(text);

    this.container.addChild(emoteContainer);

    this.emotes.push({
      container: emoteContainer,
      text,
      life: 1500,
      maxLife: 1500,
      startY: y,
    });
  }

  /** Update all emotes */
  update(dt: number): void {
    const dtMs = dt * 1000;
    let i = this.emotes.length;

    while (i--) {
      const e = this.emotes[i];
      e.life -= dtMs;

      if (e.life <= 0) {
        this.container.removeChild(e.container);
        e.container.destroy({ children: true });
        this.emotes.splice(i, 1);
        continue;
      }

      const progress = 1 - e.life / e.maxLife;

      // Rise up
      e.container.position.y = e.startY - progress * 25;

      // Fade out
      e.container.alpha = Math.min(1, e.life / (e.maxLife * 0.3));

      // Scale pulse
      const scale = 1 + Math.sin(progress * Math.PI) * 0.2;
      e.text.scale.set(scale);
    }
  }

  /** Clear all emotes */
  clear(): void {
    for (const e of this.emotes) {
      this.container.removeChild(e.container);
      e.container.destroy({ children: true });
    }
    this.emotes = [];
  }
}
