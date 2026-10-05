-- Soliq va Ombor Hisobi — Supabase bazasi
-- Supabase loyihangizda: SQL Editor → New query → shu faylni to'liq joylab, Run bosing.

create extension if not exists pgcrypto with schema extensions;

-- ===== Jadvallar =====
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  login text unique not null,
  full_name text,
  phone text,
  role text not null default 'accountant' check (role in ('admin','manager','accountant')),
  perms jsonb not null default '{}',
  firm_limit int not null default 3,
  active boolean not null default false,
  expires_at date,
  session_token text,
  must_change boolean default false,
  created_at timestamptz default now()
);

create table if not exists public.settings (id int primary key default 1, data jsonb not null default '{}');
insert into public.settings (id, data) values (1, '{"vat_rate":12,"profit_rate":15,"turnover_rate":4}') on conflict do nothing;

create table if not exists public.firms (
  id text primary key,
  owner_id uuid not null references public.profiles(id),
  data jsonb not null default '{}',
  closed_until text,
  created_at timestamptz default now()
);

create table if not exists public.records (
  id text primary key,
  firm_id text not null references public.firms(id) on delete cascade,
  kind text not null,
  data jsonb not null,
  updated_at timestamptz default now()
);
create index if not exists records_firm_idx on public.records(firm_id);

create table if not exists public.audit (
  id bigserial primary key,
  firm_id text references public.firms(id) on delete cascade,
  user_id uuid, user_login text, action text, kind text, rec_id text, summary text,
  at timestamptz default now()
);
create index if not exists audit_firm_idx on public.audit(firm_id, at desc);

-- Yangiliklar, reklama, soliq kalendari
create table if not exists public.content (
  id text primary key,
  kind text not null check (kind in ('news','ad','cal')),
  data jsonb not null default '{}',
  created_at timestamptz default now()
);

-- Eski bazani yangilash uchun (birinchi o'rnatishda zarar qilmaydi)
alter table public.profiles add column if not exists perms jsonb not null default '{}';
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('admin','manager','accountant'));

-- ===== Yordamchi funksiyalar =====
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin' and active)
$$;

create or replace function public.is_active() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and active and (expires_at is null or expires_at >= current_date))
$$;

-- huquq: bosh admin hammasi; sayt admini (manager) — perms ichida belgilanganlari
create or replace function public.has_perm(p text) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and active and (role = 'admin' or (role = 'manager' and coalesce((perms->>p)::boolean, false))))
$$;

create or replace function public.can_firm(fid text) returns boolean language sql stable security definer set search_path = public as $$
  select public.is_active() and (public.has_perm('firms') or exists (select 1 from firms where id = fid and owner_id = auth.uid()))
$$;

create or replace function public.can_write_firm(fid text) returns boolean language sql stable security definer set search_path = public as $$
  select public.is_active() and (public.is_admin() or exists (select 1 from firms where id = fid and owner_id = auth.uid()))
$$;

-- Yangi foydalanuvchi → profil (faol emas, admin faollashtiradi)
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, login, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'login', split_part(new.email, '@', 1)), new.raw_user_meta_data->>'full_name')
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- Bitta login — bitta qurilma
create or replace function public.claim_session(token text) returns void language sql security definer set search_path = public as $$
  update profiles set session_token = token where id = auth.uid()
$$;

-- Admin buxgalter parolini almashtiradi
create or replace function public.admin_set_password(uid uuid, new_password text) returns void language plpgsql security definer set search_path = public, extensions, auth as $$
begin
  if not public.has_perm('users') then raise exception 'NOT_ADMIN'; end if;
  if exists (select 1 from public.profiles where id = uid and role in ('admin','manager')) and not public.is_admin() then raise exception 'NOT_ADMIN'; end if;
  update auth.users set encrypted_password = extensions.crypt(new_password, extensions.gen_salt('bf')) where id = uid;
  update public.profiles set session_token = null where id = uid;
end $$;

-- Buxgalter o'z rolini, limitini va muddatini o'zgartira olmaydi
create or replace function public.protect_profile() returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- SQL Editor (server) dan qilingan o'zgarishlar cheklanmaydi
  if auth.uid() is null then return new; end if;
  if not public.is_admin() then
    new.role := old.role; new.perms := old.perms; new.login := old.login;
    -- sayt admini faqat buxgalterlarning limit/muddat/holatini o'zgartiradi
    if not (public.has_perm('users') and old.role = 'accountant') then
      new.firm_limit := old.firm_limit; new.active := old.active; new.expires_at := old.expires_at;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists protect_profile on public.profiles;
create trigger protect_profile before update on public.profiles for each row execute function public.protect_profile();

