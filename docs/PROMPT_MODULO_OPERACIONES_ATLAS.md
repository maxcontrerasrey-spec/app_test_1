# Prompt de contexto: Atlas Operations

Actúa como arquitecto y desarrollador senior del módulo **Operaciones de Atlas**, integrado en el ERP de Buses JM. Usa este documento como contexto funcional antes de analizar o cambiar el código. Primero verifica el estado real del repositorio, porque el código desplegado puede ser más reciente que documentos anteriores.

## Propósito

Atlas Operations organiza el ciclo de un servicio de transporte: definir el servicio base y sus rutas, planificar una salida, asignar recursos, publicarla al conductor, seguir hitos y excepciones, y consultar su historial. La **Control Tower** debe ayudar a Operaciones a saber qué servicios requieren atención y qué evidencia respalda su estado.

El objetivo de producto es tener una fuente única y trazable por servicio y despacho. No se deben presentar datos estimados, simulados o no recibidos como si fueran evidencia real.

## Flujo de punta a punta

1. **Configurar el servicio base.** Se vincula a un contrato existente, se identifica con nombre/tipo/jornada y se seleccionan los días de semana en que opera. La configuración también puede asociarse a hitos SLA y a una o más rutas.
2. **Configurar rutas del servicio.** El planificador permite definir origen, paradas ordenadas y destino, revisar la geometría en el mapa y guardar la ruta con un prefijo. Un servicio base puede tener varias rutas, por ejemplo una por turno.
3. **Planificar un despacho.** Se seleccionan fecha/hora, contrato, servicio base, conductor y vehículo. La identidad del conductor y su jornada se validan contra BUK/roster; los datos de catálogo no se copian para reemplazar esas fuentes.
4. **Despachar.** El servicio pasa por estados explícitos de preparación/publicación. No se debe publicar si faltan datos obligatorios o validaciones.
5. **Registrar ejecución.** Los hitos se completan por acciones autorizadas o, cuando exista una integración validada, por eventos GPS. Las incidencias y confirmaciones del conductor quedan asociadas al despacho.
6. **Monitorear y revisar.** Control Tower prioriza servicios y excepciones; el timeline conserva los eventos. Historial permite reconstruir qué ocurrió y cuándo.

## Componentes del módulo

La navegación funcional tiene siete vistas. El planificador de rutas es una pantalla asociada a Planificación y a los servicios base.

### 1. Control Tower

- Presenta los servicios del día, indicadores y riesgos operacionales.
- Permite filtrar por fecha/contrato y buscar por servicio, conductor o vehículo.
- Alterna entre lista y mapa; la selección abre el detalle y su timeline.
- El mapa puede mostrar la última posición procesada disponible para un vehículo despachado. Si no existe señal válida, debe indicarlo; nunca inventar coordenadas.
- Los niveles `green`, `attention`, `at_risk` y `critical` son estados derivados de reglas determinísticas de hitos/tiempos, no una predicción de IA.

### 2. Planificación

- Crea una ocurrencia de servicio con fecha, jornada, horarios e instrucciones.
- Permite elegir el servicio base, buscar conductores y asignar vehículo.
- La selección de conductor debe respetar la ficha BUK exacta y el roster para la fecha.
- La ruta planificada se asocia al servicio base y puede vincularse al despacho. La lista visible de paradas define el orden real; origen y destino se derivan de ese orden.

### 3. Despacho

- Revisa las salidas preparadas y controla el cambio a publicada.
- Debe mostrar qué validación falta y preservar quién realizó cada transición.
- Publicar no equivale a confirmar que el conductor recibió o ejecutó el servicio.

### 4. Excepciones

- Muestra alertas abiertas o atendidas, como hitos vencidos o incidencias.
- Permite reconocer y resolver una alerta con trazabilidad.
- Una alerta no se debe borrar para ocultar un incumplimiento; su resolución debe quedar documentada.

### 5. Conductor

- La vista disponible en el módulo contempla servicios publicados, confirmación de recepción y reporte de incidencias.
- El acceso personal requiere una cuenta vinculada de forma explícita a una ficha BUK exacta. Buscar por nombre o RUT no autentica a la persona.
- La navegación de rutas que hoy acompaña al planificador usa Ferrostar + Valhalla en una simulación de avance. **No la describas como una aplicación productiva de navegación con GPS real del celular** salvo que el repositorio y el despliegue actuales demuestren esa implementación.

### 6. Historial

- Permite consultar los servicios y sus eventos por fecha, con actor, origen y hora.
- Los eventos deben ser auditables y ordenables; las correcciones agregan evidencia y no reescriben silenciosamente el pasado.

### 7. Configuración

