begin;

insert into public.competency_equipment_types (code, name, sort_order, is_active)
values ('camioneta', 'Camioneta', 50, true)
on conflict (code) do update
set
  name = excluded.name,
  sort_order = excluded.sort_order,
  is_active = true,
  updated_at = timezone('utc', now());

with source_brands(code, name, sort_order) as (
  values
    ('mitsubishi', 'MITSUBISHI', 25),
    ('toyota', 'TOYOTA', 45)
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

with source_models(brand_code, type_code, model_code, model_name) as (
  values
    ('toyota', 'camioneta', 'toyota-hilux-fortuner-4x4', 'Hilux / Fortuner 4x4'),
    ('mitsubishi', 'camioneta', 'mitsubishi-l200-4x4', 'L200 4X4'),
    ('maxus', 'camioneta', 'maxus-t60-4x4', 'T60 4X4'),
    ('mercedes-benz', 'minibus', 'mercedes-benz-sprinter-516-4x4', 'Sprinter 516 4x4')
)
insert into public.competency_equipment_models (
  brand_id,
  type_id,
  code,
  name,
  notes,
  is_active
)
select
  brand.id,
  equipment_type.id,
  source.model_code,
  source.model_name,
  'Solicitud de incorporacion de vehiculos 4x4 2026-08-04',
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

do $validation$
declare
  matching_models integer;
begin
  select count(*)
  into matching_models
  from (
    values
      ('toyota', 'camioneta', 'toyota-hilux-fortuner-4x4', 'Hilux / Fortuner 4x4'),
      ('mitsubishi', 'camioneta', 'mitsubishi-l200-4x4', 'L200 4X4'),
      ('maxus', 'camioneta', 'maxus-t60-4x4', 'T60 4X4'),
      ('mercedes-benz', 'minibus', 'mercedes-benz-sprinter-516-4x4', 'Sprinter 516 4x4')
  ) as expected(brand_code, type_code, model_code, model_name)
  join public.competency_equipment_models model
    on model.code = expected.model_code
   and model.name = expected.model_name
   and model.is_active = true
  join public.competency_equipment_brands brand
    on brand.id = model.brand_id
   and brand.code = expected.brand_code
   and brand.is_active = true
  join public.competency_equipment_types equipment_type
    on equipment_type.id = model.type_id
   and equipment_type.code = expected.type_code
   and equipment_type.is_active = true;

  if matching_models <> 4 then
    raise exception 'No se pudieron confirmar los cuatro modelos 4x4 del catalogo de competencias';
  end if;
end;
$validation$;

notify pgrst, 'reload schema';

commit;
