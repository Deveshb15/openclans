// ============================================================
// MoltClans - Building Sprite (PixiJS isometric building entity)
// ============================================================

import { Container, Sprite, Graphics, Text } from "pixi.js";
import type { Building, BuildingType } from "../../shared/types";
import { gridToScreen, depthKey } from "../iso/IsoMath";
import { getBuildingTexture, getScaffoldingTexture, getCircleTexture } from "../assets/SpriteAtlas";
import { BUILDING_VISUAL_CONFIG, RESOURCE_ORB_COLORS } from "../assets/BuildingSpriteMap";

export class BuildingSprite {
  public container: Container;
  public buildingId: string;
  public buildingType: BuildingType;
  public gridX: number;
  public gridY: number;
  public gridW: number;
  public gridH: number;

  private mainSprite: Sprite;
  private scaffoldingSprite: Sprite | null = null;
  private progressBar: Container | null = null;
  private progressFill: Graphics | null = null;
  private durabilityBar: Container | null = null;
  private durabilityFill: Graphics | null = null;
  private levelBadge: Text | null = null;
  private ownerTintOverlay: Graphics | null = null;
  private resourceOrbs: Sprite[] = [];

  // Animation state
  private animTime = Math.random() * 1000;
  private smokeSprites: Sprite[] = [];
  private completed = false;

  constructor(building: Building, ownerColor: string) {
    this.container = new Container();
    this.container.eventMode = "static";
    this.container.cursor = "pointer";
    (this.container as any).entityType = "building";
    (this.container as any).entityId = building.id;

    this.buildingId = building.id;
    this.buildingType = building.type;
    this.gridX = building.x;
    this.gridY = building.y;
    this.gridW = building.width;
    this.gridH = building.height;

    // Position at center of building footprint
    const centerCol = building.x + building.width / 2;
    const centerRow = building.y + building.height / 2;
    const screen = gridToScreen(centerCol, centerRow);
    this.container.position.set(screen.x, screen.y);
    this.container.zIndex = depthKey(centerCol, centerRow);

    // Owner tint overlay (colored border at base)
    this.ownerTintOverlay = new Graphics();
    this.updateOwnerTint(ownerColor);
    this.container.addChild(this.ownerTintOverlay);

    // Main building sprite
    this.mainSprite = new Sprite(getBuildingTexture(building.type, building.width, building.height));
    this.mainSprite.anchor.set(0.5, 0.75);
    this.container.addChild(this.mainSprite);

    // Initialize based on completion state
    this.completed = building.completed;
    if (!building.completed) {
      this.showConstruction(building.progress);
    } else {
      this.showCompleted(building);
    }
  }

  /** Update building state */
  update(building: Building, ownerColor: string): void {
    this.completed = building.completed;
    this.updateOwnerTint(ownerColor);

    if (!building.completed) {
      this.showConstruction(building.progress);
    } else {
      this.hideConstruction();
      this.showCompleted(building);
    }

    // Update durability indicator
    this.updateDurabilityBar(building);

    // Tint when durability is low
    if (building.maxDurability > 0 && building.durability < building.maxDurability * 0.3) {
      this.mainSprite.tint = 0xbbbbbb;
    } else {
      this.mainSprite.tint = 0xffffff;
    }
  }

  private updateOwnerTint(color: string): void {
    if (!this.ownerTintOverlay) return;
    this.ownerTintOverlay.clear();
    const c = parseInt(color.replace("#", ""), 16);
    // Small colored diamond at base
    const w = this.gridW * 32;
    const h = this.gridH * 16;
    this.ownerTintOverlay
      .moveTo(0, -h / 2)
      .lineTo(w / 2, 0)
      .lineTo(0, h / 2)
      .lineTo(-w / 2, 0)
      .closePath()
      .fill({ color: c, alpha: 0.15 })
      .stroke({ color: c, width: 1, alpha: 0.5 });
  }

