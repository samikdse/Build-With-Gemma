import { useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { provider } from "../services";
import { useStore } from "../services/store";
import type { AgentRun } from "../types";
import { AgentPipeline } from "../components/AgentPipeline";
import { LANGUAGES } from "../types";

type Phase = "pick" | "processing" | "error";

export default function Upload() {
  const [params] = useSearchParams();
  const photoMode = params.get("mode") === "photo";
  const { language, addDocument } = useStore();
  const navigate = useNavigate();

  const [phase, setPhase] = useState<Phase>("pick");
  const [run, setRun] = useState<AgentRun | null>(null);
  const [error, setError] = useState<string>("");
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);

  const langLabel = LANGUAGES.find((l) => l.code === language)?.label ?? "English";

  async function process(file: { name: string; type: string } | null, forceImage = false) {
    setPhase("processing");
    setError("");
    try {
      const result = await provider.analyze(
        {
          fileName: file?.name ?? "sample-photo.jpg",
          mimeType: forceImage ? "image/jpeg" : (file?.type ?? "application/pdf"),
        },
        language,
        (p) => setRun(p.run),
      );
      addDocument(result.document, result.run);
      navigate(`/documents/${result.document.id}?fresh=1`);
    } catch {
      setPhase("error");
      setError("Something went wrong while reading the document. Nothing was saved — please try again.");
    }
  }

  function onFile(list: FileList | null, forceImage = false) {
    const f = list?.[0];
    if (!f && !forceImage) return;
    const ok =
      forceImage ||
      /^image\//.test(f!.type) ||
      f!.type === "application/pdf" ||
      f!.type === "text/plain";
    if (!ok) {
      setPhase("error");
      setError("Unsupported file type. Please upload a PDF, PNG, JPG or plain-text file.");
      return;
    }
    void process(f ? { name: f.name, type: f.type } : null, forceImage);
  }

  if (phase === "processing" && run) {
    return (
      <div className="mx-auto max-w-xl">
        <h1 className="text-3xl font-bold">Reading your document…</h1>
        <p className="mt-2 text-ink-soft">
          Six specialized steps run on every document. Results appear in {langLabel}.
        </p>
        <div className="mt-6">
          <AgentPipeline run={run} />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-3xl font-bold">
        {photoMode ? "Take or upload a photo" : "Upload a document"}
      </h1>
      <p className="mt-2 text-ink-soft">
        Healthcare letters, insurance papers, benefits statements, government notices. PDF, PNG,
        JPG or text. Results will appear in <strong>{langLabel}</strong> (change it in the top
        bar).
      </p>

      {phase === "error" && (
        <div role="alert" className="mt-4 border-l-4 border-alert bg-alert-soft px-4 py-3 text-sm font-semibold">
          {error}
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
          onFile(e.dataTransfer.files);
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
          onChange={(e) => onFile(e.target.files)}
        />
        {/* capture="environment" opens the camera on phones */}
        <input
          ref={photoRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => onFile(e.target.files, true)}
        />
      </div>

      {/* Demo shortcuts — reliable on stage, no file needed */}
      <div className="mt-6 border border-line bg-paper p-5">
        <p className="text-sm font-bold uppercase tracking-wide text-ink-soft">Demo shortcuts</p>
        <p className="mt-1 text-sm text-ink-soft">
          No file handy? Use a built-in synthetic sample:
        </p>
        <div className="mt-3 flex flex-wrap gap-3">
          <button
            onClick={() => void process(null, true)}
            className="border-2 border-ink px-4 py-2 text-sm font-bold hover:bg-mist"
          >
            📷 Sample: photographed dental form
          </button>
          <button
            onClick={() => void process({ name: "renewal-notice.pdf", type: "application/pdf" })}
            className="border-2 border-ink px-4 py-2 text-sm font-bold hover:bg-mist"
          >
            📄 Sample: government renewal notice
          </button>
        </div>
      </div>

      <p className="mt-6 text-xs text-ink-soft">
        Demo note: in this phase, analysis is powered by deterministic fixtures — any image maps to
        the sample dental form, any other file to the sample notice. Live Gemma analysis connects
        in the next phase behind the same interface.
      </p>
    </div>
  );
}
