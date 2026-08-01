import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { AgentRun, AnalyzedDocument, LanguageCode, Reminder } from "../types";
import { BENEFITS_DOC } from "../fixtures/documents";

/** Persisted app state (localStorage). Demo reset restores the seed. */

interface PersistedState {
  language: LanguageCode;
  documents: Record<string, AnalyzedDocument>;
  runs: Record<string, AgentRun>;
  reminders: Reminder[];
}

const STORAGE_KEY = "plaindocs-state-v1";

const seedState = (): PersistedState => ({
  language: "en",
  documents: { [BENEFITS_DOC.id]: BENEFITS_DOC },
  runs: {},
  reminders: [],
});

function loadState(): PersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seedState();
    const parsed = JSON.parse(raw) as PersistedState;
    if (!parsed.documents || !parsed.documents[BENEFITS_DOC.id]) return seedState();
    return parsed;
  } catch {
    return seedState();
  }
}

interface StoreValue extends PersistedState {
  setLanguage: (l: LanguageCode) => void;
  addDocument: (doc: AnalyzedDocument, run: AgentRun) => void;
  addReminder: (r: Omit<Reminder, "id" | "createdAt" | "status">) => void;
  updateReminder: (id: string, patch: Partial<Reminder>) => void;
  deleteReminder: (id: string) => void;
  resetDemo: () => void;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PersistedState>(loadState);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const setLanguage = useCallback(
    (language: LanguageCode) => setState((s) => ({ ...s, language })),
    [],
  );

  const addDocument = useCallback(
    (doc: AnalyzedDocument, run: AgentRun) =>
      setState((s) => ({
        ...s,
        documents: { ...s.documents, [doc.id]: doc },
        runs: { ...s.runs, [doc.id]: run },
      })),
    [],
  );

  const addReminder = useCallback(
    (r: Omit<Reminder, "id" | "createdAt" | "status">) =>
      setState((s) => {
        // idempotent: same title + dueAt is not duplicated
        if (s.reminders.some((x) => x.title === r.title && x.dueAt === r.dueAt)) return s;
        const reminder: Reminder = {
          ...r,
          id: `rem-${Math.random().toString(36).slice(2, 9)}`,
          createdAt: new Date().toISOString(),
          status: "upcoming",
        };
        return { ...s, reminders: [...s.reminders, reminder] };
      }),
    [],
  );

  const updateReminder = useCallback(
    (id: string, patch: Partial<Reminder>) =>
      setState((s) => ({
        ...s,
        reminders: s.reminders.map((r) => (r.id === id ? { ...r, ...patch } : r)),
      })),
    [],
  );

  const deleteReminder = useCallback(
    (id: string) =>
      setState((s) => ({ ...s, reminders: s.reminders.filter((r) => r.id !== id) })),
    [],
  );

  const resetDemo = useCallback(() => {
    setState(seedState());
  }, []);

  const value = useMemo<StoreValue>(
    () => ({
      ...state,
      setLanguage,
      addDocument,
      addReminder,
      updateReminder,
      deleteReminder,
      resetDemo,
    }),
    [state, setLanguage, addDocument, addReminder, updateReminder, deleteReminder, resetDemo],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside StoreProvider");
  return ctx;
}

/** All documents, newest first. */
export function useDocuments(): AnalyzedDocument[] {
  const { documents } = useStore();
  return useMemo(
    () =>
      Object.values(documents).sort((a, b) => (b.uploadedAt || "").localeCompare(a.uploadedAt || "")),
    [documents],
  );
}
