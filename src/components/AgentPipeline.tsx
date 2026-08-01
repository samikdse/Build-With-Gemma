import { AGENTS, type AgentRun } from "../types";

/**
 * The multi-agent processing visualization: six specialized Gemma roles,
 * shown as an ordered pipeline with live logs.
 */
export function AgentPipeline({ run, compact = false }: { run: AgentRun; compact?: boolean }) {
  return (
    <ol className="space-y-2">
      {AGENTS.map((agent) => {
        const stage = run.stages.find((s) => s.agent === agent.id);
        if (!stage) return null;
        const status = stage.status;
        return (
          <li
            key={agent.id}
            className={`border px-4 py-3 ${
              status === "running"
                ? "border-link bg-[#f2f7fb]"
                : status === "done"
                  ? "border-line bg-paper"
                  : status === "skipped"
                    ? "border-line bg-mist/60"
                    : "border-line bg-mist/40 opacity-60"
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <StatusDot status={status} />
                <span className="font-semibold text-sm">{agent.name}</span>
              </div>
              <span className="text-xs text-ink-soft">
                {status === "done" && stage.ms ? `${(stage.ms / 1000).toFixed(1)}s` : null}
                {status === "skipped" ? "skipped" : null}
                {status === "running" ? "working…" : null}
              </span>
            </div>
            {!compact && <p className="mt-0.5 pl-[22px] text-xs text-ink-soft">{agent.description}</p>}
            {stage.logs.length > 0 && (
              <ul className="mt-1.5 space-y-0.5 pl-[22px]">
                {stage.logs.map((line, i) => (
                  <li key={i} className="text-xs text-ink/80 pd-fade-up">
                    · {line}
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function StatusDot({ status }: { status: string }) {
  if (status === "done")
    return (
      <span aria-hidden className="grid h-3.5 w-3.5 place-items-center bg-brand text-[9px] font-bold text-white">
        ✓
      </span>
    );
  if (status === "running") return <span aria-hidden className="h-3.5 w-3.5 bg-link pd-pulse" />;
  if (status === "skipped") return <span aria-hidden className="h-3.5 w-3.5 border border-line bg-mist" />;
  return <span aria-hidden className="h-3.5 w-3.5 border border-line" />;
}
