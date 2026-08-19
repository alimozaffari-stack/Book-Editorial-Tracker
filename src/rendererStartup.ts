function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function startupErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  if (typeof error === 'string' && error.trim()) return error.trim();
  return 'Unknown renderer startup error.';
}

export function renderRendererStartupFailure(target: { innerHTML: string } | null | undefined, error: unknown): string {
  const message = startupErrorMessage(error);
  const markup = `
    <section style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f8fafc;padding:24px;font-family:Segoe UI, Arial, sans-serif;">
      <div style="max-width:640px;width:100%;background:#ffffff;border:1px solid #fecaca;border-radius:16px;padding:24px;box-shadow:0 10px 30px rgba(15,23,42,0.08);">
        <h1 style="margin:0 0 12px;font-size:24px;line-height:1.2;color:#991b1b;">Renderer startup failed</h1>
        <p style="margin:0 0 12px;color:#334155;">The application window loaded, but the renderer could not finish starting. Nothing was changed.</p>
        <pre style="margin:0;white-space:pre-wrap;word-break:break-word;border-radius:12px;background:#fff1f2;padding:16px;color:#7f1d1d;">${escapeHtml(message)}</pre>
      </div>
    </section>
  `.trim();

  if (target) target.innerHTML = markup;
  console.error(`renderer_startup_error ${message}`);
  return markup;
}