  private showConstruction(progress: number): void {
    // Show scaffolding
    if (!this.scaffoldingSprite) {
      this.scaffoldingSprite = new Sprite(getScaffoldingTexture(this.gridW, this.gridH));
      this.scaffoldingSprite.anchor.set(0.5, 0.75);
      this.container.addChild(this.scaffoldingSprite);
    }

    // Adjust main sprite alpha based on progress
    if (progress < 33) {
      this.mainSprite.alpha = 0.2;
    } else if (progress < 66) {
      this.mainSprite.alpha = 0.5;
    } else {
      this.mainSprite.alpha = 0.7;
    }

    // Progress bar
    this.updateProgressBar(progress);
  }

  private hideConstruction(): void {
    if (this.scaffoldingSprite) {
      this.container.removeChild(this.scaffoldingSprite);
      this.scaffoldingSprite = null;
    }
    this.mainSprite.alpha = 1;

    if (this.progressBar) {
      this.container.removeChild(this.progressBar);
      this.progressBar = null;
      this.progressFill = null;
    }
  }

  private updateProgressBar(progress: number): void {
    if (!this.progressBar) {
      this.progressBar = new Container();
      this.progressBar.position.set(-20, -40);

      const bg = new Graphics()
        .roundRect(0, 0, 40, 6, 2)
        .fill({ color: 0x333333, alpha: 0.8 });
      this.progressBar.addChild(bg);

      this.progressFill = new Graphics();
      this.progressBar.addChild(this.progressFill);

      this.container.addChild(this.progressBar);
    }

    if (this.progressFill) {
      this.progressFill.clear();
      const width = Math.max(1, (progress / 100) * 38);
      const color = progress < 50 ? 0xff9800 : 0x4caf50;
      this.progressFill
        .roundRect(1, 1, width, 4, 1)
        .fill({ color });
    }
  }

  private updateDurabilityBar(building: Building): void {
    if (!building.completed || building.maxDurability <= 0) {
      // Remove if building is not completed or has no durability
      if (this.durabilityBar) {
        this.container.removeChild(this.durabilityBar);
        this.durabilityBar = null;
        this.durabilityFill = null;
      }
      return;
    }

    if (!this.durabilityBar) {
      this.durabilityBar = new Container();
      this.durabilityBar.position.set(-20, 8);

      const bg = new Graphics()
        .roundRect(0, 0, 40, 4, 1)
        .fill({ color: 0x222222, alpha: 0.7 });
      this.durabilityBar.addChild(bg);

      this.durabilityFill = new Graphics();
      this.durabilityBar.addChild(this.durabilityFill);

      this.container.addChild(this.durabilityBar);
    }

    if (this.durabilityFill) {
      this.durabilityFill.clear();
      const ratio = Math.max(0, Math.min(1, building.durability / building.maxDurability));
      const width = Math.max(1, ratio * 38);
      // Red to green gradient: red at 0%, yellow at 50%, green at 100%
      let color: number;
      if (ratio < 0.5) {
        // Red to yellow
        const t = ratio * 2;
        const r = 0xff;
        const g = Math.floor(0x99 * t);
        color = (r << 16) | (g << 8);
      } else {
        // Yellow to green
        const t = (ratio - 0.5) * 2;
        const r = Math.floor(0xff * (1 - t));
        const g = Math.floor(0x99 + (0xaf - 0x99) * t);
        color = (r << 16) | (g << 8) | Math.floor(0x50 * t);
      }
      this.durabilityFill
        .roundRect(1, 0.5, width, 3, 1)
        .fill({ color });
    }
  }

  private showCompleted(building: Building): void {
    // Level badge
    if (building.level > 1) {
      if (!this.levelBadge) {
        this.levelBadge = new Text({
          text: `Lv.${building.level}`,
          style: {
            fontSize: 8,
            fill: 0xffd700,
            fontFamily: "monospace",
            stroke: { color: 0x000000, width: 2 },
          },
        });
        this.levelBadge.anchor.set(0.5, 1);
        this.levelBadge.position.set(0, -35);
        this.container.addChild(this.levelBadge);
      } else {
        this.levelBadge.text = `Lv.${building.level}`;
      }
    }

    // Resource orbs for pending resources
    this.updateResourceOrbs(building);

    // Setup idle animation sprites
    this.setupIdleAnimations();
  }

