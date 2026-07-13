"use client";

import { useEffect, useState } from "react";
import PageHeader from "@/components/PageHeader";
import ConfirmDialog from "@/components/ConfirmDialog";
import AmountDialog from "@/components/AmountDialog";
import DateDialog from "@/components/DateDialog";
import Toast from "@/components/Toast";
import { supabase } from "@/lib/supabase";
import type { Funcionario, PagamentoFuncionario, FaltaFuncionario, HoraExtra } from "@/lib/types";
import { formatCurrency, formatDateOnly, isSameMonth } from "@/lib/format";

function mesLabel(ano: number, mes: number) {
  return new Date(ano, mes, 1).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
}

function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function FuncionarioPage() {
  const hoje = new Date();
  const [anoSel, setAnoSel] = useState(hoje.getFullYear());
  const [mesSel, setMesSel] = useState(hoje.getMonth());

  const [nome, setNome] = useState("");
  const [dataEntrada, setDataEntrada] = useState("");
  const [salario, setSalario] = useState("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [pagamentos, setPagamentos] = useState<PagamentoFuncionario[]>([]);
  const [faltas, setFaltas] = useState<FaltaFuncionario[]>([]);
  const [horasExtras, setHorasExtras] = useState<HoraExtra[]>([]);
  const [loading, setLoading] = useState(true);

  const [expandidoId, setExpandidoId] = useState<string | null>(null);

  // Pagamentos
  const [paraPagamento, setParaPagamento] = useState<{ func: Funcionario; quinzena: 1 | 2 } | null>(null);
  const [valorPagamento, setValorPagamento] = useState("");
  const [paraEditarPagamento, setParaEditarPagamento] = useState<PagamentoFuncionario | null>(null);
  const [valorEditado, setValorEditado] = useState("");
  const [paraExcluirPagamento, setParaExcluirPagamento] = useState<PagamentoFuncionario | null>(null);
  const [paraEditarDataPagamento, setParaEditarDataPagamento] = useState<PagamentoFuncionario | null>(null);
  const [dataEditadaPagamento, setDataEditadaPagamento] = useState("");

  // Faltas
  const [paraFalta, setParaFalta] = useState<Funcionario | null>(null);
  const [paraEditarFalta, setParaEditarFalta] = useState<FaltaFuncionario | null>(null);
  const [dataEditada, setDataEditada] = useState("");
  const [paraExcluirFalta, setParaExcluirFalta] = useState<FaltaFuncionario | null>(null);

  // Vale
  const [paraVale, setParaVale] = useState<Funcionario | null>(null);
  const [valorVale, setValorVale] = useState("");

  // Horas Extras (overlay unificado para criar e editar)
  const [heOverlay, setHeOverlay] = useState<{ func: Funcionario; editando: HoraExtra | null } | null>(null);
  const [heValor, setHeValor] = useState("");
  const [heData, setHeData] = useState(hojeISO());
  const [heObs, setHeObs] = useState("");
  const [paraExcluirHe, setParaExcluirHe] = useState<HoraExtra | null>(null);

  const valido = nome.trim().length > 0 && dataEntrada !== "" && Number(salario.replace(",", ".")) > 0;
  const heValido = Number(heValor.replace(",", ".")) > 0 && heData !== "";

  function refMes() { return new Date(anoSel, mesSel, 1); }

  function navMes(delta: number) {
    let m = mesSel + delta;
    let a = anoSel;
    if (m < 0) { m = 11; a--; }
    if (m > 11) { m = 0; a++; }
    setMesSel(m); setAnoSel(a);
  }

  async function carregarTudo() {
    setLoading(true);
    const [f, p, fa, he] = await Promise.all([
      supabase.from("funcionarios").select("*").order("nome", { ascending: true }),
      supabase.from("pagamentos_funcionario").select("*").order("created_at", { ascending: false }),
      supabase.from("faltas_funcionario").select("*").order("created_at", { ascending: false }),
      supabase.from("horas_extras_funcionario").select("*").order("data", { ascending: false }),
    ]);
    setFuncionarios((f.data as Funcionario[]) ?? []);
    setPagamentos((p.data as PagamentoFuncionario[]) ?? []);
    setFaltas((fa.data as FaltaFuncionario[]) ?? []);
    setHorasExtras((he.data as HoraExtra[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { carregarTudo(); }, []);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  function resetForm() { setNome(""); setDataEntrada(""); setSalario(""); }

  function abrirHeOverlay(func: Funcionario, editando: HoraExtra | null) {
    setHeOverlay({ func, editando });
    setHeValor(editando ? String(editando.valor).replace(".", ",") : "");
    setHeData(editando ? editando.data : hojeISO());
    setHeObs(editando ? (editando.observacao ?? "") : "");
  }

  function fecharHeOverlay() {
    setHeOverlay(null);
    setHeValor(""); setHeData(hojeISO()); setHeObs("");
  }

  async function salvarFuncionario() {
    if (!valido) return;
    setSaving(true);
    const { error } = await supabase.from("funcionarios").insert({
      nome: nome.trim(), data_entrada: dataEntrada,
      valor_salario: Number(salario.replace(",", ".")),
    });
    setSaving(false);
    if (error) { showToast(`Erro: ${error.message}`); return; }
    showToast("Funcionário registrado."); resetForm(); carregarTudo();
  }

  async function confirmarPagamento() {
    if (!paraPagamento) return;
    const valor = Number(valorPagamento.replace(",", "."));
    if (!(valor > 0)) return;
    const { error } = await supabase.from("pagamentos_funcionario").insert({
      funcionario_id: paraPagamento.func.id, valor, quinzena: paraPagamento.quinzena,
    });
    setParaPagamento(null); setValorPagamento("");
    if (error) { showToast(`Erro: ${error.message}`); return; }
    showToast("Pagamento registrado."); carregarTudo();
  }

  async function confirmarVale() {
    if (!paraVale) return;
    const valor = Number(valorVale.replace(",", "."));
    if (!(valor > 0)) return;
    const { error } = await supabase.from("pagamentos_funcionario").insert({
      funcionario_id: paraVale.id, valor, quinzena: null,
    });
    setParaVale(null); setValorVale("");
    if (error) { showToast(`Erro: ${error.message}`); return; }
    showToast("Vale registrado."); carregarTudo();
  }

  async function confirmarFalta() {
    if (!paraFalta) return;
    const { error } = await supabase.from("faltas_funcionario").insert({ funcionario_id: paraFalta.id });
    setParaFalta(null);
    if (error) { showToast(`Erro: ${error.message}`); return; }
    showToast("Falta registrada."); carregarTudo();
  }

  async function confirmarHoraExtra() {
    if (!heOverlay || !heValido) return;
    const valor = Number(heValor.replace(",", "."));
    const { editando, func } = heOverlay;
    let error;
    if (editando) {
      ({ error } = await supabase.from("horas_extras_funcionario")
        .update({ valor, data: heData, observacao: heObs.trim() || null })
        .eq("id", editando.id));
    } else {
      ({ error } = await supabase.from("horas_extras_funcionario").insert({
        funcionario_id: func.id, valor, data: heData, observacao: heObs.trim() || null,
      }));
    }
    fecharHeOverlay();
    if (error) { showToast(`Erro: ${error.message}`); return; }
    showToast(editando ? "Horas extras atualizadas." : "Horas extras registradas.");
    carregarTudo();
  }

  async function confirmarExcluirHe() {
    if (!paraExcluirHe) return;
    const { error } = await supabase.from("horas_extras_funcionario").delete().eq("id", paraExcluirHe.id);
    setParaExcluirHe(null);
    if (error) { showToast(`Erro: ${error.message}`); return; }
    showToast("Horas extras excluídas."); carregarTudo();
  }

  async function confirmarEditarPagamento() {
    if (!paraEditarPagamento) return;
    const valor = Number(valorEditado.replace(",", "."));
    if (!(valor > 0)) return;
    const { error } = await supabase.from("pagamentos_funcionario").update({ valor }).eq("id", paraEditarPagamento.id);
    setParaEditarPagamento(null); setValorEditado("");
    if (error) { showToast(`Erro: ${error.message}`); return; }
    showToast("Pagamento atualizado."); carregarTudo();
  }

  async function confirmarExcluirPagamento() {
    if (!paraExcluirPagamento) return;
    const { error } = await supabase.from("pagamentos_funcionario").delete().eq("id", paraExcluirPagamento.id);
    setParaExcluirPagamento(null);
    if (error) { showToast(`Erro: ${error.message}`); return; }
    showToast("Pagamento excluído."); carregarTudo();
  }

  async function confirmarEditarDataPagamento() {
    if (!paraEditarDataPagamento || dataEditadaPagamento === "") return;
    const { error } = await supabase.from("pagamentos_funcionario")
      .update({ created_at: new Date(`${dataEditadaPagamento}T12:00:00`).toISOString() })
      .eq("id", paraEditarDataPagamento.id);
    setParaEditarDataPagamento(null); setDataEditadaPagamento("");
    if (error) { showToast(`Erro: ${error.message}`); return; }
    showToast("Data atualizada."); carregarTudo();
  }

  async function confirmarEditarFalta() {
    if (!paraEditarFalta || dataEditada === "") return;
    const { error } = await supabase.from("faltas_funcionario")
      .update({ created_at: new Date(`${dataEditada}T12:00:00`).toISOString() })
      .eq("id", paraEditarFalta.id);
    setParaEditarFalta(null); setDataEditada("");
    if (error) { showToast(`Erro: ${error.message}`); return; }
    showToast("Falta atualizada."); carregarTudo();
  }

  async function confirmarExcluirFalta() {
    if (!paraExcluirFalta) return;
    const { error } = await supabase.from("faltas_funcionario").delete().eq("id", paraExcluirFalta.id);
    setParaExcluirFalta(null);
    if (error) { showToast(`Erro: ${error.message}`); return; }
    showToast("Falta excluída."); carregarTudo();
  }

  function dadosMes(f: Funcionario) {
    const ref = refMes();
    const pagsMes = pagamentos.filter((p) => p.funcionario_id === f.id && isSameMonth(p.created_at, ref));
    const pagsQ1 = pagsMes.filter((p) => p.quinzena === 1);
    const pagsQ2 = pagsMes.filter((p) => p.quinzena === 2);
    const vales = pagsMes.filter((p) => p.quinzena === null);
    const faltasMes = faltas.filter((fa) => fa.funcionario_id === f.id && isSameMonth(fa.created_at, ref));
    const hesMes = horasExtras.filter((he) => {
      const [y, m] = he.data.split("-");
      return Number(y) === anoSel && Number(m) - 1 === mesSel && he.funcionario_id === f.id;
    });
    const metaQ = f.valor_salario / 2;
    const pagoQ1 = pagsQ1.reduce((acc, p) => acc + p.valor, 0);
    const pagoQ2 = pagsQ2.reduce((acc, p) => acc + p.valor, 0);
    const saldoQ1 = Math.max(0, metaQ - pagoQ1);
    const saldoQ2 = Math.max(0, metaQ - pagoQ2);
    const totalPago = pagsMes.reduce((acc, p) => acc + p.valor, 0);
    const saldoMes = f.valor_salario - totalPago;
    const totalHe = hesMes.reduce((acc, he) => acc + he.valor, 0);
    return { pagsQ1, pagsQ2, vales, faltasMes, hesMes, metaQ, pagoQ1, pagoQ2, saldoQ1, saldoQ2, totalPago, saldoMes, totalHe };
  }

  const totalFolha = funcionarios.reduce((acc, f) => acc + dadosMes(f).saldoMes, 0);

  const nomeMes = new Date(anoSel, mesSel, 1)
    .toLocaleDateString("pt-BR", { month: "long" })
    .replace(/^\w/, (c) => c.toUpperCase());

  return (
    <div>
      <Toast message={toast} />
      <PageHeader title="Equipe" subtitle="Folha de pagamento e faltas" accent="demanda" />

      <div className="space-y-5 px-5 pb-10">

        {/* Cadastro */}
        <div className="space-y-4 rounded-xl border border-border bg-surface px-4 py-4">
          <h2 className="text-xs font-extrabold uppercase tracking-wide text-muted">Novo funcionário</h2>
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-muted">Nome</label>
            <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome do funcionário"
              className="w-full rounded-xl border border-border bg-surface-2 px-4 py-3 font-bold text-foreground placeholder:text-muted focus:border-demanda focus:outline-none" />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-muted">Entrada</label>
              <input type="date" value={dataEntrada} onChange={(e) => setDataEntrada(e.target.value)}
                className="w-full rounded-xl border border-border bg-surface-2 px-3 py-3 text-foreground focus:border-demanda focus:outline-none" />
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-muted">Salário (R$)</label>
              <input inputMode="decimal" placeholder="0,00" value={salario} onChange={(e) => setSalario(e.target.value)}
                className="w-full rounded-xl border border-border bg-surface-2 px-3 py-3 font-ticket text-lg font-bold text-foreground placeholder:text-muted focus:border-demanda focus:outline-none" />
            </div>
          </div>
          <button type="button" disabled={!valido || saving} onClick={salvarFuncionario}
            className="w-full rounded-xl bg-demanda py-3 text-sm font-extrabold uppercase tracking-wide text-black disabled:opacity-40">
            Salvar Funcionário
          </button>
        </div>

        {/* Navegação de mês */}
        <div className="flex items-center justify-between gap-2">
          <button type="button" onClick={() => navMes(-1)}
            className="rounded-xl border border-border bg-surface px-4 py-2 text-sm font-bold">‹</button>
          <span className="text-sm font-bold capitalize">{mesLabel(anoSel, mesSel)}</span>
          <button type="button" onClick={() => navMes(1)}
            className="rounded-xl border border-border bg-surface px-4 py-2 text-sm font-bold">›</button>
        </div>

        {loading ? (
          <p className="py-8 text-center text-sm text-muted">Carregando...</p>
        ) : funcionarios.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">Nenhum funcionário registrado ainda.</p>
        ) : (
          <>
            {/* Resumo da folha */}
            <div className="rounded-xl border border-border bg-surface px-4 py-4">
              <h2 className="mb-3 text-xs font-extrabold uppercase tracking-wide text-muted">
                Folha de Pagamento — {mesLabel(anoSel, mesSel)}
              </h2>
              <ul className="space-y-2">
                {funcionarios.map((f) => {
                  const { saldoMes, pagoQ1, pagoQ2, metaQ, totalHe } = dadosMes(f);
                  const quitado = saldoMes <= 0;
                  return (
                    <li key={f.id} className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold">{f.nome}</p>
                        <p className="text-xs text-muted">
                          1ª Q: {formatCurrency(pagoQ1)}/{formatCurrency(metaQ)} ·{" "}
                          2ª Q: {formatCurrency(pagoQ2)}/{formatCurrency(metaQ)}
                          {totalHe > 0 ? ` · HE: ${formatCurrency(totalHe)}` : ""}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className={`font-ticket text-sm font-bold ${quitado ? "text-success" : "text-danger"}`}>
                          {quitado ? "Quitado" : `Falta ${formatCurrency(saldoMes)}`}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
              <div className="mt-3 border-t border-border pt-3 flex justify-between items-center">
                <span className="text-xs font-extrabold uppercase text-muted">Total a pagar</span>
                <span className={`font-ticket font-bold ${totalFolha <= 0 ? "text-success" : "text-danger"}`}>
                  {formatCurrency(Math.max(0, totalFolha))}
                </span>
              </div>
            </div>

            {/* Cards individuais */}
            <ul className="space-y-4">
              {funcionarios.map((f) => {
                const { pagsQ1, pagsQ2, vales, faltasMes, hesMes, metaQ, pagoQ1, pagoQ2, saldoQ1, saldoQ2, saldoMes, totalHe } = dadosMes(f);
                const mostrarFaltas = expandidoId === f.id;

                function PagamentoItem({ p }: { p: PagamentoFuncionario }) {
                  return (
                    <li className="flex items-center justify-between gap-2 rounded-lg bg-surface-2 px-3 py-2">
                      <div>
                        <p className="font-ticket text-sm font-bold">{formatCurrency(p.valor)}</p>
                        <p className="text-xs text-muted">{formatDateOnly(p.created_at.slice(0, 10))}</p>
                      </div>
                      <div className="flex gap-3">
                        <button type="button"
                          onClick={() => { setParaEditarPagamento(p); setValorEditado(String(p.valor).replace(".", ",")); }}
                          className="text-xs font-bold uppercase text-foreground">Editar</button>
                        <button type="button"
                          onClick={() => { setParaEditarDataPagamento(p); setDataEditadaPagamento(p.created_at.slice(0, 10)); }}
                          className="text-xs font-bold uppercase text-muted">Data</button>
                        <button type="button" onClick={() => setParaExcluirPagamento(p)}
                          className="text-xs font-bold uppercase text-danger">Excluir</button>
                      </div>
                    </li>
                  );
                }

                return (
                  <li key={f.id} className="rounded-xl border border-border bg-surface px-4 py-4">
                    {/* Cabeçalho */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-bold">{f.nome}</p>
                        <p className="text-xs text-muted">
                          Desde {formatDateOnly(f.data_entrada)} · {formatCurrency(f.valor_salario)}/mês
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-[10px] text-muted">Saldo devedor</p>
                        <p className={`font-ticket text-base font-bold ${saldoMes <= 0 ? "text-success" : "text-danger"}`}>
                          {saldoMes <= 0 ? "Quitado" : formatCurrency(saldoMes)}
                        </p>
                      </div>
                    </div>

                    {/* 1ª Quinzena */}
                    <div className={`mt-3 rounded-xl border p-3 ${saldoQ1 <= 0 ? "border-success/40 bg-success/10" : "border-border bg-surface-2"}`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-[10px] font-extrabold uppercase text-muted">1ª Quinzena {nomeMes}</p>
                          <p className="text-[10px] text-muted">Venc. dia 01</p>
                        </div>
                        <div className="text-right">
                          <p className="font-ticket text-xs">Meta: {formatCurrency(metaQ)}</p>
                          <p className="font-ticket text-xs text-success">Pago: {formatCurrency(pagoQ1)}</p>
                          {saldoQ1 > 0
                            ? <p className="font-ticket text-xs font-bold text-danger">Falta: {formatCurrency(saldoQ1)}</p>
                            : <p className="text-xs font-bold text-success">✓ Quitado</p>}
                        </div>
                      </div>
                      {pagsQ1.length > 0 && (
                        <ul className="mt-2 space-y-1 border-t border-border/40 pt-2">
                          {pagsQ1.map((p) => <PagamentoItem key={p.id} p={p} />)}
                        </ul>
                      )}
                    </div>

                    {/* 2ª Quinzena */}
                    <div className={`mt-2 rounded-xl border p-3 ${saldoQ2 <= 0 ? "border-success/40 bg-success/10" : "border-border bg-surface-2"}`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-[10px] font-extrabold uppercase text-muted">2ª Quinzena {nomeMes}</p>
                          <p className="text-[10px] text-muted">Venc. dia 15</p>
                        </div>
                        <div className="text-right">
                          <p className="font-ticket text-xs">Meta: {formatCurrency(metaQ)}</p>
                          <p className="font-ticket text-xs text-success">Pago: {formatCurrency(pagoQ2)}</p>
                          {saldoQ2 > 0
                            ? <p className="font-ticket text-xs font-bold text-danger">Falta: {formatCurrency(saldoQ2)}</p>
                            : <p className="text-xs font-bold text-success">✓ Quitado</p>}
                        </div>
                      </div>
                      {pagsQ2.length > 0 && (
                        <ul className="mt-2 space-y-1 border-t border-border/40 pt-2">
                          {pagsQ2.map((p) => <PagamentoItem key={p.id} p={p} />)}
                        </ul>
                      )}
                    </div>

                    {/* Vales */}
                    {vales.length > 0 && (
                      <div className="mt-2 rounded-xl border border-border bg-surface-2 p-3">
                        <p className="mb-2 text-[10px] font-extrabold uppercase text-muted">Vales do mês</p>
                        <ul className="space-y-1">
                          {vales.map((p) => <PagamentoItem key={p.id} p={p} />)}
                        </ul>
                      </div>
                    )}

                    {/* Horas Extras */}
                    <div className={`mt-2 rounded-xl border p-3 ${hesMes.length === 0 ? "border-border bg-surface-2" : "border-despesa/30 bg-despesa/5"}`}>
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] font-extrabold uppercase text-muted">Horas Extras</p>
                        {totalHe > 0 && (
                          <p className="font-ticket text-xs font-bold text-foreground">{formatCurrency(totalHe)}</p>
                        )}
                      </div>
                      {hesMes.length === 0 ? (
                        <p className="mt-1 text-xs text-muted">Nenhuma hora extra no mês.</p>
                      ) : (
                        <ul className="mt-2 space-y-1 border-t border-border/40 pt-2">
                          {hesMes.map((he) => (
                            <li key={he.id} className="flex items-center justify-between gap-2 rounded-lg bg-surface-2 px-3 py-2">
                              <div>
                                <p className="font-ticket text-sm font-bold">{formatCurrency(he.valor)}</p>
                                <p className="text-xs text-muted">
                                  {formatDateOnly(he.data)}
                                  {he.observacao ? ` · ${he.observacao}` : ""}
                                </p>
                              </div>
                              <div className="flex gap-3">
                                <button type="button" onClick={() => abrirHeOverlay(f, he)}
                                  className="text-xs font-bold uppercase text-foreground">Editar</button>
                                <button type="button" onClick={() => setParaExcluirHe(he)}
                                  className="text-xs font-bold uppercase text-danger">Excluir</button>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    {/* Faltas (toggle) */}
                    <button type="button" onClick={() => setExpandidoId(mostrarFaltas ? null : f.id)}
                      className="mt-3 text-xs font-bold uppercase text-muted underline">
                      {faltasMes.length} {faltasMes.length === 1 ? "falta" : "faltas"}{" "}
                      {mostrarFaltas ? "▲" : "▼"}
                    </button>

                    {mostrarFaltas && faltasMes.length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {faltasMes.map((fa) => (
                          <li key={fa.id} className="flex items-center justify-between gap-2 rounded-lg bg-surface-2 px-3 py-2">
                            <p className="text-sm">{formatDateOnly(fa.created_at.slice(0, 10))}</p>
                            <div className="flex gap-3">
                              <button type="button" onClick={() => { setParaEditarFalta(fa); setDataEditada(fa.created_at.slice(0, 10)); }}
                                className="text-xs font-bold uppercase text-foreground">Editar</button>
                              <button type="button" onClick={() => setParaExcluirFalta(fa)}
                                className="text-xs font-bold uppercase text-danger">Excluir</button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}

                    {/* Botões de ação */}
                    <div className="mt-3 space-y-2">
                      <div className="flex gap-2">
                        <button type="button" onClick={() => setParaPagamento({ func: f, quinzena: 1 })}
                          className={`flex-1 rounded-xl border py-2 text-xs font-bold uppercase ${saldoQ1 <= 0 ? "border-border text-muted" : "border-success text-success"}`}>
                          Pagar 1ª Q
                        </button>
                        <button type="button" onClick={() => setParaPagamento({ func: f, quinzena: 2 })}
                          className={`flex-1 rounded-xl border py-2 text-xs font-bold uppercase ${saldoQ2 <= 0 ? "border-border text-muted" : "border-success text-success"}`}>
                          Pagar 2ª Q
                        </button>
                      </div>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => setParaVale(f)}
                          className="flex-1 rounded-xl border border-demanda py-2 text-xs font-bold uppercase text-demanda">
                          Vale
                        </button>
                        <button type="button" onClick={() => abrirHeOverlay(f, null)}
                          className="flex-1 rounded-xl border border-despesa py-2 text-xs font-bold uppercase text-despesa">
                          H. Extra
                        </button>
                        <button type="button" onClick={() => setParaFalta(f)}
                          className="flex-1 rounded-xl border border-danger py-2 text-xs font-bold uppercase text-danger">
                          Falta
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>

      {/* Dialogs */}
      <AmountDialog
        open={paraPagamento !== null}
        title={paraPagamento ? `Pagar ${paraPagamento.quinzena}ª Quinzena` : ""}
        description={paraPagamento ? `${paraPagamento.func.nome} · venc. dia ${paraPagamento.quinzena === 1 ? "01" : "15"}` : undefined}
        value={valorPagamento}
        onValueChange={setValorPagamento}
        confirmLabel="Salvar pagamento"
        onConfirm={confirmarPagamento}
        onCancel={() => { setParaPagamento(null); setValorPagamento(""); }}
      />

      <AmountDialog
        open={paraVale !== null}
        title="Registrar Vale"
        description={paraVale ? `Vale para ${paraVale.nome}` : undefined}
        value={valorVale}
        onValueChange={setValorVale}
        confirmLabel="Salvar vale"
        onConfirm={confirmarVale}
        onCancel={() => { setParaVale(null); setValorVale(""); }}
      />

      <ConfirmDialog
        open={paraFalta !== null}
        title="Registrar falta?"
        description={paraFalta ? `Confirma uma falta de ${paraFalta.nome} hoje.` : undefined}
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
        onCancel={() => { setParaEditarPagamento(null); setValorEditado(""); }}
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
        open={paraEditarDataPagamento !== null}
        title="Editar data do pagamento"
        description="Ajuste a data deste lançamento."
        value={dataEditadaPagamento}
        onValueChange={setDataEditadaPagamento}
        confirmLabel="Salvar data"
        onConfirm={confirmarEditarDataPagamento}
        onCancel={() => { setParaEditarDataPagamento(null); setDataEditadaPagamento(""); }}
      />

      <DateDialog
        open={paraEditarFalta !== null}
        title="Editar falta"
        description="Ajuste a data desta falta."
        value={dataEditada}
        onValueChange={setDataEditada}
        confirmLabel="Salvar alteração"
        onConfirm={confirmarEditarFalta}
        onCancel={() => { setParaEditarFalta(null); setDataEditada(""); }}
      />

      <ConfirmDialog
        open={paraExcluirFalta !== null}
        title="Excluir falta?"
        description="Esta ação não pode ser desfeita."
        confirmLabel="Sim, excluir"
        onConfirm={confirmarExcluirFalta}
        onCancel={() => setParaExcluirFalta(null)}
      />

      <ConfirmDialog
        open={paraExcluirHe !== null}
        title="Excluir horas extras?"
        description="Esta ação não pode ser desfeita."
        confirmLabel="Sim, excluir"
        onConfirm={confirmarExcluirHe}
        onCancel={() => setParaExcluirHe(null)}
      />

      {/* Overlay Horas Extras */}
      {heOverlay && (
        <div className="fixed inset-0 z-50 flex flex-col bg-background">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h2 className="font-extrabold uppercase tracking-wide">
              {heOverlay.editando ? "Editar Horas Extras" : `H. Extra — ${heOverlay.func.nome}`}
            </h2>
            <button type="button" onClick={fecharHeOverlay} className="text-xl font-bold text-muted">✕</button>
          </div>

          <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-muted">Valor (R$)</label>
              <input
                inputMode="decimal"
                placeholder="0,00"
                value={heValor}
                onChange={(e) => setHeValor(e.target.value)}
                className="w-full rounded-xl border border-border bg-surface px-4 py-4 font-ticket text-3xl font-bold text-foreground placeholder:text-muted focus:border-despesa focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-muted">Data</label>
              <input
                type="date"
                value={heData}
                onChange={(e) => setHeData(e.target.value)}
                className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-foreground focus:border-despesa focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-muted">Observação (opcional)</label>
              <textarea
                value={heObs}
                onChange={(e) => setHeObs(e.target.value)}
                rows={3}
                placeholder="Ex: serviço extra sábado..."
                className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-foreground placeholder:text-muted focus:border-despesa focus:outline-none"
              />
            </div>
          </div>

          <div className="px-5 py-4">
            <button
              type="button"
              disabled={!heValido}
              onClick={confirmarHoraExtra}
              className="w-full rounded-xl bg-despesa py-4 text-base font-extrabold uppercase tracking-wide text-black disabled:opacity-40"
            >
              {heOverlay.editando ? "Salvar Alteração" : "Registrar Horas Extras"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
