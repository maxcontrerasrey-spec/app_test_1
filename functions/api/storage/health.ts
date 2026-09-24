interface StorageHealthEnv {
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  R2_BUCKET?: unknown;
}

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

function getBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization") || "";
  return header.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() || null;
}

export const onRequest: PagesFunction<StorageHealthEnv> = async ({ request, env }) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204 });
  }

  if (request.method !== "GET") {
    return json({ error: "method_not_allowed" }, 405);
  }

  const supabaseUrl = env.SUPABASE_URL?.trim();
  const supabaseAnonKey = env.SUPABASE_ANON_KEY?.trim();
  const token = getBearerToken(request);

  if (!supabaseUrl || !supabaseAnonKey || !token) {
    return json({ error: "unauthorized" }, 401);
  }

  const userResponse = await fetch(`${supabaseUrl.replace(/\/$/, "")}/auth/v1/user`, {
    headers: {
      apikey: supabaseAnonKey,
      authorization: `Bearer ${token}`
    }
  });

  if (!userResponse.ok) {
    return json({ error: "unauthorized" }, 401);
  }

  return json({
    storage: "r2",
    connected: Boolean(env.R2_BUCKET),
    writable: false,
    existing_supabase_storage_untouched: true
  });
};
