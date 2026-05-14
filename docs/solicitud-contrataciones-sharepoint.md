# Solicitud de Contrataciones - Estructura SharePoint

## Objetivo

Definir la lista principal y los catálogos auxiliares para el modulo
`Solicitud de Contrataciones`, reemplazando el uso actual del archivo
`template.xlsx` por una estructura operativa en SharePoint.

## Listas recomendadas

### 1. Lista principal

Nombre sugerido:

- `SolicitudesContratacion`

Esta lista almacenara cada solicitud creada por el usuario y sera la base para:

- seguimiento del proceso
- cadena de aprobaciones
- trazabilidad del folio
- integracion futura con Power Automate

### 2. Listas auxiliares

- `CargosSolicitud`
- `ContratosSolicitud`
- `TurnosSolicitud`

## Lista principal: SolicitudesContratacion

### Campos de sistema

| Columna | Tipo sugerido | Obligatorio | Origen |
|---|---|---:|---|
| `Title` | Una linea de texto | Si | Identificador visible simple |
| `Folio` | Una linea de texto | Si | Generado por sistema |
| `FechaSolicitud` | Fecha y hora | Si | Generado por sistema |
| `EstadoSolicitud` | Eleccion | Si | Sistema / flujo |

Valores sugeridos para `EstadoSolicitud`:

- `Solicitado`
- `En aprobacion`
- `Aprobado`
- `Rechazado`
- `Cerrado`

### Datos del solicitante

| Columna | Tipo sugerido | Obligatorio | Origen |
|---|---|---:|---|
| `SolicitanteNombre` | Una linea de texto | Si | Office 365 |
| `SolicitanteCargo` | Una linea de texto | Si | Office 365 |
| `SolicitanteCorreo` | Una linea de texto | Si | Office 365 |

### Datos de la solicitud

| Columna | Tipo sugerido | Obligatorio | Origen |
|---|---|---:|---|
| `FechaSolicitadaIngreso` | Fecha y hora | Si | Usuario |
| `CargoSolicitado` | Una linea de texto | Si | Lista `CargosSolicitud` |
| `NumeroVacantes` | Numero | Si | Usuario |

### Datos del contrato

| Columna | Tipo sugerido | Obligatorio | Origen |
|---|---|---:|---|
| `NombreContrato` | Una linea de texto | Si | Lista `ContratosSolicitud` |
| `NumeroContrato` | Una linea de texto | Si | Derivado por contrato |
| `NombreUnidadCosto` | Una linea de texto | Si | Derivado por contrato |
| `UnidadCosto` | Numero | Si | Derivado por contrato |
| `NombreCentroCosto` | Una linea de texto | Si | Derivado por contrato |
| `CodigoCentroCosto` | Numero | Si | Derivado por contrato |
| `GerenteArea` | Una linea de texto | Si | Derivado por contrato |

### Vigencia de la contratacion

| Columna | Tipo sugerido | Obligatorio | Origen |
|---|---|---:|---|
| `FechaInicio` | Fecha y hora | Si | Usuario |
| `FechaTermino` | Fecha y hora | Si | Calculado |

Regla:

- `FechaTermino = FechaInicio + 3 meses`

### Beneficios y condiciones

| Columna | Tipo sugerido | Obligatorio | Origen |
|---|---|---:|---|
| `Campamento` | Eleccion | Si | Usuario |
| `Pasajes` | Eleccion | Si | Usuario |
| `OtrosBeneficios` | Varias lineas de texto | No | Usuario |
| `RentaLiquidaOfrecida` | Moneda o Numero | Si | Usuario |
| `Turno` | Una linea de texto | Si | Lista `TurnosSolicitud` |

Valores sugeridos para `Campamento` y `Pasajes`:

- `Si`
- `No`

### Campos de aprobacion

La solicitud considera 3 firmas logicas:

1. `Solicitante`
2. `Gerente del area`
3. `Control de Contratos`

La primera firma se resuelve desde la web mediante aceptacion final del
solicitante. Las siguientes 2 se resuelven por Power Automate Approvals.

| Columna | Tipo sugerido | Obligatorio | Origen |
|---|---|---:|---|
| `SolicitanteFirmado` | Eleccion o Si/No | Si | Web |
| `SolicitanteFirmadoPor` | Una linea de texto | Si | Web / Office 365 |
| `SolicitanteFirmadoFecha` | Fecha y hora | Si | Web / sistema |
| `GerenteAreaCorreo` | Una linea de texto | Si | Derivado por contrato |
| `GerenteAreaResultado` | Una linea de texto | No | Flujo |
| `GerenteAreaFecha` | Fecha y hora | No | Flujo |
| `GerenteAreaObservacion` | Varias lineas de texto | No | Flujo |
| `ControlContratosCorreo` | Una linea de texto | Si | Sistema |
| `ControlContratosResultado` | Una linea de texto | No | Flujo |
| `ControlContratosFecha` | Fecha y hora | No | Flujo |
| `ControlContratosObservacion` | Varias lineas de texto | No | Flujo |

