-- Caderno de Campo: schema inicial
-- Cada linha pertence a um usuário (user_id) e o RLS garante que ninguém
-- enxerga ou altera dados de outra conta.

create table public.clients (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  name       text not null,
  farm       text,
  city       text,
  phone      text,
  notes      text,
  created_at timestamptz not null default now()
);

create table public.crops (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  name       text not null,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create table public.varieties (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  crop_id    uuid not null references public.crops on delete cascade,
  name       text not null,
  created_at timestamptz not null default now(),
  unique (crop_id, name)
);

create table public.seasons (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  name       text not null,
  start_date date,
  end_date   date,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

-- Uma planilha = documento com várias tabelas. O conteúdo (tabelas, colunas,
-- células e estilos) fica em JSON; ver src/lib/types.ts (SheetContent).
create table public.sheets (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users on delete cascade,
  title      text not null,
  crop_id    uuid references public.crops on delete set null,
  variety_id uuid references public.varieties on delete set null,
  season_id  uuid references public.seasons on delete set null,
  content    jsonb not null default '{"version":1,"tables":[]}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Uma planilha pode estar vinculada a vários clientes (edição compartilhada).
create table public.sheet_clients (
  sheet_id  uuid not null references public.sheets on delete cascade,
  client_id uuid not null references public.clients on delete cascade,
  user_id   uuid not null default auth.uid() references auth.users on delete cascade,
  primary key (sheet_id, client_id)
);

create index on public.clients (user_id);
create index on public.crops (user_id);
create index on public.varieties (user_id);
create index on public.varieties (crop_id);
create index on public.seasons (user_id);
create index on public.sheets (user_id, created_at desc);
create index on public.sheet_clients (client_id);

create function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger sheets_touch before update on public.sheets
  for each row execute function public.touch_updated_at();

-- RLS ---------------------------------------------------------------------

alter table public.clients       enable row level security;
alter table public.crops         enable row level security;
alter table public.varieties     enable row level security;
alter table public.seasons       enable row level security;
alter table public.sheets        enable row level security;
alter table public.sheet_clients enable row level security;

create policy "own rows" on public.clients for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "own rows" on public.crops for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "own rows" on public.varieties for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.crops c where c.id = crop_id and c.user_id = (select auth.uid()))
  );

create policy "own rows" on public.seasons for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "own rows" on public.sheets for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "own rows" on public.sheet_clients for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.sheets s where s.id = sheet_id and s.user_id = (select auth.uid()))
    and exists (select 1 from public.clients c where c.id = client_id and c.user_id = (select auth.uid()))
  );
