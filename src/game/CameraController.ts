// ============================================================
// MoltClans - Camera Controller for Three.js
// Drag-to-pan, wheel-zoom, keyboard pan, follow agent
// ============================================================

import * as THREE from "three";
import { GAME_CONFIG } from "../config";
import { GRID_WIDTH, GRID_HEIGHT } from "../shared/constants";

export class CameraController {
  public camera: THREE.PerspectiveCamera;

  // Camera target (the point the camera looks at on the XZ plane)
  private target: THREE.Vector3 = new THREE.Vector3(GRID_WIDTH / 2, 0, GRID_HEIGHT / 2);
  private distance: number = GAME_CONFIG.CAMERA_DISTANCE;

  // Camera angle (fixed angle from horizontal)
  private readonly angle: number = (GAME_CONFIG.CAMERA_ANGLE * Math.PI) / 180;
  private readonly azimuth: number = Math.PI / 4; // 45° rotation around Y

  // Drag state
  private isDragging = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private dragStartTarget = new THREE.Vector3();
  private dragThreshold = 4; // px
  private dragMoved = false;

  // Keys state
  private keysDown: Set<string> = new Set();

  // Follow
  private followTarget: THREE.Vector3 | null = null;
  private followEasing = 0.08;

  // Touch pinch state
  private lastPinchDist = 0;

  // DOM element
  private domElement: HTMLElement;

  constructor(domElement: HTMLElement, aspect: number) {
    this.domElement = domElement;

    this.camera = new THREE.PerspectiveCamera(
      GAME_CONFIG.CAMERA_FOV,
      aspect,
      0.1,
      500
    );

    this.updateCameraPosition();
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    const el = this.domElement;

    // Mouse drag
    el.addEventListener("mousedown", this.onMouseDown);
    window.addEventListener("mousemove", this.onMouseMove);
    window.addEventListener("mouseup", this.onMouseUp);

    // Wheel zoom
    el.addEventListener("wheel", this.onWheel, { passive: false });

    // Keyboard
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);

