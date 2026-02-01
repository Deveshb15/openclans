// ============================================================
// MoltClans - Chat Panel (DOM-based)
// ============================================================

import { GAME_CONFIG } from "../config";
import type { ChatMessage, ActivityEntry } from "../shared/types";

type TabName = "town" | "activity";

/**
 * DOM-based chat panel that shows town chat messages and activity log.
 * Spectators can only watch -- no input field is provided.
 */
export class ChatPanel {
  private container: HTMLElement;
  private messagesEl: HTMLDivElement;
  private activityEl: HTMLDivElement;
  private activeTab: TabName = "town";
  private townTabEl: HTMLElement | null = null;
  private activityTabEl: HTMLElement | null = null;

  private chatMessages: ChatMessage[] = [];
  private activityEntries: ActivityEntry[] = [];

  constructor() {
    this.container = document.getElementById("chat-panel")!;

    // Build the DOM structure
    this.container.innerHTML = "";

    // --- Header with tabs ---
    const header = document.createElement("div");
    header.className = "chat-header";

    this.townTabEl = document.createElement("span");
    this.townTabEl.className = "chat-tab active";
    this.townTabEl.textContent = "Town";
    this.townTabEl.addEventListener("click", () => this.switchTab("town"));
    header.appendChild(this.townTabEl);

    this.activityTabEl = document.createElement("span");
    this.activityTabEl.className = "chat-tab";
    this.activityTabEl.textContent = "Activity";
    this.activityTabEl.addEventListener("click", () =>
      this.switchTab("activity")
    );
    header.appendChild(this.activityTabEl);

    this.container.appendChild(header);

    // --- Messages area (Town chat) ---
    this.messagesEl = document.createElement("div");
    this.messagesEl.className = "chat-messages";
    this.container.appendChild(this.messagesEl);

    // --- Activity area (hidden by default) ---
    this.activityEl = document.createElement("div");
    this.activityEl.className = "chat-messages";
    this.activityEl.style.display = "none";
    this.container.appendChild(this.activityEl);
  }

  /** Switch between Town and Activity tabs */
  private switchTab(tab: TabName): void {
    this.activeTab = tab;

    if (tab === "town") {
      this.messagesEl.style.display = "block";
      this.activityEl.style.display = "none";
      this.townTabEl?.classList.add("active");
      this.activityTabEl?.classList.remove("active");
    } else {
      this.messagesEl.style.display = "none";
      this.activityEl.style.display = "block";
      this.townTabEl?.classList.remove("active");
      this.activityTabEl?.classList.add("active");
    }
  }

  /** Add a chat message to the Town tab */
  addMessage(msg: ChatMessage): void {
    this.chatMessages.push(msg);

    // Trim old messages
    if (this.chatMessages.length > GAME_CONFIG.MAX_VISIBLE_CHAT) {
      this.chatMessages.shift();
      // Remove oldest DOM child
      if (this.messagesEl.firstChild) {
        this.messagesEl.removeChild(this.messagesEl.firstChild);
      }
    }

    const el = document.createElement("div");
    el.className = "chat-message";

    const nameSpan = document.createElement("span");
    nameSpan.className = "agent-name";
    nameSpan.textContent = msg.senderName;
    nameSpan.style.color = this.getAgentColor(msg.senderId);

    const timeSpan = document.createElement("span");
    timeSpan.className = "timestamp";
    timeSpan.textContent = ` ${this.formatRelativeTime(msg.timestamp)} `;

    const contentSpan = document.createElement("span");
    contentSpan.textContent = msg.content;

    el.appendChild(nameSpan);
    el.appendChild(timeSpan);
    el.appendChild(contentSpan);
    this.messagesEl.appendChild(el);

    // Auto-scroll to bottom
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
  }

  /** Add an activity entry to the Activity tab */
  addActivity(entry: ActivityEntry): void {
    this.activityEntries.push(entry);

    // Trim
    if (this.activityEntries.length > GAME_CONFIG.MAX_VISIBLE_CHAT) {
      this.activityEntries.shift();
      if (this.activityEl.firstChild) {
        this.activityEl.removeChild(this.activityEl.firstChild);
      }
    }

    const el = document.createElement("div");
    el.className = "chat-message";

    const timeSpan = document.createElement("span");
    timeSpan.className = "timestamp";
    timeSpan.textContent = `${this.formatRelativeTime(entry.timestamp)} `;

    const nameSpan = document.createElement("span");
    nameSpan.className = "agent-name";
    nameSpan.textContent = entry.agentName;
    nameSpan.style.color = this.getAgentColor(entry.agentId);

    const descSpan = document.createElement("span");
    descSpan.textContent = ` ${entry.description}`;

    el.appendChild(timeSpan);
    el.appendChild(nameSpan);
    el.appendChild(descSpan);
    this.activityEl.appendChild(el);

    // Auto-scroll
    this.activityEl.scrollTop = this.activityEl.scrollHeight;
  }

  /**
   * Bulk-load chat messages (e.g. from full state).
   * Clears existing messages first.
   */
  loadMessages(messages: ChatMessage[]): void {
    this.chatMessages = [];
    this.messagesEl.innerHTML = "";
    // Only load the last N messages
    const toLoad = messages.slice(-GAME_CONFIG.MAX_VISIBLE_CHAT);
    for (const msg of toLoad) {
      this.addMessage(msg);
    }
  }

  /**
   * Bulk-load activity entries (e.g. from full state).
   */
  loadActivity(entries: ActivityEntry[]): void {
    this.activityEntries = [];
    this.activityEl.innerHTML = "";
    const toLoad = entries.slice(-GAME_CONFIG.MAX_VISIBLE_CHAT);
    for (const entry of toLoad) {
      this.addActivity(entry);
    }
  }

  /** Format a timestamp as relative time ("2m ago", "1h ago", etc.) */
  private formatRelativeTime(timestamp: number): string {
    const diff = Date.now() - timestamp;
    const seconds = Math.floor(diff / 1000);

    if (seconds < 10) return "now";
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  /**
   * Get agent color from a simple hash of the ID.
   * In a real implementation this would come from the state,
   * but we use a deterministic color for display purposes.
   */
  private agentColorCache: Map<string, string> = new Map();

  setAgentColor(agentId: string, color: string): void {
    this.agentColorCache.set(agentId, color);
  }

  private getAgentColor(agentId: string): string {
    return this.agentColorCache.get(agentId) ?? "#e0e0e0";
  }
}
