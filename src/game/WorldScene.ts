// ============================================================
// MoltClans - World Scene (PixiJS isometric orchestrator)
// ============================================================

import { Graphics } from "pixi.js";
import { GAME_CONFIG } from "../config";
import { GRID_WIDTH, GRID_HEIGHT } from "../shared/constants";
import type {
  SpectatorState,
  PublicAgent,
  Building,
  Plot,
  ChatMessage,
  ActivityEntry,
} from "../shared/types";

import { StateSync } from "../network/StateSync";
import { IsoRenderer } from "./iso/IsoRenderer";
import { IsoCamera } from "./iso/IsoCamera";
import { IsoGrid } from "./iso/IsoGrid";
import { IsoInput } from "./iso/IsoInput";
import { gridToScreen } from "./iso/IsoMath";

import { BuildingSprite } from "./entities/BuildingSprite";
import { AgentSprite } from "./entities/AgentSprite";

import { AgentBehaviorSystem } from "./behavior/AgentBehaviorSystem";
import { ParticleSystem } from "./effects/ParticleSystem";
import { EffectTriggers } from "./effects/EffectTriggers";
import { EmoteSystem } from "./effects/EmoteSystem";

import { preloadAllTextures } from "./assets/SpriteAtlas";

import { ChatPanel } from "../ui/ChatPanel";
import { AgentInfoPanel } from "../ui/AgentInfoPanel";
import { TownStats } from "../ui/TownStats";
import { MiniMap } from "../ui/MiniMap";

export class WorldScene {
  // Rendering
  private renderer!: IsoRenderer;
  private camera!: IsoCamera;
  private grid!: IsoGrid;
  private input!: IsoInput;

  // State
  private stateSync!: StateSync;
  private stateReceived = false;

  // Entity maps
  private buildingSprites: Map<string, BuildingSprite> = new Map();
  private agentSprites: Map<string, AgentSprite> = new Map();
  private plotGraphics: Map<string, Graphics> = new Map();

  // Systems
  private behaviorSystem!: AgentBehaviorSystem;
  private particleSystem!: ParticleSystem;
  private effectTriggers!: EffectTriggers;
  private emoteSystem!: EmoteSystem;

  // UI
  private chatPanel!: ChatPanel;
  private agentInfoPanel!: AgentInfoPanel;
  private townStats!: TownStats;
  private miniMap!: MiniMap;

  // Connection status
  private isConnected = false;

  // Loading overlay
  private loadingOverlay: HTMLElement | null = null;

  // Minimap throttle
  private lastMinimapUpdate = 0;
  private readonly MINIMAP_UPDATE_INTERVAL = 500;

  // Day/night cycle
  private dayNightStartTime = 0;

  // Frame timing
  private lastFrameTime = 0;

  // ============================================================
  // Initialization
  // ============================================================

  async init(container: HTMLElement, stateSync: StateSync): Promise<void> {
    this.stateSync = stateSync;

    // Preload all procedural textures
    preloadAllTextures();

    // --- PixiJS Renderer ---
    this.renderer = new IsoRenderer();
    await this.renderer.init(container);

    // --- Camera ---
    this.camera = new IsoCamera();
    const { width, height } = this.renderer.getScreenSize();
    this.camera.setViewSize(width, height);

    // --- Terrain Grid ---
    this.grid = new IsoGrid();
    this.renderer.terrainContainer.addChild(this.grid.container);

    // --- Systems ---
    this.behaviorSystem = new AgentBehaviorSystem();

    this.particleSystem = new ParticleSystem();
    this.renderer.effectsContainer.addChild(this.particleSystem.container);

    this.effectTriggers = new EffectTriggers(this.particleSystem);

    this.emoteSystem = new EmoteSystem();
    this.renderer.effectsContainer.addChild(this.emoteSystem.container);

    // --- Input ---
    this.input = new IsoInput(
      this.renderer.app.canvas as HTMLElement,
      this.camera,
      this.renderer.entityContainer,
    );

    this.input.onClick = (type, id) => {
      if (type === "building") this.onBuildingClicked(id);
      else if (type === "agent") this.onAgentClicked(id);
    };

    // --- UI ---
    this.chatPanel = new ChatPanel();
    this.agentInfoPanel = new AgentInfoPanel();
    this.townStats = new TownStats();
    this.miniMap = new MiniMap();

    this.miniMap.onNavigate = (tileX: number, tileZ: number) => {
      this.camera.stopFollow();
      this.camera.navigateToTile(tileX, tileZ);
    };

    // --- Loading overlay ---
    this.showLoadingOverlay(container);

    // --- Wire StateSync events ---
    this.wireStateSync();

    // If state already received
    if (this.stateSync.hasState) {
      this.onFullState(this.stateSync.getState()!);
    }

    // --- Day/night start ---
    this.dayNightStartTime = performance.now();

    // --- Start render loop ---
    this.lastFrameTime = performance.now();
    this.renderer.app.ticker.add(() => this.animate());
  }

