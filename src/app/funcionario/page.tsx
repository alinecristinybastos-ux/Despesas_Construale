"use client";

import { useEffect, useState } from "react";
import PageHeader from "@/components/PageHeader";
import ConfirmDialog from "@/components/ConfirmDialog";
import AmountDialog from "@/components/AmountDialog";
import DateDialog from "@/components/DateDialog";
import Toast from "@/components/Toast";
import { supabase } from "@/lib/supabase";
import type { Funcionario, PagamentoFuncionario, FaltaFuncionario } from "@/lib/types";
import { formatCurrency, formatDateOnly, isSameMonth } from "@/lib/format";

export default function FuncionarioPage() {
  const [nome, setNome] = useState("");
  const [dataEntrada, setDataEntrada] = useState("");
  const [salario, setSalario] = useState("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [pagamentos, setPagamentos] = useState<PagamentoFuncionario[]>([]);
  const [faltas, setFaltas] = useState<FaltaFuncionario[]>([]);
  const [loading, setLoading] = useState(true);

  const [expandidoId, setExpandidoId] = useState<string | null>(null);

  const [paraPagamento, setParaPagamento] = useState<Funcionario | null>(null);
  const [valorPagamento, setValorPagamento] = useState("");
  const [paraFalta, setParaFalta] = useState<Funcionario | null>(null);

  const [paraEditarPagamento, setParaEditarPagamento] = useState<PagamentoFuncionario | null>(null);
  const [valorEditado, setValorEditado] = useState("");
  const [paraExcluirPagamento, setParaExcluirPagamento] = useState<PagamentoFuncionario | null>(null);

  const [paraEditarFalta, setParaEditarFalta] = useState<FaltaFuncionario | null>(null);
  const [dataEditada, setDataEditada] = useState("");
  const [paraExcluirFalta, setParaExcluirFalta] = useState<FaltaFuncionario | null>(null);

  const valido = nome.trim().length > 0 && dataEntrada !== "" && Number(salario.replace(",", ".")) > 0;

  async function carregarTudo() {
    setLoading(true);
    const [f, p, fa] = await Promise.all([
      supabase.from("funcionarios").select("*").order("nome", { ascending: true }),
      supabase.from("pagamentos_funcionario").select("*").order("created_at", { ascending: false }),
      supabase.from("faltas_funcionario").select("*").order("created_at", { ascending: false }),
    ]);
    setFuncionarios((f.data as Funcionario[]) ?? []);
    setPagamentos((p.data as PagamentoFuncionario[]) ?? []);
    setFaltas((fa.data as FaltaFuncionario[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    carregarTudo();
  }, []);

  function resetForm() {
    setNome("");
    setDataEntrada("");
    setSalario("");
  }

  async function salvarFuncionario() {
    if (!valido) return;
    setSaving(true);
    const { error } = await supabase.from("funcionarios").insert({
      nome: nome.trim(),
      data_entrada: dataEntrada,
      valor_salario: Number(salario.replace(",", ".")),
    });
    setSaving(false);
    if (error) {
      setToast(`Erro ao salvar: ${error.message}`);
      return;
    }
    setToast("Funcionário registrado.");
    resetForm();
    carregarTudo();
    setTimeout(() => setToast(null), 2500);
  }

  async function confirmarPagamento() {
    if (!paraPagamento) return;
    const valor = Number(valorPagamento.replace(",", "."));
    if (!(valor > 0)) return;
    const { error } = await supabase.from("pagamentos_funcionario").insert({
      funcionario_id: paraPagamento.id,
      valor,
    });
    setParaPagamento(null);
    setValorPagamento("");
    if (error) {
      setToast(`Erro ao registrar pagamento: ${error.message}`);
      return;
    }
    setToast("Pagamento registrado.");
    carregarTudo();
    setTimeout(() => setToast(null), 2500);
  }

  async function confirmarFalta() {
    if (!paraFalta) return;
    const { error } = await supabase.from("faltas_funcionario").insert({
      funcionario_id: paraFalta.id,
    });
    setParaFalta(null);
    if (error) {
      setToast(`Erro ao registrar falta: ${error.message}`);
      return;
    }
    setToast("Falta registrada.");
    carregarTudo();
    setTimeout(() => setToast(null), 2500);
  }

  async function confirmarEditarPagamento() {
    if (!paraEditarPagamento) return;
    const valor = Number(valorEditado.replace(",", "."));
    if (!(valor > 0)) return;
    const { error } = await supabase
      .from("pagamentos_funcionario")
      .update({ valor })
      .eq("id", paraEditarPagamento.id);
    setParaEditarPagamento(null);
    setValorEditado("");
    if (error) {
      setToast(`Erro ao editar pagamento: ${error.message}`);
      return;
    }
    setToast("Pagamento atualizado.");
    carregarTudo();
    setTimeout(() => setToast(null), 2500);
  }

  async function confirmarExcluirPagamento() {
    if (!paraExcluirPagamento) return;
    const { error } = await supabase
      .from("pagamentos_funcionario")
      .delete()
      .eq("id", paraExcluirPagamento.id);
    setParaExcluirPagamento(null);
    if (error) {
      setToast(`Erro ao excluir pagamento: ${error.message}`);
      return;
    }
    setToast("Pagamento excluído.");
    carregarTudo();
    setTimeout(() => setToast(null), 2500);
  }

  async function confirmarEditarFalta() {
    if (!paraEditarFalta || dataEditada === "") return;
    const { error } = await supabase
      .from("faltas_funcionario")
      .update({ created_at: new Date(`${dataEditada}T12:00:00`).toISOString() })
      .eq("id", paraEditarFalta.id);
    setParaEditarFalta(null);
    setDataEditada("");
    if (error) {
      setToast(`Erro ao editar falta: ${error.message}`);
      return;
    }
    setToast("Falta atualizada.");
    carregarTudo();
    setTimeout(() => setToast(null), 2500);
  }

  async function confirmarExcluirFalta() {
    if (!paraExcluirFalta) return;
    const { error } = await supabase
      .from("faltas_funcionario")
      .delete()
      .eq("id", paraExcluirFalta.id);
    setParaExcluirFalta(null);
    if (error) {
      setToast(`Erro ao excluir falta: ${error.message}`);
      return;
    }
    setToast("Falta excluída.");
    carregarTudo();
    setTimeout(() => setToast(null), 2500);
  }

  const hoje = new Date();

  return (
    <div>
      <Toast message={toast} />
      <PageHeader
        title="Funcionários"
        subtitle="Equipe, pagamentos e faltas"
        accent="demanda"
      />

      <div className="space-y-6 px-5">
        <div>
          <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-muted">
            Nome
          </label>
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Nome do funcionário"
            className="w-full rounded-xl border border-border bg-surface px-4 py-4 text-lg font-bold text-foreground placeholder:text-muted focus:border-demanda focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-muted">
            Data de entrada
          </label>
          <input
            type="date"
            value={dataEntrada}
            onChange={(e) => setDataEntrada(e.target.value)}
            className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-foreground focus:border-demanda focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-muted">
            Valor do salário (R$)
          </label>
          <input
            inputMode="decimal"
            placeholder="0,00"
            value={salario}
            onChange={(e) => setSalario(e.target.value)}
            className="w-full rounded-xl border border-border bg-surface px-4 py-4 font-ticket text-3xl font-bold text-foreground placeholder:text-muted focus:border-demanda focus:outline-none"
          />
        </div>

        <div className="pb-2">
          <button
            type="button"
            disabled={!valido || saving}
            onClick={() => salvarFuncionario()}
            className="w-full rounded-xl bg-demanda py-4 text-base font-extrabold uppercase tracking-wide text-black disabled:opacity-40"
          >
            Salvar Funcionário
          </button>
        </div>

        <div>
          <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">
            Equipe
          </h2>
          {loading ? (
            <p className="py-4 text-center text-sm text-muted">Carregando...</p>
          ) : funcionarios.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted">
              Nenhum funcionário registrado ainda.
            </p>
          ) : (
            <ul className="space-y-3 pb-6">
              {funcionarios.map((f) => {
                const pagamentosMes = pagamentos.filter(
                  (p) => p.funcionario_id === f.id && isSameMonth(p.created_at, hoje),
                );
                const totalPagoMes = pagamentosMes.reduce((acc, p) => acc + p.valor, 0);
                const saldo = f.valor_salario - totalPagoMes;
                const faltasMes = faltas.filter(
                  (fa) => fa.funcionario_id === f.id && isSameMonth(fa.created_at, hoje),
                );
                const expandido = expandidoId === f.id;

                return (
                  <li
                    key={f.id}
                    className="rounded-xl border border-border bg-surface px-4 py-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-bold">{f.nome}</p>
                        <p className="mt-0.5 text-sm text-muted">
                          Desde {formatDateOnly(f.data_entrada)} ·{" "}
                          {formatCurrency(f.valor_salario)}/mês
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-xs text-muted">Saldo do mês</p>
                        <p className="font-ticket text-lg font-bold text-despesa">
                          {formatCurrency(saldo)}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setExpandidoId(expandido ? null : f.id)}
                      className="mt-2 text-xs font-bold uppercase text-muted underline"
                    >
                      {faltasMes.length} {faltasMes.length === 1 ? "falta" : "faltas"} no
                      mês · {expandido ? "ocultar lançamentos" : "ver lançamentos"}
                    </button>

                    {expandido && (
                      <div className="mt-3 space-y-3 border-t border-border pt-3">
                        <div>
                          <p className="mb-1 text-xs font-bold uppercase text-muted">
                            Pagamentos do mês
                          </p>
                          {pagamentosMes.length === 0 ? (
                            <p className="text-xs text-muted">Nenhum pagamento no mês.</p>
                          ) : (
                            <ul className="space-y-1">
                              {pagamentosMes.map((p) => (
                                <li
                                  key={p.id}
                                  className="flex items-center justify-between gap-2 rounded-lg bg-surface-2 px-3 py-2"
                                >
                                  <div className="min-w-0">
                                    <p className="font-ticket text-sm font-bold">
                                      {formatCurrency(p.valor)}
                                    </p>
                                    <p className="text-xs text-muted">
                                      {formatDateOnly(p.created_at.slice(0, 10))}
                                    </p>
                                  </div>
                                  <div className="flex shrink-0 gap-3">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setParaEditarPagamento(p);
                                        setValorEditado(String(p.valor).replace(".", ","));
                                      }}
                                      className="text-xs font-bold uppercase text-foreground"
                                    >
                                      Editar
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setParaExcluirPagamento(p)}
                                      className="text-xs font-bold uppercase text-danger"
                                    >
                                      Excluir
                                    </button>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>

                        <div>
                          <p className="mb-1 text-xs font-bold uppercase text-muted">
                            Faltas do mês
                          </p>
                          {faltasMes.length === 0 ? (
                            <p className="text-xs text-muted">Nenhuma falta no mês.</p>
                          ) : (
                            <ul className="space-y-1">
                              {faltasMes.map((fa) => (
                                <li
                                  key={fa.id}
                                  className="flex items-center justify-between gap-2 rounded-lg bg-surface-2 px-3 py-2"
                                >
                                  <p className="text-sm">
                                    {formatDateOnly(fa.created_at.slice(0, 10))}
                                  </p>
                                  <div className="flex shrink-0 gap-3">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setParaEditarFalta(fa);
                                        setDataEditada(fa.created_at.slice(0, 10));
                                      }}
                                      className="text-xs font-bold uppercase text-foreground"
                                    >
                                      Editar
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setParaExcluirFalta(fa)}
                                      className="text-xs font-bold uppercase text-danger"
                                    >
                                      Excluir
                                    </button>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={() => setParaPagamento(f)}
                        className="flex-1 rounded-xl border border-success py-2 text-xs font-bold uppercase text-success"
                      >
                        Pagamento
                      </button>
                      <button
                        type="button"
                        onClick={() => setParaFalta(f)}
                        className="flex-1 rounded-xl border border-danger py-2 text-xs font-bold uppercase text-danger"
                      >
                        Falta
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <AmountDialog
        open={paraPagamento !== null}
        title="Registrar pagamento"
        description={paraPagamento ? `Pagamento para ${paraPagamento.nome}.` : undefined}
        value={valorPagamento}
        onValueChange={setValorPagamento}
        confirmLabel="Salvar pagamento"
        onConfirm={confirmarPagamento}
        onCancel={() => {
          setParaPagamento(null);
          setValorPagamento("");
        }}
      />

      <ConfirmDialog
        open={paraFalta !== null}
        title="Registrar falta?"
        description={
          paraFalta ? `Confirma uma falta de ${paraFalta.nome} hoje.` : undefined
        }
        confirmLabel="Sim, registrar"
        onConfirm={confirmarFalta}
        onCancel={() => setParaFalta(null)}
      />

      <AmountDialog
        open={paraEditarPagamento !== null}
        title="Editar pagamento"
        description="Ajuste o valor deste pagamento."
        value={valorEditado}
        onValueChange={setValorEditado}
        confirmLabel="Salvar alteração"
        onConfirm={confirmarEditarPagamento}
        onCancel={() => {
          setParaEditarPagamento(null);
          setValorEditado("");
        }}
      />

      <ConfirmDialog
        open={paraExcluirPagamento !== null}
        title="Excluir pagamento?"
        description="Esta ação não pode ser desfeita."
        confirmLabel="Sim, excluir"
        onConfirm={confirmarExcluirPagamento}
        onCancel={() => setParaExcluirPagamento(null)}
      />

      <DateDialog
        open={paraEditarFalta !== null}
        title="Editar falta"
        description="Ajuste a data desta falta."
        value={dataEditada}
        onValueChange={setDataEditada}
        confirmLabel="Salvar alteração"
        onConfirm={confirmarEditarFalta}
        onCancel={() => {
          setParaEditarFalta(null);
          setDataEditada("");
        }}
      />

      <ConfirmDialog
        open={paraExcluirFalta !== null}
        title="Excluir falta?"
        description="Esta ação não pode ser desfeita."
        confirmLabel="Sim, excluir"
        onConfirm={confirmarExcluirFalta}
        onCancel={() => setParaExcluirFalta(null)}
      />
    </div>
  );
}