- **Servicios base:** contrato, nombre, tipo, proveedor/datos contractuales, jornada y días de operación. Los días usan ISO 8601: lunes=1 y domingo=7; se exige al menos un día.
- **Hitos SLA:** reglas versionadas por contrato y opcionalmente servicio base, con código, nombre, minuto relativo al inicio, aviso previo, obligatoriedad y tipo de geocerca. Una nueva versión rige para despachos futuros; no cambia el significado histórico de los ya creados.
- **Vehículos:** padrón Atlas de equipos habilitados, con código, patente y tipo. No inventar estados de mantención o acreditación si no existe fuente integrada.
- **Accesos por contrato:** existen estructuras para asignar editores operacionales, pero el alcance inicial de producción es superadministrador activo. No habilitar roles adicionales sin autorización y validación de toda la cadena frontend, RPC y RLS.
- **Vínculo de conductor:** asocia una cuenta Atlas con una ficha BUK activa y exacta.
- **Telemetría:** el panel debe dejar claro que TrackTec real está desactivado mientras falten su contrato técnico oficial y credenciales server-side.

## Planificador y navegación de rutas

- **Búsqueda/planificación:** TomTom se usa para sugerir y resolver direcciones y calcular la vista previa de ruta. La clave vive únicamente en el proxy backend `atlas-tomtom-planning`; el navegador envía una sesión autenticada. Seleccionar un resultado confirmado obtiene coordenadas exactas. La búsqueda de direcciones y el cálculo TomTom son para planificación.
- **Mapa de planificación:** MapLibre presenta cartografía raster de OpenStreetMap con atribución visible. Debe dibujar la geometría devuelta por TomTom, una línea legible, halo y flechas de sentido, y encuadrar el recorrido completo. También existe selección manual de un punto desplazando el mapa y confirmando el centro.
- **Paradas:** pueden agregarse, eliminarse y reordenarse. Al agregar una parada vacía, su marcador provisional no debe llevar el mapa a `[0,0]`; debe permanecer en el contexto visible de la ruta. Las paradas sin ubicación confirmada no participan en el encuadre ni en el cálculo.
- **Código y persistencia:** las rutas se guardan vinculadas a un servicio base y admiten varias alternativas/versiones. El código se forma con el nombre normalizado del servicio base, guion bajo y el prefijo ingresado; por ejemplo, `OPERATIVO_MINA_1_TURNO_B`. La lista debe conservar el orden de paradas, coordenadas, fuente y versión.
- **Conductor/navegación:** la decisión vigente es conservar Ferrostar + Valhalla para la experiencia de navegación, reutilizando las paradas guardadas y recalculando la geometría con ese motor. TomTom no gobierna la navegación del conductor. El perfil `auto` es una aproximación de automóvil: no representa restricciones de bus, dimensiones, faena ni caminos privados.
- **Calidad cartográfica:** direcciones numeradas se deben verificar con proveedor y coordenadas resueltas; un nombre de calle escrito libremente no equivale a una dirección confirmada. Los proveedores públicos de mapa/ruteo pueden ser best-effort y no tienen SLA de producción garantizado.

## Telemetría y TrackTec: alcance real y etapa posterior

- La arquitectura Atlas contempla bindings explícitos de vehículo externo a vehículo Atlas, eventos normalizados, deduplicación, posiciones procesadas, geocercas y alertas.
- Control Tower consulta la última posición procesada para los vehículos de los despachos visibles y la muestra sobre el mapa. La cantidad de consultas se acota a vehículos visibles; no se debe consultar continuamente todo el histórico.
- Existe un contrato interno y un proveedor mock para desarrollo/pruebas. Los eventos simulados deben identificarse como `mock` y nunca presentarse como TrackTec.
- **TrackTec real no está activo.** Antes de implementarlo se necesita documentación oficial sobre autenticación, endpoints/webhook o polling, frecuencia, límites, IDs de vehículo/evento, zona horaria, reintentos, firma y retención.
- Secretos solo backend; asociar IDs externos a vehículos mediante binding único y explícito. Eventos sin binding, repetidos o inválidos deben quedar rechazados/en cuarentena según contrato, sin completar hitos automáticamente.
- La futura app web del conductor debe usar GPS del celular para giro a giro; Control Tower usaría TrackTec para monitoreo de flota. Son señales distintas y no se deben mezclar: GPS del teléfono para progreso individual y TrackTec para posición del equipo.
- Acordamos cuidar la base compartida de 8 GB: almacenar telemetría operacional acotada, evitar guardar payloads crudos sin necesidad, definir retención/particionado o agregación antes de activar volúmenes altos. R2 puede servir para archivos/retención fría, pero no sustituye una consulta geoespacial operacional que necesita filtrar por vehículo y tiempo.