    // Touch
    el.addEventListener("touchstart", this.onTouchStart, { passive: false });
    el.addEventListener("touchmove", this.onTouchMove, { passive: false });
    el.addEventListener("touchend", this.onTouchEnd);
  }

  /** Whether the last interaction was a drag (not a click) */
  get wasDrag(): boolean {
    return this.dragMoved;
  }

  // ============================
  // Mouse handlers
  // ============================

  private onMouseDown = (e: MouseEvent): void => {
    if (e.button !== 0) return; // left only
    this.isDragging = true;
    this.dragMoved = false;
    this.dragStartX = e.clientX;
    this.dragStartY = e.clientY;
    this.dragStartTarget.copy(this.target);
  };

  private onMouseMove = (e: MouseEvent): void => {
    if (!this.isDragging) return;

    const dx = e.clientX - this.dragStartX;
    const dy = e.clientY - this.dragStartY;

    if (!this.dragMoved && Math.sqrt(dx * dx + dy * dy) < this.dragThreshold) return;

    this.dragMoved = true;
    this.followTarget = null; // stop following

    // Convert screen pixels to world movement
    const panScale = this.distance * 0.002;

    // Compute camera-relative horizontal and vertical pan directions
    const cosA = Math.cos(this.azimuth);
    const sinA = Math.sin(this.azimuth);

    this.target.x = this.dragStartTarget.x + (-dx * cosA - dy * sinA) * panScale;
    this.target.z = this.dragStartTarget.z + (dx * sinA - dy * cosA) * panScale;

    this.clampTarget();
    this.updateCameraPosition();
  };

  private onMouseUp = (): void => {
    this.isDragging = false;
  };

  // ============================
  // Wheel handler
  // ============================

  private onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 1 : -1;
    this.distance += delta * GAME_CONFIG.ZOOM_SPEED;
    this.distance = Math.max(GAME_CONFIG.MIN_ZOOM, Math.min(GAME_CONFIG.MAX_ZOOM, this.distance));
    this.updateCameraPosition();
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

  // ============================
  // Touch handlers
  // ============================

  private onTouchStart = (e: TouchEvent): void => {
    if (e.touches.length === 1) {
      this.isDragging = true;
      this.dragMoved = false;
      this.dragStartX = e.touches[0].clientX;
      this.dragStartY = e.touches[0].clientY;
      this.dragStartTarget.copy(this.target);
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
      this.followTarget = null;

      const panScale = this.distance * 0.003;
      const cosA = Math.cos(this.azimuth);
      const sinA = Math.sin(this.azimuth);

      this.target.x = this.dragStartTarget.x + (-dx * cosA - dy * sinA) * panScale;
      this.target.z = this.dragStartTarget.z + (dx * sinA - dy * cosA) * panScale;

      this.clampTarget();
      this.updateCameraPosition();
    } else if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (this.lastPinchDist > 0) {
        const scale = this.lastPinchDist / dist;
        this.distance *= scale;
        this.distance = Math.max(GAME_CONFIG.MIN_ZOOM, Math.min(GAME_CONFIG.MAX_ZOOM, this.distance));
        this.updateCameraPosition();
      }

      this.lastPinchDist = dist;
    }
  };

  private onTouchEnd = (e: TouchEvent): void => {
    if (e.touches.length === 0) {
      this.isDragging = false;
    }
    this.lastPinchDist = 0;
  };

  // ============================
  // Public API
  // ============================

  /** Center camera on a specific world position */
  centerOn(x: number, z: number): void {
    this.target.set(x, 0, z);
    this.clampTarget();
    this.updateCameraPosition();
  }

  /** Center on world middle */
  centerOnWorld(): void {
    this.centerOn(GRID_WIDTH / 2, GRID_HEIGHT / 2);
  }

  /** Follow a position (will smooth-lerp each frame) */
  follow(x: number, z: number): void {
    this.followTarget = new THREE.Vector3(x, 0, z);
  }

  /** Stop following */
  stopFollow(): void {
    this.followTarget = null;
  }

  /** Navigate to grid tile position */
  navigateToTile(tileX: number, tileZ: number): void {
    this.stopFollow();
    this.centerOn(tileX + 0.5, tileZ + 0.5);
  }

  /** Called every frame */
  update(_time: number, _delta: number): void {
    // Keyboard pan
    const panSpeed = GAME_CONFIG.PAN_SPEED * (this.distance / 50);
    const cosA = Math.cos(this.azimuth);
    const sinA = Math.sin(this.azimuth);

    let panX = 0;
    let panZ = 0;

    if (this.keysDown.has("w") || this.keysDown.has("arrowup")) {
      panX -= sinA * panSpeed;
      panZ -= cosA * panSpeed;
    }
    if (this.keysDown.has("s") || this.keysDown.has("arrowdown")) {
      panX += sinA * panSpeed;
      panZ += cosA * panSpeed;
    }
    if (this.keysDown.has("a") || this.keysDown.has("arrowleft")) {
      panX -= cosA * panSpeed;
      panZ += sinA * panSpeed;
    }
    if (this.keysDown.has("d") || this.keysDown.has("arrowright")) {
      panX += cosA * panSpeed;
      panZ -= sinA * panSpeed;
    }

    if (panX !== 0 || panZ !== 0) {
      this.followTarget = null;
      this.target.x += panX;
      this.target.z += panZ;
      this.clampTarget();
      this.updateCameraPosition();
    }

    // Follow
    if (this.followTarget) {
      this.target.lerp(this.followTarget, this.followEasing);
      this.clampTarget();
      this.updateCameraPosition();
    }
  }

  /** Handle window resize */
  onResize(width: number, height: number): void {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  /** Get approximate grid bounds visible by the camera (for minimap) */
  getVisibleGridBounds(): { minX: number; minZ: number; maxX: number; maxZ: number } {
    // Approximate visible area from camera distance and FOV
    const vFov = (this.camera.fov * Math.PI) / 180;
    const visibleHeight = 2 * this.distance * Math.tan(vFov / 2);
    const visibleWidth = visibleHeight * this.camera.aspect;

    const halfW = visibleWidth / 2;
    const halfH = visibleHeight / 2;

    return {
      minX: Math.max(0, this.target.x - halfW),
      minZ: Math.max(0, this.target.z - halfH),
      maxX: Math.min(GRID_WIDTH, this.target.x + halfW),
      maxZ: Math.min(GRID_HEIGHT, this.target.z + halfH),
    };
  }

  // ============================
  // Internal
  // ============================

  private updateCameraPosition(): void {
    // Position camera at (target + offset) where offset is determined by angle, azimuth, distance
    const offsetX = this.distance * Math.cos(this.angle) * Math.sin(this.azimuth);
    const offsetY = this.distance * Math.sin(this.angle);
    const offsetZ = this.distance * Math.cos(this.angle) * Math.cos(this.azimuth);

    this.camera.position.set(
      this.target.x + offsetX,
      this.target.y + offsetY,
      this.target.z + offsetZ
    );
    this.camera.lookAt(this.target);
  }

  private clampTarget(): void {
    this.target.x = Math.max(0, Math.min(GRID_WIDTH, this.target.x));
    this.target.z = Math.max(0, Math.min(GRID_HEIGHT, this.target.z));
  }

  /** Clean up event listeners */
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
