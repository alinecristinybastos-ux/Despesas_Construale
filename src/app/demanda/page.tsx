"use client";

import { useEffect, useState } from "react";
import PageHeader from "@/components/PageHeader";
import Chip from "@/components/Chip";
import ConfirmDialog from "@/components/ConfirmDialog";
import Toast from "@/components/Toast";
import { supabase } from "@/lib/supabase";
import {
  SERVICOS_DEMANDA,
  SERVICO_DEMANDA_LABEL,
  type ServicoDemanda,
  type Demanda,
} from "@/lib/types";
import { formatDateLabel, formatTime } from "@/lib/format";

export default function DemandaPage() {
  const [cliente, setCliente] = useState("");
  const [servico, setServico] = useState<ServicoDemanda | null>(null);
  const [contato, setContato] = useState("");
  const [observacao, setObservacao] = useState("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [recentes, setRecentes] = useState<Demanda[]>([]);
  const [loadingRecentes, setLoadingRecentes] = useState(true);
  const [paraConfirmar, setParaConfirmar] = useState<Demanda | null>(null);

  const valido = cliente.trim().length > 0 && servico !== null;

  async function carregarRecentes() {
    setLoadingRecentes(true);
    const { data } = await supabase
      .from("demandas")
      .select("*")
      .eq("concluido", false)
      .order("created_at", { ascending: false })
      .limit(20);
    setRecentes((data as Demanda[]) ?? []);
    setLoadingRecentes(false);
  }

  useEffect(() => {
    carregarRecentes();
  }, []);

  function resetForm() {
    setCliente("");
    setServico(null);
    setContato("");
    setObservacao("");
  }

  async function salvar() {
    if (!valido || !servico) return;
    setSaving(true);
    const { error } = await supabase.from("demandas").insert({
      cliente: cliente.trim(),
      servico,
      contato: contato.trim() || null,
      observacao: observacao.trim() || null,
      concluido: false,
    });
    setSaving(false);
    if (error) {
      setToast(`Erro ao salvar: ${error.message}`);
      return;
    }
    setToast("Demanda registrada.");
    resetForm();
    carregarRecentes();
    setTimeout(() => setToast(null), 2500);
  }

  async function confirmarConcluir() {
    if (!paraConfirmar) return;
    const { error } = await supabase
      .from("demandas")
      .update({ concluido: true })
      .eq("id", paraConfirmar.id);
    setParaConfirmar(null);
    if (error) {
      setToast(`Erro ao atualizar: ${error.message}`);
      return;
    }
    setRecentes((prev) => prev.filter((d) => d.id !== paraConfirmar.id));
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

        <div className="pb-6">
          <button
            type="button"
            disabled={!valido || saving}
            onClick={() => salvar()}
            className="w-full rounded-xl bg-demanda py-4 text-base font-extrabold uppercase tracking-wide text-black disabled:opacity-40"
          >
            Salvar Demanda
          </button>
        </div>

        <div>
          <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">
            Demandas recentes
          </h2>
          {loadingRecentes ? (
            <p className="py-4 text-center text-sm text-muted">Carregando...</p>
          ) : recentes.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted">
              Nenhuma demanda registrada ainda.
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
                      <p className="truncate font-bold">{d.cliente}</p>
                      <p className="mt-0.5 truncate text-sm text-muted">
                        {SERVICO_DEMANDA_LABEL[d.servico]}
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
                        className="mt-1 rounded-full border border-border px-2 py-0.5 text-xs font-bold uppercase text-muted"
                      >
                        Em aberto
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
        title="Marcar como concluído?"
        description="Confirma que esta demanda foi finalizada. Ela saíra desta aba e passará a aparecer apenas no Histórico."
        confirmLabel="Sim, concluído"
        onConfirm={confirmarConcluir}
        onCancel={() => setParaConfirmar(null)}
      />
    </div>
  );
}
