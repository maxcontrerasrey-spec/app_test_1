# Plan Corregido Fase 2: Reclutamiento y Operaciones

Este documento aterriza el plan funcional de mejoras de Reclutamiento y Operaciones sobre la arquitectura **real** del repositorio. No reemplaza el objetivo de negocio; corrige la forma de implementarlo para no introducir una segunda arquitectura paralela.

## Objetivo

Implementar tres mejoras operativas:

1. Metodología de pasajes definida por Control de Contratos al aprobar.
2. Nuevo pipeline de candidatos con etapa `Who` bloqueada por aprobación.
3. Nueva `Ficha del Trabajador` como tercera pestaña del detalle del candidato.

## Principio de implementación

Los cambios se implementarán sobre las piezas actuales del sistema:

- Aprobaciones: `TasksWidget.tsx`, `ApprovalModal.tsx`, `hiringWorkflow.ts`, `decide_hiring_request_approval_v2(...)`
- Control de candidatos: `HiringCandidatesView.tsx`, `CandidateDetailSidebar.tsx`, `hiringControl.ts`, `advance_recruitment_candidate_stage(...)`
- Detalle de caso/candidato: `get_recruitment_case_detail(...)`, `get_recruitment_control_dashboard_v2(...)`

No se crearán componentes paralelos que hoy no existen, como `CandidateBoard.tsx` o `CandidateDetailModal.tsx`, salvo que más adelante se decida una reescritura explícita del módulo.

---

## 1. Metodología de Pasajes

### Decisión técnica

No se guardará el texto visible como valor de negocio. Se usarán códigos estables:

- `travel_allowance`
- `company_purchase`

El frontend seguirá mostrando los labels:

- `Bono de traslado`
- `Compra Empresa`

### Base de datos

Modificar `public.hiring_requests`:

- agregar columna `travel_methodology text null`
- agregar `CHECK (travel_methodology in ('travel_allowance', 'company_purchase'))`

Modificar RPC `decide_hiring_request_approval_v2(...)`:

- agregar parámetro opcional `p_travel_methodology text default null`
- exigirlo solo cuando:
  - el paso sea `contracts_control`
  - `pasajes = true`
  - la decisión sea `approved`
- guardar el valor en `hiring_requests`
- registrar el valor en `hiring_request_audit_log`

### Frontend

No se dejará como campo aislado en una tabla si requiere lógica condicional. La decisión debe vivir en el detalle de aprobación:

- `ApprovalModal.tsx`
- o, si se mantiene la decisión inline de `TasksWidget.tsx`, ambos puntos deben compartir el mismo contrato de validación

### Verificación

1. Si `pasajes = false`, aprobar sin metodología debe ser válido.
2. Si `pasajes = true`, aprobar sin metodología debe fallar en backend.
3. Si `pasajes = true`, aprobar con metodología debe persistir valor y auditoría.

---

## 2. Nuevo Pipeline con Aprobación `Who`

### Decisión técnica

No se eliminarán las etapas terminales actuales `ready_for_hire` y `hired`. El nuevo flujo debe desembocar en ellas.

### Flujo propuesto

Etapas visibles de reclutamiento:

1. `lead`
2. `who_pending`
3. `who_approved`
4. `medical_exams`
5. `document_review`
6. `ready_for_hire`
7. `hired`
8. `rejected`
9. `withdrawn`

### Aprobación de etapa `Who`

No se resolverá solo con un `stage_code`. Debe existir trazabilidad formal.

#### Base de datos

Crear tabla `public.candidate_stage_approvals`:

- `id bigint identity`
- `recruitment_case_candidate_id uuid`
- `stage_code text`
- `status text`
- `requested_by uuid`
- `requested_at timestamptz`
- `approved_by uuid null`
- `approved_at timestamptz null`
- `comment text null`

Restricciones mínimas:

- solo una aprobación activa para `who_pending` por candidato
- `status in ('pending', 'approved', 'rejected', 'cancelled')`

#### RPCs nuevas o modificadas

- modificar `advance_recruitment_candidate_stage(...)`
  - mover a `who_pending` crea o actualiza solicitud de aprobación
  - bloquear avance desde `who_pending` si no existe aprobación `approved`
- crear `approve_candidate_stage_who(...)`
  - usa `auth.uid()`
  - valida capacidad del aprobador
  - cambia la aprobación a `approved`
  - mueve al candidato a `who_approved`
  - deja auditoría

