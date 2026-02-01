// ============================================================
// MoltClans - World Scene (Three.js main orchestrator)
// ============================================================

import * as THREE from "three";
import { CSS2DRenderer } from "three/addons/renderers/CSS2DRenderer.js";
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
import { CameraController } from "./CameraController";
import { InputHandler } from "./InputHandler";
import { generateTerrainTexture } from "./TerrainTexture";
import {
  createBuildingMesh,
  updateBuildingMesh,
  playCompletionFlash,
  type BuildingMesh,
} from "./BuildingFactory";
import {
  createAgentMesh,
  updateAgentMesh,
  animateAgent,
  showSpeechBubble,
  destroyAgentMesh,
  type AgentMesh,
} from "./AgentFactory";
import { ChatPanel } from "../ui/ChatPanel";
import { AgentInfoPanel } from "../ui/AgentInfoPanel";
import { TownStats } from "../ui/TownStats";
import { MiniMap } from "../ui/MiniMap";

export class WorldScene {
  // Three.js core
  private renderer!: THREE.WebGLRenderer;
  private labelRenderer!: CSS2DRenderer;
  private scene!: THREE.Scene;
  private cameraController!: CameraController;
  private inputHandler!: InputHandler;

  // Lighting
  private sunLight!: THREE.DirectionalLight;

  // State
  private stateSync!: StateSync;
  private stateReceived = false;

  // Entity maps
  private buildingMeshes: Map<string, BuildingMesh> = new Map();
  private agentMeshes: Map<string, AgentMesh> = new Map();
  private plotLines: Map<string, THREE.Group> = new Map();

  // Ground
  private groundMesh: THREE.Mesh | null = null;

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

  // Animation
  private animFrameId = 0;

  // ============================================================
  // Initialization
  // ============================================================

  init(container: HTMLElement, stateSync: StateSync): void {
    this.stateSync = stateSync;

    // --- WebGL Renderer ---
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setClearColor(0x87ceeb); // sky blue
    container.appendChild(this.renderer.domElement);

    // --- CSS2D Renderer (for labels) ---
    this.labelRenderer = new CSS2DRenderer();
    this.labelRenderer.setSize(window.innerWidth, window.innerHeight);
    this.labelRenderer.domElement.style.position = "absolute";
    this.labelRenderer.domElement.style.top = "0";
    this.labelRenderer.domElement.style.left = "0";
    this.labelRenderer.domElement.style.pointerEvents = "none";
    container.appendChild(this.labelRenderer.domElement);

    // --- Scene ---
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0x87ceeb, 150, 250);

    // --- Camera ---
    this.cameraController = new CameraController(
      this.renderer.domElement,
      window.innerWidth / window.innerHeight
    );

    // --- Input ---
    this.inputHandler = new InputHandler(
      this.renderer.domElement,
      this.cameraController.camera,
      this.scene,
      this.cameraController
    );

    this.inputHandler.onClick = (type, id) => {
      if (type === "building") this.onBuildingClicked(id);
      else if (type === "agent") this.onAgentClicked(id);
    };

    // --- Lighting ---
    this.setupLighting();

    // --- UI ---
    this.chatPanel = new ChatPanel();
    this.agentInfoPanel = new AgentInfoPanel();
    this.townStats = new TownStats();
    this.miniMap = new MiniMap();

    this.miniMap.onNavigate = (tileX: number, tileZ: number) => {
      this.cameraController.stopFollow();
      this.cameraController.navigateToTile(tileX, tileZ);
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
    this.animate();
  }

  // ============================================================
  // Lighting
  // ============================================================

  private setupLighting(): void {
    // Directional (sun) light
    this.sunLight = new THREE.DirectionalLight(
      GAME_CONFIG.SUN_COLOR,
      GAME_CONFIG.SUN_INTENSITY
    );
    this.sunLight.position.set(50, 80, 30);
    this.sunLight.castShadow = true;

    // Shadow camera setup for large scene
    this.sunLight.shadow.camera.left = -80;
    this.sunLight.shadow.camera.right = 80;
    this.sunLight.shadow.camera.top = 80;
    this.sunLight.shadow.camera.bottom = -80;
    this.sunLight.shadow.camera.near = 0.1;
    this.sunLight.shadow.camera.far = 200;
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.bias = -0.001;

    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);
    this.sunLight.target.position.set(GRID_WIDTH / 2, 0, GRID_HEIGHT / 2);

    // Ambient light
    const ambient = new THREE.AmbientLight(
      GAME_CONFIG.AMBIENT_COLOR,
      GAME_CONFIG.AMBIENT_INTENSITY
    );
    this.scene.add(ambient);

