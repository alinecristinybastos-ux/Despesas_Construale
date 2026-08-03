"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import PageHeader from "@/components/PageHeader";
import Chip from "@/components/Chip";
import Toast from "@/components/Toast";
import ConfirmDialog from "@/components/ConfirmDialog";
import { supabase } from "@/lib/supabase";
import {
  CATEGORIAS_DESPESA,
  CATEGORIA_DESPESA_LABEL,
  CATEGORIA_PROLABORE_LABEL,
  type CategoriaProlabore,
  type Despesa,
  type CategoriaDespesa,
  type Venda,
  type Servico,
} from "@/lib/types";

// Categorias de prolabore que também existem em despesas
const CATS_PROLABORE_EM_DESPESA: CategoriaDespesa[] = ["COMBUSTIVEL", "ALIMENTACAO"];
import { formatCurrency, formatDateLabel, formatDateOnly, dayKey } from "@/lib/format";
import { exportCsv, exportPdf } from "@/lib/export";

type Periodo = "hoje" | "semana" | "mes";
type TipoRel = "data" | "categoria" | "especifico";

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

function toDate(value: unknown): Date | null {
  if (!value) return null;
  // Firestore Timestamp: { seconds, nanoseconds }
  if (typeof value === "object" && value !== null && "seconds" in value) {
    return new Date((value as { seconds: number }).seconds * 1000);
  }
  if (typeof value === "string") {
    const d = new Date(value.length === 10 ? value + "T12:00:00" : value);
    return isNaN(d.getTime()) ? null : d;
  }
  if (value instanceof Date) return value;
  return null;
}

function dateInRange(dateStr: unknown, inicio: Date, fim?: Date): boolean {
  const d = toDate(dateStr);
  if (!d) return false;
  if (fim) return d >= inicio && d <= fim;
  return d >= inicio;
}

