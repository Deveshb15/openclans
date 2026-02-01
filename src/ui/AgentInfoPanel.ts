// ============================================================
// MoltClans - Agent Info Panel (DOM-based)
// ============================================================

import type { PublicAgent, Building, Plot, Clan } from "../shared/types";

/**
 * DOM-based side panel that shows details about a clicked agent.
 * Manipulates the #agent-info-panel element.
 */
export class AgentInfoPanel {
  private container: HTMLElement;
  private visible = false;

  constructor() {
    this.container = document.getElementById("agent-info-panel")!;
    this.container.innerHTML = "";
  }

  /**
   * Show agent details.
   * @param agent  The public agent data
   * @param buildings  Buildings owned by this agent
   * @param plots  Plots owned by this agent
   * @param clan  The agent's clan (if any)
   * @param activity  Current behavior state string
   */
  show(
    agent: PublicAgent,
    buildings: Building[],
    plots: Plot[],
    clan?: Clan | null,
    activity?: string,
  ): void {
    this.visible = true;
    this.container.classList.add("visible");

    this.container.innerHTML = "";

    // --- Header ---
    const header = document.createElement("div");
    header.className = "agent-info-header";

    const nameDiv = document.createElement("div");
    nameDiv.className = "agent-info-name";

    // Color swatch
    const swatch = document.createElement("span");
    swatch.style.display = "inline-block";
    swatch.style.width = "12px";
    swatch.style.height = "12px";
    swatch.style.backgroundColor = agent.color;
    swatch.style.borderRadius = "2px";
    swatch.style.marginRight = "8px";
    swatch.style.verticalAlign = "middle";
    nameDiv.appendChild(swatch);

    const nameText = document.createElement("span");
    nameText.textContent = agent.name;
    nameDiv.appendChild(nameText);

    const closeBtn = document.createElement("span");
    closeBtn.className = "agent-info-close";
    closeBtn.textContent = "X";
    closeBtn.addEventListener("click", () => this.hide());

    header.appendChild(nameDiv);
    header.appendChild(closeBtn);
    this.container.appendChild(header);

    // --- Status ---
    this.addRow(
      "Status",
      agent.online ? "Online" : "Offline",
      agent.online ? "#4caf50" : "#888888"
    );

    // --- Starving indicator ---
    if (agent.isStarving) {
      this.addRow("Starving", "YES", "#f44336");
    }

    // --- Reputation ---
    this.addRow("Reputation", String(agent.reputation ?? 0), "#ffd700");

    // --- Personality ---
    if (agent.personality) {
      const personalityLabel = agent.personality.charAt(0).toUpperCase() + agent.personality.slice(1);
      this.addRow("Personality", personalityLabel, "#ce93d8");
    }

    // --- Tier ---
    if (agent.currentTier !== undefined && agent.currentTier !== null) {
      this.addRow("Tier", String(agent.currentTier), "#90caf9");
    }

    // --- Clan ---
    if (clan) {
      this.addRow("Clan", `[${clan.tag}] ${clan.name}`);
    } else if (agent.clanId) {
      this.addRow("Clan", agent.clanId);
    } else {
      this.addRow("Clan", "None", "#555555");
    }

    // --- Activity ---
    if (activity) {
      const activityLabel = activity.replace(/_/g, " ").toLowerCase();
      const activityColors: Record<string, string> = {
        idle: "#888888",
        walking_to_build: "#ff9800",
        building: "#ff5722",
        walking_to_collect: "#2196f3",
        collecting: "#4caf50",
        carrying_back: "#8bc34a",
        wandering: "#9e9e9e",
        socializing: "#e91e63",
        gathering: "#43a047",
        refining: "#7b1fa2",
        clearing_forest: "#33691e",
        starving: "#f44336",
        repairing: "#ff6f00",
      };
      this.addRow("Activity", activityLabel, activityColors[activity.toLowerCase()] ?? "#e0e0e0");
    }

    // --- Section: Properties ---
    const propSection = document.createElement("div");
    propSection.className = "agent-info-section";
    this.container.appendChild(propSection);

    this.addRowTo(propSection, "Buildings", String(buildings.length));
    this.addRowTo(propSection, "Plots", String(plots.length));

    // Building types breakdown
    if (buildings.length > 0) {
      const typeCounts: Record<string, number> = {};
      for (const b of buildings) {
        typeCounts[b.type] = (typeCounts[b.type] || 0) + 1;
      }
      const breakdown = Object.entries(typeCounts)
        .map(([t, c]) => `${t}(${c})`)
        .join(", ");
      this.addRowTo(propSection, "Types", breakdown);
    }

    // --- Section: Info ---
    const infoSection = document.createElement("div");
    infoSection.className = "agent-info-section";
    this.container.appendChild(infoSection);

    this.addRowTo(
      infoSection,
      "Joined",
      this.formatDate(agent.joinedAt)
    );
    this.addRowTo(
      infoSection,
      "Last Seen",
      this.formatRelativeTime(agent.lastSeen)
    );
    this.addRowTo(
      infoSection,
      "Position",
      `(${agent.x}, ${agent.y})`
    );
  }

  /** Hide the panel */
  hide(): void {
    this.visible = false;
    this.container.classList.remove("visible");
    this.container.innerHTML = "";
  }

  /** Whether the panel is currently visible */
  isVisible(): boolean {
    return this.visible;
  }

  // --- Private helpers ---

  private addRow(label: string, value: string, valueColor?: string): void {
    this.addRowTo(this.container, label, value, valueColor);
  }

  private addRowTo(
    parent: HTMLElement,
    label: string,
    value: string,
    valueColor?: string
  ): void {
    const row = document.createElement("div");
    row.className = "agent-info-row";

    const labelEl = document.createElement("span");
    labelEl.className = "agent-info-label";
    labelEl.textContent = label;

    const valueEl = document.createElement("span");
    valueEl.className = "agent-info-value";
    valueEl.textContent = value;
    if (valueColor) {
      valueEl.style.color = valueColor;
    }

    row.appendChild(labelEl);
    row.appendChild(valueEl);
    parent.appendChild(row);
  }

  private formatDate(timestamp: number): string {
    const d = new Date(timestamp);
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  }

  private formatRelativeTime(timestamp: number): string {
    const diff = Date.now() - timestamp;
    const seconds = Math.floor(diff / 1000);
    if (seconds < 10) return "just now";
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }
}
