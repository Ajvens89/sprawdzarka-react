import { BistroDetail } from "./BistroDetail";
import { InvoiceImportPanel } from "./InvoiceImportPanel";
import { BistroSidebar } from "./BistroSidebar";
import { BistroSummary } from "./BistroSummary";

export function BistroPage(): JSX.Element {
  return (
    <>
      <BistroSummary />

      <div className="workspace workspace-bistro">
        <BistroSidebar />
        <BistroDetail />
      </div>

      <InvoiceImportPanel />
    </>
  );
}
