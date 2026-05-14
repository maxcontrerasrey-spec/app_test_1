# Modulo 1: Generador de Certificados

## Objetivo

Reemplazar el proceso actual basado en Excel por un modulo web interno que permita a instructores generar solicitudes de certificados de competencias para conductores usando:

- Frontend web propio
- Lista SharePoint como base de datos operativa
- Biblioteca SharePoint para documentos generados
- Power Automate para automatizacion documental
- Acceso con cuenta Microsoft 365 corporativa

## Resultado esperado

El instructor ingresa a la web, completa el formulario de certificacion, envia la solicitud y la aplicacion guarda un registro en SharePoint. Luego Power Automate toma ese registro, genera el Word, lo convierte a PDF, guarda el certificado y actualiza el estado.

## Alcance del Modulo 1

Este modulo cubre:

- Registro de una solicitud de certificado
- Validacion de datos obligatorios
- Seleccion de instructor, trabajador, marca, tipo y modelos
- Calculo o llenado de campos derivados necesarios para el certificado
- Creacion del registro base en SharePoint
- Disparo del flujo documental mediante Power Automate
- Seguimiento del estado del certificado

Este modulo no cubre aun:

- Firma avanzada fuera de lo ya resuelto en Word/Power Automate
- Administracion de usuarios y perfiles complejos
- Dashboard historico avanzado
- Otros modulos de automatizacion futuros

## Flujo funcional futuro

1. El instructor inicia sesion con su cuenta Microsoft 365.
2. Ingresa al modulo "Generador de certificados".
3. Completa el formulario.
4. La web valida los datos.
5. La web guarda un item en una lista de SharePoint con estado `Pendiente`.
6. Power Automate detecta el item nuevo o modificado en estado `Pendiente`.
7. Power Automate rellena la plantilla Word.
8. Power Automate genera el PDF.
9. Power Automate guarda el PDF en la biblioteca SharePoint.
10. Power Automate actualiza el item a estado `Generado` o `Error`.
11. La web permite revisar el resultado y, mas adelante, buscar certificados generados.

## Pantalla principal del modulo

La primera version debe incluir una pantalla simple con:

- Encabezado del modulo
- Formulario de generacion
- Boton `Generar certificado`
- Estado del envio
- Tabla simple de solicitudes recientes del instructor

## Campos del formulario

### Campos visibles para el instructor

- `instructor`
- `fecha`
- `hora`
- `trabajador`
- `marca`
- `tipo`
- `modelo_1`
- `modelo_2`
- `modelo_3`
- `evaluacion`

### Campos autocompletados o derivados

- `rut_instructor`
- `codigo_perfil_cv`
- `rut_trabajador`
- `modelos_todos`
- `autorizado_para_operar`
- `calificacion`
- `fecha_texto`
- `folio`
- `firma_instructor`
- `estado_certificado`

## Reglas funcionales

- `instructor` se selecciona desde un catalogo maestro.
- Al seleccionar `instructor`, se autocompletan `rut_instructor`, `codigo_perfil_cv` y `firma_instructor`.
- `trabajador` se selecciona desde el maestro de personal.
- Al seleccionar `trabajador`, se autocompleta `rut_trabajador`.
- `marca`, `tipo` y modelos deben salir desde catalogos administrables.
- `modelos_todos` se forma uniendo `modelo_1`, `modelo_2` y `modelo_3`.
- `evaluacion` se registra como porcentaje o valor equivalente segun definicion del negocio.
- `autorizado_para_operar` depende de la evaluacion.
- El registro se crea inicialmente con estado `Pendiente`.
- El `correlativo` inicial del nuevo sistema debe comenzar en `1000`.
- Cada nueva solicitud debe tomar el siguiente correlativo disponible en secuencia.
- El `folio` debe quedar generado de forma unica y consistente.
- El `folio` se construye con la fecha y hora de creacion del certificado mas el correlativo.
- Formato del folio: `DDMMAAAAHHmmXXXX`.
- `DDMMAAAAHHmm` corresponde a la fecha y hora de creacion del certificado.
- `XXXX` corresponde al correlativo de la solicitud.

## Contrato de datos minimo para SharePoint

La lista SharePoint que reemplaza la logica de `bbdd` debe contemplar al menos estas columnas:

- `Correlativo`
- `Instructor`
- `RutInstructor`
- `CodigoPerfilCv`
- `Fecha`
- `Hora`
- `Trabajador`
- `RutTrabajador`
- `Marca`
- `Tipo`
- `Modelo1`
- `Modelo2`
- `Modelo3`
- `ModelosTodos`
- `Evaluacion`
- `EstadoCertificado`
- `AutorizadoParaOperar`
- `Codigo`
- `Folio`
- `FechaTexto`
- `FirmaInstructor`
- `Calificacion`
- `FechaFirma2`
- `PdfUrl`
- `ObservacionError`
- `CreadoPor`
- `FechaCreacion`

## Estructura recomendada de la lista SharePoint

Nombre sugerido de la lista:

- `SolicitudesCertificados`

Objetivo:

