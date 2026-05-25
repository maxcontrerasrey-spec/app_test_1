-- Migration: Dashboard Data Engine
-- Purpose: Creates SECURITY DEFINER RPCs to securely feed real-time aggregated data 
--          to the Operational Command Center (Dashboard) widgets.

-- =============================================================================
-- 1. FUNCTION: get_dashboard_tasks
-- Combines pending approvals and assigned active cases into a unified task list.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_dashboard_tasks(p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    result JSON;
BEGIN
    SELECT COALESCE(json_agg(t), '[]'::json) INTO result
    FROM (
        -- Query 1: Pending Hiring Approvals
        SELECT 
            'approval_' || hra.id AS id,
            'Aprobación Solicitud' AS type,
            COALESCE(hr.folio, 'Borrador') || ' - ' || hr.job_position_name AS title,
            'Paso: ' || hra.step_name AS subtitle,
            'pending' AS status_code,
            'En Revisión' AS status_label,
            'Alta' AS priority,
            hra.created_at
        FROM public.hiring_request_approvals hra
        JOIN public.hiring_requests hr ON hr.id = hra.hiring_request_id
        WHERE hra.approver_user_id = p_user_id
          AND hra.status = 'pending'
          
        UNION ALL
        
        -- Query 2: Active Recruitment Cases assigned to user
        SELECT 
            'case_' || rca.id AS id,
            'Reclutamiento' AS type,
            rc.job_position_name AS title,
            'Vacantes: ' || rc.requested_vacancies AS subtitle,
            rc.status AS status_code,
            'En Proceso' AS status_label,
            'Normal' AS priority,
            rca.assigned_at AS created_at
        FROM public.recruitment_case_assignments rca
        JOIN public.recruitment_cases rc ON rc.id = rca.recruitment_case_id
        WHERE rca.user_id = p_user_id
          AND rc.status NOT IN ('closed', 'cancelled')
        ORDER BY 
            CASE priority 
                WHEN 'Crítica' THEN 1 
                WHEN 'Alta' THEN 2 
                WHEN 'Normal' THEN 3 
                ELSE 4 
            END ASC,
            created_at ASC
        LIMIT 20
    ) t;
    
    RETURN result;
END;
$$;

-- =============================================================================
-- 2. FUNCTION: get_dashboard_alerts
-- Scans for SLA breaches and expiring documents
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_dashboard_alerts(p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    result JSON;
BEGIN
    SELECT COALESCE(json_agg(a), '[]'::json) INTO result
    FROM (
        -- Query 1: Expiring Documents (next 30 days)
        SELECT 
            'doc_exp_' || cd.id AS id,
            'Acreditaciones Críticas' AS title,
            dt.name || ' de ' || cp.first_name || ' ' || cp.last_name || ' vence el ' || cd.expiry_date AS description,
            CASE WHEN cd.expiry_date <= CURRENT_DATE + INTERVAL '7 days' THEN 'critical' ELSE 'warning' END AS severity,
            'certificaciones' AS source,
            cd.created_at
        FROM public.candidate_documents cd
        JOIN public.document_types dt ON dt.id = cd.document_type_id
        JOIN public.candidate_profiles cp ON cp.id = cd.candidate_profile_id
        WHERE cd.expiry_date IS NOT NULL 
          AND cd.expiry_date <= CURRENT_DATE + INTERVAL '30 days'
          AND cd.expiry_date >= CURRENT_DATE
          AND cd.status = 'approved'
          
        UNION ALL
        
        -- Query 2: SLA Breaches in Recruitment (No movement in 15 days)
        SELECT 
            'sla_rec_' || rc.id AS id,
            'SLA Atrasado: Reclutamiento' AS title,
            'El proceso para ' || rc.job_position_name || ' superó los 15 días sin cambios.' AS description,
            'warning' AS severity,
            'reclutamiento' AS source,
            rc.updated_at AS created_at
        FROM public.recruitment_cases rc
        WHERE rc.status = 'sourcing'
          AND rc.updated_at <= CURRENT_DATE - INTERVAL '15 days'
          
        ORDER BY severity ASC, created_at DESC
        LIMIT 10
    ) a;
    
    RETURN result;
END;
$$;

-- =============================================================================
-- 3. FUNCTION: get_dashboard_kpis
-- Generates real-time aggregate metrics
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_dashboard_kpis(p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_total_vacancies INT;
    v_active_cases INT;
    v_pending_approvals INT;
    result JSON;
BEGIN
    -- Sum total vacancies from approved hiring requests
    SELECT COALESCE(SUM(vacancies), 0) INTO v_total_vacancies
    FROM public.hiring_requests
    WHERE status = 'approved';
    
    -- Count active recruitment cases
    SELECT COUNT(*) INTO v_active_cases
    FROM public.recruitment_cases
    WHERE status NOT IN ('closed', 'cancelled');
    
    -- Count total pending approvals system-wide
    SELECT COUNT(*) INTO v_pending_approvals
    FROM public.hiring_request_approvals
    WHERE status = 'pending';

    -- Build JSON
    result := json_build_object(
        'total_vacancies', v_total_vacancies,
        'active_cases', v_active_cases,
        'pending_approvals', v_pending_approvals
    );
    
    RETURN result;
END;
$$;
