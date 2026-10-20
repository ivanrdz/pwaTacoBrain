-- TacoBrain: métodos de cobro, comisiones, categorías de gasto, inventario y
-- movimientos de dinero para el estado de resultados y el balance general.

-- Ventas: cómo pagaron, por dónde llegó el pedido y cuánto se queda el banco o la app
alter table public.ventas
  add column if not exists metodo text not null default 'efectivo'
    check (metodo in ('efectivo', 'transferencia', 'tarjeta', 'app')),
  add column if not exists canal text not null default 'mostrador'
    check (canal in ('mostrador', 'rappi', 'uber', 'didi')),
  add column if not exists comision numeric(10, 2) not null default 0 check (comision >= 0);

-- Gastos: categoría (insumos = costo de ventas), de qué cuenta salió y renglones del ticket
alter table public.gastos
  add column if not exists categoria text not null default 'insumos'
    check (categoria in ('insumos', 'renta', 'gas', 'luz', 'sueldos', 'otro')),
  add column if not exists cuenta text not null default 'efectivo'
    check (cuenta in ('efectivo', 'banco')),
  -- [{ "nombre", "cantidad", "unidad", "total" }]
  add column if not exists items jsonb not null default '[]'::jsonb;

-- Configuración financiera: comisiones %, caja y banco iniciales, equipo y deudas
alter table public.negocios
  add column if not exists config jsonb not null default '{}'::jsonb;

-- Insumos del inventario (carne, tortilla, verdura...)
create table if not exists public.insumos (
  id uuid primary key,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nombre text not null check (length(trim(nombre)) > 0),
  unidad text not null default 'kg' check (unidad in ('kg', 'pza', 'paq', 'lt')),
  creado_en timestamptz not null default now()
);
create index if not exists insumos_owner_idx on public.insumos (owner_id, nombre);

-- Entradas (compras) y bajas (lo que se sacó) del inventario
create table if not exists public.movs_inventario (
  id uuid primary key,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  insumo_id uuid not null references public.insumos (id) on delete cascade,
  tipo text not null check (tipo in ('entrada', 'baja')),
  cantidad numeric(12, 3) not null check (cantidad > 0),
  -- solo entradas: lo que costó esa cantidad
  costo numeric(12, 2) not null default 0 check (costo >= 0),
  fecha date not null default current_date,
  gasto_id uuid references public.gastos (id) on delete set null,
  creado_en timestamptz not null default now()
);
create index if not exists movs_inventario_owner_fecha_idx on public.movs_inventario (owner_id, fecha);

-- Retiros del dueño y abonos a deudas (salidas de dinero que no son gasto)
create table if not exists public.movs_dinero (
  id uuid primary key,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  tipo text not null check (tipo in ('retiro', 'abono')),
  monto numeric(12, 2) not null check (monto > 0),
  cuenta text not null default 'efectivo' check (cuenta in ('efectivo', 'banco')),
  -- id de la deuda dentro de negocios.config.deudas
  deuda_id text,
  fecha date not null default current_date,
  creado_en timestamptz not null default now()
);
create index if not exists movs_dinero_owner_fecha_idx on public.movs_dinero (owner_id, fecha);

alter table public.insumos enable row level security;
alter table public.movs_inventario enable row level security;
alter table public.movs_dinero enable row level security;

create policy "insumos del dueño" on public.insumos
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "movs_inventario del dueño" on public.movs_inventario
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "movs_dinero del dueño" on public.movs_dinero
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
