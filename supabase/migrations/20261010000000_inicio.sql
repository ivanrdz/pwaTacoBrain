-- TacoBrain: tablas del MVP.
-- Cada taquería es una cuenta (auth.users). RLS hace que cada cuenta vea solo sus datos,
-- así la misma app sirve para muchas taquerías.

create table if not exists public.negocios (
  owner_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  nombre text not null default 'Mi taquería',
  creado_en timestamptz not null default now()
);

create table if not exists public.productos (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nombre text not null check (length(trim(nombre)) > 0),
  precio numeric(10, 2) not null check (precio >= 0),
  color text not null default '#B4410F',
  orden integer not null default 0,
  activo boolean not null default true,
  creado_en timestamptz not null default now()
);
create index if not exists productos_owner_idx on public.productos (owner_id, orden);

-- El id lo genera el celular: así una venta guardada sin internet no se duplica al subirse.
create table if not exists public.ventas (
  id uuid primary key,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  total numeric(10, 2) not null check (total >= 0),
  -- [{ "productoId", "nombre", "precio", "cantidad" }] copiado al momento de vender
  items jsonb not null default '[]'::jsonb,
  creada_en timestamptz not null default now()
);
create index if not exists ventas_owner_fecha_idx on public.ventas (owner_id, creada_en);

create table if not exists public.gastos (
  id uuid primary key,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  proveedor text,
  fecha date not null default current_date,
  total numeric(10, 2) not null check (total >= 0),
  foto_path text,
  creado_en timestamptz not null default now()
);
create index if not exists gastos_owner_fecha_idx on public.gastos (owner_id, fecha);

alter table public.negocios enable row level security;
alter table public.productos enable row level security;
alter table public.ventas enable row level security;
alter table public.gastos enable row level security;

create policy "negocios del dueño" on public.negocios
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "productos del dueño" on public.productos
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "ventas del dueño" on public.ventas
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "gastos del dueño" on public.gastos
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

-- Fotos de tickets: bucket privado, cada cuenta en su carpeta <uid>/...
insert into storage.buckets (id, name, public)
values ('tickets', 'tickets', false)
on conflict (id) do nothing;

create policy "tickets: leer los míos" on storage.objects
  for select to authenticated
  using (bucket_id = 'tickets' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "tickets: subir los míos" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'tickets' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "tickets: reemplazar los míos" on storage.objects
  for update to authenticated
  using (bucket_id = 'tickets' and (storage.foldername(name))[1] = (select auth.uid())::text);
