import Image from "next/image";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  accent?: "despesa" | "demanda" | "prolabore" | "neutral";
}

export default function PageHeader({
  title,
  subtitle,
  accent = "neutral",
}: PageHeaderProps) {
  const barColor =
    accent === "despesa"
      ? "bg-despesa"
      : accent === "demanda"
        ? "bg-demanda"
        : accent === "prolabore"
          ? "bg-prolabore"
          : "bg-border";

  return (
    <header className="px-5 pt-6 pb-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className={`h-1.5 w-12 rounded-full ${barColor} mb-3`} />
          <h1 className="text-2xl font-extrabold uppercase tracking-tight">
            {title}
          </h1>
          {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
        </div>
        <Image
          src="/logo-construale.png"
          alt="Construale"
          width={155}
          height={67}
          priority
          className="shrink-0"
        />
      </div>
    </header>
  );
}
