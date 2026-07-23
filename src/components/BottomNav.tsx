"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/despesa", label: "Despesa", accent: "bg-despesa" },
  { href: "/funcionario", label: "Equipe", accent: "bg-demanda" },
  { href: "/prolabore", label: "Pró-Lab", accent: "bg-prolabore" },
  { href: "/historico", label: "Histórico", accent: "bg-despesa" },
  { href: "/resumo", label: "Resumo", accent: "bg-despesa" },
  { href: "/financeiro", label: "Financeiro", accent: "bg-success" },
] as const;

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="sticky bottom-0 z-20 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)]">
      <ul className="flex overflow-x-auto" style={{ scrollbarWidth: "none" }}>
        {TABS.map((tab) => {
          const active = pathname.startsWith(tab.href);
          return (
            <li key={tab.href} className="flex-shrink-0">
              <Link
                href={tab.href}
                className={`flex min-w-[72px] flex-col items-center justify-center gap-1 px-2 py-3 text-[10px] font-bold uppercase tracking-wide transition-colors ${
                  active ? "text-foreground" : "text-muted"
                }`}
              >
                <span
                  className={`h-1 w-7 rounded-full transition-colors ${
                    active ? tab.accent : "bg-transparent"
                  }`}
                />
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
