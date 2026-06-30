# Generador de certificados legacy

Este documento preserva el valor funcional del archivo `generador_de_certificados_rev02.xlsx` sin mantener un binario Excel dentro del repositorio.

## Estado

- El workbook era una referencia del flujo legacy previo al modulo web.
- No existe consumo directo desde la aplicacion actual.
- La informacion viva ya quedo separada en archivos mas auditables del repo.

## Que contenia el Excel

| Hoja | Rol | Observacion |
| --- | --- | --- |
| `diccionario_` | Catalogo base de instructores, firmas y combinaciones de marca/tipo/modelo | Base de busqueda para autocompletar instructor, RUT, codigo de perfil y firma. |
| `dot_` | Dotacion de trabajadores | 1.653 filas con `Nombre Completo`, `Numero de Documento`, `Cargo` y `Nombre Area`. |
| `firmas` | Firmas digitalizadas | Texto de firma por instructor. |
| `form` | Formulario operativo | Usaba `XLOOKUP` y `TEXTJOIN` para resolver instructor, RUT del trabajador y modelos evaluados. |
| `bbdd` | Base historica principal | 244 filas con certificados generados y campos operativos completos. |
| `Registro_` | Registro historico anterior | 598 filas con la misma estructura operativa de certificados emitidos. |

## Campos operativos relevantes

Los registros historicos (`bbdd` y `Registro_`) compartian esta estructura:

- `correlativo_`
- `instructor_2`
- `rut_instructor`
- `codigo_perfil_cv`
- `fecha`
- `hora`
- `trabajador_`
- `rut_trabajador`
- `marca_`
- `tipo_1`
- `modelo_1`
- `modelo_2`
- `modelo_3`
- `modelos_todos`
- `evaluacion_`
- `estado_certificado`
- `autorizado_para_operar`
- `codigo_`
- `folio_`
- `fecha_texto`
- `firma_`
- `calificacion_`
- `fecha_firma2`

## Donde vive ahora el valor util

- Catalogo de instructores: `src/shared/data/instructores.csv`
- Catalogo de trabajadores: `src/shared/data/trabajadores.csv`
- Catalogo de vehiculos: `src/shared/data/catalogoVehiculos.csv`
- Especificacion funcional del modulo: `docs/modulo-1-generador-certificados.md`
- Plantilla Word asociada al certificado: `docs/templates/certificado_tipo_rev02.docx`

## Motivo del retiro del Excel

- Era un binario dificil de auditar y versionar.
- Duplicaba datos que ya existen en CSV y documentacion viva.
- Su permanencia en git no aportaba valor operativo directo al ERP actual.
