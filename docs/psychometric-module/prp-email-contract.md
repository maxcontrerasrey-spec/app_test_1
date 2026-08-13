# Contrato digital PRP recibido por correo

Estado: implementado como contrato digital versionado.
Fuente primaria: correo `Evaluaciones Psicolaborales ` recibido el 2026-08-13, adjuntos `5.- Escala PRP JM.docx` y `2. Corrector PRP  (1).xls`.
Instrumento: `PRP_EMAIL_FORM_A_30`.
Objetivo: digitalizar literalmente el PRP dentro del módulo psicométrico compartido del ERP.

## 1. Regla de fidelidad

- Conservar texto, orden, alternativas y tabulación de los adjuntos.
- No modernizar ni corregir silenciosamente redacción, ortografía, rangos o baremos.
- Versionar por separado contenido, clave, baremo e interpretación.
- Las respuestas se puntúan exclusivamente en backend. La clave y los baremos no se envían al navegador del candidato.
- Los ejemplos A, B y C son práctica; no se almacenan como respuestas del instrumento ni participan del puntaje.
- No existe decisión automática de contratación o descarte basada solo en PRP.

## 2. Instrucciones exactas

Título: `ESCALA P.R.P`

Subtítulo: `INSTRUCCIONES FORMA A`

> Señale con una X la opinión que mejor lo representa, de acuerdo con la afirmación que se le presenta.

Después del ejemplo A:

> En este caso la persona ha expresado su total desacuerdo con la frase indicada. AHORA PRACTIQUE USTED CON ESTOS DOS EJEMPLOS:

Antes de comenzar:

> Le rogamos sea lo más sincero posible y evite responder "Indeciso" cada vez que pueda hacerlo. Recuerde que lo importante es su opinión y no hay respuestas correctas o incorrectas.

> AHORA DE VUELTA LA PAGINA Y COMIENCE POR FAVOR.

## 3. Alternativas

La interfaz debe presentar una selección única por afirmación, en este orden:

1. `Totalmente de Acuerdo`
2. `De acuerdo`
3. `Indeciso`
4. `En Desacuerdo`
5. `Totalmente en Desacuerdo`

## 4. Ejemplos de práctica

- A) `El tabaco puede ser dañino para la Salud.` El documento muestra marcada la alternativa `Totalmente en Desacuerdo`.
- B) `El tabaco es menos dañino para los jóvenes.`
- C) `Las embarazadas no deberían fumar.`

En el flujo digital, A debe mostrarse resuelto como demostración. B y C pueden responderse en memoria de la sesión para practicar el control, pero no se persisten ni validan como respuestas correctas.

## 5. Ítems exactos

1. Asistiría a un curso de prevención de accidentes de trabajo.
2. Colaboraría en las acciones de prevención de accidentes de trabajo.
3. Asistir a cursos de seguridad es perder el tiempo.
4. La mayoría de los accidentes de trabajo se deben a mala suerte.
5. Las reuniones mensuales de seguridad sólo sirven para perder el tiempo.
6. Por mucho ruido que haya siempre se acostumbra uno.
7. Cada uno tiene su destino y si se ha de accidentar, por más seguro que trabaje, se accidenta.
8. Cada trabajador debe pedir su ropa de seguridad cuando le corresponde.
9. No vale la pena usar protecciones porque el trabajo cunde poco.
10. Aunque una Herramienta esta defectuosa con cuidado puede utilizarse.
11. Colaboraría con la confección de carteles de seguridad.
12. Para prevenirse de los accidentes no es necesario utilizar los elementos de protección personal.
13. Los accidentes de trabajo solo ocurren a los demás
14. El trabajador descuidado pone en peligro todos sus compañeros.
15. Deberían organizarse más campañas de seguridad.
16. Cuando trabajamos no es posible tener en cuenta todas las normas de seguridad.
17. No uso los zapatos de seguridad porque me hacen trabajar incómodo.
18. Se tendría que ver más la seguridad del trabajo.
19. Tendría que haber más supervisión en seguridad.
20. Las normas de seguridad no son problema mío.
21. Aunque sea más lento prefiero trabajar seguro.
22. La culpa de los accidentes la tienen las maquinas.
23. El experto en prevención de riesgos es una persona muy necesaria en toda empresa.
24. Me uniría a los que luchan para evitar los accidentes de trabajo.
25. El accidente no avisa, hay que estar alerta.
26. Si debiese hacerlo, usaría todas las protecciones necesarias.
27. La seguridad en el trabajo es cuestión de suerte.
28. A veces uno debe arriesgarse para terminar el trabajo más rápido.
29. Es imprescindible la buena colaboración de todos para una buena seguridad.
30. Muchos jefes molestan a la gente hablando de seguridad en el trabajo.

