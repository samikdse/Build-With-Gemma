import { HashRouter, Route, Routes } from "react-router-dom";
import { StoreProvider } from "./services/store";
import { Shell } from "./components/Shell";
import Home from "./pages/Home";
import Upload from "./pages/Upload";
import DocumentView from "./pages/DocumentView";
import Documents from "./pages/Documents";
import Coverage from "./pages/Coverage";
import Reminders from "./pages/Reminders";
import Ask from "./pages/Ask";

/** HashRouter: zero-config deep links on any static host (incl. Vercel). */
export default function App() {
  return (
    <StoreProvider>
      <HashRouter>
        <Shell>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/upload" element={<Upload />} />
            <Route path="/documents" element={<Documents />} />
            <Route path="/documents/:id" element={<DocumentView />} />
            <Route path="/coverage" element={<Coverage />} />
            <Route path="/reminders" element={<Reminders />} />
            <Route path="/ask" element={<Ask />} />
            <Route path="*" element={<Home />} />
          </Routes>
        </Shell>
      </HashRouter>
    </StoreProvider>
  );
}