  private updateResourceOrbs(building: Building): void {
    // Remove old orbs
    for (const orb of this.resourceOrbs) {
      this.container.removeChild(orb);
    }
    this.resourceOrbs = [];

    if (!building.completed) return;

    // Check all individual pending resource fields
    const resources: { type: string; amount: number }[] = [
      { type: "wood", amount: building.pendingRawWood ?? 0 },
      { type: "stone", amount: building.pendingRawStone ?? 0 },
      { type: "water", amount: building.pendingRawWater ?? 0 },
      { type: "food", amount: building.pendingRawFood ?? 0 },
      { type: "clay", amount: building.pendingRawClay ?? 0 },
      { type: "planks", amount: building.pendingRefinedPlanks ?? 0 },
      { type: "bricks", amount: building.pendingRefinedBricks ?? 0 },
      { type: "cement", amount: building.pendingRefinedCement ?? 0 },
      { type: "glass", amount: building.pendingRefinedGlass ?? 0 },
      { type: "steel", amount: building.pendingRefinedSteel ?? 0 },
      { type: "tokens", amount: building.pendingTokens ?? 0 },
    ].filter((r) => r.amount > 0);

    let orbIndex = 0;
    for (const r of resources) {
      const colorHex = RESOURCE_ORB_COLORS[r.type] ?? 0xffffff;
      const colorStr = "#" + colorHex.toString(16).padStart(6, "0");
      const orb = new Sprite(getCircleTexture(colorStr, 3));
      orb.anchor.set(0.5, 0.5);
      orb.position.set(-8 + orbIndex * 8, -45);
      this.container.addChild(orb);
      this.resourceOrbs.push(orb);
      orbIndex++;
    }
  }

  private setupIdleAnimations(): void {
    const config = BUILDING_VISUAL_CONFIG[this.buildingType];

    // Smoke particles for houses/workshops
    if (config.smoke && this.smokeSprites.length === 0) {
      for (let i = 0; i < 3; i++) {
        const smoke = new Sprite(getCircleTexture("rgba(150,150,150,0.6)", 3));
        smoke.anchor.set(0.5, 0.5);
        smoke.position.set(8 + Math.random() * 4, -30 - i * 6);
        smoke.alpha = 0;
        this.container.addChild(smoke);
        this.smokeSprites.push(smoke);
      }
    }
  }

  /** Animate per frame */
  animate(now: number): void {
    this.animTime = now;

    if (!this.completed) return;

    const config = BUILDING_VISUAL_CONFIG[this.buildingType];

    // Smoke animation
    if (config.smoke) {
      for (let i = 0; i < this.smokeSprites.length; i++) {
        const smoke = this.smokeSprites[i];
        const phase = ((now * 0.001 + i * 1.2) % 3) / 3; // 0-1 over 3 seconds
        smoke.position.y = -30 - phase * 20;
        smoke.alpha = Math.max(0, 0.5 - phase * 0.6);
        smoke.scale.set(0.8 + phase * 0.5);
      }
    }

    // Resource orb bob
    for (let i = 0; i < this.resourceOrbs.length; i++) {
      const orb = this.resourceOrbs[i];
      orb.position.y = -45 + Math.sin(now * 0.003 + i) * 3;
    }

    // Glow pulse for monuments
    if (config.glowPulse) {
      this.mainSprite.alpha = 0.85 + 0.15 * Math.sin(now * 0.002);
    }

    // Flower bob for gardens (not used since no garden type, but kept for extensibility)
    if (config.flowerBob) {
      this.mainSprite.position.y = Math.sin(now * 0.002) * 1;
    }
  }

  /** Play completion celebration effect */
  playCompletionEffect(): void {
    // Flash white briefly
    this.mainSprite.tint = 0xffffff;
    setTimeout(() => {
      this.mainSprite.tint = 0xffffff;
    }, 200);
  }

  destroy(): void {
    this.container.destroy({ children: true });
  }
}
