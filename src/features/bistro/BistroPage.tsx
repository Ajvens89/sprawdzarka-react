import { BistroDetail } from "./BistroDetail";
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
    </>
  );
}
