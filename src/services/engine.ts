import { useEffect, useState } from "react";
import { hostedHealth } from "./index";

/** Live engine status for the developer-only indicator dot. */

export interface EngineStatus {
  live: boolean;
  label: string;
  detail: string;
}

export function useEngineStatus(): EngineStatus {
  const [status, setStatus] = useState<EngineStatus>({
    live: false,
    label: "checking…",
    detail: "Checking the analysis engine",
  });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const h = await hostedHealth();
      if (cancelled) return;
      setStatus(
        h.hosted
          ? {
              live: true,
              label: `Gemma live${h.model ? ` · ${h.model}` : ""}`,
              detail: `Hosted Gemma API${h.model ? ` (${h.model})` : ""} — requests run server-side`,
            }
          : {
              live: false,
              label: "validated demo cache",
              detail: "Hosted Gemma not configured — built-in samples run from the validated cache",
            },
      );
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return status;
}
