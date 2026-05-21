import { useState } from "react";

export function InvoiceImportPanel(): JSX.Element {
  const [fileName, setFileName] = useState("brak pliku");
  const [status, setStatus] = useState<string>("");

  async function handleFile(file: File | null): Promise<void> {
    if (!file) return;
    setFileName(file.name);
    setStatus("To miejsce jest gotowe pod backend /api/parse-invoice. Frontend został przygotowany, ale parser PDF trzeba podłączyć jako kolejny etap.");
  }

  return (
    <details className="tools-drawer">
      <summary>Import z faktury PDF (Bistro)</summary>
      <div className="tools-drawer-body">
        <p className="hint" style={{ marginBottom: ".75rem" }}>
          Frontend pod import został przeniesiony. Następny krok to podłączenie endpointu
          <code style={{ marginLeft: ".35rem" }}>/api/parse-invoice</code>, który zwróci zmapowane pozycje.
        </p>

        <div className="ksef-topbar">
          <label className="ksef-file-label" htmlFor="invPdfFile">
            <span>Wgraj PDF faktury</span>
            <span className="ksef-file-name">{fileName}</span>
            <input
              id="invPdfFile"
              type="file"
              accept=".pdf,application/pdf"
              onChange={(event) => void handleFile(event.target.files?.[0] ?? null)}
            />
          </label>

          <button className="btn-ghost" type="button" onClick={() => { setFileName("brak pliku"); setStatus(""); }}>
            Wyczyść import
          </button>
        </div>

        <div className="inventory-status info" style={{ display: status ? "block" : "none", marginTop: ".75rem" }}>
          {status}
        </div>

        <div className="ksef-table-wrap" style={{ marginTop: ".75rem" }}>
          <div className="ksef-empty">
            Po podłączeniu backendu tutaj pojawi się draft faktury z mapowaniem na produkty Bistro.
          </div>
        </div>
      </div>
    </details>
  );
}
