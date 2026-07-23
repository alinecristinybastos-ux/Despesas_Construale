"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import PageHeader from "@/components/PageHeader";
import { supabase } from "@/lib/supabase";
import {
  CATEGORIAS_DESPESA,
  CATEGORIA_DESPESA_LABEL,
  type Despesa,
  type CategoriaDespesa,
  type Venda,
  type Servico,
} from "@/lib/types";
import { formatCurrency, formatDateLabel, formatDateOnly, dayKey } from "@/lib/format";
import { exportCsv, exportPdf } from "@/lib/export";

type Periodo = "hoje" | "semana" | "mes";
type TipoRel = "data" | "categoria";

const PERIODOS: { key: Periodo; label: string }[] = [
  { key: "hoje", label: "Hoje" },
  { key: "semana", label: "Semana" },
  { key: "mes", label: "Mês" },
];

function mesLabel(ano: number, mes: number) {
  return new Date(ano, mes, 1)
    .toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
    .replace(/^\w/, (c) => c.toUpperCase());
}

function dateInRange(dateStr: string, inicio: Date, fim?: Date): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr.length === 10 ? dateStr + "T12:00:00" : dateStr);
  if (fim) return d >= inicio && d <= fim;
  return d >= inicio;
}

function dateInMonth(dateStr: string, ano: number, mes: number): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr.length === 10 ? dateStr + "T12:00:00" : dateStr);
  return d.getFullYear() === ano && d.getMonth() === mes;
}

