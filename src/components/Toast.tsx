"use client";

interface ToastProps {
  message: string | null;
}

export default function Toast({ message }: ToastProps) {
  if (!message) return null;

  return (
    <div className="fixed inset-x-0 top-4 z-50 flex justify-center px-4">
      <div className="rounded-xl border border-border bg-surface-2 px-4 py-3 text-sm font-bold text-foreground shadow-lg">
        {message}
      </div>
    </div>
  );
}
