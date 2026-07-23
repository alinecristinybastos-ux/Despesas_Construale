"use client";

interface ChipProps {
  label: string;
  selected: boolean;
  onClick: () => void;
  accent?: "despesa" | "demanda" | "prolabore";
}

export default function Chip({
  label,
  selected,
  onClick,
  accent = "despesa",
}: ChipProps) {
  const accentClasses =
    accent === "despesa"
      ? "bg-despesa border-despesa text-black"
      : accent === "prolabore"
      ? "bg-prolabore border-prolabore text-black"
      : "bg-demanda border-demanda text-black";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-4 py-2 text-sm font-bold uppercase tracking-wide transition-colors ${
        selected
          ? accentClasses
          : "border-border bg-surface-2 text-muted hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}