- almacenar cada solicitud de certificado como registro maestro del proceso
- permitir trazabilidad completa desde la creacion hasta la generacion del PDF
- servir como fuente para el verificador y reportes futuros

### Columnas recomendadas

| Nombre interno sugerido | Nombre visible | Tipo SharePoint | Obligatorio | Lo llena |
| --- | --- | --- | --- | --- |
| `Title` | Titulo | Una linea de texto | Si | Sistema o flujo |
| `Correlativo` | Correlativo | Numero | Si | Sistema |
| `Folio` | Folio | Una linea de texto | Si | Sistema |
| `EstadoCertificado` | Estado certificado | Eleccion | Si | Sistema y flujo |
| `Instructor` | Instructor | Una linea de texto | Si | Web |
| `RutInstructor` | Rut instructor | Una linea de texto | Si | Web |
| `CodigoPerfilCv` | Codigo perfil CV | Una linea de texto | Si | Web |
| `FirmaInstructor` | Firma instructor | Una linea de texto multiple o una linea de texto | Si | Web |
| `FechaCertificacion` | Fecha certificacion | Fecha y hora | Si | Web |
| `HoraCertificacion` | Hora certificacion | Una linea de texto | Si | Web |
| `FechaCreacionSolicitud` | Fecha creacion solicitud | Fecha y hora | Si | Sistema |
| `Trabajador` | Trabajador | Una linea de texto | Si | Web |
| `RutTrabajador` | Rut trabajador | Una linea de texto | Si | Web |
| `Marca` | Marca | Una linea de texto | Si | Web |
| `Tipo` | Tipo | Una linea de texto | Si | Web |
| `Modelo1` | Modelo 1 | Una linea de texto | No | Web |
| `Modelo2` | Modelo 2 | Una linea de texto | No | Web |
| `Modelo3` | Modelo 3 | Una linea de texto | No | Web |
| `ModelosTodos` | Modelos consolidados | Varias lineas de texto | Si | Sistema |
| `Evaluacion` | Evaluacion | Numero | Si | Web |
| `Calificacion` | Calificacion | Una linea de texto | Si | Sistema |
| `AutorizadoParaOperar` | Autorizado para operar | Una linea de texto | Si | Sistema |
| `FechaTexto` | Fecha texto | Una linea de texto | Si | Sistema |
| `FechaFirma2` | Fecha firma 2 | Una linea de texto | No | Sistema |
| `PdfUrl` | URL PDF | Hipervinculo | No | Flujo |
| `PdfNombreArchivo` | Nombre archivo PDF | Una linea de texto | No | Flujo |
| `ObservacionError` | Observacion error | Varias lineas de texto | No | Flujo |
| `CreadoPorCuenta` | Creado por cuenta | Una linea de texto | No | Sistema |

### Valores recomendados para `EstadoCertificado`

- `Pendiente`
- `En proceso`
- `Generado`
- `Error`
- `Anulado`

### Que llena cada parte

#### Datos que deberia enviar la web

- `Instructor`
- `RutInstructor`
- `CodigoPerfilCv`
- `FirmaInstructor`
- `FechaCertificacion`
- `HoraCertificacion`
- `Trabajador`
- `RutTrabajador`
- `Marca`
- `Tipo`
- `Modelo1`
- `Modelo2`
- `Modelo3`
- `Evaluacion`

#### Datos que deberia calcular el sistema o backend de proceso

- `Correlativo`
- `Folio`
- `EstadoCertificado`
- `FechaCreacionSolicitud`
- `ModelosTodos`
- `Calificacion`
- `AutorizadoParaOperar`
- `FechaTexto`
- `FechaFirma2`
- `Title`
- `CreadoPorCuenta`

#### Datos que deberia completar el flujo

- `PdfUrl`
- `PdfNombreArchivo`
- `ObservacionError`
- cambio de `EstadoCertificado`

## Regla recomendada para `Title`

Aunque SharePoint obliga a tener la columna `Title`, en este proceso no sera el identificador principal.

Se recomienda poblarla con una cadena util como:

- `CERT-{Folio}`

Ejemplo:

- `CERT-1704202609351000`

## Regla recomendada para la generacion de correlativo

Para evitar duplicados, no se recomienda calcular el correlativo solo en el frontend.

Opciones seguras:

1. Usar el `ID` nativo de SharePoint como base y transformarlo a correlativo visible.
2. Usar un flujo o servicio intermedio que reserve el siguiente correlativo.
3. Usar una lista separada de configuracion para llevar el ultimo correlativo asignado.

### Recomendacion principal

La opcion mas segura y simple para comenzar es:

- crear el item
- obtener un identificador confiable del registro
- calcular el correlativo visible partiendo desde `1000`
- actualizar el item con `Correlativo` y `Folio`

Formula conceptual:

- `Correlativo = 999 + IDSharePoint`

Ejemplos:

- si el primer item nuevo tiene `ID = 1`, entonces `Correlativo = 1000`
- si el segundo item tiene `ID = 2`, entonces `Correlativo = 1001`

Esto evita colisiones por concurrencia y mantiene la secuencia.

## Regla recomendada para la generacion de folio

El folio debe formarse con:

