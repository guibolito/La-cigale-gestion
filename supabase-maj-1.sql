-- Mise à jour 1 : photos et justificatifs privés (à exécuter une seule fois dans Supabase > SQL Editor)
update storage.buckets set public = false where id = 'assets';
drop policy if exists "membres: lire les fichiers" on storage.objects;
create policy "membres: lire les fichiers" on storage.objects for select to authenticated
  using (bucket_id = 'assets' and public.is_member());

-- Notifications push (iPhone) : abonnements des appareils
create table if not exists public.push_subs (
  endpoint text primary key,
  email text not null,
  sub jsonb not null,
  created_at timestamptz default now()
);
alter table public.push_subs enable row level security;
drop policy if exists "membres: gérer leurs abonnements" on public.push_subs;
create policy "membres: gérer leurs abonnements" on public.push_subs for all to authenticated
  using (public.is_member()) with check (public.is_member());