-- Firmalar limiti
create or replace function public.check_firm_limit() returns trigger language plpgsql security definer set search_path = public as $$
declare lim int; cnt int; r text;
begin
  select firm_limit, role into lim, r from profiles where id = new.owner_id;
  if r = 'admin' then return new; end if;
  select count(*) into cnt from firms where owner_id = new.owner_id;
  if cnt >= coalesce(lim, 0) then raise exception 'FIRM_LIMIT'; end if;
  return new;
end $$;
drop trigger if exists firm_limit on public.firms;
create trigger firm_limit before insert on public.firms for each row execute function public.check_firm_limit();

-- Yopilgan davrni himoyalash
create or replace function public.check_period() returns trigger language plpgsql security definer set search_path = public as $$
declare cu text; d text;
begin
  select closed_until into cu from firms where id = coalesce(new.firm_id, old.firm_id);
  if cu is null or cu = '' then return coalesce(new, old); end if;
  if tg_op <> 'INSERT' and old.kind in ('doc','expense','payment','asset') then
    d := case old.kind when 'asset' then old.data->>'acquire_date' else old.data->>'date' end;
    if d is not null and substr(d, 1, 7) <= cu then raise exception 'PERIOD_CLOSED'; end if;
  end if;
  if tg_op <> 'DELETE' and new.kind in ('doc','expense','payment','asset') then
    d := case new.kind when 'asset' then new.data->>'acquire_date' else new.data->>'date' end;
    if d is not null and substr(d, 1, 7) <= cu then raise exception 'PERIOD_CLOSED'; end if;
  end if;
  return coalesce(new, old);
end $$;
drop trigger if exists period_lock on public.records;
create trigger period_lock before insert or update or delete on public.records for each row execute function public.check_period();

-- ===== Kirish huquqlari (RLS) =====
alter table public.profiles enable row level security;
alter table public.settings enable row level security;
alter table public.firms enable row level security;
alter table public.records enable row level security;
alter table public.audit enable row level security;
alter table public.content enable row level security;

drop policy if exists p_sel on public.profiles;  create policy p_sel on public.profiles for select using (id = auth.uid() or public.has_perm('users') or public.has_perm('content'));
drop policy if exists p_upd on public.profiles;  create policy p_upd on public.profiles for update using (id = auth.uid() or public.has_perm('users'));
drop policy if exists s_sel on public.settings;  create policy s_sel on public.settings for select using (auth.uid() is not null);
drop policy if exists s_adm on public.settings;  create policy s_adm on public.settings for all using (public.has_perm('rates')) with check (public.has_perm('rates'));
drop policy if exists f_sel on public.firms;     create policy f_sel on public.firms for select using (public.is_active() and (owner_id = auth.uid() or public.has_perm('firms')));
drop policy if exists f_ins on public.firms;     create policy f_ins on public.firms for insert with check (public.is_active() and (owner_id = auth.uid() or public.is_admin()));
drop policy if exists f_upd on public.firms;     create policy f_upd on public.firms for update using (public.is_active() and (owner_id = auth.uid() or public.is_admin())) with check (owner_id = auth.uid() or public.is_admin());
drop policy if exists f_del on public.firms;     create policy f_del on public.firms for delete using (public.is_admin());
drop policy if exists r_all on public.records;
drop policy if exists r_sel on public.records;   create policy r_sel on public.records for select using (public.can_firm(firm_id));
drop policy if exists r_ins on public.records;   create policy r_ins on public.records for insert with check (public.can_write_firm(firm_id));
drop policy if exists r_upd on public.records;   create policy r_upd on public.records for update using (public.can_write_firm(firm_id)) with check (public.can_write_firm(firm_id));
drop policy if exists r_del on public.records;   create policy r_del on public.records for delete using (public.can_write_firm(firm_id));
drop policy if exists a_sel on public.audit;     create policy a_sel on public.audit for select using (public.can_firm(firm_id));
drop policy if exists c_sel on public.content;   create policy c_sel on public.content for select using (public.is_active());
drop policy if exists c_all on public.content;   create policy c_all on public.content for all using (public.has_perm('content')) with check (public.has_perm('content'));
drop policy if exists a_ins on public.audit;     create policy a_ins on public.audit for insert with check (public.can_firm(firm_id) and user_id = auth.uid());

-- ===== Bosh adminni tayinlash =====
-- 1) Authentication → Users → Add user: email = admin@soliq-hisob.app, parol (Auto confirm belgilansin)
-- 2) Keyin shu qatorni ishga tushiring:
-- update public.profiles set role = 'admin', active = true, firm_limit = 999 where login = 'admin';
