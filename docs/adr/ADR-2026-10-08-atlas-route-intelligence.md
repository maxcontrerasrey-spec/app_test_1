# ADR: Atlas Route Intelligence en modo sombra

- Estado: Aceptado para V1 SHADOW
- Fecha: 2026-10-08
- Contexto: rutas cartográficamente calculables pueden ser impracticables en terreno; hoy Atlas usa TomTom, un optimizador determinista, Valhalla y Ferrostar.

## Decisión

1. GPT-6 Luna es el único LLM de Route Intelligence. No es el solver del recorrido.
2. TomTom continúa geocodificando, la heurística existente ordena, Valhalla mantiene autoridad cartográfica y Ferrostar mantiene navegación.
3. Un analizador y pre-filtro deterministas reducen el conjunto de maniobras enviado al auditor.
4. La integración usa la Responses API desde una Edge Function autenticada, con JSON estructurado, límites de tiempo y `store: false`. No se agrega `@openai/agents`: el runtime publicado de Supabase Edge no satisface el runtime mínimo documentado para ese SDK. Se evita actualizar el runtime de toda la plataforma por una sola función.
5. La base de vehículos guarda dimensiones opcionales con fuente y verificación. La falta de un dato se conserva como desconocida y limita cualquier `APPROVE`.
6. El conocimiento operacional persiste separado de la IA. Sugerencias comienzan como `PROPOSED`; solo evidencia explícitamente validada alimenta el pre-filtro. La validación no se produce automáticamente.
7. `SHADOW` es el primer modo productivo. La auditoría no cambia, bloquea ni publica rutas; la propuesta continúa disponible si falla OpenAI.
8. VROOM, planner agent y replanificación quedan fuera de esta activación. El flujo Valhalla actual no expone una capacidad verificada de alternativas/penalización para el route adapter. Implementar un ciclo que no pueda aplicar restricciones sería ficticio y riesgoso. VROOM tampoco aborda el problema prioritario de viabilidad de maniobras.

## Alternativas evaluadas

- Usar Luna para permutar direcciones: rechazado porque el LLM no debe resolver el problema matemático y las respuestas no son un sustituto de matriz/routing.
- Cambiar Valhalla o Ferrostar: rechazado; preservan sus roles y rutas existentes.
- Cambiar globalmente el runtime Supabase o instalar Agents SDK: rechazado para V1; no existe necesidad funcional que justifique el cambio del runtime.
- Aplicar sugerencias de auditoría automáticamente: rechazado hasta tener datos validados, alternativas de ruta comprobadas y aprobación humana de SHADOW.
- Adoptar VROOM: diferido; no hay necesidad de asignación de varios vehículos/ventanas que lo justifique.

## Consecuencias y condiciones de revisión

El sistema puede detectar y explicar algunas maniobras de riesgo, pero no certifica legalidad ni ejecutabilidad física. Reunir decisiones humanas y resultados reales en SHADOW. Revisar este ADR antes de activar `ASSISTED`, `ENFORCED`, replanificación o restricciones de maniobra. Medir falsos negativos, falsos positivos, cobertura de perfiles verificados, latencia y costo por auditoría con el corpus de operación.
