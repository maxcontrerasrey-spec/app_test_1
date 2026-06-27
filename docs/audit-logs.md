# Audit Logs y Trazabilidad

## Estado actual

La auditoria existe hoy por dominio, no como una sola tabla transversal.

## Superficies auditadas

### Solicitudes de contratacion

- Tabla: `public.hiring_request_audit_log`
- Cubre cambios de solicitud y decisiones del flujo de aprobacion.

### Casos de reclutamiento

- Tabla: `public.recruitment_case_audit_log`
- Cubre cambios de estado, movimientos de candidatos, WHO, documentos y resincronizaciones.

### Movilidad interna

- Tabla: `public.internal_mobility_request_audit_log`
- Cubre aprobaciones, rechazos y ejecucion RRHH.

### Acreditacion

- Tabla: `public.accreditation_audit_log`
- Cubre cambios documentales y eventos de estado via `log_accreditation_event(...)`.

### Seguridad

- Tabla: `public.security_audit_logs`
- Cubre eventos de seguridad/AUP.
- `20260618163500_harden_enterprise_sql_audit_followups.sql` elimino una policy muerta de insert.

### Alta operacional

- Tabla: `public.employee_onboarding_activity_log`
- Cubre cambios sobre casos, tasks y evidencias mediante triggers.

## Cobertura que aun falta endurecer

- Operaciones no tiene todavia un audit envelope transversal equivalente al de reclutamiento.
- No existe una tabla generica `audit_logs` para correlacionar eventos cross-modulo.
- No hay una convencion uniforme de `metadata jsonb` entre todos los logs.

## Reglas que ya deben respetarse

- el actor debe salir de `auth.uid()` o contexto backend controlado;
- los logs no deben ser editables desde frontend;
- la lectura debe seguir RLS o helpers de dominio;
- cualquier cambio de permisos o elevacion debe quedar trazado.

## Recomendacion incremental

1. Mantener los logs de dominio actuales.
2. No reescribir historicos.
3. Introducir una tabla transversal solo para nuevos dominios o para federar eventos criticos futuros.
4. Priorizar `operaciones` y cambios de matriz de permisos como siguiente cobertura a unificar.
