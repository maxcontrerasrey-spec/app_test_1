import { useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { PageShell } from "../../../shared/ui";
import { useAcknowledgeCommunicationItem, useCommunicationsPortal, useSaveCommunicationItem } from "../hooks/useCommunicationsQueries";
import { useCommunicationsSite } from "../hooks/useCommunicationsSite";
import { CommunicationsSiteContextProvider, CommunicationsSiteLayout, DEFAULT_COMMUNICATIONS_SITE } from "../site/communicationsSiteConfig";
import {
  downloadCommunicationBulletin,
  downloadCommunicationAsset,
  type CommunicationCategory,
  type CommunicationChannel,
  type CommunicationBlock,
  type CommunicationDraft,
  type CommunicationItem,
  type CommunicationKind
} from "../services/communicationsApi";
import { CommunicationAssetImage } from "../components/CommunicationAssetImage";
import { CommunicationAssetVideo } from "../components/CommunicationAssetVideo";
import { NavigationIcon } from "../../../app/layout/NavigationIcon";
import "../styles/communications.css";
import "../styles/communications-design.css";

type Filter = "todas" | CommunicationKind;

const typeLabels: Record<CommunicationKind, string> = {
  noticia: "Noticia",
  comunicado: "Comunicado",
  evento: "Evento",
  boletin: "Boletín"
};

const categoryLabels: Record<CommunicationCategory, string> = {
  empresa: "Empresa",
  beneficios: "Beneficios",
  personas: "Personas",
  cultura: "Cultura",
  general: "General",
  operaciones: "Operaciones",
  seguridad: "Seguridad",
  reconocimientos: "Reconocimientos",
  contratos: "Nuevos contratos",
  equipos: "Incorporación de equipos",
  actividades: "Actividades",
  campanas: "Campañas",
  aniversarios: "Aniversarios",
  hitos: "Hitos",
  procedimientos: "Procedimientos",
  instrucciones: "Instrucciones operacionales"
};

const editorialCategories: CommunicationCategory[] = ["empresa", "beneficios", "personas", "cultura", "operaciones", "reconocimientos", "contratos", "equipos", "actividades", "campanas", "aniversarios", "hitos", "general"];
const officialCategories: CommunicationCategory[] = ["seguridad", "procedimientos", "instrucciones", "operaciones", "general"];

const filters: Array<{ value: Filter; label: string }> = [
  { value: "todas", label: "Todo" },
  { value: "noticia", label: "Noticias" },
  { value: "comunicado", label: "Comunicados" },
  { value: "evento", label: "Eventos" },
  { value: "boletin", label: "Boletines" }
];

const emptyDraft = (): CommunicationDraft => ({
  id: "",
  contentType: "noticia",
  channel: "editorial",
  title: "",
  summary: "",
  iconKey: "download",
  body: "",
  bodyBlocks: [{ type: "paragraph", text: "" }],
  category: "empresa",
  startsAt: null,
  endsAt: null,
  publishAt: null,
  expiresAt: null,
  audienceRoleCodes: [],
  requiresAcknowledgement: false,
  coverAssetId: null,
  assets: [],
  externalUrl: null,
  isFeatured: false,
  status: "draft"
});

function formatDate(value: string | null, includeTime = false) {
  if (!value) return "Fecha por confirmar";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Fecha por confirmar";
  return new Intl.DateTimeFormat("es-CL", {
    day: "numeric",
    month: "long",
    year: "numeric",
    ...(includeTime ? { hour: "2-digit", minute: "2-digit" } : {})
  }).format(date);
}

function dateTimeInput(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 16);
}

