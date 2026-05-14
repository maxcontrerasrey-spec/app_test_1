# Brand Kit - Plataforma de Control

## Resumen
Sistema visual corporativo, calido y minimalista para plataformas internas de control, seguimiento y gestion operativa.

La intencion del branding es transmitir:
- orden
- confianza
- institucionalidad
- cercania humana
- claridad operativa

No busca verse como una startup generica ni como un dashboard frio. La sensacion general debe ser sobria, limpia y ejecutiva.

## Tipografia
- Fuente principal: `Inter`
- Uso recomendado:
  - titulos: `600`
  - subtitulos: `500`
  - texto general: `400`
  - labels y UI secundaria: `500`

Fallback recomendado:

```css
font-family: "Inter", "Inter var", -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif;
```

## Paleta

### Base
- Fondo general claro: `#f4f0ed`
- Brillo superior de pagina: `#edf1f5`
- Superficie principal: `#ffffff`

### Texto
- Texto principal: `#271f1b`
- Texto base alternativo: `#221f1d`
- Texto secundario: `#6f655f`

### Acento institucional
- Acento principal: `#be4f40`
- Acento profundo: `#a64436`
- Fondo/acento suave: `#f8e7e2`
- Borde del acento: `#e8c5bc`

### Bordes
- Borde principal: `#dccfc8`
- Borde suave: `#efe4df`

### Sidebar / panel institucional
- Gradiente recomendado:
  - inicio: `#bf5445`
  - fin: `#b44739`

## Forma y volumetria
- Cards: redondeadas, limpias, con bastante aire
- Inputs: redondeados suaves, elegantes, no exagerados
- Paneles grandes: radios altos
- Iconos: dentro de circulos o capsulas suaves cuando se busque destacar funcionalidad

Radios recomendados:
- card grande: `24px`
- panel principal: `30px`
- input: `14px`
- boton secundario: `12px`
- chips / pills: `999px` o `18px`

## Sombras
Sombras siempre suaves y calidas, nunca pesadas.

Recomendadas:

```css
0 18px 42px rgba(109, 66, 47, 0.08)
0 20px 40px rgba(95, 63, 49, 0.08)
```

## Estilo de componentes

### Boton principal
- fondo: acento institucional
- texto: blanco
- sensacion: claro, confiable, visible

### Inputs
- fondo blanco
- borde suave
- foco limpio y moderno
- hover/focus pueden usar un brillo azul delgado si se quiere reforzar interaccion

### Sidebar
- fondo terracota institucional
- texto claro
- items activos sobre fondo blanco
- contraste alto pero elegante

### Cards
- fondo blanco
- borde muy suave
- sombra discreta
- espaciado amplio

## Tono visual
- minimalista
- corporativo
- humano
- moderno sin verse experimental
- modular

## Que evitar
- colores neon
- gradientes frios tipo startup
- sombras duras
- saturacion excesiva
- iconografia inconsistente
- layouts recargados

## Prompt maestro reutilizable

```text
Diseña una aplicación web interna con estética corporativa cálida, minimalista y ejecutiva.

Sistema visual:
- Tipografía principal: Inter
- Fondo general claro con matiz cálido y luz suave
- Color de acento principal: #be4f40
- Variación profunda del acento: #a64436
- Fondos blancos para tarjetas y formularios
- Bordes suaves en tonos cálidos: #dccfc8 y #efe4df
- Texto principal oscuro cálido: #271f1b
- Texto secundario: #6f655f

Lenguaje visual:
- institucional, limpio, sobrio, humano
- paneles grandes con esquinas redondeadas
- cards blancas con bordes suaves y sombras discretas
- formularios con mucho aire y jerarquía clara
- sidebar o panel lateral en terracota institucional
- iconos dentro de círculos suaves cuando deban destacar
- diseño apto para una plataforma interna de control, seguimiento y gestión

Evitar:
- look startup genérico
- saturación excesiva
- sombras dramáticas
- dark mode agresivo
- exceso de decoración
```

## Uso recomendado en otra app
- reutilizar la paleta y los tokens
- conservar Inter como fuente base
- mantener el mismo sistema de radios/sombras
- adaptar solo el contenido funcional, no la estructura visual base
