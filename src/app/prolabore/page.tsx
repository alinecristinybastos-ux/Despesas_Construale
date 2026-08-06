"use client";

import { useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/PageHeader";
import Chip from "@/components/Chip";
import ConfirmDialog from "@/components/ConfirmDialog";
import Toast from "@/components/Toast";
import { supabase } from "@/lib/supabase";
import {
  CATEGORIAS_PROLABORE,
  CATEGORIA_PROLABORE_LABEL,
  type CategoriaProlabore,
  type Prolabore,
} from "@/lib/types";
import { formatCurrency, formatDateLabel, formatDateOnly, formatTime, isSameMonth, dayKey } from "@/lib/format";
import { exportProlaboreCsv, exportProlaborePdf } from "@/lib/export";

type TipoRel = "categoria" | "data" | "especifico";

function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}

function mesLabel(ano: number, mes: number) {
  return new Date(ano, mes, 1)
    .toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
    .replace(/^\w/, (c) => c.toUpperCase());
}

export default function ProlaborePage() {
  const hoje = new Date();
  const [anoSel, setAnoSel] = useState(hoje.getFullYear());
  const [mesSel, setMesSel] = useState(hoje.getMonth());

  const [valor, setValor] = useState("");
  const [categoria, setCategoria] = useState<CategoriaProlabore | null>(null);
  const [observacao, setObservacao] = useState("");
  const [data, setData] = useState(hojeISO);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const [registros, setRegistros] = useState<Prolabore[]>([]);
  const [loading, setLoading] = useState(true);

  const [paraExcluir, setParaExcluir] = useState<Prolabore | null>(null);
  const [paraEditar, setParaEditar] = useState<Prolabore | null>(null);
  const [editValor, setEditValor] = useState("");
  const [editCategoria, setEditCategoria] = useState<CategoriaProlabore | null>(null);
  const [editObservacao, setEditObservacao] = useState("");
  const [editData, setEditData] = useState("");

  // Relatório
  const [tipoRel, setTipoRel] = useState<TipoRel>("categoria");
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());
  const [catFiltro, setCatFiltro] = useState<CategoriaProlabore | null>(null);

  const valido = Number(valor.replace(",", ".")) > 0 && categoria !== null;
  const editValido = Number(editValor.replace(",", ".")) > 0 && editCategoria !== null;

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  function navMes(delta: number) {
    let m = mesSel + delta;
    let a = anoSel;
    if (m < 0) { m = 11; a--; }
    if (m > 11) { m = 0; a++; }
    setMesSel(m); setAnoSel(a);
  }

  function toggleCat(cat: string) {
    setExpandedCats((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  }

  async function carregar() {
    setLoading(true);
    const { data: rows } = await supabase
      .from("prolabore")
      .select("*")
      .order("created_at", { ascending: false });
    setRegistros((rows as Prolabore[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { carregar(); }, []);

  function resetForm() {
    setValor(""); setCategoria(null); setObservacao(""); setData(hojeISO());
  }

  function abrirEditar(r: Prolabore) {
    setParaEditar(r);
    setEditValor(String(r.valor).replace(".", ","));
    setEditCategoria(r.categoria);
    setEditObservacao(r.observacao ?? "");
    setEditData(r.created_at.slice(0, 10));
  }

  async function salvar() {
    if (!valido || !categoria) return;
    setSaving(true);
    const { error } = await supabase.from("prolabore").insert({
      valor: Number(valor.replace(",", ".")),
      categoria,
      observacao: observacao.trim() || null,
      created_at: new Date(`${data}T12:00:00`).toISOString(),
    });
    setSaving(false);
    if (error) { showToast(`Erro: ${error.message}`); return; }
    showToast("Registro salvo.");
    resetForm();
    carregar();
  }

  async function confirmarEditar() {
    if (!paraEditar || !editCategoria) return;
    const v = Number(editValor.replace(",", "."));
    if (!(v > 0)) return;
    const { error } = await supabase.from("prolabore").update({
      valor: v,
      categoria: editCategoria,
      observacao: editObservacao.trim() || null,
      created_at: new Date(`${editData}T12:00:00`).toISOString(),
    }).eq("id", paraEditar.id);
    setParaEditar(null);
    if (error) { showToast(`Erro: ${error.message}`); return; }
    showToast("Registro atualizado.");
    carregar();
  }

  async function confirmarExcluir() {
    if (!paraExcluir) return;
    const { error } = await supabase.from("prolabore").delete().eq("id", paraExcluir.id);
    setParaExcluir(null);
    if (error) { showToast(`Erro: ${error.message}`); return; }
    setRegistros((prev) => prev.filter((r) => r.id !== paraExcluir.id));
    showToast("Registro excluído.");
  }

  const refMes = new Date(anoSel, mesSel, 1);
  const registrosMes = registros.filter((r) => isSameMonth(r.created_at, refMes));
  const totalMes = registrosMes.reduce((acc, r) => acc + r.valor, 0);
  const periodoLabel = mesLabel(anoSel, mesSel);

  const porCategoria = useMemo(() =>
    CATEGORIAS_PROLABORE.map((cat) => {
      const itens = registrosMes.filter((r) => r.categoria === cat);
      return { cat, label: CATEGORIA_PROLABORE_LABEL[cat], itens, total: itens.reduce((a, r) => a + r.valor, 0) };
    }).filter((c) => c.total > 0).sort((a, b) => b.total - a.total),
  [registrosMes]); // eslint-disable-line react-hooks/exhaustive-deps

  const porData = useMemo(() => {
    const map = new Map<string, Prolabore[]>();
    for (const r of registrosMes) {
      const key = dayKey(new Date(r.created_at));
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    return Array.from(map.entries())
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([key, itens]) => ({
        key,
        data: new Date(itens[0].created_at),
        itens,
        total: itens.reduce((a, r) => a + r.valor, 0),
      }));
  }, [registrosMes]); // eslint-disable-line react-hooks/exhaustive-deps

  const totalPorCategoriaExport = porCategoria.map((c) => ({ categoria: c.label, total: c.total }));

  function ItemRow({ r }: { r: Prolabore }) {
    return (
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-ticket font-bold text-prolabore">{formatCurrency(r.valor)}</p>
          <p className="mt-0.5 truncate text-xs text-muted">
            {CATEGORIA_PROLABORE_LABEL[r.categoria]}{r.observacao ? ` · ${r.observacao}` : ""}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xs text-muted">{formatDateOnly(r.created_at.slice(0, 10))}</p>
          <div className="mt-1 flex justify-end gap-3">
            <button type="button" onClick={() => abrirEditar(r)} className="text-xs font-bold uppercase text-foreground">Editar</button>
            <button type="button" onClick={() => setParaExcluir(r)} className="text-xs font-bold uppercase text-danger">Excluir</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Toast message={toast} />
      <PageHeader title="Pró-labore" subtitle="Retiradas e gastos pessoais" accent="prolabore" />

      <div className="space-y-6 px-5 pb-10">
        {/* Formulário */}
        <div>
          <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-muted">Valor (R$)</label>
          <input
            inputMode="decimal"
            placeholder="0,00"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            className="w-full rounded-xl border border-border bg-surface px-4 py-4 font-ticket text-3xl font-bold text-foreground placeholder:text-muted focus:border-prolabore focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-muted">Categoria</label>
          <div className="flex flex-wrap gap-2">
            {CATEGORIAS_PROLABORE.map((cat) => (
              <Chip key={cat} label={CATEGORIA_PROLABORE_LABEL[cat]} selected={categoria === cat} onClick={() => setCategoria(cat)} accent="prolabore" />
            ))}
          </div>
        </div>

        <div>
          <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-muted">Observação (opcional)</label>
          <textarea
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            rows={2}
            placeholder="Detalhes adicionais..."
            className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-foreground placeholder:text-muted focus:border-prolabore focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-muted">Data</label>
          <input
            type="date"
            value={data}
            onChange={(e) => setData(e.target.value)}
            className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-foreground focus:border-prolabore focus:outline-none"
          />
        </div>

        <button
          type="button"
          disabled={!valido || saving}
          onClick={salvar}
          className="w-full rounded-xl bg-prolabore py-4 text-base font-extrabold uppercase tracking-wide text-black disabled:opacity-40"
        >
          Salvar
        </button>

        {/* Navegação de mês */}
        <div className="flex items-center justify-between gap-2">
          <button type="button" onClick={() => navMes(-1)} className="rounded-xl border border-border bg-surface px-4 py-2 text-sm font-bold">‹</button>
          <span className="text-sm font-bold capitalize">{periodoLabel}</span>
          <button type="button" onClick={() => navMes(1)} className="rounded-xl border border-border bg-surface px-4 py-2 text-sm font-bold">›</button>
        </div>

        {/* Card resumo do mês */}
        {totalPorCategoriaExport.length > 0 && (
          <div className="rounded-xl border border-border bg-surface px-4 py-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-extrabold uppercase tracking-wide text-muted">Total do mês</p>
              <p className="font-ticket font-bold text-prolabore">{formatCurrency(totalMes)}</p>
            </div>
            <ul className="space-y-1">
              {totalPorCategoriaExport.map((c) => (
                <li key={c.categoria} className="flex items-center justify-between">
                  <span className="text-sm text-muted">{c.categoria}</span>
                  <span className="font-ticket text-sm font-bold">{formatCurrency(c.total)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {loading ? (
          <p className="py-4 text-center text-sm text-muted">Carregando...</p>
        ) : registrosMes.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted">Nenhum registro neste mês.</p>
        ) : (
          <>
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
                      ? "border-prolabore bg-prolabore/10 text-prolabore"
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
                        ? "border-prolabore bg-prolabore text-black"
                        : "border-border bg-surface text-muted"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}

            {tipoRel === "especifico" ? (
              !catFiltro ? (
                <p className="py-4 text-center text-sm text-muted">Selecione uma categoria acima.</p>
              ) : (() => {
                const itensFiltro = registrosMes.filter((r) => r.categoria === catFiltro);
                const totalFiltro = itensFiltro.reduce((a, r) => a + r.valor, 0);
                const labelFiltro = CATEGORIA_PROLABORE_LABEL[catFiltro];
                return (
                  <div>
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-xs font-extrabold uppercase tracking-wide text-muted">{labelFiltro}</p>
                      <span className="font-ticket font-bold text-prolabore">{formatCurrency(totalFiltro)}</span>
                    </div>
                    <ul className="space-y-2">
                      {itensFiltro.map((r) => (
                        <li key={r.id} className="rounded-xl border border-border bg-surface px-4 py-3">
                          <ItemRow r={r} />
                        </li>
                      ))}
                    </ul>
                    <div className="mt-4 space-y-3">
                      <button type="button" onClick={() => exportProlaboreCsv(itensFiltro, `prolabore-${catFiltro}-${Date.now()}.csv`)} className="w-full rounded-xl border border-border bg-surface-2 py-4 text-sm font-extrabold uppercase tracking-wide text-foreground">
                        Exportar CSV — {labelFiltro}
                      </button>
                      <button type="button" onClick={() => exportProlaborePdf(`${periodoLabel} · ${labelFiltro}`, itensFiltro, [{ categoria: labelFiltro, total: totalFiltro }])} className="w-full rounded-xl border border-border bg-surface-2 py-4 text-sm font-extrabold uppercase tracking-wide text-foreground">
                        Relatório PDF — {labelFiltro}
                      </button>
                    </div>
                  </div>
                );
              })()
            ) : tipoRel === "data" ? (
              /* ── Por Data ── */
              <div className="space-y-5">
                {porData.map(({ key, data: dt, itens, total }) => (
                  <div key={key}>
                    <div className="mb-2 flex items-center justify-between">
                      <h2 className="text-xs font-bold uppercase tracking-wide text-muted">{formatDateLabel(dt)}</h2>
                      <span className="font-ticket text-sm font-bold text-prolabore">{formatCurrency(total)}</span>
                    </div>
                    <ul className="space-y-2">
                      {itens.map((r) => (
                        <li key={r.id} className="rounded-xl border border-border bg-surface px-4 py-3">
                          <ItemRow r={r} />
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
                <div className="space-y-3 pt-2">
                  <button type="button" onClick={() => exportProlaboreCsv(registrosMes)} className="w-full rounded-xl border border-border bg-surface-2 py-4 text-sm font-extrabold uppercase tracking-wide text-foreground">Exportar CSV</button>
                  <button type="button" onClick={() => exportProlaborePdf(periodoLabel, registrosMes, totalPorCategoriaExport)} className="w-full rounded-xl border border-border bg-surface-2 py-4 text-sm font-extrabold uppercase tracking-wide text-foreground">Relatório PDF</button>
                </div>
              </div>
            ) : (
              /* ── Por Categoria (expansível) ── */
              <div className="space-y-2">
                {porCategoria.map(({ cat, label, itens, total }) => {
                  const pct = totalMes > 0 ? (total / totalMes) * 100 : 0;
                  const aberta = expandedCats.has(cat);
                  return (
                    <div key={cat} className="rounded-xl border border-border bg-surface overflow-hidden">
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
                          <span className="font-ticket font-bold text-prolabore">{formatCurrency(total)}</span>
                          <span className="text-muted text-xs">{aberta ? "▲" : "▼"}</span>
                        </div>
                      </button>
                      <div className="h-1 bg-surface-2">
                        <div className="h-1 bg-prolabore" style={{ width: `${pct}%` }} />
                      </div>
                      {aberta && (
                        <ul className="divide-y divide-border px-4">
                          {itens.map((r) => (
                            <li key={r.id} className="py-3">
                              <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="font-ticket font-bold text-prolabore">{formatCurrency(r.valor)}</p>
                                  <p className="truncate text-xs text-muted">
                                    {formatDateOnly(r.created_at.slice(0, 10))}{r.observacao ? ` · ${r.observacao}` : ""}
                                  </p>
                                </div>
                                <div className="flex shrink-0 items-center gap-2">
                                  <button type="button" onClick={() => abrirEditar(r)} className="rounded-lg border border-border px-2 py-1 text-xs font-bold text-muted">Editar</button>
                                  <button type="button" onClick={() => setParaExcluir(r)} className="rounded-lg border border-danger/40 px-2 py-1 text-xs font-bold text-danger">Excluir</button>
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
                  <button type="button" onClick={() => exportProlaboreCsv(registrosMes)} className="w-full rounded-xl border border-border bg-surface-2 py-4 text-sm font-extrabold uppercase tracking-wide text-foreground">Exportar CSV</button>
                  <button type="button" onClick={() => exportProlaborePdf(periodoLabel, registrosMes, totalPorCategoriaExport)} className="w-full rounded-xl border border-border bg-surface-2 py-4 text-sm font-extrabold uppercase tracking-wide text-foreground">Relatório PDF</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <ConfirmDialog
        open={paraExcluir !== null}
        title="Excluir registro?"
        description="Esta ação não pode ser desfeita."
        confirmLabel="Sim, excluir"
        onConfirm={confirmarExcluir}
        onCancel={() => setParaExcluir(null)}
      />

      {/* Overlay de edição */}
      {paraEditar && (
        <div className="fixed inset-0 z-50 flex flex-col bg-background">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h2 className="font-extrabold uppercase tracking-wide">Editar Registro</h2>
            <button type="button" onClick={() => setParaEditar(null)} className="text-xl font-bold text-muted">✕</button>
          </div>
          <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-muted">Valor (R$)</label>
              <input
                inputMode="decimal"
                value={editValor}
                onChange={(e) => setEditValor(e.target.value)}
                className="w-full rounded-xl border border-border bg-surface px-4 py-4 font-ticket text-3xl font-bold text-foreground focus:border-prolabore focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-muted">Categoria</label>
              <div className="flex flex-wrap gap-2">
                {CATEGORIAS_PROLABORE.map((cat) => (
                  <Chip key={cat} label={CATEGORIA_PROLABORE_LABEL[cat]} selected={editCategoria === cat} onClick={() => setEditCategoria(cat)} accent="prolabore" />
                ))}
              </div>
            </div>
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-muted">Observação</label>
              <textarea
                value={editObservacao}
                onChange={(e) => setEditObservacao(e.target.value)}
                rows={2}
                className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-foreground focus:border-prolabore focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-muted">Data</label>
              <input
                type="date"
                value={editData}
                onChange={(e) => setEditData(e.target.value)}
                className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-foreground focus:border-prolabore focus:outline-none"
              />
            </div>
          </div>
          <div className="px-5 py-4">
            <button
              type="button"
              disabled={!editValido}
              onClick={confirmarEditar}
              className="w-full rounded-xl bg-prolabore py-4 text-base font-extrabold uppercase tracking-wide text-black disabled:opacity-40"
            >
              Salvar Alteração
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
