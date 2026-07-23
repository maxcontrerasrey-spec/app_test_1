---
document_id: EEES-BASELINE-PERFORMANCE-P4-V1
title: Performance Baseline P4 v1
version: 1.0.1
status: Activo
language: es-CL
owner: Quality
repository_scope: ERP completo
baseline_date: 2026-07-22
---

# Performance Baseline P4 v1

## Alcance medido

Baseline inicial de performance P4 medido desde el build productivo y smokes ejecutables. El tamano canonico corresponde al artefacto de CI con `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` publicas inyectadas, igual que el despliegue. No define thresholds funcionales arbitrarios; registra el estado actual como control anti-regresion para que aumentos futuros se justifiquen con evidencia.

## Comandos ejecutados

- Build productivo: `npm run build`.
- Build instrumentado: `npm run build:frontend-check`.
- Smoke rutas criticas: `npm run smoke:frontend-routes`.
- Auditor performance: `npm run audit:performance-baseline`.

## Bundle medido

- dist total medido: 10,666,243 bytes.
- JS total medido: 3,022,926 bytes.
- `dist` total: 10,666,243 bytes.
- Archivos JS: 51.
- JS total: 3,022,926 bytes.
- Archivos CSS: 10.
- CSS total: 213,123 bytes.
- Mayor asset total: `dist/assets/fondo-D3Rn61W4.png`, 5,257,091 bytes.
- Mayor mapa: `dist/maps/chile.json`, 1,454,860 bytes.
- Mayor vendor JS: `echarts-vendor`, 512,504 bytes.
- Exportador XLSX lazy: `xlsx-vendor`, 500,059 bytes.
- PDF lazy: `pdf-vendor`, 430,776 bytes.
- Supabase vendor: `supabase-vendor`, 221,867 bytes.
- App framework: `app-framework`, 208,819 bytes.

Revision 2026-07-23: el total global sube 671 bytes por el helper testeado que calcula `Tiempo Abierto` en reclutamiento desde `opened_at`. No agrega vendors, rutas lazy ni CSS; los limites especificos de JS, CSS y assets trackeados permanecen bajo baseline.

## Rutas criticas smoke

- `/login`: carga publica validada por `smoke:frontend-routes`.
- `/operaciones/resumen`: ruta protegida valida redirect a `/login` sin sesion.
- Resultado smoke: PASS.

## Superficie critica clasificada

- Queries costosas ya optimizadas y protegidas: `submit_service_entries_batch(jsonb)` usa preparacion set-based materializada una vez; `search` operacional BUK limita por texto y ranking antes de enriquecer.
- RPCs criticas con smokes/audits: operaciones batch, dashboard/auth routes, migraciones, seguridad Supabase, sync BUK Edge Function.
- Vendors pesados esperados fuera del entry inicial: ECharts, XLSX, PDF y QR siguen lazy por modulo/accion.

## Control machine-readable

<!-- EEES_PERFORMANCE_BASELINE_JSON -->
```json
{
  "distTotalBytes": 10666243,
  "jsFileCount": 51,
  "jsTotalBytes": 3022926,
  "cssFileCount": 10,
  "cssTotalBytes": 213123,
  "trackedAssets": [
    { "match": "fondo-", "maxBytes": 5257091 },
    { "match": "maps/chile.json", "maxBytes": 1454860 },
    { "match": "echarts-vendor", "maxBytes": 512504 },
    { "match": "xlsx-vendor", "maxBytes": 500059 },
    { "match": "pdf-vendor", "maxBytes": 430776 },
    { "match": "supabase-vendor", "maxBytes": 221867 },
    { "match": "app-framework", "maxBytes": 208819 }
  ]
}
```

## Politica de actualizacion

- Si un asset trackeado supera el baseline, se debe demostrar beneficio funcional o reduccion de riesgo y actualizar este archivo en el mismo cambio.
- Si aparece un nuevo vendor pesado, debe quedar clasificado como lazy, accion especifica o deuda justificada.
- Si una ruta critica nueva se agrega al ERP, debe sumarse a smokes o quedar clasificada con owner.
