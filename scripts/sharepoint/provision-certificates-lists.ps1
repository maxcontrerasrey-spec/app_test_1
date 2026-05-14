param(
    [Parameter(Mandatory = $true)]
    [string]$SiteUrl,

    [Parameter(Mandatory = $false)]
    [string]$ClientId
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Ensure-List {
    param(
        [string]$Title,
        [string]$Description
    )

    $existingList = Get-PnPList -Identity $Title -ErrorAction SilentlyContinue
    if ($null -eq $existingList) {
        Write-Host "Creando lista: $Title"
        New-PnPList -Title $Title -Template GenericList -OnQuickLaunch -Description $Description | Out-Null
    }
    else {
        Write-Host "La lista ya existe: $Title"
    }
}

function Ensure-Field {
    param(
        [string]$List,
        [string]$DisplayName,
        [string]$InternalName,
        [string]$Type,
        [bool]$Required = $false,
        [bool]$AddToDefaultView = $true,
        [string[]]$Choices = @()
    )

    $field = Get-PnPField -List $List -Identity $InternalName -ErrorAction SilentlyContinue
    if ($null -ne $field) {
        Write-Host "La columna ya existe en ${List}: $InternalName"
        return
    }

    $params = @{
        List             = $List
        DisplayName      = $DisplayName
        InternalName     = $InternalName
        Type             = $Type
        Required         = $Required
        AddToDefaultView = $AddToDefaultView
    }

    if ($Choices.Count -gt 0) {
        $params["Choices"] = $Choices
    }

    Add-PnPField @params | Out-Null
    Write-Host "Columna creada en ${List}: $InternalName"
}

function Set-TitleOptional {
    param(
        [string]$List
    )

    Set-PnPField -List $List -Identity "Title" -Values @{ Required = $false } | Out-Null
    Write-Host "Columna Title configurada como no obligatoria en $List"
}

Write-Host "Conectando a SharePoint: $SiteUrl"
if ([string]::IsNullOrWhiteSpace($ClientId)) {
    Connect-PnPOnline -Url $SiteUrl -Interactive
}
else {
    Connect-PnPOnline -Url $SiteUrl -Interactive -ClientId $ClientId
}

Ensure-List -Title "SolicitudesCertificados" -Description "Registro maestro de solicitudes de certificados de competencias."
Ensure-List -Title "Instructores" -Description "Catalogo de instructores habilitados para certificacion."
Ensure-List -Title "Trabajadores" -Description "Catalogo operativo de trabajadores para seleccion en certificados."
Ensure-List -Title "Marcas" -Description "Catalogo de marcas de vehiculos."
Ensure-List -Title "TiposVehiculo" -Description "Catalogo de tipos de vehiculo."
Ensure-List -Title "ModelosVehiculo" -Description "Catalogo de modelos por marca y tipo."
Ensure-List -Title "ConfiguracionCertificados" -Description "Parametros operativos del modulo de certificados."

Set-TitleOptional -List "SolicitudesCertificados"
Set-TitleOptional -List "Instructores"
Set-TitleOptional -List "Trabajadores"
Set-TitleOptional -List "Marcas"
Set-TitleOptional -List "TiposVehiculo"
Set-TitleOptional -List "ModelosVehiculo"
Set-TitleOptional -List "ConfiguracionCertificados"

Ensure-Field -List "SolicitudesCertificados" -DisplayName "Correlativo" -InternalName "Correlativo" -Type Number -Required $true
Ensure-Field -List "SolicitudesCertificados" -DisplayName "Folio" -InternalName "Folio" -Type Text -Required $true
Ensure-Field -List "SolicitudesCertificados" -DisplayName "Estado certificado" -InternalName "EstadoCertificado" -Type Choice -Required $true -Choices @("Pendiente", "En proceso", "Generado", "Error", "Anulado")
Ensure-Field -List "SolicitudesCertificados" -DisplayName "Instructor" -InternalName "Instructor" -Type Text -Required $true
Ensure-Field -List "SolicitudesCertificados" -DisplayName "Rut instructor" -InternalName "RutInstructor" -Type Text -Required $true
Ensure-Field -List "SolicitudesCertificados" -DisplayName "Codigo perfil CV" -InternalName "CodigoPerfilCv" -Type Text -Required $true
Ensure-Field -List "SolicitudesCertificados" -DisplayName "Firma instructor" -InternalName "FirmaInstructor" -Type Note -Required $true
Ensure-Field -List "SolicitudesCertificados" -DisplayName "Fecha certificacion" -InternalName "FechaCertificacion" -Type DateTime -Required $true
Ensure-Field -List "SolicitudesCertificados" -DisplayName "Hora certificacion" -InternalName "HoraCertificacion" -Type Text -Required $true
Ensure-Field -List "SolicitudesCertificados" -DisplayName "Fecha creacion solicitud" -InternalName "FechaCreacionSolicitud" -Type DateTime -Required $false
Ensure-Field -List "SolicitudesCertificados" -DisplayName "Trabajador" -InternalName "Trabajador" -Type Text -Required $true
Ensure-Field -List "SolicitudesCertificados" -DisplayName "Rut trabajador" -InternalName "RutTrabajador" -Type Text -Required $true
Ensure-Field -List "SolicitudesCertificados" -DisplayName "Marca" -InternalName "Marca" -Type Text -Required $true
Ensure-Field -List "SolicitudesCertificados" -DisplayName "Tipo" -InternalName "Tipo" -Type Text -Required $true
Ensure-Field -List "SolicitudesCertificados" -DisplayName "Modelo 1" -InternalName "Modelo1" -Type Text -Required $false
Ensure-Field -List "SolicitudesCertificados" -DisplayName "Modelo 2" -InternalName "Modelo2" -Type Text -Required $false
Ensure-Field -List "SolicitudesCertificados" -DisplayName "Modelo 3" -InternalName "Modelo3" -Type Text -Required $false
Ensure-Field -List "SolicitudesCertificados" -DisplayName "Modelos consolidados" -InternalName "ModelosTodos" -Type Note -Required $false
Ensure-Field -List "SolicitudesCertificados" -DisplayName "Evaluacion" -InternalName "Evaluacion" -Type Number -Required $true
Ensure-Field -List "SolicitudesCertificados" -DisplayName "Calificacion" -InternalName "Calificacion" -Type Text -Required $false
Ensure-Field -List "SolicitudesCertificados" -DisplayName "Autorizado para operar" -InternalName "AutorizadoParaOperar" -Type Text -Required $false
Ensure-Field -List "SolicitudesCertificados" -DisplayName "Fecha texto" -InternalName "FechaTexto" -Type Text -Required $false
Ensure-Field -List "SolicitudesCertificados" -DisplayName "Fecha firma 2" -InternalName "FechaFirma2" -Type Text -Required $false
Ensure-Field -List "SolicitudesCertificados" -DisplayName "URL PDF" -InternalName "PdfUrl" -Type URL -Required $false
Ensure-Field -List "SolicitudesCertificados" -DisplayName "Nombre archivo PDF" -InternalName "PdfNombreArchivo" -Type Text -Required $false
Ensure-Field -List "SolicitudesCertificados" -DisplayName "Observacion error" -InternalName "ObservacionError" -Type Note -Required $false
Ensure-Field -List "SolicitudesCertificados" -DisplayName "Creado por cuenta" -InternalName "CreadoPorCuenta" -Type Text -Required $false
Ensure-Field -List "SolicitudesCertificados" -DisplayName "Certificado vigente hasta" -InternalName "CertificadoVigenteHasta" -Type DateTime -Required $false

Ensure-Field -List "Instructores" -DisplayName "Nombre completo" -InternalName "NombreCompleto" -Type Text -Required $true
Ensure-Field -List "Instructores" -DisplayName "Rut" -InternalName "Rut" -Type Text -Required $true
Ensure-Field -List "Instructores" -DisplayName "Codigo perfil CV" -InternalName "CodigoPerfilCv" -Type Text -Required $true
Ensure-Field -List "Instructores" -DisplayName "Firma instructor" -InternalName "FirmaInstructor" -Type Text -Required $true
Ensure-Field -List "Instructores" -DisplayName "Activo" -InternalName "Activo" -Type Boolean -Required $false

Ensure-Field -List "Trabajadores" -DisplayName "Nombre completo" -InternalName "NombreCompleto" -Type Text -Required $true
Ensure-Field -List "Trabajadores" -DisplayName "Rut" -InternalName "Rut" -Type Text -Required $true
Ensure-Field -List "Trabajadores" -DisplayName "Cargo" -InternalName "Cargo" -Type Text -Required $false
Ensure-Field -List "Trabajadores" -DisplayName "Area" -InternalName "Area" -Type Text -Required $false
Ensure-Field -List "Trabajadores" -DisplayName "Activo" -InternalName "Activo" -Type Boolean -Required $false

Ensure-Field -List "Marcas" -DisplayName "Nombre marca" -InternalName "NombreMarca" -Type Text -Required $true
Ensure-Field -List "Marcas" -DisplayName "Activo" -InternalName "Activo" -Type Boolean -Required $false

Ensure-Field -List "TiposVehiculo" -DisplayName "Nombre tipo" -InternalName "NombreTipo" -Type Text -Required $true
Ensure-Field -List "TiposVehiculo" -DisplayName "Activo" -InternalName "Activo" -Type Boolean -Required $false

Ensure-Field -List "ModelosVehiculo" -DisplayName "Nombre modelo" -InternalName "NombreModelo" -Type Text -Required $true
Ensure-Field -List "ModelosVehiculo" -DisplayName "Marca" -InternalName "Marca" -Type Text -Required $true
Ensure-Field -List "ModelosVehiculo" -DisplayName "Tipo" -InternalName "Tipo" -Type Text -Required $true
Ensure-Field -List "ModelosVehiculo" -DisplayName "Activo" -InternalName "Activo" -Type Boolean -Required $false

Ensure-Field -List "ConfiguracionCertificados" -DisplayName "Clave" -InternalName "Clave" -Type Text -Required $true
Ensure-Field -List "ConfiguracionCertificados" -DisplayName "Valor" -InternalName "Valor" -Type Text -Required $true
Ensure-Field -List "ConfiguracionCertificados" -DisplayName "Descripcion" -InternalName "Descripcion" -Type Note -Required $false
Ensure-Field -List "ConfiguracionCertificados" -DisplayName "Activo" -InternalName "Activo" -Type Boolean -Required $false

Write-Host ""
Write-Host "Provision finalizado."
Write-Host "Siguiente paso sugerido: cargar datos base en Instructores, Trabajadores, Marcas, TiposVehiculo y ModelosVehiculo."
