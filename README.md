# Plataforma de Control Operacional

Plataforma web interna de automatización orientada a la gestión operativa, reclutamiento y control documental, construida con una arquitectura modular y base de datos con políticas "Zero Trust".

## 🏗️ Arquitectura Técnica

- **Frontend**: React + TypeScript + Vite
- **Estado Remoto**: TanStack Query para fetching, caché e invalidación progresiva en módulos operativos.
- **Estilos**: Vanilla CSS con Custom Properties (Design Tokens), arquitectura modular y mobile-first (sin frameworks externos como Tailwind, priorizando control absoluto).
- **Backend/DB**: Supabase (PostgreSQL + Auth + Storage).
- **Gobernanza de Datos**: Modelo estricto Zero Trust. Toda lógica de negocio transaccional sucede en el backend mediante RPCs (`SECURITY DEFINER`) con auditoría integrada.

## 📖 Documentación Principal

Toda la lógica de negocio, arquitectura y componentes visuales está documentada en mapas maestros:

- [Mapa Operacional Maestro](docs/operational_master_map_v1.md)
- [Arquitectura de Datos y Zero Trust](docs/data_architecture_master_v1.md)
- [Design System & UI Tokens](docs/design_system_master_v1.md)

*(Nota: los archivos maestros actualmente se gestionan junto a la documentación de arquitectura del Agente AI en este repositorio)*.

## 🚀 Inicio Rápido (Desarrollo Local)

### 1. Prerrequisitos
- Node.js (v22 o superior recomendado)
- Cuenta en Supabase o CLI instalada.

### 2. Variables de Entorno
Copia el archivo `.env.example` y renómbralo a `.env.local`. Reemplaza los valores con las credenciales de desarrollo.
```bash
cp .env.example .env.local
```

### 3. Instalación e Inicio
```bash
npm install
npm run dev
```

La aplicación estará disponible en `http://localhost:5173`.

## 🛠️ Scripts Disponibles

- `npm run dev`: Inicia el servidor de desarrollo Vite.
- `npm run build`: Ejecuta la verificación de tipos de TypeScript y construye para producción en `dist/`.
- `npm run preview`: Sirve los archivos construidos en modo local.
- `npm run provision:hiring-approvers`: Script en Node para provisionar perfiles masivos desde un archivo base.

## 📌 Estado Actual del ERP

- El dashboard operativo ya distingue entre `Tareas Pendientes`, `Folios en curso` y `Acciones Rápidas`.
- `Control de Contrataciones` ya opera con separación entre aprobaciones pendientes, casos activos y control transversal de candidatos.
- Las mutaciones críticas de reclutamiento y aprobaciones se ejecutan mediante RPCs de Supabase con trazabilidad.
- La migración hacia un estado remoto más robusto comenzó con TanStack Query en el dashboard, como base para extender luego el patrón a Reclutamiento, Operaciones y Certificados.

## 📂 Estructura del Código (`src/`)

```
src/
├── app/            # Rutas globales y layout principal del shell
├── modules/        # Dominios de negocio encapsulados
│   ├── auth/       # Contexto de sesión, guards, login
│   ├── home/       # Dashboard unificado de usuario
│   ├── recruitment/# Reclutamiento y solicitudes
│   └── operaciones/# Turnos, asistencia y servicios
└── shared/         # Infraestructura transversal
    ├── lib/        # Utilidades compartidas (Supabase client, Formatters)
    └── ui/         # Componentes del Design System (inputs, botones)
```
