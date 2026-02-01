// ============================================================
// MoltClans - Agent Factory (3D characters with name labels)
// ============================================================

import * as THREE from "three";
import { CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";
import { GAME_CONFIG } from "../config";
import type { PublicAgent } from "../shared/types";

// ============================================================
// Agent mesh data
// ============================================================

export interface AgentMesh {
  group: THREE.Group;
  agentId: string;
  agentData: PublicAgent;
  body: THREE.Mesh;
  eyeL: THREE.Group;
  eyeR: THREE.Group;
  shadow: THREE.Mesh;
  nameLabel: CSS2DObject;
  statusDot: HTMLElement;
  speechBubble: CSS2DObject | null;
  speechTimer: number | null;

  // Animation state
  targetX: number;
  targetZ: number;
  moveStartTime: number;
  moveStartX: number;
  moveStartZ: number;
  isMoving: boolean;
  moveDirection: { dx: number; dz: number };
}

const MOVE_DURATION = 400; // ms
const BODY_HEIGHT = 0.5;
const BODY_RADIUS = 0.25;

/**
 * Create a 3D agent group.
 */
export function createAgentMesh(agent: PublicAgent): AgentMesh {
  const group = new THREE.Group();

  // Position at grid center
  const wx = agent.x + 0.5;
  const wz = agent.y + 0.5;
  group.position.set(wx, 0, wz);

  // Body: Capsule
  const bodyGeo = new THREE.CapsuleGeometry(BODY_RADIUS, BODY_HEIGHT, 8, 8);
  const bodyMat = new THREE.MeshLambertMaterial({ color: new THREE.Color(agent.color) });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = BODY_RADIUS + BODY_HEIGHT / 2;
  body.castShadow = true;
  group.add(body);

  // Eyes
  const eyeL = createEye();
  eyeL.position.set(-0.1, BODY_HEIGHT * 0.7 + BODY_RADIUS, BODY_RADIUS * 0.85);
  body.add(eyeL);

  const eyeR = createEye();
  eyeR.position.set(0.1, BODY_HEIGHT * 0.7 + BODY_RADIUS, BODY_RADIUS * 0.85);
  body.add(eyeR);

  // Shadow on ground
  const shadowGeo = new THREE.CircleGeometry(0.3, 16);
  shadowGeo.rotateX(-Math.PI / 2);
  const shadowMat = new THREE.MeshBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: 0.25,
    depthWrite: false,
  });
  const shadow = new THREE.Mesh(shadowGeo, shadowMat);
  shadow.position.y = 0.01;
  group.add(shadow);

  // Name label (CSS2D)
  const nameDiv = document.createElement("div");
  nameDiv.style.cssText =
    "color:#fff;font-size:12px;font-weight:bold;white-space:nowrap;pointer-events:none;" +
    "text-shadow: -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000;" +
    "font-family: 'Courier New', monospace;";

  // Status dot
  const statusDot = document.createElement("span");
  statusDot.style.cssText =
    "display:inline-block;width:6px;height:6px;border-radius:50%;margin-left:4px;vertical-align:middle;";
  statusDot.style.backgroundColor = agent.online ? "#4caf50" : "#888888";

  nameDiv.textContent = agent.name;
  nameDiv.appendChild(statusDot);

  const nameLabel = new CSS2DObject(nameDiv);
  nameLabel.position.set(0, BODY_HEIGHT + BODY_RADIUS * 2 + 0.3, 0);
  group.add(nameLabel);

  // Store agent data for raycasting
  group.userData = { type: "agent", agentId: agent.id };
  body.userData = { type: "agent", agentId: agent.id };

  return {
    group,
    agentId: agent.id,
    agentData: agent,
    body,
    eyeL,
    eyeR,
    shadow,
    nameLabel,
    statusDot,
    speechBubble: null,
    speechTimer: null,
    targetX: wx,
    targetZ: wz,
    moveStartTime: 0,
    moveStartX: wx,
    moveStartZ: wz,
    isMoving: false,
    moveDirection: { dx: 0, dz: 1 },
  };
}

/**
 * Update an agent mesh with new data.
 */
