# Matriz Propuesta de Acceso

Base: [`usuarios_busesjm.xlsx`](/Users/maximilianocontrerasrey/Documents/GitHub/usuarios_busesjm.xlsx)

## Roles normalizados

| Excel | Sistema |
| --- | --- |
| `control de contratos` | `control_contratos` |
| `operaciones_L_1` | `operaciones_l_1` |
| `operaciones_L_2` | `operaciones_l_2` |
| `Jefe_administrativo` | `jefe_administrativo` |

## Modulos

| Rol | solicitud_contrataciones | movilidad_interna | control_contrataciones | jornadas_turnos | recursos_humanos | bi_analytics |
| --- | --- | --- | --- | --- | --- | --- |
| director_eje | si | si | si | si | si | si |
| gerente_general | si | si | si | si | si | si |
| director_op | si | si | si | si | si | si |
| gerencia | si | si | si | si | si | si |
| reclutamiento | si | si | si | si | si | si |
| operaciones_l_1 | si | si | no | si | si | si |
| operaciones_l_2 | si | no | no | si | si | no |
| administrativo | si | si | si | si | si | si |
| control_contratos | si | si | no | si | si | si |
| jefe_administrativo | si | si | si | si | si | si |
| admin | si | si | si | si | si | si |

## Submodulos

### control_contrataciones

| Rol | resumen_procesos | control_candidatos | personal_a_contratar | sub_movilidad_interna |
| --- | --- | --- | --- | --- |
| director_eje | si | no | no | no |
| gerente_general | si | no | no | no |
| director_op | si | no | no | no |
| gerencia | si | no | no | no |
| reclutamiento | si | si | si | si |
| operaciones_l_1 | no | no | no | no |
| operaciones_l_2 | no | no | no | no |
| administrativo | no | no | si | si |
| control_contratos | no | no | no | no |
| jefe_administrativo | si | si | si | si |
| admin | si | si | si | si |

### jornadas_turnos

| Rol | calendario | asignar_pauta | gestor_pautas |
| --- | --- | --- | --- |
| director_eje | si | no | no |
| gerente_general | si | no | no |
| director_op | si | no | no |
| gerencia | si | si | no |
| reclutamiento | si | no | no |
| operaciones_l_1 | si | no | no |
| operaciones_l_2 | si | no | no |
| administrativo | si | no | no |
| control_contratos | si | no | no |
| jefe_administrativo | si | no | no |
| admin | si | si | si |

### recursos_humanos

| Rol | registrar_incentivo | aprobaciones | historial | configuracion_base |
| --- | --- | --- | --- | --- |
| director_eje | no | no | si | no |
| gerente_general | no | no | si | no |
| director_op | no | no | si | no |
| gerencia | si | si | si | no |
| reclutamiento | no | no | no | no |
| operaciones_l_1 | no | si | si | no |
| operaciones_l_2 | si | no | no | no |
| administrativo | no | no | si | no |
| control_contratos | no | no | si | si |
| jefe_administrativo | si | si | si | no |
| admin | si | si | si | si |

### bi_analytics

| Rol | bi_dotacion | bi_incentivos | bi_reclutamiento |
| --- | --- | --- | --- |
| director_eje | si | si | no |
| gerente_general | si | si | no |
| director_op | si | si | no |
| gerencia | si | si | no |
| reclutamiento | si | si | no |
| operaciones_l_1 | si | si | no |
| operaciones_l_2 | no | no | no |
| administrativo | si | si | no |
| control_contratos | si | si | no |
| jefe_administrativo | si | si | no |
| admin | si | si | si |

## Workflow y capabilities

Esto no debe quedar solo como modulo o submodulo:

| Concepto Excel | Implementacion sugerida |
| --- | --- |
| aprobador_who | capability `can_approve_who_stage` |
| control de candidatos | capability `candidate_control_access` |
| aprobador_folios_area | workflow por `cost_center_approvers` |
| aprobador_folios_control_contratos | workflow real del folio, no rol fijo |
| aprobador_incentivos_1 | approval step real por `approver_user_id` |
| aprobador_incentivos_2 | approval step real por `approver_user_id` |
| pendiente_Ejecucion_RRHH | estado de workflow, no rol |
| ejecutado_RRHH | estado de workflow, no rol |

## Admin only

Todo lo no contemplado en el Excel debe quedar solo para `admin`:

| Codigo |
| --- |
| acreditacion_personas |
| alta_operacional_personal |
| ai_assistant |
| operaciones |
| certificados |
| seguimiento_certificados |
| bi_reclutamiento |

## Criterio de implementacion

1. Mantener `role_module_access` para modulos principales.
2. Agregar permisos finos para submodulos.
3. Mantener approvals y ejecuciones como workflow, no como rol fijo.
4. Todo lo no definido arriba queda solo para `admin`.
