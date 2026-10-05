import { useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { PageShell } from "../../../shared/ui";
import { useCommunicationsPortal, useSaveCommunicationItem } from "../hooks/useCommunicationsQueries";
import { useCommunicationsSite } from "../hooks/useCommunicationsSite";
import { CommunicationsSiteContextProvider, CommunicationsSiteLayout, DEFAULT_COMMUNICATIONS_SITE } from "../site/communicationsSiteConfig";
import {
  downloadCommunicationBulletin,
  type CommunicationCategory,
  type CommunicationDraft,
  type CommunicationItem,
  type CommunicationKind,
  type CommunicationStatus
} from "../services/communicationsApi";
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
  general: "General"
};

const filters: Array<{ value: Filter; label: string }> = [
  { value: "todas", label: "Todo" },
  { value: "noticia", label: "Noticias" },
  { value: "comunicado", label: "Comunicados" },
  { value: "evento", label: "Eventos" },
  { value: "boletin", label: "Boletines" }
];

const emptyDraft = (): CommunicationDraft => ({
  id: crypto.randomUUID(),
  contentType: "noticia",
  title: "",
  summary: "",
  body: "",
  category: "empresa",
  startsAt: null,
  endsAt: null,
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

function CommunicationEditor({
  initial,
  onClose,
  onSave,
  saving,
  error
}: {
  initial: CommunicationDraft;
  onClose: () => void;
  onSave: (item: CommunicationDraft, file: File | undefined) => Promise<void>;
  saving: boolean;
  error: string | null;
}) {
  const [draft, setDraft] = useState(initial);
  const [file, setFile] = useState<File>();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const set = <K extends keyof CommunicationDraft>(key: K, value: CommunicationDraft[K]) => setDraft((current) => ({ ...current, [key]: value }));

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitError(null);
    try {
      await onSave(draft, file);
    } catch (caught) {
      setSubmitError(caught instanceof Error ? caught.message : "No fue posible guardar la publicación.");
    }
  };

  return (
    <div className="communications-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose(); }}>
      <section className="communications-editor" role="dialog" aria-modal="true" aria-labelledby="communications-editor-title">
        <header className="communications-editor-header"><div><span>EDITORIAL</span><h2 id="communications-editor-title">{draft.id ? "Editar publicación" : "Nueva publicación"}</h2></div><button type="button" className="communications-icon-button" aria-label="Cerrar" onClick={onClose} disabled={saving}><Icon name="close" /></button></header>
        {submitError || error ? <div className="communications-feedback is-error" role="alert">{submitError || error}</div> : null}
        <form onSubmit={submit} className="communications-editor-form">
          <label><span>Tipo de publicación</span><select value={draft.contentType} onChange={(event) => { const contentType = event.target.value as CommunicationKind; set("contentType", contentType); if (contentType !== "evento") { set("startsAt", null); set("endsAt", null); } }}><option value="noticia">Noticia</option><option value="comunicado">Comunicado</option><option value="evento">Evento</option><option value="boletin">Boletín</option></select></label>
          <label><span>Título</span><input required minLength={3} maxLength={160} value={draft.title} onChange={(event) => set("title", event.target.value)} placeholder="Un título claro y cercano" /></label>
          <label><span>Resumen para el listado</span><textarea required minLength={3} maxLength={320} rows={3} value={draft.summary} onChange={(event) => set("summary", event.target.value)} placeholder="Cuenta en pocas líneas de qué se trata" /></label>
          <div className="communications-editor-grid">
            <label><span>Sección</span><select value={draft.category} onChange={(event) => set("category", event.target.value as CommunicationCategory)}>{Object.entries(categoryLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
            <label><span>Visibilidad</span><select value={draft.status} onChange={(event) => set("status", event.target.value as CommunicationStatus)}><option value="draft">Guardar como borrador</option><option value="published">Publicar ahora</option><option value="archived">Archivar</option></select></label>
          </div>
          {draft.contentType === "evento" ? <div className="communications-editor-grid"><label><span>Inicio del evento</span><input required type="datetime-local" value={dateTimeInput(draft.startsAt)} onChange={(event) => set("startsAt", event.target.value || null)} /></label><label><span>Término (opcional)</span><input type="datetime-local" value={dateTimeInput(draft.endsAt)} onChange={(event) => set("endsAt", event.target.value || null)} /></label></div> : null}
          <label><span>Contenido</span><textarea rows={6} maxLength={16000} value={draft.body} onChange={(event) => set("body", event.target.value)} placeholder="Agrega detalles para quienes quieran leer la publicación completa" /></label>
          <label><span>Enlace externo seguro (opcional)</span><input type="url" value={draft.externalUrl ?? ""} onChange={(event) => set("externalUrl", event.target.value || null)} placeholder="https://…" /></label>
          {draft.contentType === "boletin" ? <div className="communications-upload-field"><label htmlFor="communications-pdf"><span>PDF del boletín</span></label>{draft.hasPdf ? <p className="communications-attached-file"><Icon name="file" />{draft.pdfFilename} <small>Guardado en R2</small></p> : <><input id="communications-pdf" type="file" accept="application/pdf,.pdf" onChange={(event) => setFile(event.target.files?.[0])} /><small>PDF, máximo 20 MB. Al publicar, el archivo se sirve desde R2 con sesión autenticada.</small></>}{file ? <p className="communications-selected-file"><Icon name="file" />{file.name} · {(file.size / 1024 / 1024).toFixed(1)} MB</p> : null}</div> : null}
          <label className="communications-feature-toggle"><input type="checkbox" checked={draft.isFeatured} onChange={(event) => set("isFeatured", event.target.checked)} /><span>Destacar en la portada</span></label>
          <footer className="communications-editor-footer"><button type="button" className="communications-secondary-button" onClick={onClose} disabled={saving}>Cancelar</button><button type="submit" className="communications-primary-button" disabled={saving}>{saving ? "Guardando…" : draft.status === "published" ? "Guardar y publicar" : "Guardar publicación"}</button></footer>
        </form>
      </section>
    </div>
  );
}

export function CommunicationsPage() {
  const navigate = useNavigate();
  const portalQuery = useCommunicationsPortal();
  const siteQuery = useCommunicationsSite();
  const saveMutation = useSaveCommunicationItem();
  const [filter, setFilter] = useState<Filter>("todas");
  const [search, setSearch] = useState("");
  const [openItem, setOpenItem] = useState<CommunicationItem | null>(null);
  const [editorItem, setEditorItem] = useState<CommunicationDraft | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const canManage = portalQuery.data?.canManage ?? false;
  const items = portalQuery.data?.items ?? [];
  const published = useMemo(() => items.filter((item) => item.status === "published"), [items]);
  const visibleItems = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("es-CL");
    return items.filter((item) => (item.status === "published" || canManage) && (() => {
      if (filter !== "todas" && item.contentType !== filter) return false;
      if (!term) return true;
      return `${item.title} ${item.summary} ${item.body} ${categoryLabels[item.category]}`.toLocaleLowerCase("es-CL").includes(term);
    })());
  }, [canManage, filter, items, search]);
  const publishedVisibleItems = visibleItems.filter((item) => item.status === "published");
  const drafts = items.filter((item) => item.status === "draft");

  const save = async (item: CommunicationDraft, file?: File) => {
    setSaveSuccess(false);
    const isPublishedBulletinMissingPdf = item.contentType === "boletin" && item.status === "published" && !item.hasPdf && !file;
    if (isPublishedBulletinMissingPdf) throw new Error("Adjunta el PDF antes de publicar el boletín.");
    await saveMutation.mutateAsync({ item, file });
    setEditorItem(null);
    setSaveSuccess(true);
  };

  const openEditor = (item?: CommunicationItem) => {
    setSaveSuccess(false);
    setEditorItem(item ? {
      id: item.id,
      contentType: item.contentType,
      title: item.title,
      summary: item.summary,
      body: item.body,
      category: item.category,
      startsAt: item.startsAt,
      endsAt: item.endsAt,
      externalUrl: item.externalUrl,
      isFeatured: item.isFeatured,
      status: item.status,
      hasPdf: item.hasPdf,
      pdfFilename: item.pdfFilename
    } : emptyDraft());
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
    onDownload: (item: CommunicationItem) => { void download(item); }
  };

  return (
    <PageShell className="communications-page">
      <header className="communications-topbar"><div className="communications-brand"><span className="communications-brand-mark" aria-hidden="true">jm</span><span>Portal de Comunicaciones <small>BUSES JM</small></span></div><div className="communications-topbar-actions">{canManage ? <><button type="button" className="communications-topbar-button" onClick={() => navigate("/recursos-humanos/comunicaciones/diseno")}>Diseñar portada</button><button type="button" className="communications-new-button" onClick={() => openEditor()}><Icon name="plus" />Nueva publicación</button></> : <span className="communications-topbar-label">Un espacio para encontrarnos</span>}</div></header>

      <section className="communications-main" id="communications-latest">
        <div className="communications-section-heading"><div><span className="communications-kicker">PARA ESTAR AL DÍA</span><h2>Noticias y publicaciones</h2></div><label className="communications-search"><Icon name="search" /><input aria-label="Buscar publicaciones" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar noticias" /></label></div>
        <nav className="communications-filters" aria-label="Filtrar publicaciones">{filters.map((option) => <button key={option.value} type="button" aria-pressed={filter === option.value} className={filter === option.value ? "is-active" : ""} onClick={() => setFilter(option.value)}>{option.label}<span>{option.value === "todas" ? published.length : published.filter((item) => item.contentType === option.value).length}</span></button>)}</nav>

        {portalQuery.isLoading || siteQuery.isLoading ? <div className="communications-loading" aria-label="Cargando comunicaciones"><i /><i /><i /></div> : null}
        {portalQuery.isError || siteQuery.isError ? <div className="communications-feedback is-error" role="alert">No pudimos cargar todas las comunicaciones. Revisa tu conexión e inténtalo de nuevo. <button type="button" onClick={() => { void portalQuery.refetch(); void siteQuery.refetch(); }}>Reintentar</button></div> : null}
        {saveMutation.isError ? <div className="communications-feedback is-error" role="alert">{saveMutation.error instanceof Error ? saveMutation.error.message : "No fue posible guardar la publicación."}</div> : null}
        {saveSuccess ? <div className="communications-feedback is-success" role="status">La publicación se guardó correctamente.</div> : null}

        {!portalQuery.isLoading && !portalQuery.isError ? <CommunicationsSiteContextProvider value={layoutContext}><CommunicationsSiteLayout data={siteQuery.data?.publishedData ?? DEFAULT_COMMUNICATIONS_SITE} /></CommunicationsSiteContextProvider> : null}
        {canManage && drafts.length ? <section className="communications-drafts-panel"><div><span className="communications-kicker">SOLO TÚ PUEDES VER ESTA LISTA</span><h3>Borradores de publicaciones</h3></div>{drafts.map((item) => <div className="communications-draft-row" key={item.id}><span><strong>{item.title || "Sin título"}</strong><small>{typeLabels[item.contentType]} · Último cambio {formatDate(item.updatedAt)}</small></span><button type="button" className="communications-secondary-button" onClick={() => openEditor(item)}>Continuar edición</button></div>)}</section> : null}
        {downloadError ? <p className="communications-download-error" role="alert">{downloadError}</p> : null}
      </section>

      {openItem ? <div className="communications-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpenItem(null); }}><article className="communications-reading-panel" role="dialog" aria-modal="true" aria-labelledby="communications-reading-title"><button type="button" className="communications-icon-button communications-reading-close" aria-label="Cerrar" onClick={() => setOpenItem(null)}><Icon name="close" /></button><span className={`communications-type communications-type-${openItem.contentType}`}>{typeLabels[openItem.contentType]} · {categoryLabels[openItem.category]}</span><h2 id="communications-reading-title">{openItem.title}</h2><p className="communications-reading-date">{openItem.contentType === "evento" ? formatDate(openItem.startsAt, true) : formatDate(openItem.publishedAt)}</p><p className="communications-reading-summary">{openItem.summary}</p>{openItem.body.split(/\n{2,}/).filter(Boolean).map((paragraph, index) => <p className="communications-reading-body" key={index}>{paragraph}</p>)}{openItem.externalUrl ? <a className="communications-text-link" href={openItem.externalUrl} target="_blank" rel="noreferrer">Ver enlace relacionado <Icon name="arrow" /></a> : null}{openItem.hasPdf ? <button type="button" className="communications-primary-button" onClick={() => void download(openItem)}><Icon name="download" />Descargar boletín</button> : null}{canManage ? <button type="button" className="communications-edit-link" onClick={() => { setOpenItem(null); openEditor(openItem); }}>Editar publicación</button> : null}</article></div> : null}
      {editorItem ? <CommunicationEditor initial={editorItem} onClose={() => { if (!saveMutation.isPending) setEditorItem(null); }} onSave={save} saving={saveMutation.isPending} error={saveMutation.isError ? saveMutation.error instanceof Error ? saveMutation.error.message : "No fue posible guardar la publicación." : null} /> : null}
    </PageShell>
  );
}
