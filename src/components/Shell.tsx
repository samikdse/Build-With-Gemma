import { NavLink, Link, useNavigate } from "react-router-dom";
import type { ReactNode } from "react";
import { useStore } from "../services/store";
import { LANGUAGES, type LanguageCode } from "../types";
import { useEngineStatus } from "../services/engine";

const NAV = [
  { to: "/", label: "Home", end: true },
  { to: "/documents", label: "Documents" },
  { to: "/coverage", label: "Coverage" },
  { to: "/reminders", label: "Reminders" },
];

export function Shell({ children }: { children: ReactNode }) {
  const { language, setLanguage, resetDemo } = useStore();
  const navigate = useNavigate();
  const engine = useEngineStatus();

  return (
    <div className="min-h-screen flex flex-col bg-paper">
      {/* Synthetic-data notice — always visible */}
      <div className="bg-warn-soft border-b border-warn/30 px-4 py-1.5 text-center text-xs font-semibold text-warn">
        Demonstration only — all documents, people, programs and amounts are synthetic. No real
        personal information.
      </div>

      {/* Masthead — evolved from the reference site */}
      <header className="bg-ink text-white border-b-8 border-brand">
        <div className="mx-auto flex max-w-[1100px] items-center justify-between gap-4 px-4 py-3 md:px-6">
          <div className="flex items-center gap-3">
            <Link to="/" className="text-2xl font-bold tracking-tight text-white no-underline">
              CareLens
            </Link>
            {/* Developer-only engine indicator: a small dot, no wording. */}
            <span
              className={`h-2 w-2 rounded-full ${engine.live ? "bg-brand" : "bg-white/30"}`}
              title={engine.live ? `Live Gemma — ${engine.detail}` : `Validated demo cache — ${engine.detail}`}
              aria-hidden
            />
          </div>
          <div className="flex items-center gap-3">
            <label className="sr-only" htmlFor="lang">
              Preferred language
            </label>
            <select
              id="lang"
              value={language}
              onChange={(e) => setLanguage(e.target.value as LanguageCode)}
              className="border border-white/40 bg-ink px-2 py-1 text-sm text-white"
            >
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.native}
                </option>
              ))}
            </select>
            <button
              onClick={() => {
                if (confirm("Reset the demo? This restores the starting state.")) {
                  resetDemo();
                  navigate("/");
                }
              }}
              className="border border-white/40 px-2 py-1 text-sm text-white hover:bg-white/10"
              title="Restore the demo to its starting state"
            >
              Reset demo
            </button>
          </div>
        </div>
        <nav className="mx-auto max-w-[1100px] px-4 md:px-6">
          <ul className="flex flex-wrap gap-1 text-sm">
            {NAV.map((n) => (
              <li key={n.to}>
                <NavLink
                  to={n.to}
                  end={n.end}
                  className={({ isActive }) =>
                    `block px-3 py-2 font-semibold no-underline ${
                      isActive
                        ? "bg-paper text-ink"
                        : "text-white/90 hover:bg-white/10 hover:text-white"
                    }`
                  }
                >
                  {n.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-[1100px] flex-1 px-4 py-8 md:px-6">{children}</main>

      <footer className="border-t border-line bg-mist">
        <div className="mx-auto max-w-[1100px] px-4 py-6 text-xs text-ink-soft md:px-6">
          <p className="font-semibold">
            CareLens organizes and explains your documents. It does not give medical, legal or
            financial advice, and it never decides eligibility — official programs do.
          </p>
          <p className="mt-1" title={engine.detail}>
            CareLens · Built for the Build With Gemma hackathon · Synthetic demonstration data only
          </p>
        </div>
      </footer>
    </div>
  );
}