  // ============================================================
  // State Sync Wiring
  // ============================================================

  private wireStateSync(): void {
    this.stateSync.on("full-state", (state: SpectatorState) => {
      this.onFullState(state);
    });

    this.stateSync.on("agent-joined", (agent: PublicAgent) => {
      this.addAgent(agent);
      this.chatPanel.setAgentColor(agent.id, agent.color);
      const state = this.stateSync.getState();
      if (state) this.behaviorSystem.onAgentJoined(agent, state);
    });

    this.stateSync.on("agent-left", (agent: PublicAgent) => {
      const sprite = this.agentSprites.get(agent.id);
      if (sprite) sprite.updateAgent(agent);
    });

    this.stateSync.on("agent-moved", (agent: PublicAgent) => {
      const sprite = this.agentSprites.get(agent.id);
      if (sprite) sprite.updateAgent(agent);
      this.behaviorSystem.onAgentMoved(agent.id, agent.x, agent.y);
    });

    this.stateSync.on("plot-claimed", (_plot: Plot) => {
      this.drawPlots();
    });

    this.stateSync.on("plot-released", (_plotId: string) => {
      this.drawPlots();
    });

    this.stateSync.on("building-placed", (building: Building) => {
      this.addBuilding(building);
      this.behaviorSystem.onBuildingPlaced(building);
    });

    this.stateSync.on("building-progress", (building: Building) => {
      const sprite = this.buildingSprites.get(building.id);
      if (sprite) {
        const state = this.stateSync.getState();
        const ownerColor = state?.agents[building.ownerId]?.color ?? "#888888";
        sprite.update(building, ownerColor);
      }
      // Construction dust effect
      this.effectTriggers.constructionDust(building.x, building.y);
    });

    this.stateSync.on("building-completed", (building: Building) => {
      const sprite = this.buildingSprites.get(building.id);
      if (sprite) {
        const state = this.stateSync.getState();
        const ownerColor = state?.agents[building.ownerId]?.color ?? "#888888";
        sprite.update(building, ownerColor);
        sprite.playCompletionEffect();
      }
      this.behaviorSystem.onBuildingCompleted(building);
      this.effectTriggers.buildingCompleted(building.x, building.y, building.width, building.height);
    });

    this.stateSync.on("building-upgraded", (building: Building) => {
      const sprite = this.buildingSprites.get(building.id);
      if (sprite) {
        const state = this.stateSync.getState();
        const ownerColor = state?.agents[building.ownerId]?.color ?? "#888888";
        sprite.update(building, ownerColor);
      }
    });

    this.stateSync.on("building-demolished", (buildingId: string) => {
      const sprite = this.buildingSprites.get(buildingId);
      if (sprite) {
        this.renderer.entityContainer.removeChild(sprite.container);
        sprite.destroy();
        this.buildingSprites.delete(buildingId);
      }
    });

    this.stateSync.on("chat-message", (msg: ChatMessage) => {
      this.chatPanel.addMessage(msg);

      // Show speech bubble
      if (msg.channel === "town") {
        const sprite = this.agentSprites.get(msg.senderId);
        if (sprite) sprite.showSpeechBubble(msg.content);
      }
    });

    this.stateSync.on("activity", (entry: ActivityEntry) => {
      this.chatPanel.addActivity(entry);
    });

    this.stateSync.on("resources-collected", (data: any) => {
      if (data && data.agentId) {
        this.behaviorSystem.onResourcesCollected(data.agentId);
      }
    });
  }

  // ============================================================
  // Full State
  // ============================================================

  private onFullState(state: SpectatorState): void {
    this.stateReceived = true;
    this.hideLoadingOverlay();

    // --- Generate terrain ---
    this.grid.clear();
    this.grid.renderTerrain(state.grid);

    // --- Clear existing entities ---
    this.clearAllEntities();

    // --- Populate agent colors ---
    for (const agent of Object.values(state.agents)) {
      this.chatPanel.setAgentColor(agent.id, agent.color);
    }

    // --- Draw plots ---
    this.drawPlots();

    // --- Create buildings ---
    for (const building of Object.values(state.buildings)) {
      this.addBuilding(building);
    }

    // --- Create agents ---
    for (const agent of Object.values(state.agents)) {
      this.addAgent(agent);
    }

    // --- Initialize behavior system ---
    this.behaviorSystem.initFromState(state);

    // --- Load chat ---
    this.chatPanel.loadMessages(state.chat);
    this.chatPanel.loadActivity(state.activity);

    // --- Update stats ---
    this.townStats.update(state);

    // --- Center camera ---
    const agents = Object.values(state.agents);
    if (agents.length > 0) {
      const first = agents[0];
      this.camera.centerOnGrid(first.x + 0.5, first.y + 0.5);
    } else {
      this.camera.centerOnGrid(GRID_WIDTH / 2, GRID_HEIGHT / 2);
    }
  }