## 6. Clave privada

Los ítems `1, 2, 8, 11, 14, 15, 18, 19, 21, 23, 24, 25, 26, 29` usan:

| Respuesta | Puntaje |
|---|---:|
| Totalmente de Acuerdo | 5 |
| De acuerdo | 4 |
| Indeciso | 3 |
| En Desacuerdo | 2 |
| Totalmente en Desacuerdo | 1 |

Los ítems `3, 4, 5, 6, 7, 9, 10, 12, 13, 16, 17, 20, 22, 27, 28, 30` usan:

| Respuesta | Puntaje |
|---|---:|
| Totalmente de Acuerdo | 1 |
| De acuerdo | 2 |
| Indeciso | 3 |
| En Desacuerdo | 4 |
| Totalmente en Desacuerdo | 5 |

El puntaje directo total es la suma de los 30 ítems y su rango matemático es `30–150`.

## 7. Factores del corrector

El archivo fuente denomina las dimensiones solamente como `Factor 1` a `Factor 6`. Los nombres descriptivos encontrados fuera del correo no deben publicarse hasta que Psicología confirme la nomenclatura oficial que utilizará Buses JM.

| Factor | Ítems | Cálculo exacto del corrector |
|---|---|---|
| 1 | 23, 24, 25, 26, 29 | `suma / 25` |
| 2 | 4, 6, 7, 27 | `suma / 20` |
| 3 | 1, 2, 11, 15, 24 | `suma / 25` |
| 4 | 3, 9, 12, 13, 20, 22 | `suma / 30` |
| 5 | 18, 19, 21 | `(15 - suma) / 15` |
| 6 | 5, 10, 16, 30 | `suma / 20` |

Notas de fidelidad:

- El ítem 24 participa en los factores 1 y 3.
- El factor 5 invierte la suma completa y no sigue la misma forma de los otros factores.
- Ninguna de estas dos particularidades debe “corregirse” sin autorización profesional explícita y una nueva versión de scoring.

## 8. Datos adicionales del formulario

Datos de identidad/contexto:

- Nombre.
- Cargo al que postula.
- Empresa, con valor visible `BUSES JM` en el adjunto.
- Sexo.
- Fecha.
- Estado Civil.

Preguntas adicionales, fuera de los 30 ítems puntuados:

- Edad: `Entre 16 – 20`, `Entre 21 – 25`, `Entre 26 – 30`, `Entre 31 – 35`, `Entre 36 – 40`, `Entre 41 – 45`, `Entre 45 – 50`, `Entre 51 - 55`, `Entre 56 - 60`, `Más de 61`.
- Años de experiencia en el cargo: `1 – 5`, `6 – 10`, `11 – 15`, `16 – 20`, `21 – 25`, `26 – 30`, `Más de 31`.
- Accidentes o incidentes de trabajo sufridos en los dos últimos años: `0`, `1`, `2`, `3`, `4`, `5`, `Más de 5`.
- Años de estudio totales: `Sin Estudios`, `Entre 1 – 3`, `Entre 4 – 6`, `Entre 7 – 9`, `Entre 10 - 12`, `Entre 13 y Más.`

