-- Despesas Construale - schema do banco (Supabase / Postgres)
-- Execute este script no SQL Editor do seu projeto Supabase.

create extension if not exists "pgcrypto";

create table if not exists public.despesas (
  id uuid primary key default gen_random_uuid(),
  valor numeric(10,2) not null check (valor > 0),
  categoria text not null check (categoria in (
    'COMBUSTIVEL', 'ALIMENTACAO', 'MAO_DE_OBRA', 'MANUTENCAO_VEICULOS',
    'LUBRIFICANTES', 'PNEUS',
    'PRODUTOS', 'COMISSAO', 'DIVERSOS',
    'LICENCIAMENTOS', 'TARIFAS_JUROS', 'EMPRESTIMOS', 'IMPOSTO', 'CONTAS_FIXAS_PJ'
  )),
  observacao text,
  lancado_no_sistema boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.demandas (
  id uuid primary key default gen_random_uuid(),
  cliente text not null,
  servico text not null check (servico in (
    'ORCAMENTO', 'EXECUCAO_DE_SERVICO', 'VISITA_TECNICA',
    'COMPRA_DE_MATERIAL', 'OUTRO'
  )),
  contato text,
  observacao text,
  concluido boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists despesas_created_at_idx on public.despesas (created_at desc);
create index if not exists demandas_created_at_idx on public.demandas (created_at desc);

create table if not exists public.funcionarios (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  data_entrada date not null,
  valor_salario numeric(10,2) not null check (valor_salario > 0),
  created_at timestamptz not null default now()
);

create table if not exists public.pagamentos_funcionario (
  id uuid primary key default gen_random_uuid(),
  funcionario_id uuid not null references public.funcionarios(id) on delete cascade,
  valor numeric(10,2) not null check (valor > 0),
  observacao text,
  created_at timestamptz not null default now()
);

create table if not exists public.faltas_funcionario (
  id uuid primary key default gen_random_uuid(),
  funcionario_id uuid not null references public.funcionarios(id) on delete cascade,
  observacao text,
  created_at timestamptz not null default now()
);

create index if not exists funcionarios_created_at_idx on public.funcionarios (created_at desc);
create index if not exists pagamentos_funcionario_funcionario_id_idx on public.pagamentos_funcionario (funcionario_id);
create index if not exists pagamentos_funcionario_created_at_idx on public.pagamentos_funcionario (created_at desc);
create index if not exists faltas_funcionario_funcionario_id_idx on public.faltas_funcionario (funcionario_id);
create index if not exists faltas_funcionario_created_at_idx on public.faltas_funcionario (created_at desc);

create table if not exists public.horas_extras_funcionario (
  id uuid primary key default gen_random_uuid(),
  funcionario_id uuid not null references public.funcionarios(id) on delete cascade,
  valor numeric(10,2) not null check (valor > 0),
  data date not null,
  observacao text,
  created_at timestamptz not null default now()
);

create index if not exists horas_extras_funcionario_id_idx on public.horas_extras_funcionario (funcionario_id);
create index if not exists horas_extras_created_at_idx on public.horas_extras_funcionario (created_at desc);

-- RLS: app interno de uso unico (sem login), liberado para a chave anon.
-- Se no futuro for exposto publicamente, troque por policies com auth.
alter table public.despesas enable row level security;
alter table public.demandas enable row level security;
alter table public.funcionarios enable row level security;
alter table public.pagamentos_funcionario enable row level security;
alter table public.faltas_funcionario enable row level security;

create policy "despesas_all_anon" on public.despesas
  for all using (true) with check (true);

create policy "demandas_all_anon" on public.demandas
  for all using (true) with check (true);

create policy "funcionarios_all_anon" on public.funcionarios
  for all using (true) with check (true);

create policy "pagamentos_funcionario_all_anon" on public.pagamentos_funcionario
  for all using (true) with check (true);

create policy "faltas_funcionario_all_anon" on public.faltas_funcionario
  for all using (true) with check (true);

alter table public.horas_extras_funcionario enable row level security;

create policy "horas_extras_all_anon" on public.horas_extras_funcionario
  for all using (true) with check (true);

create table if not exists public.prolabore (
  id uuid primary key default gen_random_uuid(),
  valor numeric(10,2) not null check (valor > 0),
  categoria text not null check (categoria in (
    'COMBUSTIVEL', 'ALIMENTACAO', 'CONTAS_FIXAS', 'VESTUARIO', 'LAZER', 'SAUDE',
    'DIVERSOS', 'JUROS_TARIFAS'
  )),
  observacao text,
  created_at timestamptz not null default now()
);

create index if not exists prolabore_created_at_idx on public.prolabore (created_at desc);

alter table public.prolabore enable row level security;

create policy "prolabore_all_anon" on public.prolabore
  for all using (true) with check (true);