  // ============================================================
  // Entity Management
  // ============================================================

  private addAgent(agent: PublicAgent): void {
    if (this.agentSprites.has(agent.id)) {
      const existing = this.agentSprites.get(agent.id)!;
      existing.updateAgent(agent);
      return;
    }

    const sprite = new AgentSprite(agent);
    this.agentSprites.set(agent.id, sprite);
    this.renderer.entityContainer.addChild(sprite.container);
  }

  private addBuilding(building: Building): void {
    if (this.buildingSprites.has(building.id)) {
      const existing = this.buildingSprites.get(building.id)!;
      const state = this.stateSync.getState();
      const ownerColor = state?.agents[building.ownerId]?.color ?? "#888888";
      existing.update(building, ownerColor);
      return;
    }

    const state = this.stateSync.getState();
    const ownerColor = state?.agents[building.ownerId]?.color ?? "#888888";
    const sprite = new BuildingSprite(building, ownerColor);
    this.buildingSprites.set(building.id, sprite);
    this.renderer.entityContainer.addChild(sprite.container);
  }

  private clearAllEntities(): void {
    for (const sprite of this.agentSprites.values()) {
      this.renderer.entityContainer.removeChild(sprite.container);
      sprite.destroy();
    }
    this.agentSprites.clear();

    for (const sprite of this.buildingSprites.values()) {
      this.renderer.entityContainer.removeChild(sprite.container);
      sprite.destroy();
    }
    this.buildingSprites.clear();

    this.clearPlots();
    this.particleSystem.clear();
    this.emoteSystem.clear();
  }

  // ============================================================
  // Plot Rendering
  // ============================================================

  private drawPlots(): void {
    this.clearPlots();
    const state = this.stateSync.getState();
    if (!state) return;

    for (const plot of Object.values(state.plots)) {
      const agent = state.agents[plot.ownerId];
      const colorStr = agent?.color ?? "#888888";
      const color = parseInt(colorStr.replace("#", ""), 16);

      const gfx = new Graphics();

      // Draw isometric plot outline
      const topLeft = gridToScreen(plot.x, plot.y);
      const topRight = gridToScreen(plot.x + plot.width, plot.y);
      const bottomRight = gridToScreen(plot.x + plot.width, plot.y + plot.height);
      const bottomLeft = gridToScreen(plot.x, plot.y + plot.height);

      // Fill
      gfx.moveTo(topLeft.x, topLeft.y)
        .lineTo(topRight.x, topRight.y)
        .lineTo(bottomRight.x, bottomRight.y)
        .lineTo(bottomLeft.x, bottomLeft.y)
        .closePath()
        .fill({ color, alpha: 0.08 });

      // Border
      gfx.moveTo(topLeft.x, topLeft.y)
        .lineTo(topRight.x, topRight.y)
        .lineTo(bottomRight.x, bottomRight.y)
        .lineTo(bottomLeft.x, bottomLeft.y)
        .closePath()
        .stroke({ color, width: 1, alpha: 0.5 });

      this.renderer.plotContainer.addChild(gfx);
      this.plotGraphics.set(plot.id, gfx);
    }
  }

  private clearPlots(): void {
    for (const gfx of this.plotGraphics.values()) {
      this.renderer.plotContainer.removeChild(gfx);
      gfx.destroy();
    }
    this.plotGraphics.clear();
  }

  // ============================================================
  // Click Handlers
  // ============================================================

  private onBuildingClicked(buildingId: string): void {
    const state = this.stateSync.getState();
    if (!state) return;
    const building = state.buildings[buildingId];
    if (!building) return;
    const agent = state.agents[building.ownerId];
    if (agent) this.showAgentInfo(agent);
  }

  private onAgentClicked(agentId: string): void {
    const state = this.stateSync.getState();
    if (!state) return;
    const agent = state.agents[agentId];
    if (agent) this.showAgentInfo(agent);
  }

  private showAgentInfo(agent: PublicAgent): void {
    const state = this.stateSync.getState();
    if (!state) return;

    const buildings = Object.values(state.buildings).filter(
      (b) => b.ownerId === agent.id,
    );
    const plots = Object.values(state.plots).filter(
      (p) => p.ownerId === agent.id,
    );
    const clan = agent.clanId ? state.clans[agent.clanId] ?? null : null;

    // Get current activity from behavior system
    const behavior = this.behaviorSystem.getBehavior(agent.id);
    const activity = behavior?.data.state ?? "IDLE";

    this.agentInfoPanel.show(agent, buildings, plots, clan, activity);
  }

