import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { CATEGORIA_DESPESA_LABEL, type Despesa } from "./types";
import { formatCurrency } from "./format";

function downloadBlob(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function exportCsv(despesas: Despesa[]) {
  const lines: string[] = [];
  lines.push("data,hora,valor,categoria,observacao,status");

  for (const d of despesas) {
    const date = new Date(d.created_at);
    lines.push(
      [
        date.toLocaleDateString("pt-BR"),
        date.toLocaleTimeString("pt-BR"),
        d.valor.toFixed(2).replace(".", ","),
        CATEGORIA_DESPESA_LABEL[d.categoria],
        d.observacao ?? "",
        d.lancado_no_sistema ? "Lançado" : "Pendente",
      ]
        .map((v) => csvEscape(String(v)))
        .join(","),
    );
  }

  downloadBlob(
    "﻿" + lines.join("\n"),
    `despesas-construale-${Date.now()}.csv`,
    "text/csv;charset=utf-8",
  );
}

export function exportPdf(
  periodoLabel: string,
  despesas: Despesa[],
  totalPorCategoria: { categoria: string; total: number }[],
) {
  const doc = new jsPDF();

  doc.setFontSize(16);
  doc.text("Despesas Construale - Relatório", 14, 16);
  doc.setFontSize(10);
  doc.text(`Período: ${periodoLabel}`, 14, 23);
  doc.text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, 14, 28);

  const totalDespesas = despesas.reduce((acc, d) => acc + d.valor, 0);
  const pendentes = despesas.filter((d) => !d.lancado_no_sistema).length;

  autoTable(doc, {
    startY: 34,
    head: [["Resumo", "Valor"]],
    body: [
      ["Total de despesas", formatCurrency(totalDespesas)],
      ["Despesas pendentes de lançamento", String(pendentes)],
    ],
  });

  autoTable(doc, {
    head: [["Categoria", "Total"]],
    body: totalPorCategoria.map((c) => [c.categoria, formatCurrency(c.total)]),
  });

  autoTable(doc, {
    head: [["Data", "Valor", "Categoria", "Status", "Observação"]],
    body: despesas.map((d) => [
      new Date(d.created_at).toLocaleString("pt-BR"),
      formatCurrency(d.valor),
      CATEGORIA_DESPESA_LABEL[d.categoria],
      d.lancado_no_sistema ? "Lançado" : "Pendente",
      d.observacao ?? "",
    ]),
  });

  doc.save(`despesas-construale-${Date.now()}.pdf`);
}