Cuando el ERP ya tenga un dato autoritativo, la UI puede precargarlo, pero debe conservar el valor categórico exacto contestado para reproducibilidad histórica.

## 9. Baremos

El corrector incluye percentiles y eneatipos para cinco grupos:

- Mandos intermedios.
- Obreros calificados.
- Obreros no calificados.
- Administrativos.
- Técnicos.

La tabla marca visualmente:

- Eneatipos 7–9: `SEGUROS`.
- Eneatipos 4–6: bloque intermedio rotulado `RIESGOSOS` y `NEUTRO` en la misma fila de inicio.
- Eneatipos 1–3: `NO SEGURO`.

El archivo no contiene una fórmula ejecutable que convierta automáticamente puntaje directo y grupo ocupacional en percentil/eneatipo. La tabla tiene celdas vacías y algunos intervalos escritos como texto. Por ello, la digitalización debe almacenar el baremo como una versión tabular privada y no inferir la regla de aproximación hasta resolver los gates del apartado 11.

## 10. Contrato digital propuesto

- `instrument_code`: `PRP_EMAIL_FORM_A_30`.
- `content_version`: `email-docx-2026-08-13-v1`.
- `scoring_version`: `email-xls-2026-08-13-v1`.
- `norm_version`: `email-xls-2026-08-13-v1`.
- `response_count`: 30 respuestas obligatorias.
- `response_values`: códigos estables de alternativa, no puntajes expuestos.
- `raw_score_range`: 30–150.
- `factor_outputs`: seis valores, conservando numerador, denominador y resultado.
- `norm_group`: una de las cinco categorías, resuelta por una tabla ERP versionada y aprobada.
- `norm_output`: puntaje directo, percentil, eneatipo y clasificación; no calcular mientras el baremo aplicable sea ambiguo.
- `completion`: atómica e idempotente; no generar resultado parcial.
- `access`: candidato con proceso activo y desafío de identidad; resultados solo para Psicología/RR. HH. autorizados.
- `audit`: conservar versiones, hash de respuestas y scoring; no registrar respuestas completas en logs.

## 11. Gates bloqueantes antes del código productivo

1. Psicología debe confirmar cómo resolver puntajes que caen entre dos valores publicados o frente a celdas vacías del baremo.
2. Psicología debe confirmar la clasificación exacta del bloque de eneatipos 4–6: el corrector muestra simultáneamente `RIESGOSOS` y `NEUTRO`.
3. Psicología debe aprobar el mapeo de cada cargo ERP a uno de los cinco grupos normativos.
4. Psicología debe confirmar que la fórmula especial del Factor 5 y la doble pertenencia del ítem 24 son intencionales.
5. Deben resolverse sin cambiar silenciosamente la fuente: edad 45 aparece en dos rangos, no existe alternativa de 0 años de experiencia y `Más de 61` deja ambiguos los 61 años.
6. Debe revisarse el intervalo `110-101` de Obreros calificados, porque rompe la secuencia monotónica visible del baremo y podría corresponder a `100-101`.
7. Legal o el responsable documental debe confirmar el derecho de reproducción digital del instrumento y su corrector.

## 12. Criterios de aceptación futuros

- La UI reproduce literalmente los 30 ítems y cinco alternativas.
- Los ejemplos no afectan el resultado.
- No puede enviarse con menos o más de 30 respuestas válidas.
- Las pruebas unitarias cubren ambos sentidos de puntuación, extremos 30/150 y todos los factores.
- El resultado conserva el puntaje directo aunque el baremo no pueda resolverse.
- Un baremo ambiguo produce estado `pending_professional_review`, nunca una clasificación inventada.
- La clave, factores y baremos no aparecen en el bundle público ni en respuestas de red.
- La recalificación exige una nueva versión y conserva el resultado histórico original.
