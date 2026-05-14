# SharePoint: Paso a Paso para crear las listas

Este proyecto incluye un script para provisionar la estructura base de SharePoint del modulo `Generador de certificados`.

Archivo:

- [provision-certificates-lists.ps1](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/scripts/sharepoint/provision-certificates-lists.ps1)

## Que crea este script

Listas:

- `SolicitudesCertificados`
- `Instructores`
- `Trabajadores`
- `CatalogoVehiculos`
- `ConfiguracionCertificados`

## Antes de ejecutar

Necesitas:

1. Tener acceso al sitio SharePoint donde quedaran las listas.
2. Tener permisos para crear listas y columnas.
3. Tener PowerShell disponible.
4. Tener instalado `PnP.PowerShell`.

## Instalacion de PnP PowerShell

Si aun no lo tienes instalado, ejecuta en PowerShell:

```powershell
Install-Module PnP.PowerShell -Scope CurrentUser
```

Si te pregunta por confianza en el repositorio, acepta.

## Paso a paso de ejecucion

### 1. Abrir PowerShell

Abre una terminal PowerShell en tu computador.

### 2. Ir a la carpeta del proyecto

```powershell
cd "/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1"
```

### 3. Ejecutar el script

Reemplaza la URL por la de tu sitio real:

```powershell
./scripts/sharepoint/provision-certificates-lists.ps1 -SiteUrl "https://tuempresa.sharepoint.com/sites/TuSitio"
```

### 4. Iniciar sesion

El script abrira autenticacion interactiva para SharePoint. Inicia sesion con la cuenta que tenga permisos.

### 5. Esperar el aprovisionamiento

El script:

- crea las listas si no existen
- crea las columnas faltantes
- no vuelve a duplicar columnas ya creadas

## Que revisar despues

Una vez finalice, revisa en SharePoint:

1. Que existan las 7 listas.
2. Que `SolicitudesCertificados` tenga las columnas principales.
3. Que `EstadoCertificado` tenga estas opciones:
   `Pendiente`, `En proceso`, `Generado`, `Error`, `Anulado`
4. Que las listas auxiliares esten listas para cargar datos maestros.

## Siguiente paso recomendado

Despues de crear las listas:

1. Cargar instructores.
2. Cargar trabajadores.
3. Cargar el catalogo unificado de vehiculos.
6. Crear en `ConfiguracionCertificados` un registro base como:

| Clave | Valor | Descripcion |
| --- | --- | --- |
| `CorrelativoInicial` | `1000` | Primer correlativo visible del nuevo sistema |

## Recomendacion importante

Aunque la lista `ConfiguracionCertificados` deja preparado el parametro `CorrelativoInicial`, para evitar duplicados la logica final del correlativo deberia apoyarse en el `ID` nativo de SharePoint o en un proceso controlado por flujo.

## Uso practico recomendado para el correlativo

La opcion mas segura para empezar es:

- usar `ID` como base tecnica
- calcular `Correlativo = 999 + ID`
- luego construir el `Folio` con:
  `DDMMAAAAHHmm + Correlativo`

Ejemplo:

- `ID = 1`
- `Correlativo = 1000`
- fecha de creacion = `17/04/2026 09:35`
- folio = `1704202609351000`
