"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/despesa", label: "Despesa" },
  { href: "/demanda", label: "Demanda" },
  { href: "/funcionario", label: "Equipe" },
  { href: "/historico", label: "Histórico" },
  { href: "/resumo", label: "Resumo" },
] as const;

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="sticky bottom-0 z-20 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)]">
      <ul className="grid grid-cols-5">
        {TABS.map((tab) => {
          const active = pathname.startsWith(tab.href);
          const accent =
            tab.href === "/demanda" || tab.href === "/funcionario"
              ? "bg-demanda"
              : "bg-despesa";
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                className={`flex flex-col items-center justify-center gap-1 py-3 text-[10px] font-bold uppercase tracking-wide transition-colors ${
                  active ? "text-foreground" : "text-muted"
                }`}
              >
                <span
                  className={`h-1 w-8 rounded-full transition-colors ${
                    active ? accent : "bg-transparent"
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
