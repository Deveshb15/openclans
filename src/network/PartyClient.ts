// ============================================================
// MoltClans - PartySocket Client Wrapper
// ============================================================

import PartySocket from "partysocket";
import { parseWSMessage } from "./MessageTypes";
import type { WSMessage, WSMessageType } from "./MessageTypes";

export type MessageHandler = (message: WSMessage) => void;

export class PartyClient {
  private socket: PartySocket;
  private handlers: Map<WSMessageType, Set<MessageHandler>> = new Map();
  private wildcardHandlers: Set<MessageHandler> = new Set();
  private _connected = false;

  /** Callback for when connection opens */
  public onOpen: (() => void) | null = null;

  /** Callback for when connection closes */
  public onClose: (() => void) | null = null;

  /** Callback for connection errors */
  public onError: ((error: Event) => void) | null = null;

  /** Callback for any state update (convenience shorthand) */
  public onStateUpdate: ((message: WSMessage) => void) | null = null;

  constructor(host: string, roomId: string) {
    this.socket = new PartySocket({
      host,
      party: "main",
      room: roomId,
    });

    this.socket.addEventListener("open", () => {
      this._connected = true;
      if (this.onOpen) this.onOpen();
    });

    this.socket.addEventListener("close", () => {
      this._connected = false;
      if (this.onClose) this.onClose();
    });

    this.socket.addEventListener("error", (event: Event) => {
      if (this.onError) this.onError(event);
    });

    this.socket.addEventListener("message", (event: MessageEvent) => {
      const raw =
        typeof event.data === "string"
          ? event.data
          : String(event.data);
      const message = parseWSMessage(raw);
      if (!message) return;

      // Notify state-update convenience callback
      if (this.onStateUpdate) {
        this.onStateUpdate(message);
      }

      // Dispatch to type-specific handlers
      const typeHandlers = this.handlers.get(message.type);
      if (typeHandlers) {
        for (const handler of typeHandlers) {
          handler(message);
        }
      }

      // Dispatch to wildcard handlers
      for (const handler of this.wildcardHandlers) {
        handler(message);
      }
    });
  }

  /**
   * Register a handler for a specific message type.
   * Pass '*' as type to listen to all messages.
   */
  on(type: WSMessageType | "*", handler: MessageHandler): void {
    if (type === "*") {
      this.wildcardHandlers.add(handler);
      return;
    }
    let set = this.handlers.get(type);
    if (!set) {
      set = new Set();
      this.handlers.set(type, set);
    }
    set.add(handler);
  }

  /**
   * Remove a previously registered handler.
   */
  off(type: WSMessageType | "*", handler: MessageHandler): void {
    if (type === "*") {
      this.wildcardHandlers.delete(handler);
      return;
    }
    const set = this.handlers.get(type);
    if (set) {
      set.delete(handler);
      if (set.size === 0) {
        this.handlers.delete(type);
      }
    }
  }

  /** Whether the socket is currently connected */
  get isConnected(): boolean {
    return this._connected;
  }

  /** Close the WebSocket connection */
  close(): void {
    this.socket.close();
    this._connected = false;
  }
}
