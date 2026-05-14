# Arquitectura Tecnica Inicial

## Objetivo

Definir una base tecnica moderna, responsiva y escalable para una plataforma web interna de automatizaciones orientada a usuarios con cuenta Microsoft 365.

## Stack recomendado

- `React`
- `TypeScript`
- `Vite`
- `React Router`
- `CSS` estructurado por capas y variables de diseno

## Motivos de esta eleccion

- `React` permite construir una interfaz dinamica y modular.
- `TypeScript` ayuda a mantener el proyecto ordenado cuando crezcan los modulos.
- `Vite` entrega una base rapida y liviana para desarrollo.
- `React Router` permite agregar modulos nuevos sin rehacer la aplicacion.
- Una capa de servicios separada facilita integrar SharePoint, Microsoft 365 y Power Automate sin mezclar esa logica con la interfaz.

## Capas del proyecto

### `app`

Responsable de:

- arranque de la aplicacion
- layout global
- rutas
- navegacion principal

### `modules`

Responsable de:

- encapsular cada modulo del negocio
- agrupar paginas, componentes y logica propia por dominio

Ejemplos futuros:

- `certificates`
- `capacitaciones`
- `reportes`
- `administracion`

### `shared`

Responsable de:

- componentes reutilizables
- utilidades comunes
- configuraciones compartidas
- servicios base

### `styles`

Responsable de:

- variables globales
- reglas base de layout
- responsive design
- identidad visual transversal

## Integraciones futuras

La arquitectura se deja preparada para integrar:

- autenticacion Microsoft 365
- acceso a listas SharePoint
- acceso a bibliotecas SharePoint
- llamadas a servicios internos si la empresa las incorpora despues

## Principios de implementacion

- Separar interfaz de integraciones
- Mantener cada modulo aislado por carpeta
- Evitar dependencias circulares
- Diseñar mobile-first con buen comportamiento en escritorio
- Priorizar componentes reutilizables
- Preparar el proyecto para mas de un modulo desde la V1

## Estructura inicial sugerida

```text
src/
  app/
    layout/
    router/
  modules/
    certificates/
      components/
      pages/
      services/
  shared/
    config/
    services/
    ui/
  styles/
```

## Primera etapa de construccion

1. Crear la base del frontend.
2. Montar el layout principal y la navegacion.
3. Crear la vista inicial del modulo `Generador de certificados`.
4. Dejar lista la capa donde despues se conectara SharePoint.
5. Luego integrar autenticacion y persistencia real.
