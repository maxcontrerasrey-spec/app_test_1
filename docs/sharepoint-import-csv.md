# Importacion rapida de listas SharePoint con CSV

Si no quieres crear columna por columna en SharePoint, una forma practica es importar cada lista desde un archivo `CSV` y luego ajustar solo algunos tipos o configuraciones.

Archivos preparados:

- [SolicitudesCertificados.csv](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/templates/sharepoint/SolicitudesCertificados.csv)
- [Instructores.csv](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/templates/sharepoint/Instructores.csv)
- [Trabajadores.csv](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/templates/sharepoint/Trabajadores.csv)
- [CatalogoVehiculos.csv](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/templates/sharepoint/CatalogoVehiculos.csv)
- [ConfiguracionCertificados.csv](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/templates/sharepoint/ConfiguracionCertificados.csv)

## Metodo recomendado

Para cada lista:

1. Entra al sitio SharePoint.
2. Selecciona `Nuevo`.
3. Selecciona `Lista`.
4. Selecciona `Desde Excel` o `Desde CSV` si tu entorno lo permite.
5. Sube el archivo correspondiente.
6. Revisa los nombres de columnas sugeridos.
7. Crea la lista.

## Orden recomendado de importacion

1. `Instructores`
2. `Trabajadores`
3. `CatalogoVehiculos`
6. `ConfiguracionCertificados`
7. `SolicitudesCertificados`

## Ajustes recomendados despues de importar

Importar desde CSV acelera mucho el arranque, pero despues conviene revisar algunas columnas.

### Simplificacion aplicada para V1

Para avanzar mas rapido en la primera version, la lista `Trabajadores` se dejo reducida a las columnas minimas:

- `NombreCompleto`
- `Rut`
- `Activo`

Se excluyeron por ahora:

- `Cargo`
- `Area`

Si despues las necesitas, las agregamos sin problema.

### Catalogo de vehiculos unificado

Para simplificar el mantenimiento, se consolidaron `Marca`, `Tipo` y `Modelo` en una sola lista:

- `CatalogoVehiculos`

Eso permite manejar combinaciones validas reales y despues filtrar mejor en la web.

### `SolicitudesCertificados`

Revisar y, si hace falta, ajustar:

- `Correlativo` como numero
- `Evaluacion` como numero
- `FechaCertificacion` como fecha
- `FechaCreacionSolicitud` como fecha y hora
- `CertificadoVigenteHasta` como fecha
- `EstadoCertificado` como eleccion
- `PdfUrl` como hipervinculo
- `ObservacionError` como varias lineas de texto
- `ModelosTodos` como varias lineas de texto

Valores recomendados para `EstadoCertificado`:

- `Pendiente`
- `En proceso`
- `Generado`
- `Error`
- `Anulado`

### Listas auxiliares

Revisar que `Activo` quede como si/no o booleano si SharePoint no lo detecta bien.

## Recomendacion practica

La forma mas rapida de avanzar hoy es:

1. Importar las listas con estos archivos.
2. Verificar que la estructura base quede creada.
3. Ajustar solo las columnas especiales.
4. Cargar datos reales en las listas auxiliares.

## Nota sobre el correlativo

Aunque el CSV incluye un ejemplo con `Correlativo = 1000`, eso es solo una fila de referencia para que SharePoint cree la estructura.

La logica real del correlativo no deberia mantenerse a mano. La recomendacion sigue siendo calcularlo despues a partir del `ID` de SharePoint o mediante el flujo.
