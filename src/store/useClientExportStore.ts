import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ClientGameLine } from "../lib/exportClientGamesExcel";
import type { ClientExportSnapshot } from "../types/app";

export type EditableClientLine = ClientGameLine & { id: string };

type ListKind = "deduction" | "remaining";

type ClientExportState = {
  title: string;
  receiptTotalInput: string;
  notes: string;
  deductionItems: EditableClientLine[];
  remainingItems: EditableClientLine[];
  targetList: ListKind;
  setTitle: (value: string) => void;
  setReceiptTotalInput: (value: string) => void;
  setNotes: (value: string) => void;
  setTargetList: (value: ListKind) => void;
  setDeductionItems: (items: EditableClientLine[]) => void;
  setRemainingItems: (items: EditableClientLine[]) => void;
  updateLine: (list: ListKind, id: string, patch: Partial<ClientGameLine>) => void;
  removeLine: (list: ListKind, id: string) => void;
  appendLine: (list: ListKind, line: EditableClientLine) => void;
  resetDraft: () => void;
};

const initialState = {
  title: "Rozliczenie paragonu – gry",
  receiptTotalInput: "",
  notes: "",
  deductionItems: [] as EditableClientLine[],
  remainingItems: [] as EditableClientLine[],
  targetList: "deduction" as ListKind
};

export const useClientExportStore = create<ClientExportState>()(
  persist(
    (set) => ({
      ...initialState,

      setTitle: (value) => set({ title: value }),
      setReceiptTotalInput: (value) => set({ receiptTotalInput: value }),
      setNotes: (value) => set({ notes: value }),
      setTargetList: (value) => set({ targetList: value }),
      setDeductionItems: (items) => set({ deductionItems: items }),
      setRemainingItems: (items) => set({ remainingItems: items }),

      updateLine: (list, id, patch) =>
        set((state) => {
          const key = list === "deduction" ? "deductionItems" : "remainingItems";
          return {
            [key]: state[key].map((item) => (item.id === id ? { ...item, ...patch } : item))
          };
        }),

      removeLine: (list, id) =>
        set((state) => {
          const key = list === "deduction" ? "deductionItems" : "remainingItems";
          return {
            [key]: state[key].filter((item) => item.id !== id)
          };
        }),

      appendLine: (list, line) =>
        set((state) => {
          const key = list === "deduction" ? "deductionItems" : "remainingItems";
          return {
            [key]: [...state[key], line]
          };
        }),

      resetDraft: () => set({ ...initialState })
    }),
    {
      name: "sprawdzarka-client-export"
    }
  )
);

export function exportClientExportSnapshot(): ClientExportSnapshot {
  const state = useClientExportStore.getState();
  return {
    title: state.title,
    receiptTotalInput: state.receiptTotalInput,
    notes: state.notes,
    deductionItems: state.deductionItems,
    remainingItems: state.remainingItems,
    targetList: state.targetList
  };
}

export function importClientExportSnapshot(snapshot: ClientExportSnapshot | undefined): void {
  if (!snapshot) return;

  useClientExportStore.setState({
    title: snapshot.title ?? initialState.title,
    receiptTotalInput: snapshot.receiptTotalInput ?? "",
    notes: snapshot.notes ?? "",
    deductionItems: Array.isArray(snapshot.deductionItems) ? snapshot.deductionItems : [],
    remainingItems: Array.isArray(snapshot.remainingItems) ? snapshot.remainingItems : [],
    targetList: snapshot.targetList === "remaining" ? "remaining" : "deduction"
  });
}