function dateInMonth(dateStr: unknown, ano: number, mes: number): boolean {
  const d = toDate(dateStr);
  if (!d) return false;
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
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [vendasManual, setVendasManual] = useState<number | null>(null);
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());
  const [catFiltro, setCatFiltro] = useState<CategoriaDespesa | null>(null);

  // estados de edição
  const [paraEditar, setParaEditar] = useState<Despesa | null>(null);
  const [editValor, setEditValor] = useState("");
  const [editCategoria, setEditCategoria] = useState<CategoriaDespesa | null>(null);
  const [editObservacao, setEditObservacao] = useState("");
  const [editData, setEditData] = useState("");
  const [paraExcluir, setParaExcluir] = useState<Despesa | null>(null);
  const [migracaoAberta, setMigracaoAberta] = useState(false);
  const [migrandoId, setMigrandoId] = useState<string | null>(null);

  const editValido = Number(editValor.replace(",", ".")) > 0 && editCategoria !== null;

  // Todas as despesas — a tela de migração mostra todas para o usuário decidir
  const candidatosMigracao = useMemo(() => despesas, [despesas]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  async function carregarDespesas() {
    const res = await supabase.from("despesas").select("*").order("created_at", { ascending: false });
    setDespesas((res.data as Despesa[]) ?? []);
  }

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

  function abrirEditar(d: Despesa) {
    setParaEditar(d);
    setEditValor(String(d.valor).replace(".", ","));
    setEditCategoria(d.categoria);
    setEditObservacao(d.observacao ?? "");
    setEditData(d.created_at.slice(0, 10));
  }

  async function confirmarEditar() {
    if (!paraEditar || !editCategoria) return;
    const valor = Number(editValor.replace(",", "."));
    if (!(valor > 0)) return;
    const { error } = await supabase.from("despesas").update({
      valor,
      categoria: editCategoria,
      observacao: editObservacao.trim() || null,
      created_at: new Date(`${editData}T12:00:00`).toISOString(),
    }).eq("id", paraEditar.id);
    setParaEditar(null);
    if (error) { showToast(`Erro: ${error.message}`); return; }
    showToast("Despesa atualizada.");
    carregarDespesas();
  }

  async function confirmarExcluir() {
    if (!paraExcluir) return;
    const { error } = await supabase.from("despesas").delete().eq("id", paraExcluir.id);
    setParaExcluir(null);
    if (error) { showToast(`Erro: ${error.message}`); return; }
    showToast("Despesa excluída.");
    setDespesas((prev) => prev.filter((d) => d.id !== paraExcluir.id));
  }

  async function moverParaProlabore(d: Despesa) {
    setMigrandoId(d.id);
    const { error: insErr } = await supabase.from("prolabore").insert({
      valor: d.valor,
      categoria: d.categoria as CategoriaProlabore,
      observacao: d.observacao,
      created_at: d.created_at,
    });
    if (insErr) { showToast(`Erro: ${insErr.message}`); setMigrandoId(null); return; }
    const { error: delErr } = await supabase.from("despesas").delete().eq("id", d.id);
    setMigrandoId(null);
    if (delErr) { showToast(`Erro: ${delErr.message}`); return; }
    setDespesas((prev) => prev.filter((x) => x.id !== d.id));
    showToast("Movido para Pró-labore.");
  }

  useEffect(() => {
    const saved = localStorage.getItem(`vr_manual_${anoSel}_${mesSel}`);
    setVendasManual(saved !== null ? Number(saved) : null);
  }, [anoSel, mesSel]);

  function toggleCat(cat: string) {
    setExpandedCats((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  }

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
      const dateRef = v.dataRecebimento ?? v.data ?? v.timestamp;
      const noMes = periodo === "mes"
        ? dateInMonth(dateRef, anoSel, mesSel)
        : dateInRange(dateRef, inicioPeriodo, fimPeriodo);
      if (!noMes) continue;
      recVendas += v.valorPago || 0;
      const restante = (v.valor || 0) - (v.valorPago || 0);
      if (restante > 0) aReceber += restante;
    }

    for (const s of servicos) {
      for (const p of s.pagamentos ?? []) {
        const noMes = periodo === "mes"
          ? dateInMonth(p.data, anoSel, mesSel)
          : dateInRange(p.data, inicioPeriodo, fimPeriodo);
        if (noMes) recServicos += p.valor || 0;
      }
    }

    // Quando período é "mês" e o usuário inseriu valor manual, usa o manual
    const recVendasFinal = (periodo === "mes" && vendasManual !== null) ? vendasManual : recVendas;

    return { receitaVendas: recVendasFinal, vendasAReceber: aReceber, receitaServicos: recServicos };
  }, [vendas, servicos, periodo, anoSel, mesSel, inicioPeriodo, fimPeriodo, vendasManual]);

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

      <Toast message={toast} />

      {/* Overlay de migração */}
      {migracaoAberta && (
        <div className="fixed inset-0 z-50 flex flex-col bg-background">
          <header className="flex items-center gap-3 border-b border-border px-5 py-4">
            <button type="button" onClick={() => setMigracaoAberta(false)} className="text-muted text-lg">✕</button>
            <div>
              <h2 className="font-extrabold uppercase tracking-wide">Migrar para Pró-labore</h2>
              <p className="text-xs text-muted">Selecione o que mover ou excluir</p>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto p-5">
            {despesas.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted">Nenhuma despesa registrada.</p>
            ) : (
              <ul className="space-y-3">
                {despesas.map((d) => {
                  const podeMovar = CATS_PROLABORE_EM_DESPESA.includes(d.categoria as CategoriaDespesa);
                  return (
                    <li key={d.id} className="rounded-xl border border-border bg-surface px-4 py-3">
                      <div className="mb-2">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-ticket font-bold">{formatCurrency(d.valor)}</p>
                          <span className="rounded-full border border-border px-2 py-0.5 text-xs font-bold text-muted">
                            {CATEGORIA_DESPESA_LABEL[d.categoria]}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-muted">
                          {formatDateOnly(d.created_at.slice(0, 10))}
                          {d.observacao ? ` · ${d.observacao}` : ""}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        {podeMovar && (
                          <button
                            type="button"
                            disabled={migrandoId === d.id}
                            onClick={() => moverParaProlabore(d)}
                            className="flex-1 rounded-xl bg-prolabore py-2 text-xs font-extrabold uppercase tracking-wide text-black disabled:opacity-40"
                          >
                            {migrandoId === d.id ? "Movendo..." : "→ Pró-labore"}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setParaExcluir(d)}
                          className={`rounded-xl border border-despesa/40 px-3 py-2 text-xs font-bold text-despesa ${!podeMovar ? "flex-1" : ""}`}
                        >
                          Excluir
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Confirm excluir */}
      <ConfirmDialog
        open={!!paraExcluir}
        title="Excluir despesa"
        description={paraExcluir ? `Excluir despesa de ${formatCurrency(paraExcluir.valor)}?` : undefined}
        confirmLabel="Excluir"
        onConfirm={confirmarExcluir}
        onCancel={() => setParaExcluir(null)}
      />

      {/* Overlay edição */}
      {paraEditar && (
        <div className="fixed inset-0 z-50 flex flex-col bg-background">
          <header className="flex items-center gap-3 border-b border-border px-5 py-4">
            <button type="button" onClick={() => setParaEditar(null)} className="text-muted text-lg">✕</button>
            <h2 className="font-extrabold uppercase tracking-wide">Editar Despesa</h2>
          </header>
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-muted">Valor (R$)</label>
              <input
                type="number"
                inputMode="decimal"
                value={editValor}
                onChange={(e) => setEditValor(e.target.value)}
                className="w-full rounded-xl border border-border bg-surface-2 px-4 py-3 font-ticket text-2xl font-bold"
              />
            </div>
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-muted">Categoria</label>
              <div className="flex flex-wrap gap-2">
                {CATEGORIAS_DESPESA.map((cat) => (
                  <Chip
                    key={cat}
                    label={CATEGORIA_DESPESA_LABEL[cat]}
                    selected={editCategoria === cat}
                    onClick={() => setEditCategoria(cat)}
                    accent="despesa"
                  />
                ))}
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-muted">Observação</label>
              <input
                type="text"
                value={editObservacao}
                onChange={(e) => setEditObservacao(e.target.value)}
                className="w-full rounded-xl border border-border bg-surface-2 px-4 py-3 text-sm"
                placeholder="Detalhes adicionais..."
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-muted">Data</label>
              <input
                type="date"
                value={editData}
                onChange={(e) => setEditData(e.target.value)}
                className="w-full rounded-xl border border-border bg-surface-2 px-4 py-3 text-sm"
              />
            </div>
          </div>
          <div className="border-t border-border p-5">
            <button
              type="button"
              onClick={confirmarEditar}
              disabled={!editValido}
              className="w-full rounded-xl bg-despesa py-4 font-extrabold uppercase tracking-wide text-black disabled:opacity-40"
            >
              Salvar alterações
            </button>
          </div>
        </div>
      )}

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

            {/* Botão migração — sempre visível quando há despesas */}
            {despesas.length > 0 && (
              <button
                type="button"
                onClick={() => setMigracaoAberta(true)}
                className="w-full rounded-xl border border-prolabore bg-prolabore/10 py-3 text-sm font-extrabold uppercase tracking-wide text-prolabore"
              >
                Migrar despesas para Pró-labore
              </button>
            )}

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

            {/* Tabs de relatório */}
            <div className="flex gap-2 flex-wrap">
              {([
                ["categoria", "Por Categoria"],
                ["data", "Por Data"],
                ["especifico", "Categoria Específica"],
              ] as const).map(([k, l]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => { setTipoRel(k); if (k !== "especifico") setCatFiltro(null); }}
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

            {/* Seletor de categoria específica */}
            {tipoRel === "especifico" && (
              <div className="flex flex-wrap gap-2">
                {porCategoria.map(({ cat, label }) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCatFiltro(cat)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-bold ${
                      catFiltro === cat
                        ? "border-despesa bg-despesa text-black"
                        : "border-border bg-surface text-muted"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}

            {despesasPeriodo.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted">Sem despesas no período.</p>
            ) : tipoRel === "especifico" ? (
              /* ── Categoria Específica ── */
              !catFiltro ? (
                <p className="py-4 text-center text-sm text-muted">Selecione uma categoria acima.</p>
              ) : (() => {
                const itensFiltro = despesasPeriodo.filter((d) => d.categoria === catFiltro);
                const totalFiltro = itensFiltro.reduce((a, d) => a + d.valor, 0);
                const labelFiltro = CATEGORIA_DESPESA_LABEL[catFiltro];
                return (
                  <div>
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-xs font-extrabold uppercase tracking-wide text-muted">{labelFiltro}</p>
                      <span className="font-ticket font-bold text-despesa">{formatCurrency(totalFiltro)}</span>
                    </div>
                    <ul className="space-y-2">
                      {itensFiltro.map((d) => (
                        <li key={d.id} className="rounded-xl border border-border bg-surface px-4 py-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="font-ticket font-bold">{formatCurrency(d.valor)}</p>
                              <p className="truncate text-xs text-muted">
                                {formatDateOnly(d.created_at.slice(0, 10))}
                                {d.observacao ? ` · ${d.observacao}` : ""}
                              </p>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              <button type="button" onClick={() => abrirEditar(d)} className="rounded-lg border border-border px-2 py-1 text-xs font-bold text-muted">Editar</button>
                              <button type="button" onClick={() => setParaExcluir(d)} className="rounded-lg border border-despesa/40 px-2 py-1 text-xs font-bold text-despesa">Excluir</button>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-4 space-y-3">
                      <button type="button" onClick={() => exportCsv(itensFiltro)} className="w-full rounded-xl border border-border bg-surface-2 py-4 text-sm font-extrabold uppercase tracking-wide text-foreground">
                        Exportar CSV — {labelFiltro}
                      </button>
                      <button type="button" onClick={() => exportPdf(`${periodoLabel} · ${labelFiltro}`, itensFiltro, [{ categoria: labelFiltro, total: totalFiltro }])} className="w-full rounded-xl border border-border bg-surface-2 py-4 text-sm font-extrabold uppercase tracking-wide text-foreground">
                        Relatório PDF — {labelFiltro}
                      </button>
                    </div>
                  </div>
                );
              })()
            ) : tipoRel === "data" ? (
              /* ── Por Data ── */
              <div className="space-y-5">
                {porData.map(({ key, data, itens, total }) => (
                  <div key={key}>
                    <div className="mb-2 flex items-center justify-between">
                      <h2 className="text-xs font-bold uppercase tracking-wide text-muted">{formatDateLabel(data)}</h2>
                      <span className="font-ticket text-sm font-bold text-despesa">{formatCurrency(total)}</span>
                    </div>
                    <ul className="space-y-2">
                      {itens.map((d) => (
                        <li key={d.id} className="rounded-xl border border-border bg-surface px-4 py-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="font-ticket font-bold">{formatCurrency(d.valor)}</p>
                              <p className="mt-0.5 truncate text-sm text-muted">
                                {CATEGORIA_DESPESA_LABEL[d.categoria]}{d.observacao ? ` · ${d.observacao}` : ""}
                              </p>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              <button type="button" onClick={() => abrirEditar(d)} className="rounded-lg border border-border px-2 py-1 text-xs font-bold text-muted">Editar</button>
                              <button type="button" onClick={() => setParaExcluir(d)} className="rounded-lg border border-despesa/40 px-2 py-1 text-xs font-bold text-despesa">Excluir</button>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
                <div className="space-y-3 pt-2">
                  <button type="button" onClick={() => exportCsv(despesasPeriodo)} className="w-full rounded-xl border border-border bg-surface-2 py-4 text-sm font-extrabold uppercase tracking-wide text-foreground">Exportar CSV</button>
                  <button type="button" onClick={() => exportPdf(periodoLabel, despesasPeriodo, totalPorCategoria)} className="w-full rounded-xl border border-border bg-surface-2 py-4 text-sm font-extrabold uppercase tracking-wide text-foreground">Relatório PDF</button>
                </div>
              </div>
            ) : (
              /* ── Por Categoria (expansível) ── */
              <div className="space-y-2">
                {porCategoria.map(({ cat, label, itens, total }) => {
                  const pct = totalDespesas > 0 ? (total / totalDespesas) * 100 : 0;
                  const aberta = expandedCats.has(cat);
                  return (
                    <div key={cat} className="rounded-xl border border-border bg-surface overflow-hidden">
                      {/* Cabeçalho clicável */}
                      <button
                        type="button"
                        onClick={() => toggleCat(cat)}
                        className="w-full px-4 py-3 flex items-center justify-between gap-2 text-left"
                      >
                        <div className="min-w-0">
                          <p className="font-extrabold uppercase tracking-wide text-foreground text-sm">{label}</p>
                          <p className="text-xs text-muted">{itens.length} {itens.length === 1 ? "registro" : "registros"} · {pct.toFixed(1)}%</p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="font-ticket font-bold text-despesa">{formatCurrency(total)}</span>
                          <span className="text-muted text-xs">{aberta ? "▲" : "▼"}</span>
                        </div>
                      </button>
                      {/* Barra de progresso */}
                      <div className="h-1 bg-surface-2">
                        <div className="h-1 bg-despesa" style={{ width: `${pct}%` }} />
                      </div>
                      {/* Itens — só mostrar se expandido */}
                      {aberta && (
                        <ul className="divide-y divide-border px-4">
                          {itens.map((d) => (
                            <li key={d.id} className="py-3">
                              <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="font-ticket font-bold">{formatCurrency(d.valor)}</p>
                                  <p className="truncate text-xs text-muted">
                                    {formatDateOnly(d.created_at.slice(0, 10))}{d.observacao ? ` · ${d.observacao}` : ""}
                                  </p>
                                </div>
                                <div className="flex shrink-0 items-center gap-2">
                                  <button type="button" onClick={() => abrirEditar(d)} className="rounded-lg border border-border px-2 py-1 text-xs font-bold text-muted">Editar</button>
                                  <button type="button" onClick={() => setParaExcluir(d)} className="rounded-lg border border-despesa/40 px-2 py-1 text-xs font-bold text-despesa">Excluir</button>
                                </div>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })}
                <div className="space-y-3 pt-2">
                  <button type="button" onClick={() => exportCsv(despesasPeriodo)} className="w-full rounded-xl border border-border bg-surface-2 py-4 text-sm font-extrabold uppercase tracking-wide text-foreground">Exportar CSV</button>
                  <button type="button" onClick={() => exportPdf(periodoLabel, despesasPeriodo, totalPorCategoria)} className="w-full rounded-xl border border-border bg-surface-2 py-4 text-sm font-extrabold uppercase tracking-wide text-foreground">Relatório PDF</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
