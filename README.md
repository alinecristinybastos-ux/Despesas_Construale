# Despesas Construale

App de registro de despesas e demandas em campo, uso diário pelo
operacional da Construale (principalmente no celular). Os dados ficam
em um banco de dados real hospedado (Supabase), acessível de qualquer
dispositivo para consulta posterior.

## Stack

- **Next.js** (App Router, TypeScript, Tailwind) — frontend, hospedado na Vercel.
- **Supabase** (Postgres hospedado) — banco de dados, acessado direto pelo browser via SDK JS.

Ambos têm free tier generoso, suficiente para o volume de uma empresa pequena, e não exigem servidor próprio.

## Configurar o Supabase

1. Crie um projeto em [supabase.com](https://supabase.com).
2. No SQL Editor do projeto, rode o script `supabase/schema.sql` (cria as tabelas `despesas` e `demandas`).
3. Em **Project Settings → API**, copie a `Project URL` e a chave `anon public`.
4. Copie `.env.local.example` para `.env.local` e preencha:

```bash
cp .env.local.example .env.local
```

```
NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=SUA-CHAVE-ANON-PUBLICA
```

> O app não tem login — a chave `anon` é liberada via RLS para todas as operações nas tabelas (uso interno, de uma única equipe). Se isso mudar, ajuste as policies em `supabase/schema.sql`.

## Rodar localmente

```bash
npm install
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000).

## Deploy

1. Suba o repositório no GitHub (já feito).
2. Importe o projeto na [Vercel](https://vercel.com/new).
3. Configure as mesmas variáveis de ambiente (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) no painel da Vercel.
4. Deploy. O app funciona direto no celular como PWA-like (mobile-first), sem instalação.

## Telas

- **Despesa** — valor, categoria (chips), observação opcional, botão "Lançado no Sistema" (com confirmação) e "Salvar Despesa".
- **Demanda** — cliente, serviço (chips), contato/observação opcionais, botão "Concluído" (sem confirmação, baixa rápida) e "Salvar Demanda".
- **Histórico** — busca + filtro por tipo, agrupado por dia.
- **Resumo** — totais por período (hoje/semana/mês), por categoria, contagem de demandas e de despesas pendentes de lançamento. Exporta CSV e relatório PDF.
