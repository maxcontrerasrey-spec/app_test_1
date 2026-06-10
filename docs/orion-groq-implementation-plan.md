# Plan de Implementación: ORION con Groq vía Supabase

## Objetivo

Activar ORION como copiloto con modelo LLM real usando `Groq` desde `Supabase Edge Functions`, manteniendo:

- autenticación real por JWT
- persistencia de sesiones y mensajes
- trazabilidad mínima
- saneamiento de contexto antes de salir a un tercero

Este plan asume que el despliegue final lo realizarás tú directamente en Supabase, sin depender del conector que bloqueó la exportación a Groq en este entorno.

---

## Estado actual

Hoy ORION ya tiene:

- módulo frontend operativo
- acceso restringido a `admin`
- persistencia real en:
  - `public.orion_sessions`
  - `public.orion_messages`
- Edge Function `orion-chat` desplegada y funcional
- backend actualmente en `modo seguro local`, sin consultar un proveedor externo

Lo que falta para dejarlo como IA real:

- reactivar llamada a `Groq`
- definir la política de salida de datos
- desplegar la versión externa desde Supabase
- validar punta a punta con usuario real

---

## Decisión de arquitectura

La arquitectura objetivo es esta:

```mermaid
flowchart LR
  A["Frontend ERP"] --> B["Supabase Edge Function orion-chat"]
  B --> C["Valida JWT y sesión"]
  C --> D["Consulta contexto en Supabase"]
  D --> E["Sanea / reduce contexto"]
  E --> F["Groq API"]
  F --> G["Respuesta LLM"]
  G --> H["Persistencia en Supabase"]
  H --> I["Respuesta al frontend"]
```

Regla clave:

- `Nunca` enviar a Groq el contexto bruto completo del ERP.
- `Siempre` limitar, sanear y recortar antes de invocar el modelo.

---

## Fase 1: Preparación y decisiones previas

### 1. Definir el alcance de datos permitidos

Antes de activar Groq, debes decidir qué puede salir del ERP.

Mínimo recomendado:

- permitido:
  - consultas generales del flujo
  - texto operativo no sensible
  - contexto ya redactado
- no permitido:
  - RUT
  - correos
  - teléfonos
  - URLs internas
  - UUIDs
  - folios identificables
  - contratos/clientes sensibles
  - texto libre con datos personales de candidatos o trabajadores

### 2. Definir consentimiento operativo

Debes elegir una de estas estrategias:

1. Consentimiento por uso del módulo
   - `admin` habilita ORION sabiendo que usa proveedor externo.
2. Consentimiento por mensaje
   - antes de enviar a Groq, el usuario confirma la salida.
3. Consentimiento global por ambiente
   - solo en `testing` o `admin beta`, no abierto a todos.

Recomendación:

- para esta etapa, usar `consentimiento por módulo + restricción a admin`

### 3. Definir auditoría mínima

Recomendado registrar por cada invocación externa:

- `user_id`
- `session_id`
- fecha/hora
- proveedor = `groq`
- modelo
- cantidad de mensajes de contexto enviados
- longitud del prompt sanitizado
- resultado `ok/error`

No es necesario guardar el prompt completo externo si no quieres aumentar riesgo.

---

## Fase 2: Configuración en Groq

### 1. Crear o confirmar API key

Necesitas una `API key` válida de Groq.

### 2. Elegir modelo inicial

Recomendación inicial:

- `llama-3.1-8b-instant`

Motivo:

- rápido
- barato
- suficiente para copiloto operativo inicial

### 3. Definir base URL

Base URL:

```txt
https://api.groq.com/openai/v1
```

---

## Fase 3: Configuración en Supabase

### 1. Cargar los secrets en Supabase

Debes cargar, como mínimo:

```txt
ORION_LLM_API_KEY=<tu_api_key_de_groq>
ORION_LLM_BASE_URL=https://api.groq.com/openai/v1
ORION_LLM_MODEL=llama-3.1-8b-instant
```

Si usas dashboard:

1. Ir a `Supabase Dashboard`
2. `Edge Functions`
3. `Secrets`
4. Crear o actualizar esos valores

### 2. Confirmar que existe `SUPABASE_SERVICE_ROLE_KEY`

La función lo necesita para:

- resolver la sesión ORION
- persistir mensajes
- operar sin depender del cliente público

### 3. Verificar estado de la función

Debes revisar:

- `orion-chat`
- `verify_jwt = true`
- `status = ACTIVE`

---

## Fase 4: Cambios de código requeridos

## 1. Reemplazar el modo seguro local por proveedor externo

La versión actual de [`supabase/functions/orion-chat/index.ts`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/supabase/functions/orion-chat/index.ts:1) está en modo local seguro.

Debes cambiar la parte que hoy hace:

- saneamiento del texto
- respuesta determinística local

por esta secuencia:

1. recuperar contexto reciente
2. sanear cada mensaje
3. recortar cantidad y longitud
4. armar prompt del sistema
5. invocar `Groq`
6. persistir respuesta
7. responder al frontend

## 2. Mantener estas protecciones

No debes quitar:

- validación JWT por `Authorization`
- verificación de que `session.created_by === userId`
- saneamiento de texto
- límites de contexto

