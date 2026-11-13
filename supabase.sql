-- La Cigale Gestion : base de données Supabase
-- À coller en entier dans Supabase > SQL Editor > New query > Run (une seule fois).

-- 1) Qui a le droit d'entrer (les 2 cogérants). L'associé s'ajoute plus tard dans la table members.
create table if not exists public.members (email text primary key);
insert into public.members (email) values ('guillaume.sasia@gmail.com') on conflict do nothing;

-- 2) Les données de l'appli (clients, devis, chantiers, factures... tout est stocké ici)
create table if not exists public.docs (
  col text not null,
  id text not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (col, id)
);
create index if not exists docs_col_idx on public.docs (col);

-- Garde-fou : deux devis, factures ou chantiers ne peuvent jamais avoir le même numéro
create unique index if not exists docs_num_uq on public.docs (col, (data->>'num'))
  where col in ('devis','factures','chantiers') and coalesce(data->>'num','') <> '';

-- 3) Sécurité : seuls les membres connectés voient et modifient les données
alter table public.docs enable row level security;
alter table public.members enable row level security;

create or replace function public.is_member() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members where lower(email) = lower(auth.jwt() ->> 'email'))
$$;

drop policy if exists "membres: tout sur docs" on public.docs;
create policy "membres: tout sur docs" on public.docs for all to authenticated
  using (public.is_member()) with check (public.is_member());

-- 4) Synchronisation en direct entre les 2 appareils
do $$ begin
  alter publication supabase_realtime add table public.docs;
exception when duplicate_object then null; end $$;

-- 5) Dossier des photos et justificatifs
insert into storage.buckets (id, name, public) values ('assets', 'assets', true) on conflict (id) do nothing;
drop policy if exists "membres: envoyer des fichiers" on storage.objects;
create policy "membres: envoyer des fichiers" on storage.objects for insert to authenticated
  with check (bucket_id = 'assets' and public.is_member());
drop policy if exists "membres: supprimer des fichiers" on storage.objects;
create policy "membres: supprimer des fichiers" on storage.objects for delete to authenticated
  using (bucket_id = 'assets' and public.is_member());
