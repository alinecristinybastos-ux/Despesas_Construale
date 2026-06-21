"use client";

import { useEffect, useState } from "react";
import PageHeader from "@/components/PageHeader";
import Chip from "@/components/Chip";
import ConfirmDialog from "@/components/ConfirmDialog";
import Toast from "@/components/Toast";
import { supabase } from "@/lib/supabase";
import {
  CATEGORIAS_DESPESA,
  CATEGORIA_DESPESA_LABEL,
  type CategoriaDespesa,
  type Despesa,
} from "@/lib/types";
import { formatCurrency, formatDateLabel, formatTime } from "@/lib/format";

export default function DespesaPage() {
  const [valor, setValor] = useState("");
  const [categoria, setCategoria] = useState<CategoriaDespesa | null>(null);
  const [observacao, setObservacao] = useState("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [recentes, setRecentes] = useState<Despesa[]>([]);
  const [loadingRecentes, setLoadingRecentes] = useState(true);
  const [paraConfirmar, setParaConfirmar] = useState<Despesa | null>(null);

  const valido = Number(valor.replace(",", ".")) > 0 && categoria !== null;

  async function carregarRecentes() {
    setLoadingRecentes(true);
    const { data } = await supabase
      .from("despesas")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);
    setRecentes((data as Despesa[]) ?? []);
    setLoadingRecentes(false);
  }

  useEffect(() => {
    carregarRecentes();
  }, []);

  function resetForm() {
    setValor("");
    setCategoria(null);
    setObservacao("");
  }

  async function salvar() {
    if (!valido || !categoria) return;
    setSaving(true);
    const { error } = await supabase.from("despesas").insert({
      valor: Number(valor.replace(",", ".")),
      categoria,
      observacao: observacao.trim() || null,
      lancado_no_sistema: false,
    });
    setSaving(false);
    if (error) {
      setToast(`Erro ao salvar: ${error.message}`);
      return;
    }
    setToast("Despesa registrada.");
    resetForm();
    carregarRecentes();
    setTimeout(() => setToast(null), 2500);
  }

  async function confirmarToggleLancado() {
    if (!paraConfirmar) return;
    const novoStatus = !paraConfirmar.lancado_no_sistema;
    const { error } = await supabase
      .from("despesas")
      .update({ lancado_no_sistema: novoStatus })
      .eq("id", paraConfirmar.id);
    setParaConfirmar(null);
    if (error) {
      setToast(`Erro ao atualizar: ${error.message}`);
      return;
    }
    setRecentes((prev) =>
      prev.map((d) =>
        d.id === paraConfirmar.id ? { ...d, lancado_no_sistema: novoStatus } : d,
      ),
    );
  }

  return (
    <div>
      <Toast message={toast} />
      <PageHeader
        title="Despesa"
        subtitle="Registre um gasto de campo"
        accent="despesa"
      />

      <div className="space-y-6 px-5">
        <div>
          <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-muted">
            Valor (R$)
          </label>
          <input
            inputMode="decimal"
            placeholder="0,00"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            className="w-full rounded-xl border border-border bg-surface px-4 py-4 font-ticket text-3xl font-bold text-foreground placeholder:text-muted focus:border-despesa focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-muted">
            Categoria
          </label>
          <div className="flex flex-wrap gap-2">
            {CATEGORIAS_DESPESA.map((cat) => (
              <Chip
                key={cat}
                label={CATEGORIA_DESPESA_LABEL[cat]}
                selected={categoria === cat}
                onClick={() => setCategoria(cat)}
                accent="despesa"
              />
            ))}
          </div>
        </div>

        <div>
          <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-muted">
            Observação (opcional)
          </label>
          <textarea
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            rows={3}
            placeholder="Detalhes adicionais..."
            className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-foreground placeholder:text-muted focus:border-despesa focus:outline-none"
          />
        </div>

        <div className="pb-6">
          <button
            type="button"
            disabled={!valido || saving}
            onClick={() => salvar()}
            className="w-full rounded-xl bg-despesa py-4 text-base font-extrabold uppercase tracking-wide text-black disabled:opacity-40"
          >
            Salvar Despesa
          </button>
        </div>

        <div>
          <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">
            Despesas recentes
          </h2>
          {loadingRecentes ? (
            <p className="py-4 text-center text-sm text-muted">Carregando...</p>
          ) : recentes.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted">
              Nenhuma despesa registrada ainda.
            </p>
          ) : (
            <ul className="space-y-2 pb-6">
              {recentes.map((d) => (
                <li
                  key={d.id}
                  className="rounded-xl border border-border bg-surface px-4 py-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-ticket font-bold">
                        {formatCurrency(d.valor)}
                      </p>
                      <p className="mt-0.5 truncate text-sm text-muted">
                        {CATEGORIA_DESPESA_LABEL[d.categoria]}
                        {d.observacao ? ` · ${d.observacao}` : ""}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-xs text-muted">
                        {formatDateLabel(new Date(d.created_at))} ·{" "}
                        {formatTime(new Date(d.created_at))}
                      </p>
                      <button
                        type="button"
                        onClick={() => setParaConfirmar(d)}
                        className={`mt-1 rounded-full border px-2 py-0.5 text-xs font-bold uppercase ${
                          d.lancado_no_sistema
                            ? "border-success text-success"
                            : "border-border text-muted"
                        }`}
                      >
                        {d.lancado_no_sistema ? "Lançado" : "Pendente"}
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
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
    </div>
  );
}
