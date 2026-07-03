"use client";

import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { supabase } from "@/lib/supabase";
import PageHeader from "@/components/PageHeader";
import type { Despesa, PagamentoFuncionario, Venda, Servico } from "@/lib/types";
import { CATEGORIA_DESPESA_LABEL, CATEGORIAS_DESPESA } from "@/lib/types";
import { formatCurrency } from "@/lib/format";

function mesLabel(ano: number, mes: number) {
  return new Date(ano, mes, 1).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
}

function inMonth(dateStr: string, ano: number, mes: number): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr.length === 10 ? dateStr + "T12:00:00" : dateStr);
  return d.getFullYear() === ano && d.getMonth() === mes;
}

function Row({ label, value, bold, indent, accent }: {
  label: string;
  value: number;
  bold?: boolean;
  indent?: boolean;
  accent?: "receita" | "despesa" | "resultado";
}) {
  const valueColor =
    accent === "receita"
      ? "text-success"
      : accent === "despesa"
      ? "text-despesa"
      : accent === "resultado"
      ? value >= 0
        ? "text-success"
        : "text-danger"
      : "text-foreground";

  return (
    <div
      className={`flex items-center justify-between gap-2 py-1.5 ${
        indent ? "pl-4" : ""
      } ${bold ? "border-t border-border mt-1 pt-2" : ""}`}
    >
      <span className={`text-sm ${bold ? "font-extrabold uppercase tracking-wide" : "text-muted"}`}>
        {label}
      </span>
      <span className={`font-ticket text-sm font-bold ${valueColor}`}>
        {formatCurrency(value)}
      </span>
    </div>
  );
}

