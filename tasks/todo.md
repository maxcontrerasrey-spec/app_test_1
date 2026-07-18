# Tareas y Roadmap de Desarrollo

> **REGLA FUNDACIONAL (Leccion 56):** Antes de proponer, planificar o ejecutar cualquier cambio sobre este repositorio, se debe leer `tasks/todo.md` y `tasks/lessons.md` completos. Esta es la primera accion obligatoria de cada sesion de trabajo, sin excepcion.

Este archivo mantiene solo el estado vivo y los cierres recientes con relevancia operacional para el ERP. El historial cerrado sin enlace productivo fue purgado para reducir peso del repositorio; las reglas reutilizables permanecen en `tasks/lessons.md` y la documentacion vigente en `docs/`.

## Limpieza documental productiva

- [x] Medir peso actual de documentacion y detectar archivos historicos/duplicados.
- [x] Eliminar documentacion sin enlace productivo ni control vigente.
- [x] Conservar documentos auditados por CI y contratos operativos vivos.
- [x] Validar auditorias/documentacion/build relevante y dejar evidencia de reduccion.

### Resultado de limpieza documental

- Peso tracked inicial de `docs/` y `tasks/`: 31 archivos, 2.5 MB.
- Se eliminaron planes historicos, propuestas cerradas, plantillas legacy, documentacion duplicada y archivos archivados sin enlace productivo.
- Se retiro la plantilla Word legacy `certificado_tipo_rev02.docx`; el flujo vigente genera PDF desde backend y Edge Function, no desde ese artefacto documental.
- Se conservaron los documentos auditados por `npm run audit:enterprise-docs`: arquitectura, mapa modular, matriz de permisos, revision de seguridad, smoke tests, rollback, `tasks/todo.md` y `tasks/lessons.md`.
- Se conservaron documentos legales/operativos vigentes: politicas ISO, Ley 19.628, deploy, audit logs, database model, brand kit y template Markdown de migracion de reclutamiento.
- Se eliminaron `.DS_Store` locales ignorados por Git.

### Documentos productivos conservados

- `docs/architecture.md`
- `docs/audit-logs.md`
- `docs/brand-kit-plataforma-control.md`
- `docs/database-model.md`
- `docs/deploy-cloudflare-pages.md`
- `docs/deployment.md`
- `docs/design-tokens-plataforma-control.css`
- `docs/iso-27001-control-de-acceso.md`
- `docs/iso-27001-politica-uso-aceptable.md`
- `docs/ley-19628-consentimiento-datos.md`
- `docs/module-map.md`
- `docs/permissions-matrix.md`
- `docs/rollback.md`
- `docs/security-review.md`
- `docs/smoke-tests.md`
- `docs/supabase-auth-authorization-foundation.md`
- `docs/templates/README.md`
- `docs/templates/plantilla_migracion_reclutamiento.md`
- `tasks/lessons.md`
- `tasks/todo.md`

## Cierre Certificados - generacion productiva BUK y header limpio

- [x] Reemplazar el submit temporal por flujo real: subir evaluacion, crear solicitud backend, generar certificado productivo y cargar certificado/evaluacion a BUK.
- [x] Priorizar enlace documental BUK al abrir el resultado, dejando URL firmada local solo como fallback cuando BUK no queda en exito.
- [x] Eliminar lineas/bordes negros superiores y separadores verticales del header en preview y Edge Function productiva.
- [x] Evitar truncado de marcas/tipos/modelos en la tabla de equipos autorizados; el texto se envuelve y pagina sin puntos suspensivos.
- [x] Corregir el validador publico para mostrar trabajador, RUT, vigencia, instructor, equipos, emision, registro BUK y SHA-256 desde el contrato real `snake_case`.
- [x] Implementar formalizacion por correo despues de carga exitosa de certificado en BUK.

### Resultado aplicado

- `CompetencyCertificationPage.tsx` ya no muestra ni usa `PDF temporal ... generado sin guardar ni cargar a BUK`; ahora llama al flujo productivo.
- `competencyApi.ts` y `generate-competency-certificate` comparten el criterio visual del certificado sin artefactos negros.
- `verify-competency-certificate` y la pagina publica `/verificar/competencia` muestran el snapshot publico completo.
- `transactional_email_dispatches` acepta `competency_formalization` y `hiring-transactional-email` renderiza la notificacion.

## Duplicados de certificados de competencias

- [x] Mantener como vigente el folio reciente `1707202611471153` y reemplazar en ERP el folio antiguo `1707202611461152`.
- [x] Verificar que el validador publico muestre el folio antiguo como `replaced` y no vigente, y el folio reciente como `valid`.
- [x] Crear guarda backend transaccional para que `create_competency_request(...)` no cree certificados equivalentes para el mismo trabajador, instructor, fecha y set de modelos.

### Resultado aplicado

- El folio antiguo quedo `certificate_status = replaced`, `competency_status = revoked`, solicitud `cancelled` y `replaced_by_certificate_id` apuntando al folio reciente.
- El folio reciente se mantiene `uploaded_to_buk`, `enabled` y `completed`.
- La RPC ordena/deduplica modelos, toma `pg_advisory_xact_lock(...)` por llave operacional y rechaza solicitudes equivalentes antes de insertar.

## Retencion documental BUK

- [x] Cargar certificado PDF y evaluacion respaldada a la carpeta BUK `Acreditacion`.
- [x] Aplicar a ambos archivos el estandar de nombre usado por `sync-buk-candidates`: nombre base sanitizado en minusculas + tipo/documento del trabajador + extension.
- [x] Crear puerta de cierre: solo cuando certificado y evaluacion se suben correctamente a BUK se eliminan los objetos `certificates/...` y `evaluations/...` de `competency_documents`.
- [x] Registrar IDs, URLs, nombres BUK, carpeta, hash y estado de purga sin borrar filas transaccionales necesarias para auditoria, folio y validacion publica.

