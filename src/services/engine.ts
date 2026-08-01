import { useEffect, useState } from "react";
import { gemmaHealth } from "./gemma/client";
import { gemmaConfig } from "./gemma/config";

/** Live engine status for UI chips — polled, never blocks rendering. */

export interface EngineStatus {
  live: boolean;
  label: string;
  detail: string;
}

export function useEngineStatus(): EngineStatus {
  const [status, setStatus] = useState<EngineStatus>({
    live: false,
    label: "checking…",
    detail: "Checking for a local Gemma runtime",
  });

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      if (gemmaConfig.forceFixtures) {
        if (!cancelled)
          setStatus({ live: false, label: "demo fixtures", detail: "VITE_ENGINE=fixtures (forced)" });
        return;
      }
      const h = await gemmaHealth();
      if (cancelled) return;
      setStatus(
        h.ok
          ? {
              live: true,
              label: `Gemma live · ${gemmaConfig.chatModel}`,
              detail: `Local inference via Ollama at ${gemmaConfig.baseUrl} · embeddings: ${gemmaConfig.embedModel}`,
            }
          : {
              live: false,
              label: "demo fixtures (Gemma offline)",
              detail: "Ollama is not reachable — demo samples still work from validated cache",
            },
      );
    };
    void check();
    const t = setInterval(check, 30_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  return status;
}
