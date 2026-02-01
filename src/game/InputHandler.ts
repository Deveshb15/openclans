// ============================================================
// MoltClans - Input Handler (Raycaster click detection)
// ============================================================

import * as THREE from "three";
import type { CameraController } from "./CameraController";

export type ClickCallback = (type: "building" | "agent", id: string) => void;

export class InputHandler {
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();
  private camera: THREE.PerspectiveCamera;
  private scene: THREE.Scene;
  private cameraController: CameraController;
  private domElement: HTMLElement;

  // Callbacks
  public onClick: ClickCallback | null = null;

  // Hover highlight
  private hoveredObject: THREE.Object3D | null = null;

  constructor(
    domElement: HTMLElement,
    camera: THREE.PerspectiveCamera,
    scene: THREE.Scene,
    cameraController: CameraController
  ) {
    this.domElement = domElement;
    this.camera = camera;
    this.scene = scene;
    this.cameraController = cameraController;

    domElement.addEventListener("click", this.onClickHandler);
    domElement.addEventListener("mousemove", this.onMouseMoveHandler);
  }

  private onClickHandler = (e: MouseEvent): void => {
    // Only process clicks, not drags
    if (this.cameraController.wasDrag) return;

    this.updateMouse(e);
    this.raycaster.setFromCamera(this.mouse, this.camera);

    const intersects = this.raycaster.intersectObjects(this.scene.children, true);

    for (const hit of intersects) {
      const userData = this.findUserData(hit.object);
      if (userData) {
        if (userData.type === "building" && userData.buildingId && this.onClick) {
          this.onClick("building", userData.buildingId);
          return;
        }
        if (userData.type === "agent" && userData.agentId && this.onClick) {
          this.onClick("agent", userData.agentId);
          return;
        }
      }
    }
  };

  private onMouseMoveHandler = (e: MouseEvent): void => {
    this.updateMouse(e);
    this.raycaster.setFromCamera(this.mouse, this.camera);

    const intersects = this.raycaster.intersectObjects(this.scene.children, true);

    // Clear previous hover
    if (this.hoveredObject) {
      this.clearHighlight(this.hoveredObject);
      this.hoveredObject = null;
      this.domElement.style.cursor = "default";
    }

    for (const hit of intersects) {
      const userData = this.findUserData(hit.object);
      if (userData && (userData.type === "building" || userData.type === "agent")) {
        this.hoveredObject = hit.object;
        this.applyHighlight(hit.object);
        this.domElement.style.cursor = "pointer";
        return;
      }
    }
  };

  private updateMouse(e: MouseEvent): void {
    const rect = this.domElement.getBoundingClientRect();
    this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  }

  private findUserData(obj: THREE.Object3D): Record<string, string> | null {
    let current: THREE.Object3D | null = obj;
    while (current) {
      if (current.userData && (current.userData.type === "building" || current.userData.type === "agent")) {
        return current.userData as Record<string, string>;
      }
      current = current.parent;
    }
    return null;
  }

  private originalEmissiveCache: WeakMap<THREE.Material, number> = new WeakMap();

  private applyHighlight(obj: THREE.Object3D): void {
    if (obj instanceof THREE.Mesh && obj.material instanceof THREE.MeshLambertMaterial) {
      this.originalEmissiveCache.set(obj.material, obj.material.emissive.getHex());
      obj.material.emissive.setHex(0x222222);
    }
  }

  private clearHighlight(obj: THREE.Object3D): void {
    if (obj instanceof THREE.Mesh && obj.material instanceof THREE.MeshLambertMaterial) {
      const orig = this.originalEmissiveCache.get(obj.material);
      obj.material.emissive.setHex(orig ?? 0x000000);
    }
  }

  dispose(): void {
    this.domElement.removeEventListener("click", this.onClickHandler);
    this.domElement.removeEventListener("mousemove", this.onMouseMoveHandler);
  }
}
