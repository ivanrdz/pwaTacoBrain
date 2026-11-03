-- TacoBrain: herramientas para decidir.
-- Recetas de productos (para saber cuánto cuesta y cuánto deja cada uno)
-- y motivo de las bajas de inventario (uso o merma).
-- Los gastos fijos, los días que abre y la meta semanal viven en negocios.config (jsonb).

-- [{ "insumoId": uuid, "cantidad": número en la unidad del insumo }]
alter table public.productos
  add column if not exists receta jsonb not null default '[]'::jsonb;

alter table public.productos
  add constraint productos_receta_lista check (jsonb_typeof(receta) = 'array');

-- "uso" = se sacó para vender; "merma" = se echó a perder o se tiró. Solo en bajas.
alter table public.movs_inventario
  add column if not exists motivo text
    check (motivo in ('uso', 'merma'));

update public.movs_inventario set motivo = 'uso' where tipo = 'baja' and motivo is null;