### Roles y permisos

No reutilizaría `operaciones` o `gerencia` de forma ambigua. Para ERP hay dos caminos válidos:

1. crear rol explícito `director_operaciones`
2. crear una capacidad backend específica para aprobar `Who`

Recomendación:

- crear rol `director_operaciones`
- revisar `app_roles`, `role_module_access` y el nuevo contrato de permisos efectivos

### Frontend

No se construirá un Kanban nuevo en esta fase. El flujo se implementará sobre la vista vigente:

- `HiringCandidatesView.tsx`
- `CandidateDetailSidebar.tsx`

Cambios esperados:

- nuevas etiquetas y filtros de etapa
- bloqueo visible para `who_pending`
- botón de aprobación visible solo al aprobador autorizado
- transición a `medical_exams` solo después de `who_approved`

### Verificación

1. Reclutamiento mueve a `who_pending`.
2. El candidato no puede avanzar a `medical_exams`.
3. Director de Operaciones aprueba `Who`.
4. El candidato puede avanzar a `medical_exams`.
5. Auditoría y detalle del caso muestran solicitud y aprobación.

---

## 3. Ficha del Trabajador

### Decisión técnica clave

La ficha no debe ser una sola bolsa de datos ligada solo al candidato, porque mezcla:

- datos persistentes de persona
- datos específicos de la oferta / contratación actual

### Modelo propuesto

#### A. Datos reutilizables del candidato

Mantener en perfil o tabla satélite de persona:

- nacionalidad
- fecha de nacimiento
- estado civil
- dirección, región, comuna, ciudad
- contacto de emergencia
- inclusión / discapacidad / etnia
- bomberos
- tallas
- AFP / salud base
- banco / tipo cuenta / número de cuenta

#### B. Datos específicos del ingreso actual

Crear tabla `public.candidate_worker_files` ligada a `recruitment_case_candidates`:

- `recruitment_case_candidate_id uuid unique`
- `project_name text`
- `company_entry_date date`
- `shift_name text`
- `advance_amount numeric`
- `contract_notes text`
- campos específicos del ingreso actual que dependan del folio o proyecto

### RPC

Crear `upsert_candidate_worker_file(...)`:

- `SECURITY DEFINER`
- validación con `auth.uid()`
- acceso restringido a reclutamiento / perfiles autorizados
- auditoría de cambios

Si se decide separar también la ficha personal en backend:

- crear `upsert_candidate_person_profile(...)`

### Frontend

La tercera pestaña debe agregarse a `CandidateDetailSidebar.tsx`, no a un modal inexistente.

Tabs finales:

1. `Pipeline Operativo`
2. `Control Documental`
3. `Ficha del Trabajador`

La ficha debe dividirse por secciones:

- Información personal
- Emergencia
- Inclusión y antecedentes especiales
- Vestuario
- Pago y previsión
- Ingreso actual

### Verificación

1. Guardar datos personales persistentes.
2. Guardar datos propios del ingreso actual.
3. Reabrir candidato y verificar persistencia.
4. Validar que otro proceso futuro del mismo candidato no herede de forma incorrecta los datos específicos del ingreso anterior.

---

## Decisiones pendientes antes de programar

Estas definiciones siguen abiertas y deben cerrarse antes de implementar negocio:

1. `Pasajes`
   - confirmar si solo existen dos metodologías
2. `Who`
   - confirmar si se creará rol `director_operaciones`
3. `Pipeline`
   - confirmar que `ready_for_hire` y `hired` siguen existiendo como cierre operativo
4. `Ficha del trabajador`
   - confirmar qué campos son persistentes de persona y cuáles son del ingreso actual

---

## Orden de ejecución recomendado

### Fase 2A

- metodología de pasajes en aprobación final

### Fase 2B

- nuevo pipeline con aprobación `Who`

### Fase 2C

- ficha del trabajador

Este orden reduce riesgo porque:

- primero se ajusta la aprobación del folio
- luego el pipeline operativo
- finalmente la ficha extensa, que depende del flujo ya estabilizado

---

## Criterios de aceptación

No se considerará cerrada esta fase si ocurre cualquiera de estos puntos:

- la lógica crítica depende solo del frontend
- se crean componentes paralelos sin utilidad real
- el nuevo flujo no queda respaldado por RPCs y auditoría
- se mezclan datos personales reutilizables con datos específicos de una postulación sin separación clara
