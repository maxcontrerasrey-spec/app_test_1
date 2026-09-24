# Atlas — Mapa canónico de módulos

Status: ACTIVE
Document Type: ACTIVE_ARCHITECTURE
Owner: Engineering
Version: 1.0.0
Effective Date: 2026-09-22
Last Reviewed: 2026-09-22
Next Review: 2026-10-22
Source of Truth: AppRouter, routeModules, navigation y módulos fuente
Supersedes: mapas de rutas no fechados
Related Controls: permissions policy, route-role smoke, enterprise-doc audit
Change Approval: Engineering

| Dominio | Ruta principal | Fuente |
| --- | --- | --- |
| Inicio | / | src/modules/home y dashboard |
| Reclutamiento | /solicitud-contrataciones, /control-contrataciones | src/modules/recruitment |
| Psych | /gestion-psicolaboral, /evaluacionpsico | src/modules/psycholaboral |
| Movilidad | /movilidad-interna | src/modules/internal_mobility |
| RRHH/Incentivos | /recursos-humanos/:view | src/modules/incentives |
| Jornadas | /roster | src/modules/roster |
| Acreditación | /recursos-humanos/acreditacion/:view | src/modules/accreditation |
| Certificación | /certificados, /seguimiento-certificados | src/modules/competencies |
| Operaciones | /operaciones/:view | src/modules/operaciones |
| BI | /bi/:view | src/modules/bi |
| Alta operacional | /alta-operacional/:tab? | src/modules/operational_onboarding |

labs existe en el árbol, pero no está routeado ni en navegación activa; no se considera operativo sin evidencia adicional.
