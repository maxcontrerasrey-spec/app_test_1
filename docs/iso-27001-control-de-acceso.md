# Política de Control de Accesos (ISO 27001)

**Versión:** 1.0  
**Clasificación:** Interno Confidencial  

## 1. Objetivo
Asegurar que el acceso a la Plataforma ERP y a sus módulos de información esté restringido exclusivamente a usuarios autorizados y basado en el principio de **Mínimo Privilegio**, previniendo accesos no autorizados a información confidencial.

## 2. Definición de Roles y Privilegios
El acceso al sistema está gobernado por una arquitectura de roles que define los límites de lectura y escritura:
- **Usuario Estándar:** Acceso restringido únicamente a su perfil y tareas que le hayan sido delegadas (ej. Aprobaciones específicas).
- **Rol Operativo (Reclutamiento / RRHH):** Acceso a lectura de salarios, creación de folios y gestión de candidatos. No pueden auto-otorgarse roles ni eliminar logs.
- **SuperAdministrador (`is_super_admin`):** Rol con privilegios absolutos. Solo debe asignarse al CISO o a personal clave de soporte de TI estrictamente necesario.

## 3. Asignación y Revocación
1. **Asignación:** Cualquier solicitud de nuevo usuario o cambio de rol debe ser autorizada por la Gerencia respectiva y ejecutada por el SuperAdministrador.
2. **Revocación Inmediata:** Ante despido, renuncia o término de contrato de cualquier usuario del ERP, su acceso debe ser revocado en un plazo máximo de 4 horas hábiles.
3. **Revisión Periódica:** El equipo de TI realizará una auditoría semestral de las cuentas activas y los roles asignados, documentando cualquier anomalía.

## 4. Trazabilidad de Roles
Cualquier cambio a la matriz de roles o la elevación de un usuario a `is_super_admin` queda registrado permanentemente en el `security_audit_logs`. Estos registros no pueden ser alterados o eliminados por ningún usuario de la plataforma.
