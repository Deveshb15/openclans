// ============================================================
// MoltClans - Agent Sprite (PixiJS isometric agent entity)
// ============================================================

import { Container, Sprite, Text, Graphics } from "pixi.js";
import type { PublicAgent } from "../../shared/types";
import { gridToScreen, depthKey, directionFromDelta } from "../iso/IsoMath";
import { getAgentTexture, getShadowTexture } from "../assets/SpriteAtlas";
import { WALK_ANIM_FPS } from "../assets/CharacterSpriteMap";
import type { AgentAnimState } from "../assets/CharacterSpriteMap";

export class AgentSprite {
  public container: Container;
  public agentId: string;
  public gridX: number;
  public gridY: number;

  private bodySprite: Sprite;
  private shadowSprite: Sprite;
  private nameLabel: Text;
  private statusDot: Graphics;
  private speechBubble: Container | null = null;
  private speechTimeout: ReturnType<typeof setTimeout> | null = null;

  // Animation
  private direction = 0;
  private animState: AgentAnimState = "idle";
  private walkFrame = 0;
  private lastFrameTime = 0;
  private agentColor: number;

  // Movement lerp
  private targetGridX: number;
  private targetGridY: number;
  private lerpProgress = 1;
  private readonly lerpSpeed = 3; // units per second
  private prevGridX: number;
  private prevGridY: number;

  // Online status
  private online = true;

  constructor(agent: PublicAgent) {
    this.container = new Container();
    this.container.eventMode = "static";
    this.container.cursor = "pointer";
    (this.container as any).entityType = "agent";
    (this.container as any).entityId = agent.id;

    this.agentId = agent.id;
    this.gridX = agent.x;
    this.gridY = agent.y;
    this.targetGridX = agent.x;
    this.targetGridY = agent.y;
    this.prevGridX = agent.x;
    this.prevGridY = agent.y;
    this.online = agent.online;

    // Parse agent color
    this.agentColor = parseInt(agent.color.replace("#", ""), 16);

    // Position
    const screen = gridToScreen(agent.x + 0.5, agent.y + 0.5);
    this.container.position.set(screen.x, screen.y);
    this.container.zIndex = depthKey(agent.x, agent.y);

    // Shadow
    this.shadowSprite = new Sprite(getShadowTexture());
    this.shadowSprite.anchor.set(0.5, 0.5);
    this.shadowSprite.position.set(0, 4);
    this.container.addChild(this.shadowSprite);

    // Body
    this.bodySprite = new Sprite(getAgentTexture(0, 0, "idle"));
    this.bodySprite.anchor.set(0.5, 0.85);
    this.bodySprite.tint = this.agentColor;
    this.container.addChild(this.bodySprite);

    // Name label
    this.nameLabel = new Text({
      text: agent.name,
      style: {
        fontSize: 9,
        fill: 0xffffff,
        fontFamily: "monospace",
        stroke: { color: 0x000000, width: 3 },
      },
    });
    this.nameLabel.anchor.set(0.5, 1);
    this.nameLabel.position.set(0, -38);
    this.container.addChild(this.nameLabel);

    // Status dot
    this.statusDot = new Graphics();
    this.updateStatusDot();
    this.statusDot.position.set(this.nameLabel.width / 2 + 6, -42);
    this.container.addChild(this.statusDot);
  }

  /** Update agent data from state sync */
  updateAgent(agent: PublicAgent): void {
    // Update online status
    if (this.online !== agent.online) {
      this.online = agent.online;
      this.updateStatusDot();
      this.bodySprite.alpha = agent.online ? 1 : 0.5;
    }

    // Movement
    if (agent.x !== this.targetGridX || agent.y !== this.targetGridY) {
      this.prevGridX = this.gridX;
      this.prevGridY = this.gridY;
      this.targetGridX = agent.x;
      this.targetGridY = agent.y;
      this.lerpProgress = 0;

      // Calculate direction
      const dx = agent.x - this.gridX;
      const dy = agent.y - this.gridY;
      if (dx !== 0 || dy !== 0) {
        this.direction = directionFromDelta(dx, dy);
        this.animState = "walk";
      }
    }
  }

