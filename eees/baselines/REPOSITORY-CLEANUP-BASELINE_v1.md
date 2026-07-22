---
document_id: EEES-BASELINE-REPOSITORY-CLEANUP
title: Repository Cleanup Baseline
version: 1.0.0
status: Activo
language: es-CL
owner: Engineering Governance
repository_scope: ERP completo
baseline_date: 2026-07-22
---

# Repository Cleanup Baseline

## Baseline previo

Medido antes de eliminar residuos confirmados.

| Metrica | Valor |
| --- | ---: |
| Archivos versionados | 737 |
| Archivos worktree sin `node_modules`, `dist`, `coverage`, `.git` | 784 |
| Archivos TS/TSX en `src` | 202 |
| LOC TS/TSX en `src` | 44.403 |
| Componentes TS/TSX | 70 |
| Hooks TS/TSX | 17 |
| Services TS/TSX | 24 |
| Helpers/lib TS/TSX | 30 |
| Types TS/TSX | 10 |
| Tests versionados | 13 |
| Edge Functions | 11 |
| Migraciones SQL | 347 |
| SQL functions/RPC detectadas | 777 |
| Scripts npm | 31 |
| Scripts propios `.mjs` | 32 |
| Dependencias directas | 18 |
| DevDependencies directas | 9 |
| Workflows GitHub | 5 |
| `dist` total | 10.719.087 bytes |
| Archivos en `dist` | 89 |
| Guardian | 0 errores, 0 warnings |

## Baseline posterior

Medido despues de los lotes validados de limpieza.

| Metrica | Valor |
| --- | ---: |
| Archivos versionados proyectados | 711 |
| Archivos worktree sin `node_modules`, `dist`, `coverage`, `.git` | 759 |
| Archivos TS/TSX en `src` | 200 |
| LOC TS/TSX en `src` | 44.250 |
| Componentes TS/TSX | 70 |
| Hooks TS/TSX | 17 |
| Services TS/TSX | 23 |
| Helpers/lib TS/TSX | 30 |
| Types TS/TSX | 10 |
| Tests versionados | 13 |
| Edge Functions | 11 |
| Migraciones SQL | 347 |
| SQL functions/RPC detectadas | 777 |
| Scripts npm | 32 |
| Scripts propios `.mjs` | 28 |
| Dependencias directas | 15 |
| DevDependencies directas | 9 |
| Workflows GitHub | 5 |
| `dist` total | 10.658.698 bytes |
| Archivos en `dist` | 82 |
| Guardian | 0 errores, 0 warnings |

## Reduccion medida

- Archivos eliminados: 26.
- Dependencias directas eliminadas: 3.
- Scripts propios eliminados: 5.
- LOC TS/TSX reducidas: 153.
- `dist` reducido: 60.389 bytes.
- Objetos DB removidos: 0.
