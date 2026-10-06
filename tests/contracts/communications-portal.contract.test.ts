import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync("supabase/migrations/20261005165138_communications_portal.sql", "utf8");
const designMigration = readFileSync("supabase/migrations/20261005165140_communications_visual_editor.sql", "utf8");
const quickLinksMigration = readFileSync("supabase/migrations/20261006111015_communications_quick_access_links.sql", "utf8");
const nestingMigration = readFileSync("supabase/migrations/20261005180221_nest_communications_portal_under_hr.sql", "utf8");
const cmsMigration = readFileSync("supabase/migrations/20261005190355_communications_editorial_official_cms.sql", "utf8");
const bulletinEditorialMigration = readFileSync("supabase/migrations/20261006123602_communications_bulletin_editorial_icon.sql", "utf8");
const storageRoute = readFileSync("functions/api/comunicaciones/files.ts", "utf8");
const assetRoute = readFileSync("functions/api/comunicaciones/assets.ts", "utf8");
const router = readFileSync("src/app/router/AppRouter.tsx", "utf8");
const routeModules = readFileSync("src/app/router/routeModules.ts", "utf8");
const navigation = readFileSync("src/shared/config/navigation.ts", "utf8");
const access = readFileSync("src/modules/auth/config/access.ts", "utf8");
const modulePage = readFileSync("src/modules/communications/pages/CommunicationsPage.tsx", "utf8");
const designPage = readFileSync("src/modules/communications/pages/CommunicationsDesignPage.tsx", "utf8");
const siteConfig = readFileSync("src/modules/communications/site/communicationsSiteConfig.tsx", "utf8");
const communicationsApi = readFileSync("src/modules/communications/services/communicationsApi.ts", "utf8");
const siteStyles = readFileSync("src/modules/communications/styles/communications-design.css", "utf8");
const authContext = readFileSync("src/modules/auth/context/AuthContext.tsx", "utf8");

