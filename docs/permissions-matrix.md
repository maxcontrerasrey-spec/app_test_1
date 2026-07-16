# Matriz de Roles y Permisos

## Como se resuelven hoy los permisos

1. AuthContext llama `public.get_my_effective_permissions()`.
2. La RPC devuelve `profile`, `app_roles`, `accessible_modules`, `capabilities`, `is_super_admin`.
3. `RouteGuards.tsx` bloquea por modulo o admin.
4. Las RPCs criticas vuelven a validar con helpers `user_can_*`.

Eso significa que el frontend filtra navegacion, pero la autorizacion real vive en SQL.

## Modulos visibles en frontend

| Modulo | Ruta | Guardia frontend |
| --- | --- | --- |
| `solicitud_contrataciones` | `/solicitud-contrataciones` | `RoleProtectedRoute` |
| `movilidad_interna` | `/movilidad-interna` | `RoleProtectedRoute` |
| `control_contrataciones` | `/control-contrataciones` | `RoleProtectedRoute` |
| `alta_operacional_personal` | `/alta-operacional` | `RoleProtectedRoute` |
| `operaciones` | `/operaciones/*` | `RoleProtectedRoute` |
| `recursos_humanos` | `/recursos-humanos/*` | `RoleProtectedRoute` + roles para analytics |
| `jornadas_turnos` | `/roster` | `RoleProtectedRoute` |
| `acreditacion_personas` | `/recursos-humanos/acreditacion/*` | `RoleProtectedRoute` |
| `certificados` | `/certificados` | `RoleProtectedRoute` |
| `seguimiento_certificados` | `/seguimiento-certificados` | `RoleProtectedRoute` + redirect a `/certificados` |
| `bi_analytics` | `/bi/*` | `RoleProtectedRoute` |
| `ai_assistant` | `/copiloto-ia` | `AdminProtectedRoute` |

## Capabilities finas vigentes

| Capability | Uso actual |
| --- | --- |
| `candidate_control_access` | desbloquea control documental/candidatos dentro de reclutamiento |
| `can_approve_who_stage` | habilita aprobaciones Who sin depender solo del modulo |

## Matriz operativa resumida

| Rol | Modulos/responsabilidades actuales |
| --- | --- |
| `admin` | todos los modulos activos y todas las capabilities activas |
| `reclutamiento` | solicitud, control, movilidad; capability `candidate_control_access` |
| `control_contratos` | control, solicitud, movilidad, RRHH, roster, acreditacion, BI |
| `operaciones` | operaciones, roster, acreditacion |
| `gerencia` | solicitud, movilidad, roster, acreditacion, BI |
| `director_eje` | solicitud, movilidad, roster, acreditacion, BI |
| `director_op` | solicitud, movilidad, roster, acreditacion, BI, capability `can_approve_who_stage` |
| `gerente_general` | solicitud, control, movilidad, roster, acreditacion, BI, capability `can_approve_who_stage` |
| `operaciones_l_1` | solicitud, movilidad, roster, acreditacion, BI |
| `operaciones_l_2` | solicitud, movilidad, roster, acreditacion |
| `administrativo` | solicitud, movilidad, roster, acreditacion |
| `jefe_administrativo` | union efectiva de `administrativo` + `reclutamiento` |
| `certificaciones` | certificados y seguimiento de certificados; puede operar seleccion editable de instructor |
| `instructor` | certificados y seguimiento de certificados; instructor autoseleccionado/no editable cuando la cuenta esta vinculada |

## Reglas de diseno vigentes

- La visibilidad de ruta nunca reemplaza validacion SQL.
- Las acciones criticas deben usar helpers `user_can_*` o `assert_*`.
- `service_role` no puede reemplazar identidad de usuario en flujos interactivos.
- Si un rol compuesto nace por negocio, debe materializarse en SQL y no en `if` locales de React.

## Hallazgos de coherencia

- El frontend ya esta alineado con `accessible_modules`, no con allowlists por correo.
- `jefe_administrativo` esta bien modelado como rol acumulativo en SQL.
- El modulo AI sigue siendo admin-only en frontend; no existe una superficie productiva general para `ai_assistant`.
- Certificacion de competencias usa modulos separados `certificados` y `seguimiento_certificados`; la pantalla viva redirige seguimiento al mismo modulo funcional mientras se consolida el flujo.
- Sobrevive SQL legacy de onboarding con `user_can_access_module(..., 'reclutamiento')`; ese valor es un rol, no un modulo, y debe tratarse como deuda de seguridad/consistencia si ese bloque vuelve a usarse.