export function updateAgentMesh(am: AgentMesh, agent: PublicAgent): void {
  const prevData = am.agentData;
  am.agentData = agent;

  // Update color
  if (am.body.material instanceof THREE.MeshLambertMaterial) {
    am.body.material.color.set(agent.color);
  }

  // Update status dot
  am.statusDot.style.backgroundColor = agent.online ? "#4caf50" : "#888888";

  // Update name
  const nameDiv = am.nameLabel.element;
  // Preserve status dot
  nameDiv.textContent = agent.name;
  nameDiv.appendChild(am.statusDot);

  // Movement
  const newX = agent.x + 0.5;
  const newZ = agent.y + 0.5;
  const dx = newX - am.group.position.x;
  const dz = newZ - am.group.position.z;

  if (Math.abs(dx) > 0.01 || Math.abs(dz) > 0.01) {
    am.moveStartX = am.group.position.x;
    am.moveStartZ = am.group.position.z;
    am.targetX = newX;
    am.targetZ = newZ;
    am.moveStartTime = performance.now();
    am.isMoving = true;

    // Track direction for eye position
    const len = Math.sqrt(dx * dx + dz * dz);
    am.moveDirection = { dx: dx / len, dz: dz / len };
  }
}

/**
 * Per-frame animation update for an agent.
 */
export function animateAgent(am: AgentMesh, now: number): void {
  if (!am.isMoving) return;

  const elapsed = now - am.moveStartTime;
  const t = Math.min(elapsed / MOVE_DURATION, 1);

  // Ease out
  const eased = 1 - Math.pow(1 - t, 2);

  // Lerp position
  am.group.position.x = am.moveStartX + (am.targetX - am.moveStartX) * eased;
  am.group.position.z = am.moveStartZ + (am.targetZ - am.moveStartZ) * eased;

  // Bounce during movement
  const bounce = Math.sin(t * Math.PI) * 0.1;
  am.body.position.y = BODY_RADIUS + BODY_HEIGHT / 2 + bounce;

  // Update eye direction
  const eyeOffset = 0.03;
  am.eyeL.children[1].position.z = eyeOffset * am.moveDirection.dz;
  am.eyeL.children[1].position.x = eyeOffset * am.moveDirection.dx;
  am.eyeR.children[1].position.z = eyeOffset * am.moveDirection.dz;
  am.eyeR.children[1].position.x = eyeOffset * am.moveDirection.dx;

  if (t >= 1) {
    am.isMoving = false;
    am.group.position.x = am.targetX;
    am.group.position.z = am.targetZ;
    am.body.position.y = BODY_RADIUS + BODY_HEIGHT / 2;
  }
}

/**
 * Show a speech bubble above the agent.
 */
export function showSpeechBubble(am: AgentMesh, text: string): void {
  clearSpeechBubble(am);

  const div = document.createElement("div");
  div.style.cssText =
    "background:rgba(0,0,0,0.75);color:#fff;padding:4px 8px;border-radius:8px;" +
    "font-size:11px;max-width:150px;word-wrap:break-word;pointer-events:none;" +
    "font-family:'Courier New',monospace;white-space:pre-wrap;" +
    "border:1px solid rgba(255,255,255,0.2);";
  div.textContent = text.length > 80 ? text.slice(0, 77) + "..." : text;

  const label = new CSS2DObject(div);
  label.position.set(0, BODY_HEIGHT + BODY_RADIUS * 2 + 0.7, 0);
  am.group.add(label);
  am.speechBubble = label;

  am.speechTimer = window.setTimeout(() => {
    clearSpeechBubble(am);
  }, GAME_CONFIG.SPEECH_BUBBLE_DURATION);
}

/**
 * Clear the speech bubble.
 */
export function clearSpeechBubble(am: AgentMesh): void {
  if (am.speechBubble) {
    am.group.remove(am.speechBubble);
    am.speechBubble.element.remove();
    am.speechBubble = null;
  }
  if (am.speechTimer !== null) {
    clearTimeout(am.speechTimer);
    am.speechTimer = null;
  }
}

/**
 * Destroy an agent mesh and clean up.
 */
export function destroyAgentMesh(am: AgentMesh): void {
  clearSpeechBubble(am);
  am.group.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.geometry.dispose();
      if (child.material instanceof THREE.Material) {
        child.material.dispose();
      }
    }
  });
  am.nameLabel.element.remove();
}

// ============================================================
// Helpers
// ============================================================

function createEye(): THREE.Group {
  const eye = new THREE.Group();

  // White sclera
  const scleraGeo = new THREE.SphereGeometry(0.06, 8, 8);
  const scleraMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const sclera = new THREE.Mesh(scleraGeo, scleraMat);
  eye.add(sclera);

  // Black pupil
  const pupilGeo = new THREE.SphereGeometry(0.03, 6, 6);
  const pupilMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
  const pupil = new THREE.Mesh(pupilGeo, pupilMat);
  pupil.position.z = 0.04;
  eye.add(pupil);

  return eye;
}