describe("Portal de Comunicaciones", () => {
  it("registra el módulo, da lectura a cuentas activas y reserva edición al perfil comunicador", () => {
    expect(migration).toContain("'portal_comunicaciones'");
    expect(migration).toContain("'comunicador_'");
    expect(migration).toContain("public.user_is_admin(auth.uid())");
    expect(migration).toContain("public.user_has_role(auth.uid(), 'comunicador_')");
    expect(migration).toContain("profile_row.status = 'active'");
    expect(router).toContain('moduleCode="portal_comunicaciones"');
    expect(access).toContain('"portal_comunicaciones"');
    expect(access).toContain('"comunicador_"');
    expect(authContext).toContain('nextModules.push("portal_comunicaciones")');
  });

  it("lo contiene en la sección RRHH y conserva alias a la ruta canónica", () => {
    const rrhhStart = navigation.indexOf('label: "Recursos Humanos"');
    const operationsStart = navigation.indexOf('label: "Operaciones"');
    const rrhhNavigation = navigation.slice(rrhhStart, operationsStart);

    expect(rrhhStart).toBeGreaterThanOrEqual(0);
    expect(operationsStart).toBeGreaterThan(rrhhStart);
    expect(rrhhNavigation).toContain('moduleCode: "portal_comunicaciones"');
    expect(rrhhNavigation).toContain('to: "/recursos-humanos/comunicaciones"');
    expect(navigation.slice(operationsStart)).not.toContain('moduleCode: "portal_comunicaciones"');
    expect(router).toContain('path="/recursos-humanos/comunicaciones"');
    expect(router).toContain('path="/recursos-humanos/comunicaciones/diseno"');
    expect(router).toMatch(/path="\/comunicaciones"\s+element=\{<Navigate to="\/recursos-humanos\/comunicaciones"/);
    expect(router).toMatch(/path="\/comunicaciones\/diseno"\s+element=\{<Navigate to="\/recursos-humanos\/comunicaciones\/diseno"/);
    expect(routeModules).toContain('normalizedPath.startsWith("/recursos-humanos/comunicaciones")');
    expect(nestingMigration).toContain("set route = '/recursos-humanos/comunicaciones'");
  });

  it("mantiene el contenido detrás de RPCs y sin acceso directo a la tabla", () => {
    expect(migration).toContain("alter table public.communications_items enable row level security");
    expect(migration).toContain("for all to authenticated using (false) with check (false)");
    expect(migration).toContain("revoke all on public.communications_items from public, anon, authenticated");
    expect(migration).toContain("revoke all on function public.save_communications_item(uuid, jsonb) from public, anon");
    expect(migration).toContain("grant execute on function public.save_communications_item(uuid, jsonb) to authenticated");
  });

  it("exige PDF para boletines publicados y restringe su carga a borradores", () => {
    expect(migration).toContain("communications_bulletin_pdf_required");
    expect(migration).toContain("item.status = 'draft'");
    expect(migration).toContain("item.r2_object_key is null");
    expect(migration).toContain("'has_pdf', item.r2_object_key is not null");
  });

  it("valida sesión, formato, tamaño e integridad antes de servir archivos privados de R2", () => {
    expect(storageRoute).toContain("/auth/v1/user");
    expect(storageRoute).toContain("application/pdf");
    expect(storageRoute).toContain("MAX_PDF_BYTES = 20 * 1024 * 1024");
    expect(storageRoute).toContain("isPdfSignature");
    expect(storageRoute).toContain("customMetadata?.sha256 !== artifact.sha256");
    expect(storageRoute).toContain('"cache-control": "private, no-store"');
    expect(storageRoute).not.toMatch(/public[-_ ]bucket|r2\.dev/i);
  });

  it("no usa publicaciones, eventos ni boletines de muestra como contenido real", () => {
    expect(siteConfig).toContain("Aún no hay boletines publicados.");
    expect(siteConfig).toContain("Próximas actividades");
    expect(modulePage).not.toContain("Un nuevo espacio para encontrarnos");
    expect(modulePage).not.toContain("Tus beneficios, más cerca de ti");
  });

  it("guarda el borrador por revisión y conserva versiones inmutables del portal", () => {
    expect(designMigration).toContain("create table if not exists public.communications_site_state");
    expect(designMigration).toContain("create table if not exists public.communications_site_versions");
    expect(designMigration).toContain("draft_revision = state_row.draft_revision + 1");
    expect(designMigration).toContain("using errcode = '40001'");
    expect(designMigration).toContain("restore_communications_site_version");
    expect(designMigration).toContain("restored_from_version");
  });

  it("usa bloques y temas allowlist sin insertar HTML, CSS o scripts del editor", () => {
    expect(siteConfig).toContain("HeroSection");
    expect(siteConfig).toContain("NewsSection");
    expect(siteConfig).toContain("type: \"select\", label: \"Paleta de colores\"");
    expect(designMigration).toContain("is_valid_communications_site_data");
    expect(designMigration).toContain("octet_length(p_data::text) > 262144");
    expect(designMigration).toContain("'buses-jm', 'andino', 'neutro'");
    expect(designMigration).not.toMatch(/dangerouslySetInnerHTML|<script|customCss/i);
  });

  it("carga la edición visual como ruta protegida e incluye vista previa e historial", () => {
    expect(router).toContain("/recursos-humanos/comunicaciones/diseno");
    expect(designPage).toContain('href="/recursos-humanos/comunicaciones"');
    expect(designPage).toContain("onPublish={publish}");
    expect(designPage).toContain("Vista previa");
    expect(designPage).toContain("Historial de versiones");
    expect(designPage).toContain("Restaurar");
  });

  it("separa Editorial y Oficial, limita la audiencia por roles y permite exigir acuse", () => {
    expect(cmsMigration).toContain("channel in ('editorial', 'oficial')");
    expect(cmsMigration).toContain("public.user_has_role(actor_id, audience.role_code)");
    expect(cmsMigration).toContain("communications_acknowledgements");
    expect(cmsMigration).toContain("ack_communications_item");
    expect(cmsMigration).toContain("Solo las publicaciones oficiales pueden exigir acuse de lectura");
    expect(modulePage).toContain('Editorial<span>Historias y vida en Buses JM</span>');
    expect(modulePage).toContain('Oficial<span>Comunicados e información vigente</span>');
    expect(modulePage).toContain("Confirmar lectura");
  });

  it("programa y vence por hora de servidor y mantiene archivos privados verificados en R2", () => {
    expect(cmsMigration).toContain("publish_at timestamptz");
    expect(cmsMigration).toContain("expires_at timestamptz");
    expect(cmsMigration).toContain("item.expires_at > timezone('utc', now())");
    expect(cmsMigration).toContain("item.publish_at > timezone('utc', now())");
    expect(cmsMigration).toContain("body_blocks jsonb");
    expect(assetRoute).toContain("signatureMatches");
    expect(assetRoute).toContain("customMetadata?.sha256 !== asset.sha256");
    expect(assetRoute).toContain('request.method === "POST"');
    expect(modulePage).toContain("Programar publicación");
    expect(modulePage).toContain("Previsualizar");
    expect(modulePage).toContain("Vencimiento (opcional)");
  });

  it("permite configurar icono y bajada en boletines y los muestra en la lista", () => {
    expect(bulletinEditorialMigration).toContain("add column if not exists icon_key text not null default 'download'");
    expect(bulletinEditorialMigration).toContain("'icon_key', item.icon_key");
    expect(bulletinEditorialMigration).toContain("icon_key = excluded.icon_key");
    expect(bulletinEditorialMigration).toContain("user_can_manage_communications()");
    expect(bulletinEditorialMigration).toContain("communications_items_icon_key_check");
    expect(bulletinEditorialMigration).toContain("notify pgrst, 'reload schema'");
    expect(modulePage).toContain("Icono del boletín");
    expect(modulePage).toContain("draft.summary");
    expect(siteConfig).toContain("item.iconKey");
    expect(siteConfig).toContain("<p>{item.summary}</p>");
    expect(communicationsApi).toContain("icon_key: item.iconKey");
    expect(communicationsApi).toContain('iconKey: row.icon_key ?? "download"');
    expect(siteStyles).toContain("communications-site-bulletin-icon");
  });

  it("mantiene accesos directos editables con destinos internos cerrados y mosaicos de agenda visibles sin contenido", () => {
    expect(siteConfig).toContain('QuickLinksSection: {');
    expect(siteConfig).toContain('label: "Accesos directos"');
    expect(siteConfig).toContain('"Mosaico · 3 columnas"');
    expect(siteConfig).toContain('communications-site-event-empty');
    expect(siteStyles).toContain('grid-template-columns: repeat(3, minmax(0, 1fr))');
    expect(siteStyles).toContain('grid-template-columns: repeat(2, minmax(0, 1fr))');
    expect(siteConfig).toContain('onQuickAccess:');
    expect(quickLinksMigration).toContain("'QuickLinksSection'");
    expect(quickLinksMigration).toContain("('actualidad', 'oficial', 'agenda', 'boletines')");
    expect(quickLinksMigration).not.toMatch(/execute\s+format|dynamic sql|security\s+definer/i);
    expect(modulePage).not.toContain('communications-brand-mark" aria-hidden="true">jm');
  });
});
