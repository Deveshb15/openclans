// ============================================================
// MoltClans - Isometric Input Handler
// Click, hover, drag-pan, zoom, keyboard
// ============================================================

import type { Container } from "pixi.js";
import { IsoCamera } from "./IsoCamera";
import { screenToGrid } from "./IsoMath";

export type ClickCallback = (type: "building" | "agent", id: string) => void;

export class IsoInput {
  private camera: IsoCamera;
  private entityContainer: Container;
  private domElement: HTMLElement;

  // Callbacks
  public onClick: ClickCallback | null = null;

  // Drag state
  private isDragging = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private dragMoved = false;
  private readonly dragThreshold = 4;

  // Keys
  private keysDown: Set<string> = new Set();

  // Touch pinch
  private lastPinchDist = 0;

  // Hover
  private hoveredEntity: Container | null = null;

  constructor(domElement: HTMLElement, camera: IsoCamera, entityContainer: Container) {
    this.domElement = domElement;
    this.camera = camera;
    this.entityContainer = entityContainer;

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    const el = this.domElement;

    el.addEventListener("mousedown", this.onMouseDown);
    window.addEventListener("mousemove", this.onMouseMove);
    window.addEventListener("mouseup", this.onMouseUp);
    el.addEventListener("wheel", this.onWheel, { passive: false });
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    el.addEventListener("touchstart", this.onTouchStart, { passive: false });
    el.addEventListener("touchmove", this.onTouchMove, { passive: false });
    el.addEventListener("touchend", this.onTouchEnd);
  }

  // ============================
  // Mouse handlers
  // ============================

  private onMouseDown = (e: MouseEvent): void => {
    if (e.button !== 0) return;
    this.isDragging = true;
    this.dragMoved = false;
    this.dragStartX = e.clientX;
    this.dragStartY = e.clientY;
  };

  private onMouseMove = (e: MouseEvent): void => {
    if (this.isDragging) {
      const dx = e.clientX - this.dragStartX;
      const dy = e.clientY - this.dragStartY;

      if (!this.dragMoved && Math.sqrt(dx * dx + dy * dy) < this.dragThreshold) return;

      this.dragMoved = true;
      this.camera.pan(dx, dy);
      this.dragStartX = e.clientX;
      this.dragStartY = e.clientY;
    }

    // Hover detection
    this.updateHover(e.clientX, e.clientY);
  };

  private onMouseUp = (e: MouseEvent): void => {
    if (this.isDragging && !this.dragMoved) {
      // Click — detect entity
      this.handleClick(e.clientX, e.clientY);
    }
    this.isDragging = false;
  };

  private onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    this.camera.zoomAt(e.clientX, e.clientY, e.deltaY);
  };

  // ============================
  // Keyboard
  // ============================

  private onKeyDown = (e: KeyboardEvent): void => {
    this.keysDown.add(e.key.toLowerCase());
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keysDown.delete(e.key.toLowerCase());
  };

  /** Process keyboard pan (call each frame) */
  updateKeyboard(): void {
    const panSpeed = 8;
    let dx = 0;
    let dy = 0;

    if (this.keysDown.has("w") || this.keysDown.has("arrowup")) dy += panSpeed;
    if (this.keysDown.has("s") || this.keysDown.has("arrowdown")) dy -= panSpeed;
    if (this.keysDown.has("a") || this.keysDown.has("arrowleft")) dx += panSpeed;
    if (this.keysDown.has("d") || this.keysDown.has("arrowright")) dx -= panSpeed;

    if (dx !== 0 || dy !== 0) {
      this.camera.pan(dx, dy);
    }
  }

  // ============================
  // Touch handlers
  // ============================

  private onTouchStart = (e: TouchEvent): void => {
    if (e.touches.length === 1) {
      this.isDragging = true;
      this.dragMoved = false;
      this.dragStartX = e.touches[0].clientX;
      this.dragStartY = e.touches[0].clientY;
    } else if (e.touches.length === 2) {
      this.isDragging = false;
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      this.lastPinchDist = Math.sqrt(dx * dx + dy * dy);
    }
  };

  private onTouchMove = (e: TouchEvent): void => {
    e.preventDefault();

    if (e.touches.length === 1 && this.isDragging) {
      const dx = e.touches[0].clientX - this.dragStartX;
      const dy = e.touches[0].clientY - this.dragStartY;

      if (!this.dragMoved && Math.sqrt(dx * dx + dy * dy) < this.dragThreshold) return;

      this.dragMoved = true;
      this.camera.pan(dx, dy);
      this.dragStartX = e.touches[0].clientX;
      this.dragStartY = e.touches[0].clientY;
    } else if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (this.lastPinchDist > 0) {
        const delta = (this.lastPinchDist - dist) * 3;
        const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        this.camera.zoomAt(midX, midY, delta);
      }
      this.lastPinchDist = dist;
    }
  };

  private onTouchEnd = (e: TouchEvent): void => {
    if (e.touches.length === 0) {
      if (this.isDragging && !this.dragMoved) {
        // Tap = click
        this.handleClick(this.dragStartX, this.dragStartY);
      }
      this.isDragging = false;
    }
    this.lastPinchDist = 0;
  };

  // ============================
  // Click/Hover Detection
  // ============================

  private handleClick(screenX: number, screenY: number): void {
    // Check entity container children for hits
    const worldPos = this.camera.screenToWorld(screenX, screenY);
    const gridPos = screenToGrid(worldPos.x, worldPos.y);

    // Search entities for closest one to the click point
    let bestMatch: { type: "building" | "agent"; id: string } | null = null;
    let bestDist = 25; // max click distance in screen pixels

    for (const child of this.entityContainer.children) {
      const entityType = (child as any).entityType;
      const entityId = (child as any).entityId;
      if (!entityType || !entityId) continue;

      const dx = child.position.x - worldPos.x;
      const dy = child.position.y - worldPos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < bestDist) {
        bestDist = dist;
        bestMatch = { type: entityType, id: entityId };
      }
    }

    if (bestMatch && this.onClick) {
      this.onClick(bestMatch.type, bestMatch.id);
    }
  }

  private updateHover(screenX: number, screenY: number): void {
    const worldPos = this.camera.screenToWorld(screenX, screenY);

    let found = false;
    for (const child of this.entityContainer.children) {
      const entityType = (child as any).entityType;
      if (!entityType) continue;

      const dx = child.position.x - worldPos.x;
      const dy = child.position.y - worldPos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 20) {
        this.domElement.style.cursor = "pointer";
        found = true;
        break;
      }
    }

    if (!found) {
      this.domElement.style.cursor = "default";
    }
  }

  dispose(): void {
    const el = this.domElement;
    el.removeEventListener("mousedown", this.onMouseDown);
    window.removeEventListener("mousemove", this.onMouseMove);
    window.removeEventListener("mouseup", this.onMouseUp);
    el.removeEventListener("wheel", this.onWheel);
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    el.removeEventListener("touchstart", this.onTouchStart);
    el.removeEventListener("touchmove", this.onTouchMove);
    el.removeEventListener("touchend", this.onTouchEnd);
  }
}
