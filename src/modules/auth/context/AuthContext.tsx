import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { resolveAppRole, type AppRole } from "../config/access";
import { isSupabaseConfigured, supabase } from "../../../shared/lib/supabase";

type AuthContextValue = {
  isConfigured: boolean;
  isLoading: boolean;
  isRecoveryMode: boolean;
  session: Session | null;
  user: User | null;
  appRole: AppRole;
  displayName: string;
  jobTitle: string;
  email: string;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  sendPasswordReset: (email: string) => Promise<{ error: string | null }>;
  updatePassword: (password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function buildDisplayName(user: User | null) {
  const metadataName =
    (user?.user_metadata?.full_name as string | undefined) ||
    (user?.user_metadata?.name as string | undefined);

  if (metadataName?.trim()) {
    return metadataName.trim();
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

function buildJobTitle(user: User | null) {
  const metadataRole =
    (user?.user_metadata?.job_title as string | undefined) ||
    (user?.user_metadata?.role_name as string | undefined);

  return metadataRole?.trim() || "Perfil pendiente";
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

  useEffect(() => {
    if (!supabase) {
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) {
        return;
      }

      setSession(data.session);
      setIsRecoveryMode(detectRecoveryMode());
      setIsLoading(false);
    });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!isMounted) {
        return;
      }

      setSession(nextSession);
      setIsRecoveryMode(event === "PASSWORD_RECOVERY" || detectRecoveryMode());
      setIsLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(() => {
    const user = session?.user ?? null;

    return {
      isConfigured: isSupabaseConfigured,
      isLoading,
      isRecoveryMode,
      session,
      user,
      appRole: resolveAppRole(user),
      displayName: buildDisplayName(user),
      jobTitle: buildJobTitle(user),
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
        setIsRecoveryMode(false);
      }
    };
  }, [isLoading, isRecoveryMode, session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
}
