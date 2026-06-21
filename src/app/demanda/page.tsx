"use client";

import { useState } from "react";
import PageHeader from "@/components/PageHeader";
import Chip from "@/components/Chip";
import Toast from "@/components/Toast";
import { supabase } from "@/lib/supabase";
import {
  SERVICOS_DEMANDA,
  SERVICO_DEMANDA_LABEL,
  type ServicoDemanda,
} from "@/lib/types";

export default function DemandaPage() {
  const [cliente, setCliente] = useState("");
  const [servico, setServico] = useState<ServicoDemanda | null>(null);
  const [contato, setContato] = useState("");
  const [observacao, setObservacao] = useState("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const valido = cliente.trim().length > 0 && servico !== null;

  function resetForm() {
    setCliente("");
    setServico(null);
    setContato("");
    setObservacao("");
  }

  async function salvar(concluido: boolean) {
    if (!valido || !servico) return;
    setSaving(true);
    const { error } = await supabase.from("demandas").insert({
      cliente: cliente.trim(),
      servico,
      contato: contato.trim() || null,
      observacao: observacao.trim() || null,
      concluido,
    });
    setSaving(false);
    if (error) {
      setToast("Erro ao salvar. Tente novamente.");
      return;
    }
    setToast(concluido ? "Demanda registrada e concluída." : "Demanda registrada.");
    resetForm();
    setTimeout(() => setToast(null), 2500);
  }

  return (
    <div>
      <Toast message={toast} />
      <PageHeader
        title="Demanda"
        subtitle="Registre um atendimento de campo"
        accent="demanda"
      />

      <div className="space-y-6 px-5">
        <div>
          <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-muted">
            Cliente
          </label>
          <input
            value={cliente}
            onChange={(e) => setCliente(e.target.value)}
            placeholder="Nome do cliente"
            className="w-full rounded-xl border border-border bg-surface px-4 py-4 text-lg font-bold text-foreground placeholder:text-muted focus:border-demanda focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-muted">
            Serviço
          </label>
          <div className="flex flex-wrap gap-2">
            {SERVICOS_DEMANDA.map((s) => (
              <Chip
                key={s}
                label={SERVICO_DEMANDA_LABEL[s]}
                selected={servico === s}
                onClick={() => setServico(s)}
                accent="demanda"
              />
            ))}
          </div>
        </div>

        <div>
          <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-muted">
            Contato (opcional)
          </label>
          <input
            value={contato}
            onChange={(e) => setContato(e.target.value)}
            placeholder="Telefone ou e-mail"
            className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-foreground placeholder:text-muted focus:border-demanda focus:outline-none"
          />
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
            className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-foreground placeholder:text-muted focus:border-demanda focus:outline-none"
          />
        </div>

        <div className="space-y-3 pb-6">
          <button
            type="button"
            disabled={!valido || saving}
            onClick={() => salvar(true)}
            className="w-full rounded-xl bg-success py-4 text-base font-extrabold uppercase tracking-wide text-black disabled:opacity-40"
          >
            Concluído
          </button>
          <button
            type="button"
            disabled={!valido || saving}
            onClick={() => salvar(false)}
            className="w-full rounded-xl bg-demanda py-4 text-base font-extrabold uppercase tracking-wide text-black disabled:opacity-40"
          >
            Salvar Demanda
          </button>
        </div>
      </div>
    </div>
  );
}
