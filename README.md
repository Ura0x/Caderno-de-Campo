# Caderno de Campo

SPA para organizar planilhas de manejo (nutrição e defesa de plantas) por cliente, cultura, variedade e safra.

**Stack:** React + TypeScript + Vite · Tailwind · Zustand + Immer (editor) · TanStack Query · dnd-kit · @react-pdf/renderer · Supabase (Postgres, Auth Google, RLS).

## Rodando localmente

```bash
npm install
cp .env.example .env   # preencha com os dados do Supabase
npm run dev
```

## Configurando o Supabase (uma vez)

1. Crie um projeto em <https://supabase.com>.
2. **SQL Editor** → cole e execute, **em ordem**, cada arquivo de `supabase/migrations/` (`0001_init.sql`, `0002_pruning_date.sql`, …).
3. **Project Settings → API**: copie a *Project URL* e a *publishable key* para o `.env`.
4. **Login com Google**
   1. No [Google Cloud Console](https://console.cloud.google.com/apis/credentials), crie um *OAuth client ID* do tipo *Web application*.
   2. Em *Authorized redirect URIs*, adicione `https://<seu-projeto>.supabase.co/auth/v1/callback`.
   3. No Supabase: **Authentication → Sign In / Providers → Google** → ative e cole o Client ID e o Client Secret.
   4. Em **Authentication → URL Configuration**, defina *Site URL* (ex.: a URL da Vercel) e adicione `http://localhost:5173` em *Redirect URLs*.

## Deploy (Vercel)

Importe o repositório na Vercel, defina `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` nas variáveis de ambiente. O `vercel.json` já redireciona as rotas da SPA para `index.html`.

## Estrutura

```
supabase/migrations/   schema + políticas RLS
src/lib/               supabase, auth, consultas (api.ts), tipos
src/pages/             Planilhas (lista + filtros), Editor, Cadastros, Login
src/editor/            modelo do documento, store (desfazer/refazer), tabela, barra de ferramentas, PDF
```

### Modelo da planilha

Cada planilha guarda suas tabelas em `sheets.content` (JSON). Uma tabela tem colunas, e **cada coluna tem sua própria lista de células**, por isso colunas podem ter quantidades diferentes de linhas e todas se esticam até a mesma altura. O estilo da coluna vale para todas as suas células; o estilo da célula tem prioridade. "Formatar linha" aplica o estilo na N-ésima célula de cada coluna que a possui.

Clientes ligados a uma planilha (`sheet_clients`) compartilham o mesmo documento; "Duplicar" cria uma cópia independente.