  /** Set the animation state from behavior system */
  setAnimState(state: AgentAnimState): void {
    this.animState = state;
  }

  /** Set direction (0-7) */
  setDirection(dir: number): void {
    this.direction = dir;
  }

  /** Animate per frame */
  animate(now: number, dt: number): void {
    // Lerp position
    if (this.lerpProgress < 1) {
      this.lerpProgress = Math.min(1, this.lerpProgress + dt * this.lerpSpeed);
      this.gridX = this.prevGridX + (this.targetGridX - this.prevGridX) * this.lerpProgress;
      this.gridY = this.prevGridY + (this.targetGridY - this.prevGridY) * this.lerpProgress;

      if (this.lerpProgress >= 1) {
        this.gridX = this.targetGridX;
        this.gridY = this.targetGridY;
        if (this.animState === "walk") {
          this.animState = "idle";
        }
      }
    }

    // Update screen position
    const screen = gridToScreen(this.gridX + 0.5, this.gridY + 0.5);
    this.container.position.set(screen.x, screen.y);
    this.container.zIndex = depthKey(this.gridX, this.gridY);

    // Walk animation frame
    if (now - this.lastFrameTime > 1000 / WALK_ANIM_FPS) {
      this.walkFrame = (this.walkFrame + 1) % 2;
      this.lastFrameTime = now;
    }

    // Update body sprite texture
    const frame = this.animState === "idle" ? 0 : this.walkFrame;
    this.bodySprite.texture = getAgentTexture(this.direction, frame, this.animState);

    // Walk bob
    if (this.animState === "walk") {
      this.bodySprite.position.y = Math.sin(now * 0.01) * 1.5;
    } else {
      this.bodySprite.position.y = 0;
    }

    // Idle fidget
    if (this.animState === "idle" && Math.random() < 0.001) {
      this.bodySprite.position.y = -1;
      setTimeout(() => {
        this.bodySprite.position.y = 0;
      }, 150);
    }
  }

  /** Show a speech bubble */
  showSpeechBubble(text: string, duration = 4000): void {
    this.hideSpeechBubble();

    this.speechBubble = new Container();

    // Truncate long text
    const displayText = text.length > 60 ? text.substring(0, 57) + "..." : text;

    const label = new Text({
      text: displayText,
      style: {
        fontSize: 8,
        fill: 0x222222,
        fontFamily: "monospace",
        wordWrap: true,
        wordWrapWidth: 120,
      },
    });

    const padding = 6;
    const bg = new Graphics()
      .roundRect(-padding, -padding, label.width + padding * 2, label.height + padding * 2, 6)
      .fill({ color: 0xffffff, alpha: 0.95 });

    // Pointer triangle
    bg.moveTo(10, label.height + padding)
      .lineTo(15, label.height + padding + 5)
      .lineTo(20, label.height + padding)
      .fill({ color: 0xffffff, alpha: 0.95 });

    this.speechBubble.addChild(bg);
    this.speechBubble.addChild(label);
    this.speechBubble.position.set(-label.width / 2, -55 - label.height);
    this.container.addChild(this.speechBubble);

    // Auto-dismiss
    this.speechTimeout = setTimeout(() => {
      this.hideSpeechBubble();
    }, duration);
  }

  hideSpeechBubble(): void {
    if (this.speechBubble) {
      this.container.removeChild(this.speechBubble);
      this.speechBubble.destroy({ children: true });
      this.speechBubble = null;
    }
    if (this.speechTimeout) {
      clearTimeout(this.speechTimeout);
      this.speechTimeout = null;
    }
  }

  private updateStatusDot(): void {
    this.statusDot.clear();
    const color = this.online ? 0x4caf50 : 0x888888;
    this.statusDot.circle(0, 0, 3).fill({ color });
  }

  destroy(): void {
    this.hideSpeechBubble();
    this.container.destroy({ children: true });
  }
}
