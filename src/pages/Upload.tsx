import { useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { provider, RecoverableAnalysisError } from "../services";
import { useEngineStatus } from "../services/engine";
import { useStore } from "../services/store";
import type { AgentRun } from "../types";
import type { UploadInput } from "../services/provider";
import { AgentPipeline } from "../components/AgentPipeline";
import { LANGUAGES } from "../types";

type Phase = "pick" | "processing" | "error";

const readAsDataUrl = (f: File) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("could not read file"));
    r.readAsDataURL(f);
  });

export default function Upload() {
  const [params] = useSearchParams();
  const photoMode = params.get("mode") === "photo";
  const { language, addDocument } = useStore();
  const navigate = useNavigate();
  const engine = useEngineStatus();

  const [phase, setPhase] = useState<Phase>("pick");
  const [run, setRun] = useState<AgentRun | null>(null);
  const [error, setError] = useState<string>("");
  const [lastInput, setLastInput] = useState<UploadInput | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);

  const langLabel = LANGUAGES.find((l) => l.code === language)?.label ?? "English";

  async function process(input: UploadInput) {
    setPhase("processing");
    setError("");
    setRun(null);
    setLastInput(input);
    try {
      const result = await provider.analyze(input, language, (p) => setRun(p.run));
      addDocument(result.document, result.run);
      navigate(`/documents/${result.document.id}?fresh=1`);
    } catch (e) {
      setPhase("error");
      setError(
        e instanceof RecoverableAnalysisError
          ? e.message
          : "Something went wrong while reading the document. Nothing was saved.",
      );
    }
  }

  async function onFile(list: FileList | null, forceImage = false) {
    const f = list?.[0];
    if (!f) return;
    const isImage = forceImage || /^image\//.test(f.type);
    const ok = isImage || f.type === "application/pdf" || f.type === "text/plain";
    if (!ok) {
      setPhase("error");
      setError("Unsupported file type. Please upload a PDF, PNG, JPG or plain-text file.");
      return;
    }
    try {
      const input: UploadInput = {
        fileName: f.name,
        mimeType: isImage ? f.type || "image/jpeg" : f.type,
        dataUrl: f.type === "text/plain" ? undefined : await readAsDataUrl(f),
        textContent: f.type === "text/plain" ? await f.text() : undefined,
      };
      void process(input);
    } catch {
      setPhase("error");
      setError("Could not read that file. Please try again.");
    }
  }

  async function useSample(sampleId: "dental-form" | "renewal-notice") {
    try {
      if (sampleId === "dental-form") {
        const res = await fetch("/samples/dental-form.png");
        const blob = await res.blob();
        const dataUrl = await readAsDataUrl(new File([blob], "dental-form.png", { type: "image/png" }));
        void process({ fileName: "dental-form.png", mimeType: "image/png", dataUrl, sampleId });
      } else {
        const res = await fetch("/samples/renewal-notice.txt");
        const text = await res.text();
        void process({ fileName: "renewal-notice.txt", mimeType: "text/plain", textContent: text, sampleId });
      }
    } catch {
      // even the sample fetch failing must not strand the user
      void process({ fileName: `${sampleId}.txt`, mimeType: sampleId === "dental-form" ? "image/png" : "text/plain", sampleId });
    }
  }

  if (phase === "processing") {
    return (
      <div className="mx-auto max-w-xl" aria-live="polite">
        <h1 className="text-3xl font-bold">Reading your document…</h1>
        <p className="mt-2 text-ink-soft">
          {engine.live
            ? `Gemma is analyzing this locally on your machine (${engine.label.replace("Gemma live · ", "")}). On CPU this can take a minute or two — each stage reports below.`
            : "Running the analysis pipeline."}{" "}
          Results appear in {langLabel}.
        </p>
        <div className="mt-6">
          {run ? (
            <AgentPipeline run={run} />
          ) : (
            <p className="border border-line bg-mist/40 px-4 py-6 text-center font-semibold text-ink-soft pd-pulse">
              Starting pipeline…
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-3xl font-bold">
          {photoMode ? "Take or upload a photo" : "Upload a document"}
        </h1>
        <span
          className={`px-2 py-1 text-xs font-bold uppercase tracking-wide ${
            engine.live ? "bg-brand-soft text-brand" : "bg-warn-soft text-warn"
          }`}
          title={engine.detail}
        >
          {engine.label}
        </span>
      </div>
      <p className="mt-2 text-ink-soft">
        Healthcare letters, insurance papers, benefits statements, government notices. PDF, PNG,
        JPG or text. Results will appear in <strong>{langLabel}</strong> (change it in the top
        bar).
      </p>

      {phase === "error" && (
        <div role="alert" className="mt-4 border-l-4 border-alert bg-alert-soft px-4 py-3">
          <p className="text-sm font-semibold">{error}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {lastInput && (
              <button
                onClick={() => lastInput && void process(lastInput)}
                className="border-2 border-ink px-3 py-1.5 text-sm font-bold hover:bg-white"
              >
                Try again
              </button>
            )}
            <button
              onClick={() => void useSample("dental-form")}
              className="border-2 border-ink px-3 py-1.5 text-sm font-bold hover:bg-white"
            >
              Use a built-in sample instead
            </button>
          </div>
        </div>
      )}

      {/* Dropzone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          void onFile(e.dataTransfer.files);
        }}
        className={`mt-6 border-2 border-dashed p-10 text-center ${
          dragOver ? "border-brand bg-brand-soft" : "border-line bg-mist/40"
        }`}
      >
        <p className="text-lg font-semibold">Drag a file here</p>
        <p className="mt-1 text-sm text-ink-soft">or</p>
        <div className="mt-3 flex flex-wrap justify-center gap-3">
          <button
            onClick={() => fileRef.current?.click()}
            className="bg-brand px-5 py-2.5 font-bold text-white shadow-[0_2px_0_#00542d] hover:bg-[#005a30]"
          >
            Choose a file
          </button>
          <button
            onClick={() => photoRef.current?.click()}
            className="border-2 border-ink px-5 py-2.5 font-bold hover:bg-mist"
          >
            Use camera / photo
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.txt,application/pdf,image/png,image/jpeg,text/plain"
          className="hidden"
          onChange={(e) => void onFile(e.target.files)}
        />
        {/* capture="environment" opens the camera on phones */}
        <input
          ref={photoRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => void onFile(e.target.files, true)}
        />
      </div>

      {/* Demo samples — analyzed LIVE by Gemma when it's running */}
      <div className="mt-6 border border-line bg-paper p-5">
        <p className="text-sm font-bold uppercase tracking-wide text-ink-soft">Built-in samples</p>
        <p className="mt-1 text-sm text-ink-soft">
          {engine.live
            ? "These run through the live Gemma pipeline like any upload. If a live call fails, the validated cached result is shown instead — clearly labeled."
            : "Gemma is offline — these will show the validated cached analysis."}
        </p>
        <div className="mt-3 flex flex-wrap gap-3">
          <button
            onClick={() => void useSample("dental-form")}
            className="border-2 border-ink px-4 py-2 text-sm font-bold hover:bg-mist"
          >
            📷 Sample: photographed dental form
          </button>
          <button
            onClick={() => void useSample("renewal-notice")}
            className="border-2 border-ink px-4 py-2 text-sm font-bold hover:bg-mist"
          >
            📄 Sample: government renewal notice
          </button>
        </div>
      </div>
    </div>
  );
}
