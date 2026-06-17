-- Migration: Upgrade get_dashboard_tasks for expanded table view
-- Purpose: Includes detailed data for approvals and recruitment cases so TasksWidget can render an expanded view.

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
            'approval' AS type,
            hra.id AS approval_id,
            hr.id AS hiring_request_id,
            COALESCE(hr.folio, 'Borrador') AS folio,
            hr.job_position_name,
            -- para contrato/cc:
            cc.name AS contract_name,
            cc.code AS cost_center_code,
            -- cupos:
            hr.requested_vacancies,
            0 AS candidate_count,
            0 AS ready_candidates,
            req_prof.first_name || ' ' || req_prof.last_name AS requester_name,
            req_prof.email AS requester_email,
            'pending' AS status_code,
            'En Revisión (' || hra.step_name || ')' AS status_label,
            'Alta' AS priority,
            hra.created_at,
            
            -- Detalles expandidos
            hr.requested_income_date,
            hr.contract_start_date,
            hr.contract_end_date,
            hr.shift_code,
            hr.salary_liquid,
            hr.camp_required,
            hr.flight_tickets_required,
            hr.other_benefits
            
        FROM public.hiring_request_approvals hra
        JOIN public.hiring_requests hr ON hr.id = hra.hiring_request_id
        LEFT JOIN public.cost_centers cc ON cc.id = hr.cost_center_id
        LEFT JOIN public.profiles req_prof ON req_prof.id = hr.requester_id
        WHERE (hra.approver_user_id = p_user_id OR public.user_is_admin(p_user_id))
          AND hra.status = 'pending'
          
        UNION ALL
        
        -- Query 2: Active Recruitment Cases assigned to user
        SELECT 
            'case_' || rca.id AS id,
            'case' AS type,
            NULL::uuid AS approval_id,
            hr.id AS hiring_request_id,
            rc.case_code AS folio,
            rc.job_position_name,
            rc.contract_name,
            cc.code AS cost_center_code,
            rc.requested_vacancies,
            (SELECT COUNT(*) FROM public.candidate_applications ca WHERE ca.recruitment_case_id = rc.id AND ca.status NOT IN ('rejected', 'hired', 'withdrawn')) AS candidate_count,
            (SELECT COUNT(*) FROM public.candidate_applications ca WHERE ca.recruitment_case_id = rc.id AND ca.status = 'ready_to_hire') AS ready_candidates,
            req_prof.first_name || ' ' || req_prof.last_name AS requester_name,
            req_prof.email AS requester_email,
            rc.status AS status_code,
            'En Proceso' AS status_label,
            'Normal' AS priority,
            rca.assigned_at AS created_at,
            
            -- Detalles expandidos (del hiring_request subyacente)
            hr.requested_income_date,
            hr.contract_start_date,
            hr.contract_end_date,
            hr.shift_code,
            hr.salary_liquid,
            hr.camp_required,
            hr.flight_tickets_required,
            hr.other_benefits

        FROM public.recruitment_case_assignments rca
        JOIN public.recruitment_cases rc ON rc.id = rca.recruitment_case_id
        LEFT JOIN public.hiring_requests hr ON hr.id = rc.hiring_request_id
        LEFT JOIN public.cost_centers cc ON cc.id = hr.cost_center_id
        LEFT JOIN public.profiles req_prof ON req_prof.id = hr.requester_id
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