  // ============================================================
  // Loading Overlay
  // ============================================================

  private showLoadingOverlay(container: HTMLElement): void {
    this.loadingOverlay = document.createElement("div");
    this.loadingOverlay.style.cssText =
      "position:absolute;top:0;left:0;width:100%;height:100%;display:flex;" +
      "align-items:center;justify-content:center;background:rgba(0,0,0,0.3);" +
      "color:#888;font-family:monospace;font-size:14px;z-index:10;pointer-events:none;";
    this.loadingOverlay.textContent = "Waiting for server...";
    container.appendChild(this.loadingOverlay);
  }

  private hideLoadingOverlay(): void {
    if (this.loadingOverlay) {
      this.loadingOverlay.remove();
      this.loadingOverlay = null;
    }
  }

  // ============================================================
  // Render Loop
  // ============================================================

  private animate(): void {
    const now = performance.now();
    const dt = Math.min(0.1, (now - this.lastFrameTime) / 1000); // seconds, capped
    this.lastFrameTime = now;

    // Process keyboard input
    this.input.updateKeyboard();

    // Update camera
    this.camera.update();

    // Apply camera transform
    this.renderer.applyCamera(this.camera.offsetX, this.camera.offsetY, this.camera.zoom);

    // Update behavior system
    const state = this.stateSync.getState();
    this.behaviorSystem.update(dt, state);

    // Update agent sprites from behavior system
    for (const [agentId, sprite] of this.agentSprites) {
      const behavior = this.behaviorSystem.getBehavior(agentId);
      if (behavior) {
        // Update sprite position from behavior pathfollower
        sprite.gridX = behavior.x;
        sprite.gridY = behavior.y;
        sprite.setDirection(behavior.direction);
        sprite.setAnimState(behavior.animState);
      }
      sprite.animate(now, dt);
    }

    // Update building sprites (idle animations)
    for (const sprite of this.buildingSprites.values()) {
      sprite.animate(now);
    }

    // Update effects
    this.particleSystem.update(dt);
    this.emoteSystem.update(dt);

    // Day/night cycle
    this.updateDayNight(now);

    // Update minimap (throttled)
    if (now - this.lastMinimapUpdate > this.MINIMAP_UPDATE_INTERVAL) {
      this.lastMinimapUpdate = now;
      if (state) {
        const bounds = this.camera.getVisibleGridBounds();
        this.miniMap.update(state, {
          minX: bounds.minCol,
          minZ: bounds.minRow,
          maxX: bounds.maxCol,
          maxZ: bounds.maxRow,
        });
        this.townStats.update(state);
      }
    }

    // Occasional emotes from building agents
    if (Math.random() < 0.002) {
      for (const [agentId, sprite] of this.agentSprites) {
        const behavior = this.behaviorSystem.getBehavior(agentId);
        if (behavior && behavior.data.state === "BUILDING") {
          const screen = gridToScreen(behavior.x + 0.5, behavior.y + 0.5);
          this.emoteSystem.show(screen.x, screen.y - 30, "build");
          this.effectTriggers.hammerSparks(behavior.x, behavior.y);
          break;
        }
      }
    }
  }

  // ============================================================
  // Day/Night Cycle
  // ============================================================

  private updateDayNight(now: number): void {
    const elapsed = now - this.dayNightStartTime;
    const progress = (elapsed % GAME_CONFIG.DAY_CYCLE_DURATION) / GAME_CONFIG.DAY_CYCLE_DURATION;

    // Subtle background color shift
    const nightFactor = Math.max(0, -Math.sin(progress * Math.PI * 2) * 0.3);
    const r = Math.floor(26 * (1 - nightFactor));
    const g = Math.floor(26 * (1 - nightFactor));
    const b = Math.floor(46 * (1 - nightFactor * 0.5));
    this.renderer.app.renderer.background.color = (r << 16) | (g << 8) | b;

    // Update night status for stats bar
    const isNight = Math.sin(progress * Math.PI * 2) < -0.3;
    this.townStats.setNight(isNight);

    // Ambient fireflies at night
    if (isNight && Math.random() < 0.01) {
      this.effectTriggers.spawnFirefly(4000, 2000);
    }
  }

  // ============================================================
  // Public API
  // ============================================================

  setConnected(connected: boolean): void {
    this.isConnected = connected;
    this.townStats.setConnected(connected);
  }

  onResize(): void {
    const { width, height } = this.renderer.getScreenSize();
    this.camera.setViewSize(width, height);
  }

  dispose(): void {
    this.input.dispose();
    this.renderer.destroy();
  }
}
