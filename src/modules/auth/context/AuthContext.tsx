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
  normalizeCapabilityCode,
  normalizeFeatureCode,
  normalizeModuleCode,
  normalizeRoleCode,
  resolvePrimaryRole,
  type AppCapability,
  type AppFeatureCode,
  type AppModuleCode,
  type AppRole
} from "../config/access";
import { buildPublicAppUrl } from "../../../shared/config/runtime";
import { logger } from "../../../shared/lib/logger";
import { isSupabaseConfigured, supabase } from "../../../shared/lib/supabase";

type ProfileRecord = {
  id: string;
  email: string;
  full_name: string | null;
  job_title: string | null;
  department: string | null;
  status: "pending" | "active" | "suspended" | "inactive";
  is_super_admin: boolean;
  must_reset_password: boolean;
  aup_accepted_at: string | null;
};

type EffectivePermissionsPayload = {
  profile: ProfileRecord | null;
  app_roles?: unknown;
  accessible_modules?: unknown;
  accessible_features?: unknown;
  capabilities?: unknown;
  is_super_admin?: boolean;
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
  accessibleFeatures: AppFeatureCode[];
  capabilities: AppCapability[];
  hasFeature: (feature: AppFeatureCode) => boolean;
  hasCapability: (capability: AppCapability) => boolean;
  isSuperAdmin: boolean;
  displayName: string;
  jobTitle: string;
  email: string;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  sendPasswordReset: (email: string) => Promise<{ error: string | null }>;
  updatePassword: (password: string) => Promise<{ error: string | null }>;
  acceptAupPolicy: () => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000;

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

function buildResetPasswordRedirectUrl() {
  return buildPublicAppUrl("/reset-password");
}

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

function normalizeProfileRecord(value: unknown): ProfileRecord | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;

  if (
    typeof record.id !== "string" ||
    typeof record.email !== "string" ||
    typeof record.status !== "string" ||
    typeof record.is_super_admin !== "boolean" ||
    typeof record.must_reset_password !== "boolean"
  ) {
    return null;
  }

  return {
    id: record.id,
    email: record.email,
    full_name: typeof record.full_name === "string" ? record.full_name : null,
    job_title: typeof record.job_title === "string" ? record.job_title : null,
    department: typeof record.department === "string" ? record.department : null,
    status:
      record.status === "pending" ||
      record.status === "active" ||
      record.status === "suspended" ||
      record.status === "inactive"
        ? record.status
        : "pending",
    is_super_admin: record.is_super_admin,
    must_reset_password: record.must_reset_password,
    aup_accepted_at: typeof record.aup_accepted_at === "string" ? record.aup_accepted_at : null
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRecoveryMode, setIsRecoveryMode] = useState(detectRecoveryMode);
  const [profile, setProfile] = useState<ProfileRecord | null>(null);
  const [appRoles, setAppRoles] = useState<AppRole[]>([]);
  const [accessibleModules, setAccessibleModules] = useState<AppModuleCode[]>([]);
  const [accessibleFeatures, setAccessibleFeatures] = useState<AppFeatureCode[]>([]);
  const [capabilities, setCapabilities] = useState<AppCapability[]>([]);
  const inactivityTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (!supabase) {
      setIsLoading(false);
      return;
    }

    const supabaseClient = supabase;
    let isMounted = true;
    let currentSession: Session | null = null;

    const loadAuthorization = async (nextSession: Session | null) => {
      if (!isMounted) {
        return;
      }

      currentSession = nextSession;
      setSession(nextSession);
      setIsRecoveryMode((prev) => prev || detectRecoveryMode());

      if (!nextSession?.user) {
        setProfile(null);
        setAppRoles([]);
        setAccessibleModules([]);
        setAccessibleFeatures([]);
        setCapabilities([]);
        setIsLoading(false);
        return;
      }

      try {
        const { data, error } = await supabaseClient.rpc("get_my_effective_permissions");

        if (!isMounted) {
          return;
        }

        if (error) {
          logger.error("AuthContext loadAuthorization", error);
          setIsLoading(false);
          return;
        }

        const payload = (data ?? null) as EffectivePermissionsPayload | null;
        const nextProfile = normalizeProfileRecord(payload?.profile ?? null);
        setProfile(nextProfile);

        const nextRoles = normalizeStringArray(payload?.app_roles)
          .map((roleCode) => normalizeRoleCode(roleCode))
          .filter((role): role is AppRole => role !== null);

        setAppRoles(Array.from(new Set(nextRoles)));

        const nextModules = normalizeStringArray(payload?.accessible_modules)
          .map((moduleCode) => normalizeModuleCode(moduleCode))
          .filter((moduleCode): moduleCode is AppModuleCode => moduleCode !== null);

        setAccessibleModules(Array.from(new Set(nextModules)));

        const nextCapabilities = normalizeStringArray(payload?.capabilities)
          .map((capabilityCode) => normalizeCapabilityCode(capabilityCode))
          .filter((capability): capability is AppCapability => capability !== null);

        setCapabilities(Array.from(new Set(nextCapabilities)));

        const nextFeatures = normalizeStringArray(payload?.accessible_features)
          .map((featureCode) => normalizeFeatureCode(featureCode))
          .filter((featureCode): featureCode is AppFeatureCode => featureCode !== null);

        setAccessibleFeatures(Array.from(new Set(nextFeatures)));
      } catch (err) {
        logger.error("AuthContext loadAuthorization catch", err);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    // Safety timeout: if loading takes more than 10s, force exit loading state
    const safetyTimer = window.setTimeout(() => {
      if (isMounted) {
        logger.warn("AuthContext safety timeout");
        setIsLoading(false);
      }
    }, 10_000);

    let initialLoadDone = false;

    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) return;
      initialLoadDone = true;
      void loadAuthorization(data.session);
    }).catch((err) => {
      logger.error("AuthContext getSession", err);
      if (isMounted) {
        setIsLoading(false);
      }
    });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!isMounted) {
        return;
      }

      // Skip if this is the initial INITIAL_SESSION event and getSession already handled it
      if (event === "INITIAL_SESSION" && initialLoadDone) {
        return;
      }

      // Evitamos unmount completo (reset de state) durante refrescos de token o cross-tab events
      const isActuallySigningIn = event === "SIGNED_IN" && !currentSession;
      if (isActuallySigningIn || event === "SIGNED_OUT") {
        setIsLoading(true);
      }
      
      if (event === "PASSWORD_RECOVERY") {
        setIsRecoveryMode(true);
      }
      
      void loadAuthorization(nextSession);
    });

    return () => {
      isMounted = false;
      window.clearTimeout(safetyTimer);
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
      accessibleFeatures,
      capabilities,
      hasFeature: (feature) => accessibleFeatures.includes(feature),
      hasCapability: (capability) => capabilities.includes(capability),
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

        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: buildResetPasswordRedirectUrl()
        });

        return { error: error?.message ?? null };
      },
      updatePassword: async (password) => {
        if (!supabase) {
          return { error: "Supabase no está configurado en este entorno." };
        }

        const { error } = await supabase.auth.updateUser({ password });
        if (error) {
          return { error: error.message };
        }

        const currentUserId = user?.id ?? null;

        if (currentUserId) {
          const { error: profileError } = await supabase
            .from("profiles")
            .update({
              must_reset_password: false,
              updated_at: new Date().toISOString()
            })
            .eq("id", currentUserId);

          if (profileError) {
            return { error: profileError.message };
          }

          setProfile((currentProfile) =>
            currentProfile
              ? {
                  ...currentProfile,
                  must_reset_password: false
                }
              : currentProfile
          );
        }

        return { error: null };
      },
      acceptAupPolicy: async () => {
        if (!supabase) {
          return { error: "Supabase no está configurado en este entorno." };
        }

        const { data, error } = await supabase.rpc("accept_aup_policy", {
          p_ip_address: null
        });

        if (error) {
          return { error: error.message };
        }

        const acceptedAt = typeof data === "string" ? data : new Date().toISOString();

        setProfile((currentProfile) =>
          currentProfile
            ? {
                ...currentProfile,
                aup_accepted_at: acceptedAt
              }
            : currentProfile
        );

        return { error: null };
      },
      signOut: async () => {
        if (!supabase) {
          return;
        }

        await supabase.auth.signOut();
        setIsRecoveryMode(false);
      }
    };
  }, [
    accessibleFeatures,
    accessibleModules,
    appRoles,
    capabilities,
    isLoading,
    isRecoveryMode,
    profile,
    session
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
}
