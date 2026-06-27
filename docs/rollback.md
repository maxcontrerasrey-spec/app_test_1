# Rollback y Mitigacion

## Regla principal

En este repo, el rollback preferido no es editar historia SQL. El camino seguro suele ser:

1. revert de frontend;
2. forward-fix SQL versionado;
3. restore de datos solo si el cambio fue destructivo y existe respaldo.

## Casos

### Frontend sin cambio SQL

- usar `git revert <commit>`;
- validar `tsc`, build y diff limpio;
- redeploy frontend.

### RPC/SQL con error no destructivo

- no modificar migraciones ya aplicadas;
- crear una migracion nueva de correccion;
- aplicar con `supabase db push --linked --include-all`;
- humear la RPC corregida.

### Edge Function con regression

- revert del codigo de la funcion;
- redeploy de la function puntual;
- verificar ejecucion o logs del flujo.

### Cambio de datos productivos

- si hubo mutacion incorrecta de datos, documentar alcance y usar restauracion controlada;
- nunca improvisar updates manuales sin dejar version y evidencia.

## Checklist de mitigacion

- identificar si el problema es UI, permiso, RLS, RPC, trigger o data;
- aislar commit/migracion/function responsable;
- decidir `revert` vs `forward-fix`;
- validar humo real del flujo afectado;
- registrar causa raiz y mitigacion en `tasks/todo.md` y `tasks/lessons.md`.
