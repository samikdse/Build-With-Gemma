import { readConfig } from "./_lib/hosted";

/**
 * Engine status for the UI. Reports only WHETHER hosted Gemma is configured
 * and which model name is in use — never the key, never any part of it.
 */
export default function handler(_req: any, res: any) {
  const cfg = readConfig();
  res.status(200).json({
    hosted: Boolean(cfg),
    model: cfg?.model ?? null,
  });
}
