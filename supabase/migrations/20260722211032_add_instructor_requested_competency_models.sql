begin;

with source_types(code, name, sort_order) as (
  values
    ('minibus', 'Mini Bus', 10),
    ('bus-1-piso', 'Bus 1 Piso', 20),
    ('bus-1-1-2-piso', 'Bus 1 1/2 Piso', 25),
    ('bus-2-pisos', 'Bus 2 Pisos', 30),
    ('taxibus', 'Taxibus', 40)
)
insert into public.competency_equipment_types (code, name, sort_order, is_active)
select code, name, sort_order, true
from source_types
on conflict (code) do update
set
  name = excluded.name,
  sort_order = excluded.sort_order,
  is_active = true,
  updated_at = timezone('utc', now());

with source_brands(code, name, sort_order) as (
  values
    ('king-long', 'KING LONG', 75),
    ('yutong', 'YUTONG', 70)
)
insert into public.competency_equipment_brands (code, name, sort_order, is_active)
select code, name, sort_order, true
from source_brands
on conflict (code) do update
set
  name = excluded.name,
  sort_order = excluded.sort_order,
  is_active = true,
  updated_at = timezone('utc', now());

with source_models(brand_code, type_code, model_code, model_name, notes) as (
  values
    ('mercedes-benz', 'bus-1-1-2-piso', 'mercedes-benz-o-500-rsd-bus-1-1-2', 'O 500 RSD', 'Solicitud instructores 2026-07-22'),
    ('scania', 'bus-1-piso', 'scania-f-310-hb-bus-1', 'F 310 HB', 'Solicitud instructores 2026-07-22'),
    ('scania', 'bus-1-piso', 'scania-k410-c-bus-1', 'K410 C', 'Solicitud instructores 2026-07-22'),
    ('scania', 'bus-1-1-2-piso', 'scania-k-440-ib-bus-1-1-2', 'K 440 IB', 'Solicitud instructores 2026-07-22'),
    ('scania', 'bus-2-pisos', 'scania-k400-c-bus-2', 'K400 C', 'Solicitud instructores 2026-07-22'),
    ('scania', 'bus-2-pisos', 'scania-k-450-c-bus-2', 'K 450-C', 'Solicitud instructores 2026-07-22'),
    ('volvo', 'bus-1-1-2-piso', 'volvo-b-450-r-bus-1-1-2', 'B 450 R', 'Solicitud instructores 2026-07-22'),
    ('maxus', 'minibus', 'maxus-delibery-9-e-delibery-9', 'DELIBERY -9 - E DELIBERY -9', 'Solicitud instructores 2026-07-22'),
    ('king-long', 'bus-1-piso', 'king-long-xmq6130-e-bus-1', 'XMQ6130 E', 'Solicitud instructores 2026-07-22')
)
insert into public.competency_equipment_models (brand_id, type_id, code, name, notes, is_active)
select
  brand.id,
  equipment_type.id,
  source.model_code,
  source.model_name,
  source.notes,
  true
from source_models source
join public.competency_equipment_brands brand on brand.code = source.brand_code
join public.competency_equipment_types equipment_type on equipment_type.code = source.type_code
on conflict (code) do update
set
  brand_id = excluded.brand_id,
  type_id = excluded.type_id,
  name = excluded.name,
  notes = excluded.notes,
  is_active = true,
  updated_at = timezone('utc', now());

update public.competency_equipment_models model
set
  type_id = equipment_type.id,
  name = 'ZK6709 H',
  notes = coalesce(nullif(trim(model.notes), '') || '; ', '') || 'Reclasificado desde Taxibus a Bus 1 Piso por solicitud instructores 2026-07-22',
  is_active = true,
  updated_at = timezone('utc', now())
from public.competency_equipment_brands brand,
     public.competency_equipment_types equipment_type
where model.brand_id = brand.id
  and brand.code = 'yutong'
  and equipment_type.code = 'bus-1-piso'
  and model.code = 'yutong-c9-zk6709h';

insert into public.competency_equipment_models (brand_id, type_id, code, name, notes, is_active)
select
  brand.id,
  equipment_type.id,
  'yutong-zk6709-h-bus-1',
  'ZK6709 H',
  'Solicitud instructores 2026-07-22; respaldo si el codigo legacy no existe',
  true
from public.competency_equipment_brands brand
join public.competency_equipment_types equipment_type on equipment_type.code = 'bus-1-piso'
where brand.code = 'yutong'
  and not exists (
    select 1
    from public.competency_equipment_models existing
    where existing.code = 'yutong-c9-zk6709h'
  )
on conflict (code) do update
set
  brand_id = excluded.brand_id,
  type_id = excluded.type_id,
  name = excluded.name,
  notes = excluded.notes,
  is_active = true,
  updated_at = timezone('utc', now());

notify pgrst, 'reload schema';

commit;
