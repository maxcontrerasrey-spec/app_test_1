import "jsr:@supabase/functions-js/edge-runtime.d.ts"

// Habilitar CORS para que la función pueda ser llamada desde la app web (browser)
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Manejo de la solicitud OPTIONS para CORS (preflight request)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const BUK_AUTH_TOKEN = Deno.env.get('BUK_AUTH_TOKEN');
    if (!BUK_AUTH_TOKEN) {
      throw new Error("Missing BUK_AUTH_TOKEN in environment variables");
    }

    // Parsear el body para obtener el RUT (document_number)
    const { rut } = await req.json();

    if (!rut) {
      return new Response(
        JSON.stringify({ error: "El RUT (document_number) es requerido." }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Llamar a la API de BUK
    // Usamos el tenant busesjm y el país chile (según la documentación compartida)
    const url = `https://busesjm.buk.cl/api/v1/chile/employees?document_number=${encodeURIComponent(rut)}`;

    const bukResponse = await fetch(url, {
      method: "GET",
      headers: {
        "auth_token": BUK_AUTH_TOKEN,
        "Accept": "application/json",
        "Content-Type": "application/json"
      }
    });

    if (!bukResponse.ok) {
      const text = await bukResponse.text();
      throw new Error(`Buk API Error: ${bukResponse.status} - ${text}`);
    }

    const json = await bukResponse.json();
    
    // BUK devuelve la data en json.data (array de empleados que coinciden con la busqueda)
    // El payload comun es: { data: [ { id: 1, first_name: "...", employment_status: "activo" } ], pagination: ... }
    const data = json.data || [];

    if (data.length > 0) {
      // Tomamos el primero porque el RUT debería ser único, pero ordenamos o tomamos el que tenga estado si hay varios
      const employee = data[0];
      return new Response(
        JSON.stringify({
          exists: true,
          status: employee.employment_status || "desconocido", // "activo" | "inactivo" | "terminado" etc.
          name: `${employee.first_name || ""} ${employee.last_name || ""}`.trim()
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Si no hay resultados, no existe en BUK
    return new Response(
        JSON.stringify({ exists: false }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error("Error checking BUK candidate:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Error interno consultando BUK" }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
})
