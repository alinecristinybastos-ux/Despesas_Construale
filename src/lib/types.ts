export const CATEGORIAS_DESPESA = [
  "COMBUSTIVEL",
  "ALIMENTACAO",
  "MAO_DE_OBRA",
  "MANUTENCAO_VEICULOS",
  "PRODUTOS",
  "COMISSAO",
  "DIVERSOS",
  "LICENCIAMENTOS",
  "TARIFAS_JUROS",
  "DESPESAS_PESSOAIS",
  "CONTAS_FX_PESS",
] as const;

export type CategoriaDespesa = (typeof CATEGORIAS_DESPESA)[number];

export const CATEGORIA_DESPESA_LABEL: Record<CategoriaDespesa, string> = {
  COMBUSTIVEL: "Combustível",
  ALIMENTACAO: "Alimentação",
  MAO_DE_OBRA: "Mão de Obra",
  MANUTENCAO_VEICULOS: "Manutenção Veículos",
  PRODUTOS: "Produtos",
  COMISSAO: "Comissão",
  DIVERSOS: "Diversos",
  LICENCIAMENTOS: "Licenciamentos",
  TARIFAS_JUROS: "Tarifas/Juros",
  DESPESAS_PESSOAIS: "Despesas Pessoais",
  CONTAS_FX_PESS: "Contas Fx Pess.",
};

export const SERVICOS_DEMANDA = [
  "ORCAMENTO",
  "EXECUCAO_DE_SERVICO",
  "VISITA_TECNICA",
  "COMPRA_DE_MATERIAL",
  "OUTRO",
] as const;

export type ServicoDemanda = (typeof SERVICOS_DEMANDA)[number];

export const SERVICO_DEMANDA_LABEL: Record<ServicoDemanda, string> = {
  ORCAMENTO: "Orçamento",
  EXECUCAO_DE_SERVICO: "Execução de Serviço",
  VISITA_TECNICA: "Visita Técnica",
  COMPRA_DE_MATERIAL: "Compra de Material",
  OUTRO: "Outro",
};

export interface Despesa {
  id: string;
  valor: number;
  categoria: CategoriaDespesa;
  observacao: string | null;
  lancado_no_sistema: boolean;
  created_at: string;
}

export interface Demanda {
  id: string;
  cliente: string;
  servico: ServicoDemanda;
  contato: string | null;
  observacao: string | null;
  concluido: boolean;
  created_at: string;
}

export interface Funcionario {
  id: string;
  nome: string;
  data_entrada: string;
  valor_salario: number;
  created_at: string;
}

export interface PagamentoFuncionario {
  id: string;
  funcionario_id: string;
  valor: number;
  quinzena: 1 | 2 | null;
  observacao: string | null;
  created_at: string;
}

export interface FaltaFuncionario {
  id: string;
  funcionario_id: string;
  observacao: string | null;
  created_at: string;
}

export interface Venda {
  id: string;
  numero: number;
  vendedor: string;
  cliente: string;
  valor: number;
  valorPago: number;
  statusPagamento: "a_receber" | "recebido";
  data: string; // YYYY-MM-DD
  hora: string;
  obs: string;
}

export interface PagamentoServico {
  id: string;
  valor: number;
  data: string; // YYYY-MM-DD
}

export interface Servico {
  id: string;
  vendedor: string;
  tipo: string;
  cliente: string;
  tipoCobranca: "empreitada" | "viagem";
  valor: number;
  valorViagem: number;
  dataInicio: string;
  status: string;
  pagamentos: PagamentoServico[];
}
