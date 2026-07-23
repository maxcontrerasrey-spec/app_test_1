begin;

update public.competency_equipment_models model
set
  name = 'DELIBERY 9',
  notes = concat_ws(
    '; ',
    nullif(trim(model.notes), ''),
    'Correccion visual catalogo certificados 2026-07-23: la opcion MAXUS inicial debe decir DELIBERY 9'
  ),
  updated_at = timezone('utc', now())
from public.competency_equipment_brands brand,
     public.competency_equipment_types equipment_type
where model.brand_id = brand.id
  and model.type_id = equipment_type.id
  and brand.code = 'maxus'
  and equipment_type.code = 'minibus'
  and model.code = 'maxus-delibery-9-e-delibery-9'
  and model.name = 'DELIBERY -9 - E DELIBERY -9';

do $$
begin
  if not exists (
    select 1
    from public.competency_equipment_models model
    join public.competency_equipment_brands brand on brand.id = model.brand_id
    join public.competency_equipment_types equipment_type on equipment_type.id = model.type_id
    where brand.code = 'maxus'
      and equipment_type.code = 'minibus'
      and model.code = 'maxus-delibery-9-e-delibery-9'
      and model.name = 'DELIBERY 9'
      and model.is_active = true
  ) then
    raise exception 'No se pudo confirmar el modelo MAXUS DELIBERY 9 corregido';
  end if;
end $$;

notify pgrst, 'reload schema';

commit;
