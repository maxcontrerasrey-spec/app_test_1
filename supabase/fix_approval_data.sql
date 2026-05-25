-- Forzar que la aprobacion pendiente te pertenezca a tu usuario actual
UPDATE public.hiring_request_approvals 
SET approver_user_id = (
    SELECT ur.user_id 
    FROM public.user_roles ur 
    WHERE ur.role_code = 'admin' 
    LIMIT 1
)
WHERE status = 'pending';
