// ============================================================
// MoltClans - Town Stats Bar (DOM-based)
// ============================================================

import type { SpectatorState } from "../shared/types";

/**
 * DOM-based stats bar at the top of the screen.
 * Shows population, buildings, active trades, day/night, connection status.
 */
export class TownStats {
  private container: HTMLElement;
  private populationEl: HTMLElement;
  private buildingsEl: HTMLElement;
  private tradesEl: HTMLElement;
  private dayNightEl: HTMLElement;
  private connectionEl: HTMLElement;
  private tickEl: HTMLElement;

  private _connected = false;
  private _isNight = false;

  constructor() {
    this.container = document.getElementById("town-stats")!;
    this.container.innerHTML = "";

    // --- Title ---
    const titleItem = this.createStatItem("MoltClans", "", "#ffd700");
    this.container.appendChild(titleItem.wrapper);

    // --- Population ---
    const pop = this.createStatItem("Population", "0");
    this.populationEl = pop.valueEl;
    this.container.appendChild(pop.wrapper);

    // --- Buildings ---
    const bld = this.createStatItem("Buildings", "0");
    this.buildingsEl = bld.valueEl;
    this.container.appendChild(bld.wrapper);

    // --- Active Trades ---
    const trades = this.createStatItem("Trades", "0");
    this.tradesEl = trades.valueEl;
    this.container.appendChild(trades.wrapper);

    // --- Tick ---
    const tick = this.createStatItem("Tick", "0");
    this.tickEl = tick.valueEl;
    this.container.appendChild(tick.wrapper);

    // --- Day/Night ---
    const dn = this.createStatItem("", "Day", "#ffd700");
    this.dayNightEl = dn.valueEl;
    this.container.appendChild(dn.wrapper);

    // --- Spacer pushes connection to the right ---
    const spacer = document.createElement("div");
    spacer.style.flex = "1";
    this.container.appendChild(spacer);

    // --- Connection status ---
    const conn = this.createStatItem("", "Connecting...", "#888888");
    this.connectionEl = conn.valueEl;
    this.container.appendChild(conn.wrapper);
  }

  /**
   * Update all stats from the current spectator state.
   */
  update(state: SpectatorState): void {
    const agentCount = Object.keys(state.agents).length;
    const onlineCount = Object.values(state.agents).filter(
      (a) => a.online
    ).length;
    this.populationEl.textContent = String(agentCount);

    const buildingCount = Object.keys(state.buildings).length;
    this.buildingsEl.textContent = String(buildingCount);

    const activeTradeCount = Object.values(state.trades).filter(
      (t) => t.status === "open"
    ).length;
    this.tradesEl.textContent = String(activeTradeCount);

    this.tickEl.textContent = String(state.tick);
  }

  /** Update the connection status indicator */
  setConnected(connected: boolean): void {
    this._connected = connected;
    if (connected) {
      this.connectionEl.textContent = "Connected";
      this.connectionEl.style.color = "#4caf50";
    } else {
      this.connectionEl.textContent = "Disconnected";
      this.connectionEl.style.color = "#e74c3c";
    }
  }

  /** Update the day/night indicator */
  setNight(isNight: boolean): void {
    if (this._isNight === isNight) return;
    this._isNight = isNight;
    if (isNight) {
      this.dayNightEl.textContent = "Night";
      this.dayNightEl.style.color = "#5577cc";
    } else {
      this.dayNightEl.textContent = "Day";
      this.dayNightEl.style.color = "#ffd700";
    }
  }

  // --- Private helpers ---

  private createStatItem(
    label: string,
    value: string,
    valueColor = "#ffd700"
  ): { wrapper: HTMLElement; valueEl: HTMLElement } {
    const wrapper = document.createElement("div");
    wrapper.className = "stat-item";

    if (label) {
      const labelEl = document.createElement("span");
      labelEl.className = "stat-label";
      labelEl.textContent = label;
      wrapper.appendChild(labelEl);
    }

    const valueEl = document.createElement("span");
    valueEl.className = "stat-value";
    valueEl.textContent = value;
    valueEl.style.color = valueColor;
    wrapper.appendChild(valueEl);

    return { wrapper, valueEl };
  }
}
