"use client";

import { useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/PageHeader";
import { supabase } from "@/lib/supabase";
import {
  CATEGORIAS_DESPESA,
  CATEGORIA_DESPESA_LABEL,
  type Despesa,
  type Demanda,
} from "@/lib/types";
import { formatCurrency } from "@/lib/format";
import { exportCsv, exportPdf } from "@/lib/export";

type Periodo = "hoje" | "semana" | "mes";

const PERIODOS: { key: Periodo; label: string }[] = [
  { key: "hoje", label: "Hoje" },
  { key: "semana", label: "Semana" },
  { key: "mes", label: "Mês" },
];

function startOfPeriod(periodo: Periodo): Date {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);

  if (periodo === "hoje") return start;

  if (periodo === "semana") {
    const diffToMonday = (start.getDay() + 6) % 7;
    start.setDate(start.getDate() - diffToMonday);
    return start;
  }

  start.setDate(1);
  return start;
}

export default function ResumoPage() {
  const [despesas, setDespesas] = useState<Despesa[]>([]);
  const [demandas, setDemandas] = useState<Demanda[]>([]);
  const [periodo, setPeriodo] = useState<Periodo>("hoje");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [d1, d2] = await Promise.all([
        supabase.from("despesas").select("*").order("created_at", { ascending: false }),
        supabase.from("demandas").select("*").order("created_at", { ascending: false }),
      ]);
      setDespesas((d1.data as Despesa[]) ?? []);
      setDemandas((d2.data as Demanda[]) ?? []);
      setLoading(false);
    }
    load();
  }, []);

  const inicio = useMemo(() => startOfPeriod(periodo), [periodo]);

  const despesasPeriodo = useMemo(
    () => despesas.filter((d) => new Date(d.created_at) >= inicio),
    [despesas, inicio],
  );
  const demandasPeriodo = useMemo(
    () => demandas.filter((d) => new Date(d.created_at) >= inicio),
    [demandas, inicio],
  );

  const totalDespesas = despesasPeriodo.reduce((acc, d) => acc + d.valor, 0);
  const pendentes = despesasPeriodo.filter((d) => !d.lancado_no_sistema).length;
  const demandasConcluidas = demandasPeriodo.filter((d) => d.concluido).length;

  const totalPorCategoria = useMemo(
    () =>
      CATEGORIAS_DESPESA.map((cat) => ({
        categoria: CATEGORIA_DESPESA_LABEL[cat],
        total: despesasPeriodo
          .filter((d) => d.categoria === cat)
          .reduce((acc, d) => acc + d.valor, 0),
      })).filter((c) => c.total > 0),
    [despesasPeriodo],
  );

  const periodoLabel = PERIODOS.find((p) => p.key === periodo)?.label ?? "";

  return (
    <div>
      <PageHeader title="Resumo" subtitle="Totais e relatórios" />

      <div className="space-y-6 px-5 pb-6">
        <div className="flex gap-2">
          {PERIODOS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => setPeriodo(p.key)}
              className={`rounded-full border px-4 py-2 text-sm font-bold uppercase tracking-wide ${
                periodo === p.key
                  ? "border-foreground bg-surface-2 text-foreground"
                  : "border-border bg-surface text-muted"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="py-8 text-center text-muted">Carregando...</p>
        ) : (
          <>
            <div className="rounded-xl border border-border bg-surface p-5">
              <p className="text-xs font-bold uppercase tracking-wide text-muted">
                Total de despesas
              </p>
              <p className="mt-1 font-ticket text-4xl font-bold text-despesa">
                {formatCurrency(totalDespesas)}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-border bg-surface p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-muted">
                  Demandas
                </p>
                <p className="mt-1 font-ticket text-2xl font-bold">
                  {demandasPeriodo.length}
                </p>
                <p className="text-xs text-muted">{demandasConcluidas} concluídas</p>
              </div>
              <div className="rounded-xl border border-border bg-surface p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-muted">
                  Despesas pendentes
                </p>
                <p className="mt-1 font-ticket text-2xl font-bold text-demanda">
                  {pendentes}
                </p>
                <p className="text-xs text-muted">não lançadas no sistema</p>
              </div>
            </div>

            <div>
              <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">
                Por categoria
              </h2>
              {totalPorCategoria.length === 0 ? (
                <p className="text-sm text-muted">Sem despesas no período.</p>
              ) : (
                <ul className="space-y-2">
                  {totalPorCategoria.map((c) => (
                    <li
                      key={c.categoria}
                      className="flex items-center justify-between rounded-xl border border-border bg-surface px-4 py-3"
                    >
                      <span className="font-bold">{c.categoria}</span>
                      <span className="font-ticket font-bold text-despesa">
                        {formatCurrency(c.total)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="space-y-3">
              <button
                type="button"
                onClick={() => exportCsv(despesasPeriodo, demandasPeriodo)}
                className="w-full rounded-xl border border-border bg-surface-2 py-4 text-sm font-extrabold uppercase tracking-wide text-foreground"
              >
                Exportar CSV
              </button>
              <button
                type="button"
                onClick={() =>
                  exportPdf(periodoLabel, despesasPeriodo, demandasPeriodo, totalPorCategoria)
                }
                className="w-full rounded-xl border border-border bg-surface-2 py-4 text-sm font-extrabold uppercase tracking-wide text-foreground"
              >
                Relatório PDF
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