export default function ResumoPage() {
  const hoje = new Date();
  const [despesas, setDespesas] = useState<Despesa[]>([]);
  const [vendas, setVendas] = useState<Venda[]>([]);
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [periodo, setPeriodo] = useState<Periodo>("mes");
  const [anoSel, setAnoSel] = useState(hoje.getFullYear());
  const [mesSel, setMesSel] = useState(hoje.getMonth());
  const [tipoRel, setTipoRel] = useState<TipoRel>("categoria");
  const [catExpandida, setCatExpandida] = useState<CategoriaDespesa | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [despesasRes, vendasSnap, servicosSnap] = await Promise.all([
        supabase.from("despesas").select("*").order("created_at", { ascending: false }),
        getDocs(collection(db, "vendas")),
        getDocs(collection(db, "servicos")),
      ]);
      setDespesas((despesasRes.data as Despesa[]) ?? []);
      setVendas(vendasSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Venda)));
      setServicos(servicosSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Servico)));
      setLoading(false);
    }
    load();
  }, []);

  function navMes(delta: number) {
    let m = mesSel + delta;
    let a = anoSel;
    if (m < 0) { m = 11; a--; }
    if (m > 11) { m = 0; a++; }
    setMesSel(m);
    setAnoSel(a);
  }

  // Intervalo do período selecionado
  const { inicioPeriodo, fimPeriodo } = useMemo(() => {
    const now = new Date();
    if (periodo === "hoje") {
      const ini = new Date(now);
      ini.setHours(0, 0, 0, 0);
      const fim = new Date(now);
      fim.setHours(23, 59, 59, 999);
      return { inicioPeriodo: ini, fimPeriodo: fim };
    }
    if (periodo === "semana") {
      const ini = new Date(now);
      ini.setHours(0, 0, 0, 0);
      const diffToMonday = (ini.getDay() + 6) % 7;
      ini.setDate(ini.getDate() - diffToMonday);
      const fim = new Date(now);
      fim.setHours(23, 59, 59, 999);
      return { inicioPeriodo: ini, fimPeriodo: fim };
    }
    // mes
    return { inicioPeriodo: new Date(anoSel, mesSel, 1), fimPeriodo: new Date(anoSel, mesSel + 1, 0, 23, 59, 59) };
  }, [periodo, anoSel, mesSel]);

  // Filtro de despesas
  const despesasPeriodo = useMemo(() => {
    if (periodo === "mes") {
      return despesas.filter((d) => dateInMonth(d.created_at, anoSel, mesSel));
    }
    return despesas.filter((d) => dateInRange(d.created_at, inicioPeriodo, fimPeriodo));
  }, [despesas, periodo, anoSel, mesSel, inicioPeriodo, fimPeriodo]);

  // Receitas do período
  const { receitaVendas, vendasAReceber, receitaServicos } = useMemo(() => {
    let recVendas = 0;
    let aReceber = 0;
    let recServicos = 0;

    for (const v of vendas) {
      const noMes = periodo === "mes"
        ? dateInMonth(v.data, anoSel, mesSel)
        : dateInRange(v.data, inicioPeriodo, fimPeriodo);
      if (!noMes) continue;
      if (v.statusPagamento === "recebido") recVendas += v.valorPago || 0;
      else aReceber += v.valor || 0;
    }

    for (const s of servicos) {
      for (const p of s.pagamentos ?? []) {
        const noMes = periodo === "mes"
          ? dateInMonth(p.data, anoSel, mesSel)
          : dateInRange(p.data, inicioPeriodo, fimPeriodo);
        if (noMes) recServicos += p.valor || 0;
      }
    }

    return { receitaVendas: recVendas, vendasAReceber: aReceber, receitaServicos: recServicos };
  }, [vendas, servicos, periodo, anoSel, mesSel, inicioPeriodo, fimPeriodo]);

  const totalReceitas = receitaVendas + receitaServicos;
  const totalDespesas = despesasPeriodo.reduce((acc, d) => acc + d.valor, 0);
  const saldo = totalReceitas - totalDespesas;
  const pendentes = despesasPeriodo.filter((d) => !d.lancado_no_sistema).length;

  // Agrupado por categoria
  const porCategoria = useMemo(
    () =>
      CATEGORIAS_DESPESA.map((cat) => {
        const itens = despesasPeriodo.filter((d) => d.categoria === cat);
        return {
          cat,
          label: CATEGORIA_DESPESA_LABEL[cat],
          itens,
          total: itens.reduce((acc, d) => acc + d.valor, 0),
        };
      })
        .filter((c) => c.total > 0)
        .sort((a, b) => b.total - a.total),
    [despesasPeriodo],
  );

  // Agrupado por data
  const porData = useMemo(() => {
    const map = new Map<string, Despesa[]>();
    for (const d of despesasPeriodo) {
      const key = dayKey(new Date(d.created_at));
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(d);
    }
    return Array.from(map.entries())
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([key, itens]) => ({
        key,
        data: new Date(itens[0].created_at),
        itens,
        total: itens.reduce((acc, d) => acc + d.valor, 0),
      }));
  }, [despesasPeriodo]);

  const periodoLabel =
    periodo === "mes"
      ? mesLabel(anoSel, mesSel)
      : PERIODOS.find((p) => p.key === periodo)?.label ?? "";

  const totalPorCategoria = porCategoria.map((c) => ({ categoria: c.label, total: c.total }));

  return (
    <div>
      <PageHeader title="Relatório" subtitle="Receitas, despesas e saldo do período" accent="despesa" />

      <div className="space-y-4 px-5 pb-6">
        {/* Seletor de período */}
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

        {/* Navegação de mês */}
        {periodo === "mes" && (
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => navMes(-1)}
              className="rounded-xl border border-border bg-surface px-4 py-2 text-sm font-bold"
            >
              ‹
            </button>
            <span className="text-sm font-bold capitalize">{mesLabel(anoSel, mesSel)}</span>
            <button
              type="button"
              onClick={() => navMes(1)}
              className="rounded-xl border border-border bg-surface px-4 py-2 text-sm font-bold"
            >
              ›
            </button>
          </div>
        )}

        {loading ? (
          <p className="py-8 text-center text-muted">Carregando...</p>
        ) : (
          <>
            {/* Cards de receitas / despesas / saldo */}
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl border border-border bg-surface p-3 text-center">
                <p className="text-[10px] font-bold uppercase text-muted">Receitas</p>
                <p className="mt-1 font-ticket text-sm font-bold text-success">
                  {formatCurrency(totalReceitas)}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-surface p-3 text-center">
                <p className="text-[10px] font-bold uppercase text-muted">Despesas</p>
                <p className="mt-1 font-ticket text-sm font-bold text-despesa">
                  {formatCurrency(totalDespesas)}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-surface p-3 text-center">
                <p className="text-[10px] font-bold uppercase text-muted">Saldo</p>
                <p className={`mt-1 font-ticket text-sm font-bold ${saldo >= 0 ? "text-success" : "text-danger"}`}>
                  {formatCurrency(saldo)}
                </p>
              </div>
            </div>

            {/* Detalhamento das receitas */}
            <div className="rounded-xl border border-border bg-surface px-4 py-3">
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">Receitas do período</p>
              <div className="flex items-center justify-between py-1">
                <span className="text-sm text-muted">Vendas recebidas</span>
                <span className="font-ticket text-sm font-bold text-success">{formatCurrency(receitaVendas)}</span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-sm text-muted">Serviços recebidos</span>
                <span className="font-ticket text-sm font-bold text-success">{formatCurrency(receitaServicos)}</span>
              </div>
              {vendasAReceber > 0 && (
                <div className="mt-2 rounded-lg bg-surface-2 px-3 py-2">
                  <p className="text-xs text-muted">
                    ⚠ {formatCurrency(vendasAReceber)} em vendas ainda a receber
                  </p>
                </div>
              )}
            </div>

            {/* Totalizador despesas */}
            <div className="rounded-xl border border-despesa/30 bg-despesa/5 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-muted">
                Total de despesas — {periodoLabel}
              </p>
              <p className="mt-1 font-ticket text-4xl font-bold text-despesa">
                {formatCurrency(totalDespesas)}
              </p>
              {pendentes > 0 && (
                <p className="mt-1 text-xs text-muted">
                  {pendentes} pendente{pendentes > 1 ? "s" : ""} de lançamento
                </p>
              )}
            </div>

            {/* Toggle Por Data / Por Categoria */}
            <div className="flex gap-2">
              {(
                [
                  ["data", "Por Data"],
                  ["categoria", "Por Categoria"],
                ] as const
              ).map(([k, l]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setTipoRel(k)}
                  className={`rounded-full border px-4 py-2 text-sm font-bold uppercase tracking-wide ${
                    tipoRel === k
                      ? "border-despesa bg-despesa/10 text-despesa"
                      : "border-border bg-surface text-muted"
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>

            {despesasPeriodo.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted">
                Sem despesas no período.
              </p>
            ) : tipoRel === "data" ? (
              /* ── Por Data ── */
              <div className="space-y-5">
                {porData.map(({ key, data, itens, total }) => (
                  <div key={key}>
                    <div className="mb-2 flex items-center justify-between">
                      <h2 className="text-xs font-bold uppercase tracking-wide text-muted">
                        {formatDateLabel(data)}
                      </h2>
                      <span className="font-ticket text-sm font-bold text-despesa">
                        {formatCurrency(total)}
                      </span>
                    </div>
                    <ul className="space-y-2">
                      {itens.map((d) => (
                        <li
                          key={d.id}
                          className="rounded-xl border border-border bg-surface px-4 py-3"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="font-ticket font-bold">{formatCurrency(d.valor)}</p>
                              <p className="mt-0.5 truncate text-sm text-muted">
                                {CATEGORIA_DESPESA_LABEL[d.categoria]}
                                {d.observacao ? ` · ${d.observacao}` : ""}
                              </p>
                            </div>
                            <span
                              className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-bold uppercase ${
                                d.lancado_no_sistema
                                  ? "border-success text-success"
                                  : "border-border text-muted"
                              }`}
                            >
                              {d.lancado_no_sistema ? "Lançado" : "Pendente"}
                            </span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ) : (
              /* ── Por Categoria ── */
              <div className="space-y-2">
                {porCategoria.map(({ cat, label, itens, total }) => {
                  const pct = totalDespesas > 0 ? (total / totalDespesas) * 100 : 0;
                  const aberta = catExpandida === cat;
                  return (
                    <div
                      key={cat}
                      className="overflow-hidden rounded-xl border border-border bg-surface"
                    >
                      <button
                        type="button"
                        onClick={() => setCatExpandida(aberta ? null : cat)}
                        className="flex w-full items-center justify-between px-4 py-3 text-left"
                      >
                        <div className="min-w-0">
                          <p className="font-bold">{label}</p>
                          <p className="text-xs text-muted">
                            {itens.length} {itens.length === 1 ? "registro" : "registros"} ·{" "}
                            {pct.toFixed(1)}%
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-3">
                          <span className="font-ticket font-bold text-despesa">
                            {formatCurrency(total)}
                          </span>
                          <span className="text-sm text-muted">{aberta ? "▲" : "▼"}</span>
                        </div>
                      </button>

                      <div className="mx-4 mb-3 h-1 rounded-full bg-surface-2">
                        <div
                          className="h-1 rounded-full bg-despesa"
                          style={{ width: `${pct}%` }}
                        />
                      </div>

                      {aberta && (
                        <ul className="space-y-1 border-t border-border/40 px-4 py-3">
                          {itens.map((d) => (
                            <li
                              key={d.id}
                              className="flex items-center justify-between gap-3 py-1"
                            >
                              <div className="min-w-0">
                                <p className="font-ticket text-sm font-bold">
                                  {formatCurrency(d.valor)}
                                </p>
                                <p className="truncate text-xs text-muted">
                                  {formatDateOnly(d.created_at.slice(0, 10))}
                                  {d.observacao ? ` · ${d.observacao}` : ""}
                                </p>
                              </div>
                              <span
                                className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-bold uppercase ${
                                  d.lancado_no_sistema
                                    ? "border-success text-success"
                                    : "border-border text-muted"
                                }`}
                              >
                                {d.lancado_no_sistema ? "Lançado" : "Pendente"}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Exportar */}
            <div className="space-y-3 pt-2">
              <button
                type="button"
                onClick={() => exportCsv(despesasPeriodo)}
                className="w-full rounded-xl border border-border bg-surface-2 py-4 text-sm font-extrabold uppercase tracking-wide text-foreground"
              >
                Exportar CSV (Despesas)
              </button>
              <button
                type="button"
                onClick={() => exportPdf(periodoLabel, despesasPeriodo, totalPorCategoria)}
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