- fecha y hora de creacion efectiva de la solicitud
- correlativo asignado

Formato:

- `DDMMAAAAHHmmXXXX`

Ejemplo:

- fecha/hora creacion: `17/04/2026 09:35`
- correlativo: `1000`
- folio: `1704202609351000`

## Columnas futuras utiles para el verificador

Aunque el verificador no se construira ahora, conviene dejar la lista preparada para exponer o derivar despues:

- `EstadoCertificado`
- `Folio`
- `Trabajador`
- `RutTrabajador`
- `Instructor`
- `Marca`
- `ModelosTodos`
- `FechaCertificacion`
- `PdfUrl`

## Catalogos complementarios

Ademas de la lista principal, la solucion necesitara catalogos o listas auxiliares:

- Catalogo de instructores
- Catalogo de trabajadores
- Catalogo unificado de vehiculos

En una primera etapa, estos catalogos pueden venir desde SharePoint aunque originalmente hoy vivan en hojas de Excel.

### Catalogo unificado de vehiculos

Para este proyecto se recomienda usar una sola lista llamada `CatalogoVehiculos` en lugar de separar:

- marcas
- tipos
- modelos

Esto es mejor porque la operacion real trabaja con combinaciones validas entre `Marca`, `Tipo` y `Modelo`.

Ejemplo:

- `MERCEDES BENZ | MINIBUS | SPRINTER 315 - 415 - 515 - 517 4X2`
- `MERCEDES BENZ | BUS 1 PISO | O500 RS - OC500 RF`
- `MAXUS | MINIBUS | eDeliver 9`

La lista `CatalogoVehiculos` debe incluir:

- `Marca`
- `Tipo`
- `Modelo`
- `Activo`

## Responsabilidades por componente

### Web

- Mostrar formulario
- Validar campos
- Consultar catalogos
- Calcular algunos campos derivados simples
- Crear el item en SharePoint
- Mostrar estado al usuario

### SharePoint

- Guardar solicitudes
- Guardar catalogos
- Guardar certificados PDF generados

### Power Automate

- Detectar solicitudes pendientes
- Preparar datos finales del documento si falta algun campo derivado
- Rellenar plantilla Word
- Convertir a PDF
- Guardar documento en biblioteca
- Actualizar estado del item
- Registrar error si falla
- Enviar correo si se mantiene ese comportamiento

## Datos del Word ya identificados

La plantilla actual consume estos campos:

- `fecha_texto`
- `modelos_todos`
- `marca`
- `firma_instructor`
- `calificacion`
- `instructor`
- `rut_instructor`
- `trabajador`
- `rut_trabajador`
- `autorizado_para_operar`
- `fecha_firma2`
- `codigo_perfil_cv`
- `folio`

## Estados del proceso

Estados recomendados para la lista principal:

- `Pendiente`
- `En proceso`
- `Generado`
- `Error`

## Regla de correlativo y folio

La nueva solucion debe continuar la numeracion historica que hoy se llevaba en Excel.

Reglas:

- El primer registro del modulo web debe usar correlativo `1000`.
- Cada registro siguiente debe incrementar el correlativo en `1`.
- El correlativo forma parte obligatoria del folio del certificado.
- El folio no puede reutilizarse.

Formato del folio:

- `DDMMAAAAHHmmXXXX`

Ejemplo:

- Si una solicitud se crea el `17/04/2026` a las `09:35`
- y el correlativo asignado es `1000`
- el folio resultante debe ser `1704202609351000`

Consideraciones de implementacion:

- La fecha y hora usadas para el folio deben ser las de creacion efectiva de la solicitud.
- La zona horaria debe respetar la operacion del negocio.
- La generacion del correlativo debe resolverse de forma segura para evitar duplicados si dos usuarios crean solicitudes al mismo tiempo.

## Criterios para la primera version

La V1 del modulo se considera util cuando:

- Un instructor puede crear una solicitud sin usar Excel
- La solicitud queda registrada en SharePoint
- Power Automate puede tomar el registro y generar el certificado
- El estado final queda visible
- El PDF queda almacenado y trazable

## Decisiones ya acordadas

- La web se publicara en el servidor web de la empresa
- El acceso sera con cuenta Microsoft 365
- SharePoint sera la capa de datos y documentos
- Power Automate seguira resolviendo la automatizacion documental
- El Excel actual sera reemplazado por la web y por SharePoint
- La interfaz debe ser responsiva para escritorio, tablet y movil
- La aplicacion debe nacer con una arquitectura modular para crecer a futuros modulos mas complejos

## Requisitos no funcionales iniciales

- Diseno responsivo desde la primera version
- Navegacion preparada para multiples modulos
- Componentes reutilizables
- Formularios dinamicos y mantenibles
- Separacion clara entre interfaz, logica de negocio e integraciones
- Estructura lista para escalar sin rehacer la base del proyecto

## Siguiente paso recomendado

1. Diseñar la estructura tecnica inicial de la app web.
2. Definir la lista SharePoint con nombres finales de columnas.
3. Adaptar el flujo Power Automate para que lea desde SharePoint en vez de Excel.
4. Construir la primera pantalla funcional del modulo 1.
