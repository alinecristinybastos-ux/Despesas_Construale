"use client";

import { useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/PageHeader";
import ConfirmDialog from "@/components/ConfirmDialog";
import Chip from "@/components/Chip";
import Toast from "@/components/Toast";
import { supabase } from "@/lib/supabase";
import {
  CATEGORIAS_DESPESA,
  CATEGORIA_DESPESA_LABEL,
  SERVICO_DEMANDA_LABEL,
  type CategoriaDespesa,
  type Despesa,
  type Demanda,
} from "@/lib/types";
import { formatCurrency, formatDateLabel, formatDateOnly, formatTime, dayKey } from "@/lib/format";

type Tipo = "despesa" | "demanda";

interface ItemHistorico {
  id: string;
  tipo: Tipo;
  createdAt: Date;
  titulo: string;
  subtitulo: string;
  detalhe?: string;
  status: { label: string; done: boolean };
}

type Filtro = "todos" | Tipo;

export default function HistoricoPage() {
  const [despesas, setDespesas] = useState<Despesa[]>([]);
  const [demandas, setDemandas] = useState<Demanda[]>([]);
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [busca, setBusca] = useState("");
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  const [paraConfirmar, setParaConfirmar] = useState<Despesa | null>(null);
  const [paraExcluir, setParaExcluir] = useState<Despesa | null>(null);
  const [paraConfirmarDemanda, setParaConfirmarDemanda] = useState<Demanda | null>(null);

  // Estados de edição
  const [paraEditar, setParaEditar] = useState<Despesa | null>(null);
  const [editValor, setEditValor] = useState("");
  const [editCategoria, setEditCategoria] = useState<CategoriaDespesa | null>(null);
  const [editObservacao, setEditObservacao] = useState("");
  const [editData, setEditData] = useState("");

  const editValido = Number(editValor.replace(",", ".")) > 0 && editCategoria !== null;

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

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

  useEffect(() => { load(); }, []);

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
    load();
  }

  async function confirmarToggleLancado() {
    if (!paraConfirmar) return;
    const novoStatus = !paraConfirmar.lancado_no_sistema;
    const { error } = await supabase
      .from("despesas")
      .update({ lancado_no_sistema: novoStatus })
      .eq("id", paraConfirmar.id);
    setParaConfirmar(null);
    if (error) return;
    setDespesas((prev) =>
      prev.map((d) =>
        d.id === paraConfirmar.id ? { ...d, lancado_no_sistema: novoStatus } : d,
      ),
    );
  }

  async function confirmarExcluir() {
    if (!paraExcluir) return;
    const { error } = await supabase.from("despesas").delete().eq("id", paraExcluir.id);
    setParaExcluir(null);
    if (error) return;
    setDespesas((prev) => prev.filter((d) => d.id !== paraExcluir.id));
  }

  async function confirmarToggleConcluido() {
    if (!paraConfirmarDemanda) return;
    const novoStatus = !paraConfirmarDemanda.concluido;
    const { error } = await supabase
      .from("demandas")
      .update({ concluido: novoStatus })
      .eq("id", paraConfirmarDemanda.id);
    setParaConfirmarDemanda(null);
    if (error) return;
    setDemandas((prev) =>
      prev.map((d) =>
        d.id === paraConfirmarDemanda.id ? { ...d, concluido: novoStatus } : d,
      ),
    );
  }

  const itens: ItemHistorico[] = useMemo(() => {
    const itensDespesa: ItemHistorico[] = despesas.map((d) => ({
      id: d.id,
      tipo: "despesa",
      createdAt: new Date(d.created_at),
      titulo: formatCurrency(d.valor),
      subtitulo: CATEGORIA_DESPESA_LABEL[d.categoria],
      detalhe: d.observacao ?? undefined,
      status: {
        label: d.lancado_no_sistema ? "Lançado" : "Pendente",
        done: d.lancado_no_sistema,
      },
    }));

    const itensDemanda: ItemHistorico[] = demandas.map((d) => ({
      id: d.id,
      tipo: "demanda",
      createdAt: new Date(d.created_at),
      titulo: d.cliente,
      subtitulo: SERVICO_DEMANDA_LABEL[d.servico],
      detalhe: d.observacao ?? undefined,
      status: {
        label: d.concluido ? "Concluído" : "Em aberto",
        done: d.concluido,
      },
    }));

    return [...itensDespesa, ...itensDemanda].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );
  }, [despesas, demandas]);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return itens.filter((item) => {
      if (filtro !== "todos" && item.tipo !== filtro) return false;
      if (!termo) return true;
      return (
        item.titulo.toLowerCase().includes(termo) ||
        item.subtitulo.toLowerCase().includes(termo) ||
        (item.detalhe?.toLowerCase().includes(termo) ?? false)
      );
    });
  }, [itens, filtro, busca]);

  const grupos = useMemo(() => {
    const map = new Map<string, ItemHistorico[]>();
    for (const item of filtrados) {
      const key = dayKey(item.createdAt);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }
    return Array.from(map.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [filtrados]);

  return (
    <div>
      <Toast message={toast} />
      <PageHeader title="Histórico" subtitle="Despesas e demandas registradas" />

      <div className="space-y-4 px-5">
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar..."
          className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-foreground placeholder:text-muted focus:border-foreground focus:outline-none"
        />

        <div className="flex gap-2">
          {(
            [
              { key: "todos", label: "Todos" },
              { key: "despesa", label: "Despesas" },
              { key: "demanda", label: "Demandas" },
            ] as const
          ).map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFiltro(f.key)}
              className={`rounded-full border px-4 py-2 text-sm font-bold uppercase tracking-wide ${
                filtro === f.key
                  ? "border-foreground bg-surface-2 text-foreground"
                  : "border-border bg-surface text-muted"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {loading && <p className="py-8 text-center text-muted">Carregando...</p>}

        {!loading && grupos.length === 0 && (
          <p className="py-8 text-center text-muted">Nada encontrado.</p>
        )}

        <div className="space-y-6 pb-6">
          {grupos.map(([key, itensDoDia]) => (
            <div key={key}>
              <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">
                {formatDateLabel(itensDoDia[0].createdAt)}
              </h2>
              <ul className="space-y-2">
                {itensDoDia.map((item) => (
                  <li
                    key={`${item.tipo}-${item.id}`}
                    className="rounded-xl border border-border bg-surface px-4 py-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className={`h-2 w-2 shrink-0 rounded-full ${
                              item.tipo === "despesa" ? "bg-despesa" : "bg-demanda"
                            }`}
                          />
                          <p
                            className={`truncate font-bold ${
                              item.tipo === "despesa" ? "font-ticket" : ""
                            }`}
                          >
                            {item.titulo}
                          </p>
                        </div>
                        <p className="mt-0.5 truncate text-sm text-muted">
                          {item.subtitulo}
                          {item.detalhe ? ` · ${item.detalhe}` : ""}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-xs text-muted">{formatTime(item.createdAt)}</p>
                        {item.tipo === "despesa" ? (
                          <>
                            <button
                              type="button"
                              onClick={() =>
                                setParaConfirmar(
                                  despesas.find((d) => d.id === item.id) ?? null,
                                )
                              }
                              className={`mt-1 rounded-full border px-2 py-0.5 text-xs font-bold uppercase ${
                                item.status.done
                                  ? "border-success text-success"
                                  : "border-border text-muted"
                              }`}
                            >
                              {item.status.label}
                            </button>
                            <div className="mt-1 flex justify-end gap-3">
                              <button
                                type="button"
                                onClick={() => {
                                  const d = despesas.find((d) => d.id === item.id);
                                  if (d) abrirEditar(d);
                                }}
                                className="text-xs font-bold uppercase text-foreground"
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setParaExcluir(
                                    despesas.find((d) => d.id === item.id) ?? null,
                                  )
                                }
                                className="text-xs font-bold uppercase text-danger"
                              >
                                Excluir
                              </button>
                            </div>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              setParaConfirmarDemanda(
                                demandas.find((d) => d.id === item.id) ?? null,
                              )
                            }
                            className={`mt-1 rounded-full border px-2 py-0.5 text-xs font-bold uppercase ${
                              item.status.done
                                ? "border-success text-success"
                                : "border-border text-muted"
                            }`}
                          >
                            {item.status.label}
                          </button>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <ConfirmDialog
        open={paraConfirmar !== null}
        title={
          paraConfirmar?.lancado_no_sistema
            ? "Desmarcar lançamento?"
            : "Marcar como lançado?"
        }
        description={
          paraConfirmar?.lancado_no_sistema
            ? "Esta despesa volta a ficar pendente de lançamento no sistema contábil."
            : "Confirma que esta despesa já foi processada no sistema contábil."
        }
        confirmLabel={paraConfirmar?.lancado_no_sistema ? "Sim, desmarcar" : "Sim, lançado"}
        onConfirm={confirmarToggleLancado}
        onCancel={() => setParaConfirmar(null)}
      />

      <ConfirmDialog
        open={paraExcluir !== null}
        title="Excluir despesa?"
        description="Esta ação não pode ser desfeita."
        confirmLabel="Sim, excluir"
        onConfirm={confirmarExcluir}
        onCancel={() => setParaExcluir(null)}
      />

      <ConfirmDialog
        open={paraConfirmarDemanda !== null}
        title={paraConfirmarDemanda?.concluido ? "Reabrir demanda?" : "Marcar como concluído?"}
        description={
          paraConfirmarDemanda?.concluido
            ? "Esta demanda volta a ficar em aberto."
            : "Confirma que esta demanda foi finalizada."
        }
        confirmLabel={paraConfirmarDemanda?.concluido ? "Sim, reabrir" : "Sim, concluído"}
        onConfirm={confirmarToggleConcluido}
        onCancel={() => setParaConfirmarDemanda(null)}
      />

      {/* Overlay de edição */}
      {paraEditar && (
        <div className="fixed inset-0 z-50 flex flex-col bg-background">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h2 className="font-extrabold uppercase tracking-wide">Editar Despesa</h2>
            <button type="button" onClick={() => setParaEditar(null)}
              className="text-xl font-bold text-muted">✕</button>
          </div>

          <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-muted">Valor (R$)</label>
              <input
                inputMode="decimal"
                value={editValor}
                onChange={(e) => setEditValor(e.target.value)}
                className="w-full rounded-xl border border-border bg-surface px-4 py-4 font-ticket text-3xl font-bold text-foreground focus:border-despesa focus:outline-none"
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
              <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-muted">Observação</label>
              <textarea
                value={editObservacao}
                onChange={(e) => setEditObservacao(e.target.value)}
                rows={3}
                className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-foreground focus:border-despesa focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-muted">Data</label>
              <input
                type="date"
                value={editData}
                onChange={(e) => setEditData(e.target.value)}
                className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-foreground focus:border-despesa focus:outline-none"
              />
            </div>
          </div>

          <div className="px-5 py-4">
            <button
              type="button"
              disabled={!editValido}
              onClick={confirmarEditar}
              className="w-full rounded-xl bg-despesa py-4 text-base font-extrabold uppercase tracking-wide text-black disabled:opacity-40"
            >
              Salvar Alteração
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
