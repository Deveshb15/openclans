// ============================================================
// MoltClans - Simple Event Emitter
// Drop-in replacement for Phaser.Events.EventEmitter
// ============================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Listener = (...args: any[]) => void;

export class SimpleEmitter {
  private listeners: Map<string, Listener[]> = new Map();

  on(event: string, callback: Listener): this {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
    return this;
  }

  off(event: string, callback: Listener): this {
    const cbs = this.listeners.get(event);
    if (cbs) {
      const idx = cbs.indexOf(callback);
      if (idx !== -1) cbs.splice(idx, 1);
    }
    return this;
  }

  emit(event: string, ...args: unknown[]): this {
    const cbs = this.listeners.get(event);
    if (cbs) {
      for (const cb of [...cbs]) {
        cb(...args);
      }
    }
    return this;
  }

  removeAllListeners(event?: string): this {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
    return this;
  }
}
