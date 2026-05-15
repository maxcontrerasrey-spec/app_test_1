import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import {
  normalizeModuleCode,
  normalizeRoleCode,
  resolvePrimaryRole,
  type AppModuleCode,
  type AppRole
} from "../config/access";
import { isSupabaseConfigured, supabase } from "../../../shared/lib/supabase";

type ProfileRecord = {
  id: string;
  email: string;
  full_name: string | null;
  job_title: string | null;
  department: string | null;
  status: "pending" | "active" | "suspended" | "inactive";
  is_super_admin: boolean;
};

type AuthContextValue = {
  isConfigured: boolean;
  isLoading: boolean;
  isRecoveryMode: boolean;
  session: Session | null;
  user: User | null;
  profile: ProfileRecord | null;
  appRoles: AppRole[];
  appRole: AppRole;
  accessibleModules: AppModuleCode[];
  isSuperAdmin: boolean;
  displayName: string;
  jobTitle: string;
  email: string;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  sendPasswordReset: (email: string) => Promise<{ error: string | null }>;
  updatePassword: (password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000;

function buildDisplayName(user: User | null, profile: ProfileRecord | null) {
  if (profile?.full_name?.trim()) {
    return profile.full_name.trim();
  }

  const email = user?.email?.trim();
  if (!email) {
    return "Usuario";
  }

  const localPart = email.split("@")[0];
  return localPart
    .split(/[._-]+/)
    .filter(Boolean)
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ");
}

function buildJobTitle(profile: ProfileRecord | null) {
  return profile?.job_title?.trim() || "Perfil pendiente";
}

function detectRecoveryMode() {
  if (typeof window === "undefined") {
    return false;
  }

  const queryParams = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));

  return (
    queryParams.get("type") === "recovery" ||
    queryParams.get("recovery") === "1" ||
    hashParams.get("type") === "recovery" ||
    hashParams.get("recovery") === "1"
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRecoveryMode, setIsRecoveryMode] = useState(detectRecoveryMode);
  const [profile, setProfile] = useState<ProfileRecord | null>(null);
  const [appRoles, setAppRoles] = useState<AppRole[]>([]);
  const [accessibleModules, setAccessibleModules] = useState<AppModuleCode[]>([]);
  const inactivityTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (!supabase) {
      setIsLoading(false);
      return;
    }

    const supabaseClient = supabase;
    let isMounted = true;

    const loadAuthorization = async (nextSession: Session | null) => {
      if (!isMounted) {
        return;
      }

      setSession(nextSession);
      setIsRecoveryMode(detectRecoveryMode());

      if (!nextSession?.user) {
        setProfile(null);
        setAppRoles([]);
        setAccessibleModules([]);
        setIsLoading(false);
        return;
      }

      const userId = nextSession.user.id;

      const profileResponse = await supabaseClient
        .from("profiles")
        .select("id, email, full_name, job_title, department, status, is_super_admin")
        .eq("id", userId)
        .maybeSingle<ProfileRecord>();

      if (!isMounted) {
        return;
      }

      if (profileResponse.error) {
        setProfile(null);
        setAppRoles([]);
        setAccessibleModules([]);
        setIsLoading(false);
        return;
      }

      const nextProfile = profileResponse.data ?? null;
      setProfile(nextProfile);

      const rolesResponse = await supabaseClient
        .from("user_roles")
        .select("role_code")
        .eq("user_id", userId);

      if (!isMounted) {
        return;
      }

      const nextRoles =
        rolesResponse.error || !rolesResponse.data
          ? []
          : rolesResponse.data
              .map((row) => normalizeRoleCode(row.role_code))
              .filter((role): role is AppRole => role !== null);

      setAppRoles(Array.from(new Set(nextRoles)));

      const shouldLoadAllModules =
        nextProfile?.is_super_admin === true || nextRoles.includes("admin");

      if (shouldLoadAllModules) {
        const moduleResponse = await supabaseClient
          .from("app_modules")
          .select("code")
          .eq("is_active", true)
          .order("sort_order", { ascending: true });

        if (!isMounted) {
          return;
        }

        const moduleCodes =
          moduleResponse.error || !moduleResponse.data
            ? []
            : moduleResponse.data
                .map((row) => normalizeModuleCode(row.code))
                .filter((moduleCode): moduleCode is AppModuleCode => moduleCode !== null);

        setAccessibleModules(Array.from(new Set(moduleCodes)));
        setIsLoading(false);
        return;
      }

      if (nextRoles.length === 0) {
        setAccessibleModules([]);
        setIsLoading(false);
        return;
      }

      const moduleAccessResponse = await supabaseClient
        .from("role_module_access")
        .select("module_code")
        .in("role_code", nextRoles)
        .eq("can_view", true);

      if (!isMounted) {
        return;
      }

      const nextModules =
        moduleAccessResponse.error || !moduleAccessResponse.data
          ? []
          : moduleAccessResponse.data
              .map((row) => normalizeModuleCode(row.module_code))
              .filter((moduleCode): moduleCode is AppModuleCode => moduleCode !== null);

      setAccessibleModules(Array.from(new Set(nextModules)));
      setIsLoading(false);
    };

    supabase.auth.getSession().then(({ data }) => {
      void loadAuthorization(data.session);
    });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!isMounted) {
        return;
      }

      setIsLoading(true);
      if (event === "PASSWORD_RECOVERY") {
        setIsRecoveryMode(true);
      }
      void loadAuthorization(nextSession);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!supabase || !session?.user) {
      if (inactivityTimeoutRef.current) {
        window.clearTimeout(inactivityTimeoutRef.current);
        inactivityTimeoutRef.current = null;
      }
      return;
    }

    const supabaseClient = supabase;

    const clearInactivityTimer = () => {
      if (inactivityTimeoutRef.current) {
        window.clearTimeout(inactivityTimeoutRef.current);
      }
    };

    const scheduleInactivitySignOut = () => {
      clearInactivityTimer();
      inactivityTimeoutRef.current = window.setTimeout(async () => {
        await supabaseClient.auth.signOut();
        setIsRecoveryMode(false);
      }, INACTIVITY_TIMEOUT_MS);
    };

    const handleActivity = () => {
      scheduleInactivitySignOut();
    };

    const activityEvents: Array<keyof WindowEventMap> = [
      "mousedown",
      "keydown",
      "scroll",
      "touchstart",
      "mousemove"
    ];

    scheduleInactivitySignOut();
    for (const eventName of activityEvents) {
      window.addEventListener(eventName, handleActivity, { passive: true });
    }

    return () => {
      clearInactivityTimer();
      inactivityTimeoutRef.current = null;
      for (const eventName of activityEvents) {
        window.removeEventListener(eventName, handleActivity);
      }
    };
  }, [session]);

  const value = useMemo<AuthContextValue>(() => {
    const user = session?.user ?? null;
    const isSuperAdmin = profile?.is_super_admin ?? false;
    const appRole = resolvePrimaryRole(appRoles, isSuperAdmin);

    return {
      isConfigured: isSupabaseConfigured,
      isLoading,
      isRecoveryMode,
      session,
      user,
      profile,
      appRoles,
      appRole,
      accessibleModules,
      isSuperAdmin,
      displayName: buildDisplayName(user, profile),
      jobTitle: buildJobTitle(profile),
      email: user?.email ?? "",
      signIn: async (email, password) => {
        if (!supabase) {
          return { error: "Supabase no está configurado en este entorno." };
        }

        const { error } = await supabase.auth.signInWithPassword({
          email,
          password
        });

        return { error: error?.message ?? null };
      },
      sendPasswordReset: async (email) => {
        if (!supabase) {
          return { error: "Supabase no está configurado en este entorno." };
        }

        const redirectTo =
          typeof window === "undefined"
            ? undefined
            : `${window.location.origin}/reset-password`;

        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo
        });

        return { error: error?.message ?? null };
      },
      updatePassword: async (password) => {
        if (!supabase) {
          return { error: "Supabase no está configurado en este entorno." };
        }

        const { error } = await supabase.auth.updateUser({ password });
        return { error: error?.message ?? null };
      },
      signOut: async () => {
        if (!supabase) {
          return;
        }

        await supabase.auth.signOut();
        setProfile(null);
        setAppRoles([]);
        setAccessibleModules([]);
        setIsRecoveryMode(false);
      }
    };
  }, [accessibleModules, appRoles, isLoading, isRecoveryMode, profile, session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
}