export default function FinanceiroPage() {
  const hoje = new Date();
  const [ano, setAno] = useState(hoje.getFullYear());
  const [mes, setMes] = useState(hoje.getMonth());
  const [loading, setLoading] = useState(true);

  const [vendas, setVendas] = useState<Venda[]>([]);
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [despesas, setDespesas] = useState<Despesa[]>([]);
  const [salarios, setSalarios] = useState<PagamentoFuncionario[]>([]);

  async function carregar() {
    setLoading(true);
    const [vendasSnap, servicosSnap, despesasRes, salariosRes] = await Promise.all([
      getDocs(collection(db, "vendas")),
      getDocs(collection(db, "servicos")),
      supabase.from("despesas").select("*"),
      supabase.from("pagamentos_funcionario").select("*"),
    ]);

    setVendas(vendasSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Venda)));
    setServicos(servicosSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Servico)));
    setDespesas((despesasRes.data as Despesa[]) ?? []);
    setSalarios((salariosRes.data as PagamentoFuncionario[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { carregar(); }, []);

  function navMes(delta: number) {
    let m = mes + delta;
    let a = ano;
    if (m < 0) { m = 11; a--; }
    if (m > 11) { m = 0; a++; }
    setMes(m);
    setAno(a);
  }

  // --- Receitas ---
  const vendasMes = vendas.filter((v) => inMonth(v.data, ano, mes));
  const receitaVendas = vendasMes
    .filter((v) => v.statusPagamento === "recebido")
    .reduce((acc, v) => acc + (v.valorPago || 0), 0);
  const vendasAReceber = vendasMes
    .filter((v) => v.statusPagamento === "a_receber")
    .reduce((acc, v) => acc + (v.valor || 0), 0);

  const receitaServicos = servicos.reduce((acc, s) => {
    const pagsMes = (s.pagamentos ?? []).filter((p) => inMonth(p.data, ano, mes));
    return acc + pagsMes.reduce((a, p) => a + (p.valor || 0), 0);
  }, 0);

  const totalReceitas = receitaVendas + receitaServicos;

  // --- Despesas por categoria ---
  const despesasMes = despesas.filter((d) => inMonth(d.created_at, ano, mes));
  const totalPorCategoria = CATEGORIAS_DESPESA.reduce(
    (acc, cat) => {
      acc[cat] = despesasMes.filter((d) => d.categoria === cat).reduce((s, d) => s + d.valor, 0);
      return acc;
    },
    {} as Record<string, number>,
  );
  const totalDespesas = despesasMes.reduce((acc, d) => acc + d.valor, 0);

  // --- Salários ---
  const salariosMes = salarios.filter((s) => inMonth(s.created_at, ano, mes));
  const totalSalarios = salariosMes.reduce((acc, s) => acc + s.valor, 0);

  const totalCustos = totalDespesas + totalSalarios;
  const resultado = totalReceitas - totalCustos;

  // --- CSV export ---
  function exportarCsv() {
    const linhas = [
      ["DRE — " + mesLabel(ano, mes)],
      [],
      ["RECEITAS"],
      ["Vendas recebidas", receitaVendas],
      ["Serviços recebidos", receitaServicos],
      ["TOTAL RECEITAS", totalReceitas],
      [],
      ["DESPESAS OPERACIONAIS"],
      ...CATEGORIAS_DESPESA.map((c) => [CATEGORIA_DESPESA_LABEL[c], totalPorCategoria[c]]),
      ["TOTAL DESPESAS", totalDespesas],
      [],
      ["PESSOAL"],
      ["Salários pagos", totalSalarios],
      [],
      ["TOTAL CUSTOS", totalCustos],
      ["RESULTADO", resultado],
    ];
    const csv = linhas
      .map((l) =>
        l.length === 0
          ? ""
          : l.map((v) => (typeof v === "number" ? v.toFixed(2).replace(".", ",") : `"${v}"`)).join(";"),
      )
      .join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `DRE_${ano}_${String(mes + 1).padStart(2, "0")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <PageHeader title="Financeiro" subtitle="DRE e Fluxo de Caixa" accent="despesa" />

      <div className="space-y-5 px-5 pb-10">
        {/* Navegação de mês */}
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => navMes(-1)}
            className="rounded-xl border border-border bg-surface px-4 py-2 text-sm font-bold"
          >
            ‹
          </button>
          <span className="text-sm font-bold capitalize">{mesLabel(ano, mes)}</span>
          <button
            type="button"
            onClick={() => navMes(1)}
            className="rounded-xl border border-border bg-surface px-4 py-2 text-sm font-bold"
          >
            ›
          </button>
        </div>

        {loading ? (
          <p className="py-10 text-center text-sm text-muted">Carregando dados...</p>
        ) : (
          <>
            {/* Cards de resumo */}
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl border border-border bg-surface p-3 text-center">
                <p className="text-[10px] font-bold uppercase text-muted">Receitas</p>
                <p className="mt-1 font-ticket text-sm font-bold text-success">
                  {formatCurrency(totalReceitas)}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-surface p-3 text-center">
                <p className="text-[10px] font-bold uppercase text-muted">Custos</p>
                <p className="mt-1 font-ticket text-sm font-bold text-despesa">
                  {formatCurrency(totalCustos)}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-surface p-3 text-center">
                <p className="text-[10px] font-bold uppercase text-muted">Resultado</p>
                <p
                  className={`mt-1 font-ticket text-sm font-bold ${
                    resultado >= 0 ? "text-success" : "text-danger"
                  }`}
                >
                  {formatCurrency(resultado)}
                </p>
              </div>
            </div>

            {/* Fluxo de Caixa */}
            <div className="rounded-xl border border-border bg-surface px-4 py-4">
              <h2 className="mb-3 text-xs font-extrabold uppercase tracking-wide text-muted">
                Fluxo de Caixa
              </h2>

              <p className="mb-1 text-xs font-bold uppercase text-success">Entradas</p>
              <Row label="Vendas recebidas" value={receitaVendas} indent accent="receita" />
              <Row label="Serviços recebidos" value={receitaServicos} indent accent="receita" />
              <Row label="Total entradas" value={totalReceitas} bold accent="receita" />

              <div className="mt-3" />
              <p className="mb-1 text-xs font-bold uppercase text-despesa">Saídas</p>
              <Row label="Despesas operacionais" value={totalDespesas} indent accent="despesa" />
              <Row label="Salários pagos" value={totalSalarios} indent accent="despesa" />
              <Row label="Total saídas" value={totalCustos} bold accent="despesa" />

              <div className="mt-3 border-t border-border pt-3">
                <Row
                  label="Saldo do período"
                  value={resultado}
                  bold
                  accent="resultado"
                />
              </div>

              {vendasAReceber > 0 && (
                <p className="mt-2 text-xs text-muted">
                  ⚠ {formatCurrency(vendasAReceber)} em vendas ainda a receber
                </p>
              )}
            </div>

            {/* DRE */}
            <div className="rounded-xl border border-border bg-surface px-4 py-4">
              <h2 className="mb-3 text-xs font-extrabold uppercase tracking-wide text-muted">
                DRE — Demonstração do Resultado
              </h2>

              <p className="mb-1 text-xs font-bold uppercase text-success">Receitas</p>
              <Row label="Vendas recebidas" value={receitaVendas} indent />
              <Row label="Serviços recebidos" value={receitaServicos} indent />
              <Row label="(+) Total receitas" value={totalReceitas} bold accent="receita" />

              <div className="mt-3" />
              <p className="mb-1 text-xs font-bold uppercase text-despesa">Despesas operacionais</p>
              {CATEGORIAS_DESPESA.map((cat) =>
                totalPorCategoria[cat] > 0 ? (
                  <Row
                    key={cat}
                    label={CATEGORIA_DESPESA_LABEL[cat]}
                    value={totalPorCategoria[cat]}
                    indent
                  />
                ) : null,
              )}
              <Row label="(-) Total operacional" value={totalDespesas} bold accent="despesa" />

              <div className="mt-3" />
              <p className="mb-1 text-xs font-bold uppercase text-muted">Pessoal</p>
              <Row label="Salários pagos" value={totalSalarios} indent />
              <Row label="(-) Total pessoal" value={totalSalarios} bold accent="despesa" />

              <div className="mt-3 border-t-2 border-border pt-3">
                <Row
                  label="= RESULTADO DO PERÍODO"
                  value={resultado}
                  bold
                  accent="resultado"
                />
              </div>
            </div>

            {/* Exportar */}
            <button
              type="button"
              onClick={exportarCsv}
              className="w-full rounded-xl border border-border bg-surface py-3 text-sm font-bold uppercase tracking-wide text-foreground"
            >
              Exportar DRE em CSV
            </button>
          </>
        )}
      </div>
    </div>
  );
}