function Icon({ name }: { name: "arrow" | "calendar" | "download" | "file" | "search" | "plus" | "close" }) {
  const paths = {
    arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></>,
    download: <><path d="M12 3v12m-5-5 5 5 5-5" /><path d="M4 17v3h16v-3" /></>,
    file: <><path d="M7 3h7l5 5v13H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" /><path d="M14 3v6h5M9 14h6m-6 4h6" /></>,
    search: <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 5 5" /></>,
    plus: <path d="M12 5v14M5 12h14" />,
    close: <path d="m6 6 12 12M18 6 6 18" />
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

function renderBlocks(blocks: CommunicationBlock[], legacyBody: string) {
  if (!blocks.length) return legacyBody.split(/\n{2,}/).filter(Boolean).map((paragraph, index) => <p className="communications-reading-body" key={index}>{paragraph}</p>);
  return blocks.filter((block) => block.text.trim()).map((block, index) => {
    if (block.type === "heading") return <h3 className="communications-reading-heading" key={index}>{block.text}</h3>;
    if (block.type === "quote") return <blockquote className="communications-reading-quote" key={index}>{block.text}</blockquote>;
    if (block.type === "bullet_list" || block.type === "numbered_list") {
      const List = block.type === "bullet_list" ? "ul" : "ol";
      return <List className="communications-reading-list" key={index}>{block.text.split("\n").filter(Boolean).map((line, lineIndex) => <li key={lineIndex}>{line}</li>)}</List>;
    }
    if (block.type === "link") return /^https:\/\//i.test(block.url ?? "") ? <p className="communications-reading-body" key={index}><a href={block.url} target="_blank" rel="noreferrer">{block.text}</a></p> : null;
    return <p className="communications-reading-body" key={index}>{block.text}</p>;
  });
}

function CommunicationEditor({ initial, audiences, onClose, onSave, saving, error }: {
  initial: CommunicationDraft;
  audiences: Array<{ code: string; name: string }>;
  onClose: () => void;
  onSave: (item: CommunicationDraft, files: { bulletin?: File; cover?: File; assets: File[] }) => Promise<void>;
  saving: boolean;
  error: string | null;
}) {
  const [draft, setDraft] = useState(initial);
  const [bulletin, setBulletin] = useState<File>();
  const [cover, setCover] = useState<File>();
  const [assets, setAssets] = useState<File[]>([]);
  const [preview, setPreview] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [scheduleMode, setScheduleMode] = useState(initial.status === "draft" ? "draft" : initial.status === "archived" ? "archived" : initial.publishAt && new Date(initial.publishAt).getTime() > Date.now() ? "scheduled" : "now");
  const categories = draft.channel === "oficial" ? officialCategories : editorialCategories;
  const set = <K extends keyof CommunicationDraft>(key: K, value: CommunicationDraft[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setSubmitError(null);
    try { await onSave({ ...draft, status: scheduleMode === "draft" ? "draft" : scheduleMode === "archived" ? "archived" : "published" }, { bulletin, cover, assets }); }
    catch (caught) { setSubmitError(caught instanceof Error ? caught.message : "No fue posible guardar la publicación."); }
  };
  const updateBlock = (index: number, key: keyof CommunicationBlock, value: string) => set("bodyBlocks", draft.bodyBlocks.map((block, current) => current === index ? { ...block, [key]: value } : block));

  return <div className="communications-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose(); }}>
    <section className={`communications-editor ${preview ? "is-previewing" : ""}`} role="dialog" aria-modal="true" aria-labelledby="communications-editor-title">
      <header className="communications-editor-header"><div><span>{draft.channel === "editorial" ? "EDITORIAL" : "OFICIAL"} · GESTOR DE PUBLICACIONES</span><h2 id="communications-editor-title">{draft.id ? "Editar publicación" : "Nueva publicación"}</h2></div><div className="communications-topbar-actions"><button type="button" className="communications-topbar-button" onClick={() => setPreview((value) => !value)}>{preview ? "Volver a editar" : "Previsualizar"}</button><button type="button" className="communications-icon-button" aria-label="Cerrar" onClick={onClose} disabled={saving}><Icon name="close" /></button></div></header>
      {submitError || error ? <div className="communications-feedback is-error" role="alert">{submitError || error}</div> : null}
      {preview ? <article className="communications-editor-preview"><span className="communications-type">{draft.channel === "editorial" ? "Editorial" : "Oficial"} · {categoryLabels[draft.category]}</span>{draft.contentType === "boletin" ? <span className="communications-bulletin-preview-icon"><NavigationIcon iconKey={draft.iconKey} /></span> : null}<h2>{draft.title || "Título de la publicación"}</h2><p className="communications-reading-summary">{draft.summary || "La bajada aparecerá aquí."}</p>{renderBlocks(draft.bodyBlocks, draft.body)}{draft.requiresAcknowledgement ? <small>Esta publicación solicitará confirmación de lectura a su audiencia.</small> : null}</article> : <form onSubmit={submit} className="communications-editor-form">
        <div className="communications-editor-grid"><label><span>Nivel</span><select value={draft.channel} onChange={(event) => { const channel = event.target.value as CommunicationChannel; setDraft((current) => ({ ...current, channel, category: (channel === "oficial" ? officialCategories : editorialCategories).includes(current.category) ? current.category : channel === "oficial" ? "general" : "empresa", requiresAcknowledgement: channel === "oficial" ? current.requiresAcknowledgement : false, contentType: channel === "oficial" && current.contentType === "noticia" ? "comunicado" : current.contentType })); }}><option value="editorial">Editorial</option><option value="oficial">Oficial</option></select></label><label><span>Tipo</span><select value={draft.contentType} onChange={(event) => { const contentType = event.target.value as CommunicationKind; set("contentType", contentType); if (contentType !== "evento") { set("startsAt", null); set("endsAt", null); } }}><option value="noticia">Noticia</option><option value="comunicado">Comunicado</option><option value="evento">Actividad / evento</option><option value="boletin">Boletín</option></select></label></div>
        <label><span>Título</span><input required minLength={3} maxLength={160} value={draft.title} onChange={(event) => set("title", event.target.value)} placeholder="Un título claro y cercano" /></label>
        <label><span>Bajada</span><textarea required minLength={3} maxLength={320} rows={2} value={draft.summary} onChange={(event) => set("summary", event.target.value)} placeholder="Resume la noticia en pocas líneas" /></label>
        {draft.contentType === "boletin" ? <label><span>Icono del boletín</span><select value={draft.iconKey} onChange={(event) => set("iconKey", event.target.value as CommunicationDraft["iconKey"])}><option value="download">Edición / descarga</option><option value="megaphone">Comunicaciones</option><option value="clipboard-list">Información</option><option value="calendar-clock">Fechas y agenda</option><option value="users">Personas</option><option value="bus">Operaciones</option><option value="award">Reconocimientos</option><option value="sparkles">Destacado</option></select><small className="communications-field-help">Se mostrará en la ficha del boletín y en su listado.</small></label> : null}
        <div className="communications-editor-grid"><label><span>Categoría</span><select value={draft.category} onChange={(event) => set("category", event.target.value as CommunicationCategory)}>{categories.map((category) => <option key={category} value={category}>{categoryLabels[category]}</option>)}</select></label><label><span>Publicación</span><select value={scheduleMode} onChange={(event) => { const mode = event.target.value; setScheduleMode(mode); if (mode === "draft") { set("status", "draft"); set("publishAt", null); } else if (mode === "archived") set("status", "archived"); else { set("status", "published"); if (mode === "now") set("publishAt", null); else if (!draft.publishAt || new Date(draft.publishAt).getTime() <= Date.now()) set("publishAt", new Date(Date.now() + 60 * 60_000).toISOString()); } }}><option value="draft">Guardar borrador</option><option value="now">Publicar ahora</option><option value="scheduled">Programar publicación</option>{draft.id ? <option value="archived">Archivar</option> : null}</select></label></div>
        {scheduleMode === "scheduled" ? <label><span>Fecha y hora de publicación</span><input required type="datetime-local" value={dateTimeInput(draft.publishAt)} onChange={(event) => set("publishAt", event.target.value || null)} /></label> : null}
        <label><span>Vencimiento (opcional)</span><input type="datetime-local" value={dateTimeInput(draft.expiresAt)} onChange={(event) => set("expiresAt", event.target.value || null)} /></label>
        <label><span>Audiencia por roles ERP</span><select multiple value={draft.audienceRoleCodes} onChange={(event) => set("audienceRoleCodes", Array.from(event.currentTarget.selectedOptions, (option) => option.value).filter(Boolean))}>{audiences.map((audience) => <option key={audience.code} value={audience.code}>{audience.name}</option>)}</select><small className="communications-field-help">Sin roles seleccionados, la publicación queda visible para todas las personas con acceso al portal.</small></label>
        {draft.channel === "oficial" ? <label className="communications-feature-toggle"><input type="checkbox" checked={draft.requiresAcknowledgement} onChange={(event) => set("requiresAcknowledgement", event.target.checked)} /><span>Exigir confirmación de lectura</span></label> : null}
        <section className="communications-block-editor"><div className="communications-block-editor-heading"><div><span>CONTENIDO</span><small>Agrega párrafos, títulos, citas, listas y enlaces.</small></div><button type="button" className="communications-secondary-button" onClick={() => set("bodyBlocks", [...draft.bodyBlocks, { type: "paragraph", text: "" }])}>Agregar bloque</button></div>{draft.bodyBlocks.map((block, index) => <div className="communications-content-block" key={index}><div className="communications-editor-grid"><select aria-label="Formato del bloque" value={block.type} onChange={(event) => updateBlock(index, "type", event.target.value)}><option value="paragraph">Párrafo</option><option value="heading">Título de sección</option><option value="quote">Cita</option><option value="bullet_list">Lista con viñetas</option><option value="numbered_list">Lista numerada</option><option value="link">Enlace</option></select><button type="button" className="communications-edit-link" onClick={() => set("bodyBlocks", draft.bodyBlocks.filter((_, current) => current !== index))}>Quitar bloque</button></div><textarea rows={block.type.includes("list") ? 4 : 3} maxLength={5000} value={block.text} onChange={(event) => updateBlock(index, "text", event.target.value)} placeholder={block.type.includes("list") ? "Un elemento por línea" : "Escribe el contenido de este bloque"} />{block.type === "link" ? <input type="url" aria-label="Enlace HTTPS" value={block.url ?? ""} onChange={(event) => updateBlock(index, "url", event.target.value)} placeholder="https://…" /> : null}</div>)}</section>
        <div className="communications-editor-grid"><label><span>Imagen de portada</span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setCover(event.target.files?.[0])} />{cover ? <small>{cover.name}</small> : draft.coverAssetId ? <small>Portada actual guardada en R2</small> : <small>JPG, PNG o WebP · máximo 50 MB</small>}</label><label><span>Imágenes y adjuntos</span><input type="file" multiple accept="image/jpeg,image/png,image/webp,video/mp4,application/pdf,.pdf,.docx,.xlsx" onChange={(event) => setAssets(Array.from(event.target.files ?? []))} /><small>{assets.length ? `${assets.length} archivo(s) seleccionado(s)` : `${draft.assets?.length ?? 0} archivo(s) asociado(s) · máximo 50 MB cada uno`}</small></label></div>
        {draft.contentType === "evento" ? <div className="communications-editor-grid"><label><span>Inicio de actividad</span><input required type="datetime-local" value={dateTimeInput(draft.startsAt)} onChange={(event) => set("startsAt", event.target.value || null)} /></label><label><span>Término (opcional)</span><input type="datetime-local" value={dateTimeInput(draft.endsAt)} onChange={(event) => set("endsAt", event.target.value || null)} /></label></div> : null}
        {draft.contentType === "boletin" ? <div className="communications-upload-field"><label htmlFor="communications-pdf"><span>PDF del boletín</span></label>{draft.hasPdf ? <p className="communications-attached-file"><Icon name="file" />{draft.pdfFilename} <small>Guardado en R2</small></p> : <><input id="communications-pdf" type="file" accept="application/pdf,.pdf" onChange={(event) => setBulletin(event.target.files?.[0])} /><small>PDF, máximo 20 MB. Se almacena en R2 privado.</small></>}{bulletin ? <p className="communications-selected-file"><Icon name="file" />{bulletin.name} · {(bulletin.size / 1024 / 1024).toFixed(1)} MB</p> : null}</div> : null}
        <label><span>Enlace complementario (opcional)</span><input type="url" value={draft.externalUrl ?? ""} onChange={(event) => set("externalUrl", event.target.value || null)} placeholder="https://…" /></label>
        {draft.channel === "editorial" ? <label className="communications-feature-toggle"><input type="checkbox" checked={draft.isFeatured} onChange={(event) => set("isFeatured", event.target.checked)} /><span>Destacar en la portada Editorial</span></label> : null}
        <footer className="communications-editor-footer"><button type="button" className="communications-secondary-button" onClick={onClose} disabled={saving}>Cancelar</button><button type="submit" className="communications-primary-button" disabled={saving}>{saving ? "Guardando…" : scheduleMode === "draft" ? "Guardar borrador" : scheduleMode === "archived" ? "Archivar" : scheduleMode === "scheduled" ? "Programar publicación" : "Guardar y publicar"}</button></footer>
      </form>}
    </section>
  </div>;
}

export function CommunicationsPage() {
  const navigate = useNavigate();
  const portalQuery = useCommunicationsPortal();
  const siteQuery = useCommunicationsSite();
  const saveMutation = useSaveCommunicationItem();
  const acknowledgeMutation = useAcknowledgeCommunicationItem();
  const [channel, setChannel] = useState<CommunicationChannel>("editorial");
  const [filter, setFilter] = useState<Filter>("todas");
  const [search, setSearch] = useState("");
  const [openItem, setOpenItem] = useState<CommunicationItem | null>(null);
  const [editorItem, setEditorItem] = useState<CommunicationDraft | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const canManage = portalQuery.data?.canManage ?? false;
  const items = portalQuery.data?.items ?? [];
  const published = useMemo(() => items.filter((item) => item.status === "published" && item.channel === channel), [channel, items]);
  const visibleItems = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("es-CL");
    return items.filter((item) => item.channel === channel && (item.status === "published" || canManage) && (() => {
      if (filter !== "todas" && item.contentType !== filter) return false;
      if (!term) return true;
      return `${item.title} ${item.summary} ${item.body} ${item.bodyBlocks.map((block) => block.text).join(" ")} ${categoryLabels[item.category]}`.toLocaleLowerCase("es-CL").includes(term);
    })());
  }, [canManage, channel, filter, items, search]);
  const publishedVisibleItems = visibleItems.filter((item) => item.status === "published");
  const drafts = items.filter((item) => item.channel === channel && item.status !== "published");
  const pendingAcknowledgements = published.filter((item) => item.requiresAcknowledgement && !item.hasAcknowledged).length;

  const save = async (item: CommunicationDraft, files: { bulletin?: File; cover?: File; assets: File[] }) => {
    setSaveSuccess(false);
    const isPublishedBulletinMissingPdf = item.contentType === "boletin" && item.status === "published" && !item.hasPdf && !files.bulletin;
    if (isPublishedBulletinMissingPdf) throw new Error("Adjunta el PDF antes de publicar el boletín.");
    await saveMutation.mutateAsync({ item, bulletin: files.bulletin, cover: files.cover, assets: files.assets });
    setEditorItem(null);
    setSaveSuccess(true);
  };

  const openEditor = (item?: CommunicationItem) => {
    setSaveSuccess(false);
    setEditorItem(item ? {
      id: item.id,
      contentType: item.contentType,
      channel: item.channel,
      title: item.title,
      summary: item.summary,
      iconKey: item.iconKey,
      body: item.body,
      bodyBlocks: item.bodyBlocks.length ? item.bodyBlocks : item.body.split(/\n{2,}/).filter(Boolean).map((text) => ({ type: "paragraph" as const, text })),
      category: item.category,
      startsAt: item.startsAt,
      endsAt: item.endsAt,
      publishAt: item.publishAt,
      expiresAt: item.expiresAt,
      audienceRoleCodes: item.audienceRoleCodes,
      requiresAcknowledgement: item.requiresAcknowledgement,
      coverAssetId: item.coverAssetId,
      assets: item.assets,
      externalUrl: item.externalUrl,
      isFeatured: item.isFeatured,
      status: item.status === "scheduled" || item.status === "expired" ? "published" : item.status,
      hasPdf: item.hasPdf,
      pdfFilename: item.pdfFilename
    } : channel === "oficial" ? { ...emptyDraft(), channel: "oficial", contentType: "comunicado", category: "general" } : emptyDraft());
  };

  const download = async (item: CommunicationItem) => {
    setDownloadError(null);
    try { await downloadCommunicationBulletin(item); }
    catch (error) { setDownloadError(error instanceof Error ? error.message : "No fue posible descargar el boletín."); }
  };

  const layoutContext = {
    items: publishedVisibleItems,
    featured: publishedVisibleItems.find((item) => item.isFeatured) ?? publishedVisibleItems.find((item) => item.contentType !== "boletin"),
    onOpen: (item: CommunicationItem) => setOpenItem(item),
    onDownload: (item: CommunicationItem) => { void download(item); },
    onQuickAccess: (target: "actualidad" | "oficial" | "agenda" | "boletines") => {
      if (target === "oficial") setChannel("oficial");
      else setChannel("editorial");
      setFilter(target === "agenda" ? "evento" : target === "boletines" ? "boletin" : "todas");
      window.setTimeout(() => document.getElementById(target === "agenda" ? "communications-agenda" : target === "boletines" ? "communications-bulletins" : "communications-latest")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
    }
  };

  return (
    <PageShell className="communications-page">
      <header className="communications-topbar"><div className="communications-brand"><span>Comunicaciones</span></div><label className="communications-search communications-topbar-search"><Icon name="search" /><input aria-label="Buscar publicaciones" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar" /></label><div className="communications-topbar-actions">{canManage ? <><button type="button" className="communications-topbar-button" onClick={() => navigate("/recursos-humanos/comunicaciones/diseno")}>Diseñar portal</button><button type="button" className="communications-new-button" onClick={() => openEditor()}><Icon name="plus" />Nueva publicación</button></> : null}</div></header>

      <section className="communications-main" id="communications-latest">
        <nav className="communications-levels" aria-label="Niveles de comunicaciones"><button type="button" aria-current={channel === "editorial" ? "page" : undefined} className={channel === "editorial" ? "is-active" : ""} onClick={() => { setChannel("editorial"); setFilter("todas"); }}>Editorial<span>Historias y vida en Buses JM</span></button><button type="button" aria-current={channel === "oficial" ? "page" : undefined} className={channel === "oficial" ? "is-active" : ""} onClick={() => { setChannel("oficial"); setFilter("todas"); }}>Oficial<span>Comunicados e información vigente</span></button></nav>
        <div className="communications-section-heading"><div><span className="communications-kicker">{channel === "editorial" ? "PARA ESTAR AL DÍA" : "INFORMACIÓN CORPORATIVA"}</span><h2>{channel === "editorial" ? "Lo que está pasando" : "Comunicaciones oficiales"}</h2></div></div>
        {channel === "oficial" && pendingAcknowledgements > 0 ? <div className="communications-pending-notice"><strong>{pendingAcknowledgements} publicación(es) requieren tu lectura</strong><span>Abre cada comunicado y confirma cuando termines de leerlo.</span></div> : null}
        <nav className="communications-filters" aria-label="Filtrar publicaciones">{filters.map((option) => <button key={option.value} type="button" aria-pressed={filter === option.value} className={filter === option.value ? "is-active" : ""} onClick={() => setFilter(option.value)}>{option.label}<span>{option.value === "todas" ? published.length : published.filter((item) => item.contentType === option.value).length}</span></button>)}</nav>

        {portalQuery.isLoading || siteQuery.isLoading ? <div className="communications-loading" aria-label="Cargando comunicaciones"><i /><i /><i /></div> : null}
        {portalQuery.isError || siteQuery.isError ? <div className="communications-feedback is-error" role="alert">No pudimos cargar todas las comunicaciones. Revisa tu conexión e inténtalo de nuevo. <button type="button" onClick={() => { void portalQuery.refetch(); void siteQuery.refetch(); }}>Reintentar</button></div> : null}
        {saveMutation.isError ? <div className="communications-feedback is-error" role="alert">{saveMutation.error instanceof Error ? saveMutation.error.message : "No fue posible guardar la publicación."}</div> : null}
        {saveSuccess ? <div className="communications-feedback is-success" role="status">La publicación se guardó correctamente.</div> : null}

        {!portalQuery.isLoading && !portalQuery.isError ? <CommunicationsSiteContextProvider value={layoutContext}><CommunicationsSiteLayout data={siteQuery.data?.publishedData ?? DEFAULT_COMMUNICATIONS_SITE} /></CommunicationsSiteContextProvider> : null}
        {canManage && drafts.length ? <section className="communications-drafts-panel"><div><span className="communications-kicker">GESTIÓN INTERNA · {channel.toUpperCase()}</span><h3>Otras publicaciones</h3></div>{drafts.map((item) => <div className="communications-draft-row" key={item.id}><span><strong>{item.title || "Sin título"}</strong><small>{item.status === "scheduled" ? `Programada para ${formatDate(item.publishAt, true)}` : item.status === "expired" ? "Vencida" : item.status === "archived" ? "Archivada" : "Borrador"} · {typeLabels[item.contentType]} · Actualizado {formatDate(item.updatedAt)}</small></span><button type="button" className="communications-secondary-button" onClick={() => openEditor(item)}>Continuar edición</button></div>)}</section> : null}
        {downloadError ? <p className="communications-download-error" role="alert">{downloadError}</p> : null}
      </section>

      {openItem ? <div className="communications-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpenItem(null); }}><article className="communications-reading-panel" role="dialog" aria-modal="true" aria-labelledby="communications-reading-title"><button type="button" className="communications-icon-button communications-reading-close" aria-label="Cerrar" onClick={() => setOpenItem(null)}><Icon name="close" /></button><CommunicationAssetImage assetId={openItem.coverAssetId} alt={openItem.title} className="communications-reading-cover" /><span className={`communications-type communications-type-${openItem.contentType}`}>{openItem.channel === "editorial" ? "Editorial" : "Oficial"} · {categoryLabels[openItem.category]}</span><h2 id="communications-reading-title">{openItem.title}</h2><p className="communications-reading-date">{openItem.contentType === "evento" ? formatDate(openItem.startsAt, true) : formatDate(openItem.publishAt ?? openItem.publishedAt)}</p><p className="communications-reading-summary">{openItem.summary}</p>{renderBlocks(openItem.bodyBlocks, openItem.body)}{openItem.assets.filter((asset) => asset.assetType !== "cover").length ? <section className="communications-reading-assets"><h3>Imágenes y archivos</h3><div>{openItem.assets.filter((asset) => asset.assetType !== "cover").map((asset) => asset.assetType === "image" ? <CommunicationAssetImage key={asset.id} assetId={asset.id} alt={asset.filename} className="communications-reading-gallery-image" /> : asset.assetType === "video" ? <CommunicationAssetVideo key={asset.id} assetId={asset.id} label={asset.filename} /> : <button key={asset.id} type="button" className="communications-secondary-button" onClick={() => void downloadCommunicationAsset(asset)}><Icon name="download" />{asset.filename}</button>)}</div></section> : null}{openItem.requiresAcknowledgement ? <section className={`communications-acknowledgement ${openItem.hasAcknowledged ? "is-done" : ""}`}><span>{openItem.hasAcknowledged ? "Lectura confirmada" : "Esta publicación requiere confirmación de lectura."}</span>{canManage ? <small>{openItem.acknowledgementCount ?? 0} confirmación(es) registradas</small> : null}{acknowledgeMutation.isError ? <small role="alert">No fue posible registrar la lectura. Inténtalo nuevamente.</small> : null}{openItem.canAcknowledge && !openItem.hasAcknowledged ? <button type="button" className="communications-primary-button" disabled={acknowledgeMutation.isPending} onClick={() => void acknowledgeMutation.mutateAsync(openItem.id).then(() => setOpenItem((current) => current ? { ...current, hasAcknowledged: true } : current))}>{acknowledgeMutation.isPending ? "Registrando…" : "Confirmar lectura"}</button> : null}</section> : null}{openItem.externalUrl ? <a className="communications-text-link" href={openItem.externalUrl} target="_blank" rel="noreferrer">Ver enlace relacionado <Icon name="arrow" /></a> : null}{openItem.hasPdf ? <button type="button" className="communications-primary-button" onClick={() => void download(openItem)}><Icon name="download" />Descargar boletín</button> : null}{canManage ? <button type="button" className="communications-edit-link" onClick={() => { setOpenItem(null); openEditor(openItem); }}>Editar publicación</button> : null}</article></div> : null}
      {editorItem ? <CommunicationEditor initial={editorItem} audiences={portalQuery.data?.audiences ?? []} onClose={() => { if (!saveMutation.isPending) setEditorItem(null); }} onSave={save} saving={saveMutation.isPending} error={saveMutation.isError ? saveMutation.error instanceof Error ? saveMutation.error.message : "No fue posible guardar la publicación." : null} /> : null}
    </PageShell>
  );
}
