export function onRequest() {
  return new Response("Este enlace ya no está disponible.", {
    status: 410,
    headers: {
      "cache-control": "no-store",
      "content-type": "text/plain; charset=utf-8"
    }
  });
}
