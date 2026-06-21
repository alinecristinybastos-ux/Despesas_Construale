-- Despesas Construale - schema do banco (Supabase / Postgres)
-- Execute este script no SQL Editor do seu projeto Supabase.

create extension if not exists "pgcrypto";

create table if not exists public.despesas (
  id uuid primary key default gen_random_uuid(),
  valor numeric(10,2) not null check (valor > 0),
  categoria text not null check (categoria in (
    'COMBUSTIVEL', 'ALIMENTACAO', 'MAO_DE_OBRA', 'MANUTENCAO_VEICULOS',
    'PRODUTOS', 'VALE_FUNCIONARIO', 'DIVERSOS'
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

-- RLS: app interno de uso unico (sem login), liberado para a chave anon.
-- Se no futuro for exposto publicamente, troque por policies com auth.
alter table public.despesas enable row level security;
alter table public.demandas enable row level security;

create policy "despesas_all_anon" on public.despesas
  for all using (true) with check (true);

create policy "demandas_all_anon" on public.demandas
  for all using (true) with check (true);
