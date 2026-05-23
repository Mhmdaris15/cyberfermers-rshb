import { useEffect, useState } from "react";
import { api, getSystemStatus, type SystemStatus } from "./api";

// ============================================================
//   Maintenance client — global gate detection.
//
//   Two signals feed the same state machine:
//
//     1. Every API call: a 503 response with `body.maintenance === true`
//        flips the gate on. This is the FAST path — the user trying to
//        do anything in the app discovers the gate the moment they try.
//
//     2. A periodic poll of /api/system/status (15s) catches users sitting
//        idle on the landing page or on the maintenance screen itself.
//        That's how the screen knows to disappear once the toggle is off.
//
//   The polling cadence shifts based on current state:
//     - off: 60s   (cheap heartbeat — gate is rare)
//     - on : 10s   (we want the "we're back!" flip to be near-instant)
//
//   Like auth.ts, this is a tiny pub-sub — no React context provider,
//   no Redux. Components subscribe via useMaintenance().
// ============================================================

const POLL_OFF_MS = 60_000;
const POLL_ON_MS = 10_000;

type State = SystemStatus;

const initialState: State = { maintenance: false };
let current: State = initialState;
const listeners = new Set<() => void>();

function notify() {
  for (const l of listeners) l();
}

function setState(next: State) {
  // Shallow compare the maintenance flag + reason — full deep equal is
  // overkill; if the fields change, we re-render either way.
  if (
    current.maintenance === next.maintenance &&
    current.reason_preset === next.reason_preset &&
    current.eta === next.eta &&
    current.message_ru === next.message_ru &&
    current.message_en === next.message_en
  ) {
    return;
  }
  current = next;
  notify();
}

// ───── axios interceptor: detect 503 + maintenance:true ────────────────
let installed = false;
function installInterceptorOnce() {
  if (installed) return;
  installed = true;
  api.interceptors.response.use(
    (r) => r,
    (err) => {
      const status = err?.response?.status;
      const body = err?.response?.data;
      if (status === 503 && body && body.maintenance === true) {
        setState({
          maintenance: true,
          reason_preset: body.reason_preset,
          eta: body.eta,
          message_ru: body.message_ru,
          message_en: body.message_en,
        });
      }
      return Promise.reject(err);
    },
  );
}
installInterceptorOnce();

// ───── polling loop ─────────────────────────────────────────────────────
// Single timer for the whole app — we don't spin one per useMaintenance
// consumer. Runs forever; that's fine for an SPA.

let pollTimer: ReturnType<typeof setTimeout> | null = null;
let pollInflight = false;

async function pollOnce() {
  if (pollInflight) return;
  pollInflight = true;
  try {
    const s = await getSystemStatus();
    setState(s);
  } catch {
    // Network failure is NOT a maintenance signal — we leave state alone.
    // If the API is genuinely down, the user's next interactive request
    // will surface that via its own error handling.
  } finally {
    pollInflight = false;
  }
}

function schedule() {
  if (pollTimer) clearTimeout(pollTimer);
  const delay = current.maintenance ? POLL_ON_MS : POLL_OFF_MS;
  pollTimer = setTimeout(async () => {
    await pollOnce();
    schedule();
  }, delay);
}

// Kick the loop and do one immediate fetch so first render is accurate.
if (typeof window !== "undefined") {
  void pollOnce().then(schedule);
}

// ───── public hook ──────────────────────────────────────────────────────

export function useMaintenance(): State {
  const [s, setS] = useState<State>(current);
  useEffect(() => {
    const l = () => setS(current);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return s;
}

// One-shot helper for admin UX — after the admin POSTs a change, they
// want the gate state to update immediately without waiting for the
// poll. The API itself returns the new shape; this stamps it in.
export function applyMaintenanceState(s: State) {
  setState(s);
}
