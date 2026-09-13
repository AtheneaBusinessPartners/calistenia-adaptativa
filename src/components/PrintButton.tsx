"use client";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="print:hidden whitespace-nowrap rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--accent)]"
    >
      Exportar PDF
    </button>
  );
}
