// Mirrors the POS cart to a second screen (a customer-facing display) open in
// another window of the same browser. BroadcastChannel + localStorage never leaves the
// machine, so no server, account or network is involved.

export interface DisplayLine {
  name: string;
  quantity: number;
  total: number;
  status?: string;
}

export type DisplayState =
  | { kind: "idle" }
  | {
      kind: "cart";
      orderNumber?: string;
      tableName?: string;
      customerName?: string;
      lines: DisplayLine[];
      previousLines?: DisplayLine[];
      subtotal: number;
      tax?: number;
      discount?: number;
      total?: number;
    }
  | {
      kind: "upi";
      total: number;
      uri: string;
      payee: string;
      orderNumber?: string;
      tableName?: string;
      lines?: DisplayLine[];
    }
  | {
      kind: "paid";
      total: number;
      method?: string;
      orderNumber?: string;
      tableName?: string;
    };

const CHANNEL = "dinr-customer-display";
const STORAGE_KEY = "dinr-customer-display-state";

export function publishDisplay(state: DisplayState) {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore localStorage quotas / private browsing errors
    }
  }

  if (typeof BroadcastChannel === "undefined") return;
  try {
    const ch = new BroadcastChannel(CHANNEL);
    ch.postMessage({ type: "STATE_UPDATE", state });
    ch.close();
  } catch {
    // Ignore BroadcastChannel errors
  }
}

export function subscribeDisplay(onState: (s: DisplayState) => void): () => void {
  // 1. Immediately read cached state from localStorage if available so the window
  // is never blank when opened
  if (typeof window !== "undefined") {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as DisplayState;
        if (parsed && typeof parsed === "object" && "kind" in parsed) {
          onState(parsed);
        }
      }
    } catch {
      // Ignore parse errors
    }
  }

  // 2. Storage event listener (syncs across tabs/windows)
  const handleStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY && e.newValue) {
      try {
        const parsed = JSON.parse(e.newValue) as DisplayState;
        if (parsed && typeof parsed === "object" && "kind" in parsed) {
          onState(parsed);
        }
      } catch {
        // Ignore parse errors
      }
    }
  };

  if (typeof window !== "undefined") {
    window.addEventListener("storage", handleStorage);
  }

  // 3. BroadcastChannel listener
  let ch: BroadcastChannel | null = null;
  if (typeof BroadcastChannel !== "undefined") {
    try {
      ch = new BroadcastChannel(CHANNEL);
      ch.onmessage = (e: MessageEvent) => {
        const data = e.data;
        if (!data) return;
        if (data.type === "STATE_UPDATE" && data.state) {
          onState(data.state as DisplayState);
        } else if ("kind" in data) {
          // Backward compatibility
          onState(data as DisplayState);
        }
      };

      // Request an active terminal to sync state
      ch.postMessage({ type: "REQUEST_SYNC" });
    } catch {
      // Ignore channel errors
    }
  }

  return () => {
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", handleStorage);
    }
    if (ch) {
      try {
        ch.close();
      } catch {
        // Ignore
      }
    }
  };
}

export function listenDisplaySync(getState: () => DisplayState | null): () => void {
  if (typeof BroadcastChannel === "undefined") return () => {};
  try {
    const ch = new BroadcastChannel(CHANNEL);
    ch.onmessage = (e: MessageEvent) => {
      if (e.data?.type === "REQUEST_SYNC") {
        const current = getState();
        if (current) {
          publishDisplay(current);
        }
      }
    };
    return () => {
      try {
        ch.close();
      } catch {
        // Ignore
      }
    };
  } catch {
    return () => {};
  }
}