Reglas:

- `ControlContratosCorreo` sera siempre `mariajesus.lagos@busesjm.com`
- al crear la solicitud:
  - el solicitante ya queda firmado
  - el estado inicial queda `Pendiente`
- si rechaza gerente o control de contratos:
  - la solicitud queda `Rechazada`
- si las 3 firmas quedan aprobadas:
  - la solicitud queda `Aprobada`

### Campos de control interno

Estos campos soportan el submodulo `Control de Contrataciones` y deben poder ser
editados por Reclutamiento sin alterar la logica base de la solicitud.

| Columna | Tipo sugerido | Obligatorio | Origen |
|---|---|---:|---|
| `FechaIngresoEfectiva` | Fecha y hora | No | Control |
| `ResultadoSeguimiento` | Eleccion | No | Control |
| `ObservacionInterna` | Varias lineas de texto | No | Control |
| `ComentarioProceso` | Varias lineas de texto | No | Control |
| `UltimaActualizacionControl` | Fecha y hora | No | Sistema / Control |
| `ActualizadoPorControl` | Una linea de texto | No | Sistema / Office 365 |

Valores sugeridos para `ResultadoSeguimiento`:

- `En revision`
- `Documentacion pendiente`
- `Listo para ingreso`
- `Ingreso realizado`
- `Cerrado`

## Lista auxiliar: CargosSolicitud

Fuente:

- archivo `cargos.xlsx`

Columnas sugeridas:

| Columna | Tipo sugerido |
|---|---|
| `Title` | Una linea de texto |
| `NombreCargo` | Una linea de texto |
| `Activo` | Numero o Si/No |

Uso:

- poblar el desplegable `CargoSolicitado`

Observacion:

- conviene limpiar duplicados y espacios sobrantes antes de importar

## Lista auxiliar: ContratosSolicitud

Fuente:

- archivo `diccionario_Contratos_Gerencias.xlsx`

Columnas sugeridas:

| Columna | Tipo sugerido |
|---|---|
| `Title` | Una linea de texto |
| `NumeroContrato` | Una linea de texto |
| `NombreContrato` | Una linea de texto |
| `UnidadCosto` | Numero |
| `NombreUnidadCosto` | Una linea de texto |
| `CodigoCentroCosto` | Numero |
| `NombreCentroCosto` | Una linea de texto |
| `GerenteArea` | Una linea de texto |
| `CorreoGerente` | Una linea de texto |
| `Activo` | Numero o Si/No |

Uso:

- `NombreContrato` alimenta el desplegable del formulario
- al elegir contrato, el resto se autocompleta

Observaciones:

- conviene limpiar espacios extras en nombres
- conviene revisar duplicados por `NombreContrato`

## Lista auxiliar: TurnosSolicitud

Fuente:

- archivo `turno`

Columnas sugeridas:

| Columna | Tipo sugerido |
|---|---|
| `Title` | Una linea de texto |
| `NombreTurno` | Una linea de texto |
| `Activo` | Numero o Si/No |

Uso:

- poblar el desplegable `Turno`

## Reglas de negocio principales

1. `Folio` debe generarse por sistema.
2. `FechaSolicitud` debe asignarse automaticamente al crear la solicitud.
3. `SolicitanteNombre`, `SolicitanteCargo` y `SolicitanteCorreo` deben venir desde Office 365.
4. La aceptacion final del solicitante equivale a la primera firma del proceso.
5. `NombreContrato` debe disparar el autocompletado de los datos contractuales, incluyendo `GerenteArea` y `GerenteAreaCorreo`.
6. `ControlContratosCorreo` debe quedar fijo en `mariajesus.lagos@busesjm.com`.
7. `FechaTermino` debe calcularse automaticamente en base a `FechaInicio`.
8. Todos los campos son obligatorios, excepto:
   - `OtrosBeneficios`
   - observaciones de aprobacion
   - campos de control interno
9. `Administrador de contrato` no forma parte del formulario.
10. `Control de Contrataciones` no debe permitir editar:
   - `Folio`
   - datos del solicitante
   - datos base del contrato
   - correos de aprobacion
   - firmas ya registradas

## Recomendacion tecnica

Para este modulo conviene repetir la misma estrategia que en certificados:

- catálogos auxiliares administrables
- lista principal como registro maestro
- Power Automate para aprobaciones y actualizacion de estados

Y, al igual que en certificados:

- usar texto plano en la lista principal para los valores finales
- no depender de columnas Lookup complejas en la V1

## Siguiente paso recomendado

1. Crear estas listas en SharePoint.
2. Limpiar e importar las fuentes:
   - `cargos.xlsx`
   - `diccionario_Contratos_Gerencias.xlsx`
   - archivo `turno`
3. Diseñar el formulario web del modulo ya contra este contrato de datos.