## Datos y seguridad

- La implementación nueva partió desde cero para el dominio Operaciones: no se heredan las plantillas, vehículos ni capturas del módulo anterior. Los dominios compartidos (contratos, Auth/perfiles, BUK y roster) continúan siendo fuentes canónicas.
- Las entidades Atlas incluyen servicio base, vehículo, despacho, hitos versionados y por despacho, eventos, cuentas de conductor, bindings y eventos de telemetría, geocercas, alertas, incidencias y rutas/paradas.
- Mantener migraciones forward-only. No borrar tablas, datos ni historial compartido como parte de un cambio funcional.
- La puerta de entrada usa el módulo protegido `operaciones`; las acciones críticas vuelven a validar identidad y permiso en RPC/RLS. No considerar que ocultar un botón sea autorización.
- El alcance de publicación solicitado al inicio fue acceso solo para superadministrador activo. No ampliar acceso por rol/contrato hasta una solicitud expresa y verificación end-to-end.
- No exponer `TOMTOM_API_KEY`, JWT, secretos ni `service_role` en bundles, logs o respuestas. No llamar proveedores desde el navegador con una clave privada.

## Qué no se ha desarrollado / límites explícitos

1. No hay optimizador de rutas con IA; IA permanece fuera del alcance actual.
2. TrackTec real está desactivado hasta recibir contrato oficial y credenciales. El mapa que muestra posiciones depende de que existan eventos procesados.
3. La navegación Ferrostar del planificador puede simular avance; no equivale a la app del conductor con GPS real del dispositivo lista para operar.
4. TomTom usa perfil automóvil para planificación y no aplica restricciones específicas de bus/faena.
5. No afirmar ETA operacional, tráfico en vivo, geocercas activas o cierre automático de hitos salvo evidencia de su proveedor/job productivo actual.
6. OSM/Valhalla públicos sirven para desarrollo/validación, pero su disponibilidad, cobertura y SLA deben evaluarse antes de soportar una operación crítica.
7. No afirmar “verificado en producción” solo porque compile el frontend, exista una tabla o el bundle responda HTTP 200. Verificar la ruta, datos, permiso y experiencia real disponibles.

## Instrucciones para futuras tareas

Antes de cambiar Operaciones:

1. Inspecciona el código, las migraciones y el flujo desplegado actuales; los documentos de estado pueden estar desactualizados.
2. Identifica si la petición afecta planificación, despacho, conductor, Control Tower, configuración, alertas o historial, y traza la operación de extremo a extremo hasta RPC/RLS/proveedor.
3. Conserva los contratos de BUK, roster, perfiles y contratos; no introduzcas copias de catálogos como nuevas fuentes de verdad.
4. Distingue “implementado”, “mock/simulado”, “desactivado” y “pendiente”. No inventes integración TrackTec ni IA.
5. Para cambios de acceso, valida frontend, RPC, grants y RLS. Para cambios de datos, usa migración forward-only y protege el historial.
6. Para defectos de mapa, valida las coordenadas del proveedor, GeoJSON, fuente/capas MapLibre, encuadre y flechas; la existencia de métricas no demuestra que la ruta esté visible.
7. Mantén los controles compactos y consistentes con el ERP, especialmente altura/tamaño de inputs, selectores, tarjetas, indicadores y tablas; la UI debe responder a desktop y móvil.
8. Verifica el comportamiento afectado con pruebas, build frontend, Guardian y `git diff --check`; si se publica, confirma el artefacto nuevo y el comportamiento productivo. No relajes budgets para hacer pasar un gate.

## Referencias del repositorio

- Página principal: `src/modules/operaciones/pages/OperationsControlTowerPage.tsx`.
- Planificador: `src/modules/operaciones/pages/OperationsRoutePlannerDemo.tsx`.
- API Atlas/TomTom: `src/modules/operaciones/services/atlasOperationsApi.ts`.
- Mapa de Control Tower: `src/modules/operaciones/components/OperationsLiveMap.tsx`.
- Contrato de telemática: `src/modules/operaciones/telematics/provider.ts` y `docs/operations-control-tower/TRACKTEC_INTEGRATION_CONTRACT.md`.
- Esquema Atlas: migraciones `20260930174145_atlas_operations_control_tower.sql`, `20261002130716_atlas_ops_service_routes_and_tomtom.sql` y `20261002144349_atlas_ops_service_template_operating_days.sql`.
- Proxy TomTom: `supabase/functions/atlas-tomtom-planning/index.ts`.

**Fin del contexto.** Antes de ejecutar una tarea, confirma qué está realmente publicado y respeta los límites y distinciones de este prompt.
