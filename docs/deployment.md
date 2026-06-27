# Deployment Operativo

## Principios

- No desplegar frontend si la migracion SQL equivalente no fue auditada.
- No editar migraciones historicas para "arreglar" produccion.
- No publicar funciones ni RPCs sin verificacion posterior.

## Flujo recomendado

### 1. Preparacion local

```bash
npm run audit:migrations
npx tsc -b --pretty false
npm run build:frontend-check
git diff --check
```

### 2. Verificacion de impacto SQL

```bash
npx --yes supabase db push --linked --dry-run
```

Validar:

- migraciones a aplicar
- que no existan sorpresas fuera de alcance
- que la baseline legacy no haya derivado

### 3. Publicacion SQL

```bash
npx --yes supabase db push --linked --include-all
```

### 4. Publicacion de funciones, si aplica

```bash
npx --yes supabase functions deploy <function_name> --project-ref <ref> --use-api --yes
```

### 5. Humo remoto

Validar al menos uno de estos caminos:

- `supabase db query --linked`
- RPC puntual via Supabase
- `pg_get_functiondef(...)`
- lectura de `pg_indexes` o tablas nuevas

### 6. Publicacion de frontend

Solo despues de confirmar SQL/funciones si el cambio dependia de ellas.

## Evidencia minima a guardar

- migracion versionada
- comandos ejecutados
- resultado en `tasks/todo.md`
- commit y push trazables

## No hacer

- ejecutar SQL manual aislado sin versionarlo;
- empujar frontend que depende de una RPC aun no aplicada;
- mezclar despliegue funcional con cambios de limpieza no auditados.
