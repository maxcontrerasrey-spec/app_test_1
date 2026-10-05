import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync("supabase/migrations/20261005165138_communications_portal.sql", "utf8");
const designMigration = readFileSync("supabase/migrations/20261005165140_communications_visual_editor.sql", "utf8");
const storageRoute = readFileSync("functions/api/comunicaciones/files.ts", "utf8");
const router = readFileSync("src/app/router/AppRouter.tsx", "utf8");
const access = readFileSync("src/modules/auth/config/access.ts", "utf8");
const modulePage = readFileSync("src/modules/communications/pages/CommunicationsPage.tsx", "utf8");
const designPage = readFileSync("src/modules/communications/pages/CommunicationsDesignPage.tsx", "utf8");
const siteConfig = readFileSync("src/modules/communications/site/communicationsSiteConfig.tsx", "utf8");
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
    expect(router).toContain("/comunicaciones/diseno");
    expect(designPage).toContain("onPublish={publish}");
    expect(designPage).toContain("Vista previa");
    expect(designPage).toContain("Historial de versiones");
    expect(designPage).toContain("Restaurar");
  });
});
