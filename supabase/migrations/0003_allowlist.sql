-- Acesso restrito a um grupo fechado: só e-mails desta lista podem criar conta
-- e ler/gravar dados. A lista é gerenciada pelo painel do Supabase (Table Editor)
-- ou pelo SQL Editor; o app não tem acesso a ela.

create table public.allowed_emails (
  email      text primary key check (email = lower(email)),
  note       text,
  created_at timestamptz not null default now()
);

-- RLS ligado e sem políticas: invisível para a API.
alter table public.allowed_emails enable row level security;

-- O usuário logado está na lista?
create function public.is_allowed() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.allowed_emails where email = lower((select auth.jwt() ->> 'email'))
  )
$$;

revoke execute on function public.is_allowed() from public, anon;
grant execute on function public.is_allowed() to authenticated;

-- Auth Hook "Before User Created": recusa a criação de contas fora da lista.
-- Ativar em: Authentication → Hooks → Before User Created → Postgres → public.hook_before_user_created
create function public.hook_before_user_created(event jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.allowed_emails where email = lower(event -> 'user' ->> 'email')) then
    return '{}'::jsonb;
  end if;
  return jsonb_build_object(
    'error', jsonb_build_object(
      'http_code', 403,
      'message', 'Acesso restrito. Peça ao administrador para liberar o seu e-mail.'
    )
  );
end $$;

revoke execute on function public.hook_before_user_created(jsonb) from public, anon, authenticated;
grant execute on function public.hook_before_user_created(jsonb) to supabase_auth_admin;

-- Todas as políticas passam a exigir e-mail liberado (vale também para contas já existentes).

drop policy "own rows" on public.clients;
create policy "own rows" on public.clients for all to authenticated
  using (user_id = (select auth.uid()) and (select public.is_allowed()))
  with check (user_id = (select auth.uid()) and (select public.is_allowed()));

drop policy "own rows" on public.crops;
create policy "own rows" on public.crops for all to authenticated
  using (user_id = (select auth.uid()) and (select public.is_allowed()))
  with check (user_id = (select auth.uid()) and (select public.is_allowed()));

drop policy "own rows" on public.varieties;
create policy "own rows" on public.varieties for all to authenticated
  using (user_id = (select auth.uid()) and (select public.is_allowed()))
  with check (
    user_id = (select auth.uid())
    and (select public.is_allowed())
    and exists (select 1 from public.crops c where c.id = crop_id and c.user_id = (select auth.uid()))
  );

drop policy "own rows" on public.seasons;
create policy "own rows" on public.seasons for all to authenticated
  using (user_id = (select auth.uid()) and (select public.is_allowed()))
  with check (user_id = (select auth.uid()) and (select public.is_allowed()));

-- Além do dono, a cultura/variedade/safra referenciada também precisa ser do próprio usuário.
drop policy "own rows" on public.sheets;
create policy "own rows" on public.sheets for all to authenticated
  using (user_id = (select auth.uid()) and (select public.is_allowed()))
  with check (
    user_id = (select auth.uid())
    and (select public.is_allowed())
    and (crop_id is null or exists (select 1 from public.crops c where c.id = crop_id and c.user_id = (select auth.uid())))
    and (variety_id is null or exists (select 1 from public.varieties v where v.id = variety_id and v.user_id = (select auth.uid())))
    and (season_id is null or exists (select 1 from public.seasons s where s.id = season_id and s.user_id = (select auth.uid())))
  );

drop policy "own rows" on public.sheet_clients;
create policy "own rows" on public.sheet_clients for all to authenticated
  using (user_id = (select auth.uid()) and (select public.is_allowed()))
  with check (
    user_id = (select auth.uid())
    and (select public.is_allowed())
    and exists (select 1 from public.sheets s where s.id = sheet_id and s.user_id = (select auth.uid()))
    and exists (select 1 from public.clients c where c.id = client_id and c.user_id = (select auth.uid()))
  );
