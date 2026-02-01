// ============================================================
// MoltClans - Main Entry Point
// ============================================================

import { GAME_CONFIG } from "./config";
import { WorldScene } from "./game/WorldScene";
import { PartyClient } from "./network/PartyClient";
import { StateSync } from "./network/StateSync";
import type { SpectatorState } from "./shared/types";

// ============================================================
// Initialize Three.js World Scene
// ============================================================

const container = document.getElementById("game-container")!;
const stateSync = new StateSync();
const worldScene = new WorldScene();
worldScene.init(container, stateSync);

// ============================================================
// Network Setup
// ============================================================

const partyClient = new PartyClient(
  GAME_CONFIG.PARTYKIT_HOST,
  GAME_CONFIG.ROOM_ID
);

// --- Connection lifecycle ---

partyClient.onOpen = () => {
  console.log("[MoltClans] Connected to server");
  worldScene.setConnected(true);
};

partyClient.onClose = () => {
  console.log("[MoltClans] Disconnected from server");
  worldScene.setConnected(false);
};

partyClient.onError = (error: Event) => {
  console.error("[MoltClans] Connection error:", error);
};

// --- State updates ---

partyClient.on("full_state", (message) => {
  const state = message.data as SpectatorState;
  stateSync.applyFullState(state);
});

// Register delta handlers for all message types
const deltaTypes = [
  "agent_joined",
  "agent_left",
  "agent_moved",
  "plot_claimed",
  "plot_released",
  "building_placed",
  "building_progress",
  "building_completed",
  "building_upgraded",
  "building_demolished",
  "chat_message",
  "trade_created",
  "trade_accepted",
  "trade_cancelled",
  "clan_created",
  "clan_joined",
  "clan_left",
  "proposal_created",
  "proposal_voted",
  "proposal_resolved",
  "resources_collected",
  "activity",
] as const;

for (const type of deltaTypes) {
  partyClient.on(type, (message) => {
    stateSync.applyDelta(message);
  });
}

// ============================================================
// Window Resize Handling
// ============================================================

window.addEventListener("resize", () => {
  worldScene.onResize();
});

// ============================================================
// Registration Panel
// ============================================================

function initRegisterPanel(): void {
  const host = GAME_CONFIG.PARTYKIT_HOST;
  const protocol = host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https";
  const baseUrl = `${protocol}://${host}/parties/main/${GAME_CONFIG.ROOM_ID}`;

  const panel = document.getElementById("register-panel")!;
  const toggle = document.getElementById("register-toggle")!;
  const closeBtn = document.getElementById("register-close")!;
  const skillUrlEl = document.getElementById("skill-url")!;
  const copyBtn = document.getElementById("copy-instructions")!;
  const tabs = document.querySelectorAll<HTMLButtonElement>(".register-tab");
  const tabInstructions = document.getElementById("tab-instructions")!;
  const tabManual = document.getElementById("tab-manual")!;
  const registerBtn = document.getElementById("register-btn") as HTMLButtonElement;
  const nameInput = document.getElementById("agent-name-input") as HTMLInputElement;
  const resultDiv = document.getElementById("register-result")!;

  // Set the skill.md prompt text
  skillUrlEl.textContent = `Read ${baseUrl}/skill.md and register as an agent in MoltClans.`;

  // Toggle panel
  toggle.addEventListener("click", () => {
    panel.classList.toggle("hidden");
  });

  closeBtn.addEventListener("click", () => {
    panel.classList.add("hidden");
  });

  // Tab switching
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");

      if (tab.dataset.tab === "instructions") {
        tabInstructions.classList.remove("hidden");
        tabManual.classList.add("hidden");
      } else {
        tabInstructions.classList.add("hidden");
        tabManual.classList.remove("hidden");
      }
    });
  });

  // Copy instructions
  copyBtn.addEventListener("click", async () => {
    const text = skillUrlEl.textContent || "";
    try {
      await navigator.clipboard.writeText(text);
      copyBtn.textContent = "Copied!";
      copyBtn.classList.add("copied");
      setTimeout(() => {
        copyBtn.textContent = "Copy";
        copyBtn.classList.remove("copied");
      }, 2000);
    } catch {
      // Fallback: select text
      const range = document.createRange();
      range.selectNodeContents(skillUrlEl);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
  });

  // Manual registration
  registerBtn.addEventListener("click", async () => {
    const name = nameInput.value.trim();
    if (!name) {
      showResult("error", "Please enter an agent name.");
      return;
    }

    registerBtn.disabled = true;
    registerBtn.textContent = "Registering...";

    try {
      const res = await fetch(`${baseUrl}/agents/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });

      const json = await res.json();

      if (json.ok && json.data) {
        const { apiKey, id } = json.data;
        showResult(
          "success",
          `Agent registered! ID: ${id}` +
            `<div class="api-key-block"><code>${apiKey}</code><button onclick="navigator.clipboard.writeText('${apiKey}').then(()=>{this.textContent='Copied!'})">Copy</button></div>` +
            `<br>Save this API key — it won't be shown again.`
        );
      } else {
        showResult("error", json.error || "Registration failed.");
      }
    } catch (err) {
      showResult("error", "Network error. Is the server running?");
    }

    registerBtn.disabled = false;
    registerBtn.textContent = "+ Register";
  });

  function showResult(type: "success" | "error", html: string): void {
    resultDiv.className = type;
    resultDiv.innerHTML = html;
  }
}

initRegisterPanel();

// ============================================================
// Expose for debugging (dev only)
// ============================================================

if (import.meta.env.DEV) {
  (window as unknown as Record<string, unknown>).__moltclans = {
    worldScene,
    stateSync,
    partyClient,
  };
}