## Optimizacion global de chunks y busquedas BUK

- [x] Separar dependencias pesadas de PDF/competencias del chunk inicial del modulo.
- [x] Endurecer el lookup estandar para no disparar consultas BUK por busquedas bajo umbral.
- [x] Limitar concurrencia en exportaciones que consultan fichas BUK.
- [x] Ajustar particion de vendors donde la medicion lo justifico.

### Resultado aplicado

- `competencyCoreApi.ts` concentra catalogos, busqueda BUK, advertencias y verificacion publica sin arrastrar `pdf-lib`, `qrcode`, fuentes ni logos.
- `CompetencyCertificationPage.tsx` carga `generateCompetencyPreviewPdf(...)` con import dinamico solo al generar prueba.
- `WorkerLookupField.tsx` usa debounce estandar de 250 ms y no consulta mientras el texto no cumpla umbral.
- `HiringPersonnelToHireView.tsx` limita a 5 consultas concurrentes de ficha BUK y carga `bukEmployeeNomina` dinamicamente solo al exportar.
- `vite.config.ts` separa `pdf-vendor` y `qrcode-vendor`; ECharts se mantiene como chunk lazy unico por ciclos internos de Rollup.

## Correccion Operaciones - super admin sin contratos editables

- [x] Confirmar causa raiz remota del selector vacio en Registro Base de Operaciones.
- [x] Crear migracion forward-only para que `admin/super admin` pueda editar todos los contratos activos sin depender de `operations_contract_editors`.
- [x] Mantener la matriz contractual obligatoria para `operaciones_l_1` y `operaciones_l_2`.

### Resultado aplicado

- `public.user_can_edit_operations_contract(...)` autoriza a usuarios admin sobre cualquier contrato activo.
- `public.operations_editable_contracts` retorna todos los contratos activos para admin/super admin y conserva matriz para usuarios operativos no admin.
- El usuario admin `maximiliano.contreras@busesjm.com` paso a ver 110 contratos editables, igual al total activo remoto.

## Alta cuentas instructor para certificados

- [x] Auditar que el rol `instructor` tiene acceso a `certificados` y `seguimiento_certificados`.
- [x] Provisionar cuentas Auth para los cinco instructores sin exponer contrasenas temporales.
- [x] Sincronizar `profiles`, `user_roles.role_code = 'instructor'` y `competency_instructors.user_id`.
- [x] Validar que una cuenta instructor ve solo su propio instructor en `get_competency_catalogs()`.

## Correccion Certificados - examen/evaluacion obligatoria

- [x] Confirmar que el backend `create_competency_request` bloquea sin evaluacion cargada, notas 100%, hash y archivo en Storage.
- [x] Agregar input obligatorio `Examen teorico / evaluacion respaldada` con tipos PDF/JPG/PNG.
- [x] Bloquear el boton si no existe archivo o no se acepto la declaracion.
- [x] Revalidar en `handleSubmit` para evitar bypass visual del formulario.

## Submodulo Certificacion de Competencias BUK

- [x] Implementar base backend auditable: rol/modulo, tablas, catalogos, RLS, storage privado, auditoria y RPCs.
- [x] Reutilizar `employees_active_current` para seleccion de trabajadores sincronizados desde BUK.
- [x] Reutilizar cliente BUK existente para subir certificado PDF a carpeta documental `Acreditacion`.
- [x] Generar PDF backend desde datos validados, con folio, vencimiento, hash, QR verificable y estado separado de carga BUK.
- [x] Crear UI modular funcional en `/certificados` con busqueda trabajador, seleccion equipo/modelos, carga evaluacion 100%, emision y dashboard.

### Criterio de cierre vivo

- El modulo opera sin Excel ni Power Automate como fuente transaccional.
- No se genera certificado sin evaluacion respaldada, archivo privado y nota final 100%.
- El backend genera folio, token, nombre de documento, vencimiento y estados; el frontend no los inventa.
- La carga BUK debe ser idempotente y no duplicar folio ni documento ante reintentos.
- El certificado queda privado, hasheado, trazable, auditable y validable publicamente por QR.
- Roles `admin`, `certificaciones` e `instructor` tienen acceso segun alcance.

## Loop Enterprise global

- [x] Mantener documentacion viva verificable: arquitectura, mapa modular, matriz de permisos, seguridad, smoke plan y rollback.
- [x] Mantener `npm run audit:enterprise-docs` como control ejecutable de cobertura documental Enterprise.
- [x] Mantener CI alineado para que cambios de rutas, docs, tareas o scripts de auditoria ejecuten el gate documental.

### Contrato vigente

- `audit:enterprise-docs` compara rutas/modulos activos contra `docs/module-map.md` y `docs/permissions-matrix.md`.
- El auditor exige secciones minimas en `docs/security-review.md` y `docs/smoke-tests.md`.
- El auditor exige que este archivo registre la iteracion activa `Loop Enterprise global`.

## Proximos objetivos vivos

- [ ] Convertir la purga documental en rutina periodica: revisar archivos grandes versionados y referencias huerfanas antes de cada cierre mayor.
- [ ] Mantener smokes autenticados por rol cuando existan credenciales controladas en secrets.
- [ ] Evaluar activos no documentales pesados solo si el usuario autoriza optimizacion fuera de `docs/` y `tasks/`.