## 3. Mantener respuesta JSON

Recomendación:

- no volver a SSE en esta etapa
- usar respuesta JSON cerrada

Motivo:

- la versión con stream fue la que terminó en `504`
- JSON simple es más estable para producción inicial

## 4. Mantener compatibilidad del cliente

[`src/modules/ai_assistant/services/orionChat.ts`](/Users/maximilianocontrerasrey/Documents/GitHub/app_test_1/src/modules/ai_assistant/services/orionChat.ts:1) ya soporta:

- `application/json`
- `text/event-stream`

No necesitas romper eso. Solo debes aprovechar la rama JSON.

---

## Fase 5: Hardening recomendado antes de habilitar Groq

### 1. Limitar contexto

Mantener algo como:

- máximo `8` mensajes previos
- máximo `600` caracteres por mensaje

### 2. Redacción mínima obligatoria

Mantener reemplazo de:

- email -> `[email]`
- URL -> `[url]`
- UUID -> `[id]`
- RUT -> `[rut]`
- teléfono -> `[telefono]`
- números largos -> `[numero]`

### 3. No enviar tablas ni payloads estructurados completos

ORION debe recibir solo:

- conversación resumida/sanitizada
- no registros completos de Supabase
- no objetos de candidatos/trabajadores crudos

### 4. Timeout del proveedor

Recomendado:

- `15s` a `20s` máximo

Si Groq no responde:

- devolver error controlado
- no dejar colgada la UI

### 5. Registro de auditoría

Idealmente crear una tabla tipo:

```sql
create table if not exists public.orion_provider_audit (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  user_id uuid not null,
  provider text not null,
  model text,
  outbound_context_messages integer not null default 0,
  outbound_chars integer not null default 0,
  status text not null,
  error_message text,
  created_at timestamptz not null default now()
);
```

No es estrictamente obligatoria para arrancar, pero sí recomendable.

---

## Fase 6: Paso a paso operativo

## Paso 1

Guardar una copia de la versión actual de `orion-chat` por si necesitas rollback.

## Paso 2

Actualizar secrets en Supabase:

- `ORION_LLM_API_KEY`
- `ORION_LLM_BASE_URL`
- `ORION_LLM_MODEL`

## Paso 3

Reemplazar en `orion-chat` la lógica local por la llamada real a Groq.

## Paso 4

Mantener el saneamiento de texto antes del envío.

## Paso 5

Desplegar la Edge Function directamente desde Supabase.

## Paso 6

Verificar en logs:

- que no haya `401`
- que no haya `404`
- que no haya `504`
- que el tiempo de respuesta sea razonable

## Paso 7

Ejecutar prueba autenticada real:

1. iniciar sesión con cuenta `admin`
2. abrir ORION
3. crear sesión nueva
4. enviar mensaje controlado
5. comprobar:
   - respuesta visible
   - persistencia en `orion_messages`
   - ausencia de timeout

## Paso 8

Ejecutar prueba con mensaje sensible:

Probar texto con:

- RUT
- correo
- número largo

Validar que:

- la salida al proveedor vaya redactada
- no se persista un prompt externo con dato sensible crudo en auditoría

## Paso 9

Validar fallback:

Si Groq cae o devuelve error:

- la UI no debe quedar colgada
- debe aparecer error controlado
- la sesión debe seguir consistente

---

## Fase 7: Checklist de validación final

Debes considerar ORION listo solo si se cumple todo esto:

- [ ] `orion-chat` desplegada y activa
- [ ] `verify_jwt = true`
- [ ] secrets de Groq cargados
- [ ] llamada real a Groq funcionando
- [ ] contexto sanitizado antes de salir
- [ ] respuesta vuelve en JSON sin timeout
- [ ] sesión y mensajes persisten correctamente
- [ ] acceso sigue restringido a `admin`
- [ ] logs sin `504`
- [ ] fallback controlado ante error del proveedor

---

## Riesgos conocidos

### 1. Riesgo de compliance

Aunque técnicamente funcione, sigues enviando contexto del ERP a un tercero.

Eso requiere decisión explícita de negocio y seguridad.

### 2. Riesgo de fuga por prompt libre

Si el usuario escribe datos sensibles en el chat, la sanitización debe cubrir ese caso.

### 3. Riesgo de costo

Si ORION queda abierto a más usuarios sin rate limit ni límites de contexto, el consumo crecerá rápido.

### 4. Riesgo de dependencia externa

Si Groq falla, ORION falla como IA real. Por eso el fallback debe existir.

---

## Recomendación final

Para pasar ORION de estable a útil, el orden correcto es:

1. activar Groq desde Supabase directo
2. mantener JSON y no SSE
3. conservar saneamiento agresivo
4. agregar auditoría de proveedor
5. probar solo con `admin`
6. recién después abrirlo a más roles

---

## Resultado esperado

Si ejecutas este plan correctamente, ORION quedará así:

- chatbot real con modelo LLM
- persistencia real en Supabase
- backend estable
- sin `504`
- con control razonable del contexto enviado
- listo para una etapa posterior de permisos finos, auditoría completa y apertura gradual
