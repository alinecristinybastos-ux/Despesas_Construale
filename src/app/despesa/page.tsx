"use client";

import { useState } from "react";
import PageHeader from "@/components/PageHeader";
import Chip from "@/components/Chip";
import ConfirmDialog from "@/components/ConfirmDialog";
import Toast from "@/components/Toast";
import { supabase } from "@/lib/supabase";
import {
  CATEGORIAS_DESPESA,
  CATEGORIA_DESPESA_LABEL,
  type CategoriaDespesa,
} from "@/lib/types";

export default function DespesaPage() {
  const [valor, setValor] = useState("");
  const [categoria, setCategoria] = useState<CategoriaDespesa | null>(null);
  const [observacao, setObservacao] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const valido = Number(valor.replace(",", ".")) > 0 && categoria !== null;

  function resetForm() {
    setValor("");
    setCategoria(null);
    setObservacao("");
  }

  async function salvar(lancadoFinal: boolean) {
    if (!valido || !categoria) return;
    setSaving(true);
    const { error } = await supabase.from("despesas").insert({
      valor: Number(valor.replace(",", ".")),
      categoria,
      observacao: observacao.trim() || null,
      lancado_no_sistema: lancadoFinal,
    });
    setSaving(false);
    if (error) {
      setToast("Erro ao salvar. Tente novamente.");
      return;
    }
    setToast("Despesa registrada.");
    resetForm();
    setTimeout(() => setToast(null), 2500);
  }

  function onLancadoClick() {
    if (!valido) return;
    setConfirmOpen(true);
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

        <div className="space-y-3 pb-6">
          <button
            type="button"
            disabled={!valido || saving}
            onClick={onLancadoClick}
            className="w-full rounded-xl bg-success py-4 text-base font-extrabold uppercase tracking-wide text-black disabled:opacity-40"
          >
            Lançado no Sistema
          </button>
          <button
            type="button"
            disabled={!valido || saving}
            onClick={() => salvar(false)}
            className="w-full rounded-xl bg-despesa py-4 text-base font-extrabold uppercase tracking-wide text-black disabled:opacity-40"
          >
            Salvar Despesa
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Marcar como lançado?"
        description="Confirma que esta despesa já foi processada no sistema contábil."
        confirmLabel="Sim, lançado"
        onConfirm={() => {
          setConfirmOpen(false);
          salvar(true);
        }}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
