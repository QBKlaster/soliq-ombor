-- Hujjat biriktirish funksiyasi uchun yangilash. Supabase → SQL Editor → New query → shu matnni joylab Run bosing.

-- ===== Biriktirilgan hujjatlar (PDF, rasm) =====
create table if not exists public.files (
  id text primary key,
  firm_id text not null references public.firms(id) on delete cascade,
  rec_id text not null,
  name text not null,
  mime text,
  size bigint,
  orig_size bigint,
  path text not null,
  created_by uuid default auth.uid(),
  created_at timestamptz default now()
);
create index if not exists files_firm_idx on public.files(firm_id);
alter table public.files enable row level security;
drop policy if exists fl_sel on public.files; create policy fl_sel on public.files for select using (public.can_firm(firm_id));
drop policy if exists fl_ins on public.files; create policy fl_ins on public.files for insert with check (public.can_write_firm(firm_id));
drop policy if exists fl_del on public.files; create policy fl_del on public.files for delete using (public.can_write_firm(firm_id));

-- Fayllar ombori: yopiq, bitta fayl 10 MB gacha, faqat PDF va rasm
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('hujjatlar', 'hujjatlar', false, 10485760, array['application/pdf','image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Yo'l: <firma_id>/<yozuv_id>/<fayl>. Firmaga kirish huquqi bo'yicha ruxsat.
drop policy if exists hj_sel on storage.objects;
create policy hj_sel on storage.objects for select to authenticated
  using (bucket_id = 'hujjatlar' and public.can_firm((storage.foldername(name))[1]));
drop policy if exists hj_ins on storage.objects;
create policy hj_ins on storage.objects for insert to authenticated
  with check (bucket_id = 'hujjatlar' and public.can_write_firm((storage.foldername(name))[1]));
drop policy if exists hj_del on storage.objects;
create policy hj_del on storage.objects for delete to authenticated
  using (bucket_id = 'hujjatlar' and (public.can_write_firm((storage.foldername(name))[1])
    -- firmasi o'chirilgan "yetim" fayllarni bosh admin yoki foydalanuvchilar huquqi bor admin tozalaydi
    or ((public.is_admin() or public.has_perm('users')) and not exists (select 1 from public.files f where f.path = storage.objects.name))));

-- Foydalanuvchini firmalari bilan birga o'chirish (bosh admin: buxgalter va sayt admini; sayt admini: faqat buxgalter)
-- Fayllar yo'llarini qaytaradi: ilova ularni omborxonadan ham o'chiradi
drop function if exists public.admin_delete_user(uuid);
create or replace function public.admin_delete_user(uid uuid) returns text[] language plpgsql security definer set search_path = public, auth as $$
declare target_role text; paths text[];
begin
  if uid = auth.uid() then raise exception 'SELF_DELETE'; end if;
  select role into target_role from public.profiles where id = uid;
  if target_role = 'admin' then raise exception 'NOT_ALLOWED'; end if;
  if not (public.is_admin() or (public.has_perm('users') and coalesce(target_role, 'accountant') = 'accountant')) then
    raise exception 'NOT_ALLOWED';
  end if;
  select coalesce(array_agg(fl.path), '{}') into paths from public.files fl join public.firms f on f.id = fl.firm_id where f.owner_id = uid;
  delete from public.firms where owner_id = uid;   -- yozuvlar, fayllar ro'yxati va tarix ham (cascade) o'chadi
  delete from auth.users where id = uid;           -- profil ham (cascade) o'chadi
  return paths;
end $$;