    // Hemisphere light (sky to ground for natural outdoor feel)
    const hemi = new THREE.HemisphereLight(0x87ceeb, 0x4caf50, 0.3);
    this.scene.add(hemi);
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
    });

    this.stateSync.on("agent-left", (agent: PublicAgent) => {
      const am = this.agentMeshes.get(agent.id);
      if (am) updateAgentMesh(am, agent);
    });

    this.stateSync.on("agent-moved", (agent: PublicAgent) => {
      const am = this.agentMeshes.get(agent.id);
      if (am) updateAgentMesh(am, agent);
    });

    this.stateSync.on("plot-claimed", (_plot: Plot) => {
      this.drawPlots();
    });

    this.stateSync.on("plot-released", (_plotId: string) => {
      this.drawPlots();
    });

    this.stateSync.on("building-placed", (building: Building) => {
      this.addBuilding(building);
    });

    this.stateSync.on("building-progress", (building: Building) => {
      const bm = this.buildingMeshes.get(building.id);
      if (bm) {
        const state = this.stateSync.getState();
        const ownerColor = state?.agents[building.ownerId]?.color ?? "#888888";
        updateBuildingMesh(bm, building, ownerColor);
      }
    });

    this.stateSync.on("building-completed", (building: Building) => {
      const bm = this.buildingMeshes.get(building.id);
      if (bm) {
        const state = this.stateSync.getState();
        const ownerColor = state?.agents[building.ownerId]?.color ?? "#888888";
        updateBuildingMesh(bm, building, ownerColor);
        playCompletionFlash(bm);
      }
    });

    this.stateSync.on("building-upgraded", (building: Building) => {
      const bm = this.buildingMeshes.get(building.id);
      if (bm) {
        const state = this.stateSync.getState();
        const ownerColor = state?.agents[building.ownerId]?.color ?? "#888888";
        updateBuildingMesh(bm, building, ownerColor);
      }
    });

    this.stateSync.on("building-demolished", (buildingId: string) => {
      const bm = this.buildingMeshes.get(buildingId);
      if (bm) {
        this.scene.remove(bm.group);
        this.buildingMeshes.delete(buildingId);
      }
    });

    this.stateSync.on("chat-message", (msg: ChatMessage) => {
      this.chatPanel.addMessage(msg);

      // Show speech bubble
      if (msg.channel === "town") {
        const am = this.agentMeshes.get(msg.senderId);
        if (am) showSpeechBubble(am, msg.content);
      }
    });

    this.stateSync.on("activity", (entry: ActivityEntry) => {
      this.chatPanel.addActivity(entry);
    });
  }

  // ============================================================
  // Full State
  // ============================================================

  private onFullState(state: SpectatorState): void {
    this.stateReceived = true;
    this.hideLoadingOverlay();

    // --- Generate terrain ---
    if (this.groundMesh) {
      this.scene.remove(this.groundMesh);
      this.groundMesh = null;
    }
    const terrainTexture = generateTerrainTexture(state.grid);
    const groundGeo = new THREE.PlaneGeometry(GRID_WIDTH, GRID_HEIGHT);
    groundGeo.rotateX(-Math.PI / 2);
    const groundMat = new THREE.MeshLambertMaterial({ map: terrainTexture });
    this.groundMesh = new THREE.Mesh(groundGeo, groundMat);
    this.groundMesh.position.set(GRID_WIDTH / 2, 0, GRID_HEIGHT / 2);
    this.groundMesh.receiveShadow = true;
    this.scene.add(this.groundMesh);

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

    // --- Load chat ---
    this.chatPanel.loadMessages(state.chat);
    this.chatPanel.loadActivity(state.activity);

    // --- Update stats ---
    this.townStats.update(state);

    // --- Center camera ---
    const agents = Object.values(state.agents);
    if (agents.length > 0) {
      const first = agents[0];
      this.cameraController.centerOn(first.x + 0.5, first.y + 0.5);
    } else {
      this.cameraController.centerOnWorld();
    }
  }

  // ============================================================
  // Entity Management
  // ============================================================

  private addAgent(agent: PublicAgent): void {
    if (this.agentMeshes.has(agent.id)) {
      const existing = this.agentMeshes.get(agent.id)!;
      updateAgentMesh(existing, agent);
      return;
    }

    const am = createAgentMesh(agent);
    this.agentMeshes.set(agent.id, am);
    this.scene.add(am.group);
  }

  private addBuilding(building: Building): void {
    if (this.buildingMeshes.has(building.id)) {
      const existing = this.buildingMeshes.get(building.id)!;
      const state = this.stateSync.getState();
      const ownerColor = state?.agents[building.ownerId]?.color ?? "#888888";
      updateBuildingMesh(existing, building, ownerColor);
      return;
    }

    const state = this.stateSync.getState();
    const ownerColor = state?.agents[building.ownerId]?.color ?? "#888888";
    const bm = createBuildingMesh(building, ownerColor);
    this.buildingMeshes.set(building.id, bm);
    this.scene.add(bm.group);
  }

  private clearAllEntities(): void {
    for (const am of this.agentMeshes.values()) {
      this.scene.remove(am.group);
      destroyAgentMesh(am);
    }
    this.agentMeshes.clear();

    for (const bm of this.buildingMeshes.values()) {
      this.scene.remove(bm.group);
    }
    this.buildingMeshes.clear();

    this.clearPlots();
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
      const color = new THREE.Color(colorStr);

      const plotGroup = new THREE.Group();

      // Border rectangle
      const points = [
        new THREE.Vector3(plot.x, 0.02, plot.y),
        new THREE.Vector3(plot.x + plot.width, 0.02, plot.y),
        new THREE.Vector3(plot.x + plot.width, 0.02, plot.y + plot.height),
        new THREE.Vector3(plot.x, 0.02, plot.y + plot.height),
        new THREE.Vector3(plot.x, 0.02, plot.y),
      ];
      const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
      const lineMat = new THREE.LineBasicMaterial({ color, linewidth: 2 });
      const line = new THREE.LineLoop(lineGeo, lineMat);
      plotGroup.add(line);

      // Semi-transparent fill
      const fillGeo = new THREE.PlaneGeometry(plot.width, plot.height);
      fillGeo.rotateX(-Math.PI / 2);
      const fillMat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.08,
        depthWrite: false,
      });
      const fill = new THREE.Mesh(fillGeo, fillMat);
      fill.position.set(
        plot.x + plot.width / 2,
        0.015,
        plot.y + plot.height / 2
      );
      plotGroup.add(fill);

      this.scene.add(plotGroup);
      this.plotLines.set(plot.id, plotGroup);
    }
  }

  private clearPlots(): void {
    for (const group of this.plotLines.values()) {
      this.scene.remove(group);
    }
    this.plotLines.clear();
  }

  // ============================================================
  // Click handlers
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
      (b) => b.ownerId === agent.id
    );
    const plots = Object.values(state.plots).filter(
      (p) => p.ownerId === agent.id
    );
    const clan = agent.clanId ? state.clans[agent.clanId] ?? null : null;
    this.agentInfoPanel.show(agent, buildings, plots, clan);
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

  private animate = (): void => {
    this.animFrameId = requestAnimationFrame(this.animate);

    const now = performance.now();

    // Update camera
    this.cameraController.update(now, 16);

    // Update agent animations
    for (const am of this.agentMeshes.values()) {
      animateAgent(am, now);
    }

    // Day/night cycle (subtle)
    this.updateDayNight(now);

    // Render
    this.renderer.render(this.scene, this.cameraController.camera);
    this.labelRenderer.render(this.scene, this.cameraController.camera);

    // Update minimap (throttled)
    if (now - this.lastMinimapUpdate > this.MINIMAP_UPDATE_INTERVAL) {
      this.lastMinimapUpdate = now;
      const state = this.stateSync.getState();
      if (state) {
        const bounds = this.cameraController.getVisibleGridBounds();
        this.miniMap.update(state, {
          minX: bounds.minX,
          minZ: bounds.minZ,
          maxX: bounds.maxX,
          maxZ: bounds.maxZ,
        });
        this.townStats.update(state);
      }
    }
  };

  // ============================================================
  // Day/Night cycle (subtle)
  // ============================================================

  private updateDayNight(now: number): void {
    const elapsed = now - this.dayNightStartTime;
    const progress = (elapsed % GAME_CONFIG.DAY_CYCLE_DURATION) / GAME_CONFIG.DAY_CYCLE_DURATION;

    // Subtle intensity variation: sin wave between 0.9 and 1.2
    const intensity = 1.05 + 0.15 * Math.sin(progress * Math.PI * 2);
    this.sunLight.intensity = intensity;

    // Very subtle sun angle rotation
    const angle = progress * Math.PI * 2;
    const radius = 80;
    this.sunLight.position.set(
      GRID_WIDTH / 2 + Math.cos(angle) * radius * 0.5,
      60 + Math.sin(angle) * 20,
      GRID_HEIGHT / 2 + Math.sin(angle) * radius * 0.5
    );

    // Update night status for stats bar
    const isNight = Math.sin(progress * Math.PI * 2) < -0.3;
    this.townStats.setNight(isNight);
  }

  // ============================================================
  // Public API
  // ============================================================

  /** Update connection status */
  setConnected(connected: boolean): void {
    this.isConnected = connected;
    this.townStats.setConnected(connected);
  }

  /** Handle window resize */
  onResize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.labelRenderer.setSize(w, h);
    this.cameraController.onResize(w, h);
  }

  /** Clean up */
  dispose(): void {
    cancelAnimationFrame(this.animFrameId);
    this.cameraController.dispose();
    this.inputHandler.dispose();
    this.renderer.dispose();
  }
}
