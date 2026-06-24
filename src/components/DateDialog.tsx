"use client";

interface DateDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  value: string;
  onValueChange: (value: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function DateDialog({
  open,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  value,
  onValueChange,
  onConfirm,
  onCancel,
}: DateDialogProps) {
  if (!open) return null;

  const valido = value !== "";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 px-4 pb-8 sm:items-center">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-5">
        <h2 className="text-lg font-extrabold uppercase tracking-tight">{title}</h2>
        {description && <p className="mt-2 text-sm text-muted">{description}</p>}
        <input
          autoFocus
          type="date"
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
          className="mt-4 w-full rounded-xl border border-border bg-surface-2 px-4 py-3 text-foreground focus:border-foreground focus:outline-none"
        />
        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-xl border border-border bg-surface-2 py-3 text-sm font-bold uppercase text-foreground"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={!valido}
            onClick={onConfirm}
            className="flex-1 rounded-xl bg-success py-3 text-sm font-bold uppercase text-black disabled:opacity-40"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
