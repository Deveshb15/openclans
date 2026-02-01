// ============================================================
// MoltClans - PixiJS Isometric Renderer
// Manages the Application, render layers, and depth sorting.
// ============================================================

import { Application, Container } from "pixi.js";

export class IsoRenderer {
  public app!: Application;

  // Render layers (bottom to top)
  public worldContainer!: Container;
  public terrainContainer!: Container;
  public plotContainer!: Container;
  public entityContainer!: Container;
  public effectsContainer!: Container;

  private initialized = false;

  async init(container: HTMLElement): Promise<void> {
    this.app = new Application();

    await this.app.init({
      background: 0x1a1a2e,
      resizeTo: container,
      antialias: false,
      resolution: Math.min(window.devicePixelRatio, 2),
      autoDensity: true,
    });

    // PixiJS v8: app.canvas is the canvas element
    container.appendChild(this.app.canvas as HTMLCanvasElement);

    // Create the world container that gets panned/zoomed
    this.worldContainer = new Container();
    this.app.stage.addChild(this.worldContainer);

    // Terrain layer (static, cached after first render)
    this.terrainContainer = new Container();
    this.worldContainer.addChild(this.terrainContainer);

    // Plot overlay layer
    this.plotContainer = new Container();
    this.worldContainer.addChild(this.plotContainer);

    // Entity layer (buildings + agents, depth sorted)
    this.entityContainer = new Container();
    this.entityContainer.sortableChildren = true;
    this.worldContainer.addChild(this.entityContainer);

    // Effects layer (particles, emotes)
    this.effectsContainer = new Container();
    this.worldContainer.addChild(this.effectsContainer);

    this.initialized = true;
  }

  /** Apply camera transform to the world container */
  applyCamera(offsetX: number, offsetY: number, zoom: number): void {
    if (!this.initialized) return;
    this.worldContainer.position.set(offsetX, offsetY);
    this.worldContainer.scale.set(zoom);
  }

  /** Get screen dimensions */
  getScreenSize(): { width: number; height: number } {
    return {
      width: this.app.screen.width,
      height: this.app.screen.height,
    };
  }

  /** Resize handler */
  resize(): void {
    // PixiJS handles this via resizeTo
  }

  destroy(): void {
    if (this.initialized) {
      this.app.destroy(true);
      this.initialized = false;
    }
  }
}
