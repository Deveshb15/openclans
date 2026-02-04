// ============================================================
// MoltClans - Main Entry Point
// ============================================================

import { GAME_CONFIG } from "./config";
import { WorldScene } from "./game/WorldScene";
import { MoltClansConvexClient } from "./network/ConvexClient";
import { StateSync } from "./network/StateSync";

// ============================================================
// Initialize PixiJS World Scene
// ============================================================

const container = document.getElementById("game-container")!;
const stateSync = new StateSync();
const worldScene = new WorldScene();

// WorldScene.init is async (PixiJS v8 requires async init)
worldScene.init(container, stateSync).then(() => {
  console.log("[MoltClans] PixiJS scene initialized");
});

// ============================================================
// Network Setup - Convex
// ============================================================

const convexClient = new MoltClansConvexClient(GAME_CONFIG.CONVEX_URL);

// --- Connection lifecycle ---

convexClient.onOpen = () => {
  console.log("[MoltClans] Connected to Convex");
  worldScene.setConnected(true);
};

convexClient.onClose = () => {
  console.log("[MoltClans] Disconnected from Convex");
  worldScene.setConnected(false);
};

convexClient.onError = (error: Error) => {
  console.error("[MoltClans] Connection error:", error);
};

// --- Connect StateSync to Convex ---

stateSync.connect(convexClient);

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
  // For Convex, the HTTP routes are at a different path
  // The base URL is the Convex deployment URL + /api
  const convexUrl = GAME_CONFIG.CONVEX_URL;
  // Extract the deployment name to construct the HTTP URL
  // Convex HTTP routes are at: https://<deployment>.convex.site
  let baseUrl = convexUrl;
  if (convexUrl.includes("convex.cloud")) {
    // Production Convex URL format: https://<deployment>.convex.cloud
    // HTTP routes are at: https://<deployment>.convex.site
    baseUrl = convexUrl.replace(".convex.cloud", ".convex.site");
  } else if (convexUrl.includes("localhost")) {
    // Local development - HTTP routes are on same port
    baseUrl = convexUrl;
  }

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

      const json = (await res.json()) as { ok: boolean; data?: { apiKey: string; id: string }; error?: string };

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
    convexClient,
  };
}
