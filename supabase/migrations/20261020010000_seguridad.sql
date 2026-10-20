-- TacoBrain: seguridad.
-- 1) Límite diario de lecturas de tickets con IA por cuenta (para que nadie te genere una factura).
-- 2) Fotos de tickets: máximo 5 MB y solo imágenes.
-- 3) Ninguna tabla es accesible sin sesión, aunque se agregue una política por error.

create table if not exists public.uso_ia (
  owner_id uuid not null references auth.users (id) on delete cascade,
  fecha date not null,
  lecturas integer not null default 0,
  primary key (owner_id, fecha)
);

alter table public.uso_ia enable row level security;

-- Cada cuenta puede ver su consumo; nadie puede escribirlo directo (solo la función de abajo).
create policy "uso_ia: ver el mío" on public.uso_ia
  for select to authenticated
  using (owner_id = (select auth.uid()));

-- Suma una lectura a la cuenta que llama y dice si todavía está dentro del límite.
-- La Edge Function leer-ticket la llama con el token del usuario ANTES de pagar al modelo.
create or replace function public.consumir_lectura_ia(p_limite integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_lecturas integer;
begin
  if v_uid is null then
    return false;
  end if;
  insert into public.uso_ia as u (owner_id, fecha, lecturas)
  values (v_uid, (now() at time zone 'America/Mexico_City')::date, 1)
  on conflict (owner_id, fecha) do update set lecturas = u.lecturas + 1
  returning lecturas into v_lecturas;
  return v_lecturas <= greatest(p_limite, 0);
end;
$$;

revoke all on function public.consumir_lectura_ia(integer) from public, anon;
grant execute on function public.consumir_lectura_ia(integer) to authenticated;

-- Fotos: tamaño y tipo
update storage.buckets
set file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id = 'tickets';

-- Defensa en profundidad: el rol anónimo no toca ninguna tabla de la app.
revoke all on table
  public.negocios,
  public.productos,
  public.ventas,
  public.gastos,
  public.insumos,
  public.movs_inventario,
  public.movs_dinero,
  public.uso_ia
from anon;

-- La configuración siempre debe ser un objeto JSON
alter table public.negocios
  add constraint negocios_config_objeto check (jsonb_typeof(config) = 'object');
