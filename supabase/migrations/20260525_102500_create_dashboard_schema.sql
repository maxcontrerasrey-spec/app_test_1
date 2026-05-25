-- Migration: Create Dashboard Schema and Seed Widgets
-- Purpose: Establish tables for the modular operational command center
--          (widgets, user preferences, and notifications).

-- =============================================================================
-- 1. Table: dashboard_widgets
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.dashboard_widgets (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    component_key text NOT NULL UNIQUE,
    allowed_roles text[] NOT NULL DEFAULT '{}',
    default_position integer NOT NULL DEFAULT 0,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS para dashboard_widgets (Solo lectura para todos)
ALTER TABLE public.dashboard_widgets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Widgets son de lectura publica" ON public.dashboard_widgets
    FOR SELECT
    USING (true);

-- =============================================================================
-- 2. Table: user_dashboard_preferences
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.user_dashboard_preferences (
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    widget_id uuid NOT NULL REFERENCES public.dashboard_widgets(id) ON DELETE CASCADE,
    position integer NOT NULL DEFAULT 0,
    hidden boolean NOT NULL DEFAULT false,
    size text NOT NULL DEFAULT 'medium',
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    PRIMARY KEY (user_id, widget_id)
);

-- RLS para user_dashboard_preferences (Usuarios administran los suyos)
ALTER TABLE public.user_dashboard_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios pueden ver sus propias preferencias" ON public.user_dashboard_preferences
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Usuarios pueden insertar sus preferencias" ON public.user_dashboard_preferences
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuarios pueden actualizar sus preferencias" ON public.user_dashboard_preferences
    FOR UPDATE USING (auth.uid() = user_id);

-- =============================================================================
-- 3. Table: notifications
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.notifications (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type text NOT NULL,
    severity text NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
    title text NOT NULL,
    description text,
    is_read boolean NOT NULL DEFAULT false,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS para notifications (Usuarios leen las suyas, sistema las crea)
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios pueden ver sus notificaciones" ON public.notifications
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Usuarios pueden marcar leidas sus notificaciones" ON public.notifications
    FOR UPDATE USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- =============================================================================
-- 4. Seed Data: Initial Widgets
-- =============================================================================
INSERT INTO public.dashboard_widgets (name, component_key, allowed_roles, default_position)
VALUES 
    ('Tareas Pendientes', 'TasksWidget', '{admin,reclutamiento,control_contratos,operaciones}', 1),
    ('Alertas Operacionales', 'AlertsWidget', '{admin,operaciones,gerencia,certificaciones}', 2),
    ('Indicadores Clave', 'KPIWidget', '{admin,gerencia,operaciones,reclutamiento}', 3),
    ('Acciones Rápidas', 'QuickActionsWidget', '{admin,reclutamiento,operaciones,certificaciones}', 4),
    ('Actividad Reciente', 'TimelineWidget', '{admin,reclutamiento,operaciones,gerencia}', 5)
ON CONFLICT (component_key) DO UPDATE 
SET 
    name = EXCLUDED.name,
    allowed_roles = EXCLUDED.allowed_roles,
    default_position = EXCLUDED.default_position;
