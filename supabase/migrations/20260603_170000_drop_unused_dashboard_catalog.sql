begin;

drop function if exists public.get_dashboard_widgets_for_current_user();
drop function if exists public.get_dashboard_alerts(uuid);
drop function if exists public.get_dashboard_kpis(uuid);
drop function if exists public.get_home_dashboard_summary();
drop function if exists public.get_hiring_control_dashboard();

drop table if exists public.user_dashboard_preferences;
drop table if exists public.notifications;
drop table if exists public.dashboard_widgets;

notify pgrst, 'reload schema';

commit;
