// Helper untuk membuat Response JSON dari EdgeOne Cloud Functions.
// Mengurangi boilerplate di setiap handler.

export function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
  })
}
