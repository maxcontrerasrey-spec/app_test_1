import { useEffect, useState } from "react";
import { Puck, type Viewports } from "@puckeditor/core";
import { useCommunicationsPortal } from "../hooks/useCommunicationsQueries";
import { useCommunicationsSite, useCommunicationsSiteActions } from "../hooks/useCommunicationsSite";
import {
  CommunicationsSiteContextProvider,
  CommunicationsSiteLayout,
  communicationsSiteConfig,
  type CommunicationsSiteData
} from "../site/communicationsSiteConfig";
import { downloadCommunicationBulletin } from "../services/communicationsApi";
import type { CommunicationItem } from "../services/communicationsApi";
import "@puckeditor/core/puck.css";
import "../styles/communications.css";
import "../styles/communications-design-editor.css";

const viewports: Viewports = [
  { width: 375, icon: "Smartphone", label: "Móvil" },
  { width: 768, icon: "Tablet", label: "Tablet" },
  { width: 1280, icon: "Monitor", label: "Escritorio" }
];

function formatVersionDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Fecha no disponible" : new Intl.DateTimeFormat("es-CL", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
  }).format(date);
}

export function CommunicationsDesignPage() {
  const siteQuery = useCommunicationsSite();
  const portalQuery = useCommunicationsPortal();
  const actions = useCommunicationsSiteActions();
  const [workingData, setWorkingData] = useState<CommunicationsSiteData | null>(null);
  const [revision, setRevision] = useState<number | null>(null);
  const [isPreview, setIsPreview] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; message: string } | null>(null);
  const initialData = siteQuery.data?.draftData ?? siteQuery.data?.publishedData;

  useEffect(() => {
    if (!workingData && initialData) setWorkingData(initialData);
    if (revision === null && siteQuery.data?.draftRevision !== null && siteQuery.data?.draftRevision !== undefined) {
      setRevision(siteQuery.data.draftRevision);
    }
  }, [initialData, revision, siteQuery.data?.draftRevision, workingData]);

  const canManage = siteQuery.data?.canManage === true;
  const publishedItems = (portalQuery.data?.items ?? []).filter((item) => item.status === "published");
  const renderContext = {
    items: publishedItems,
    featured: publishedItems.find((item) => item.isFeatured) ?? publishedItems.find((item) => item.contentType !== "boletin"),
    onOpen: (_item: CommunicationItem) => undefined,
    onDownload: (item: CommunicationItem) => { void downloadCommunicationBulletin(item); },
    onQuickAccess: () => undefined
  };

  const saveDraft = async (data = workingData) => {
    if (!data || revision === null) return;
    setBusy(true);
    setFeedback(null);
    try {
      const nextRevision = await actions.saveDraft(data, revision);
      setRevision(nextRevision);
      setWorkingData(data);
      setFeedback({ kind: "success", message: "Borrador guardado. El portal publicado sigue igual hasta que lo publiques." });
    } catch (error) {
      setFeedback({ kind: "error", message: error instanceof Error ? error.message : "No fue posible guardar el borrador." });
    } finally {
      setBusy(false);
    }
  };

  const publish = async (nextData: CommunicationsSiteData) => {
    if (revision === null) return;
    setBusy(true);
    setFeedback(null);
    try {
      const nextRevision = await actions.saveDraft(nextData, revision);
      setRevision(nextRevision);
      setWorkingData(nextData);
      const version = await actions.publish(nextRevision);
      setFeedback({ kind: "success", message: `Portal publicado como versión ${version}.` });
    } catch (error) {
      setFeedback({ kind: "error", message: error instanceof Error ? error.message : "No fue posible publicar el portal." });
    } finally {
      setBusy(false);
    }
  };

  const restore = async (version: number) => {
    if (revision === null || !window.confirm(`¿Restaurar la versión ${version}? Se publicará como una versión nueva y quedará en el historial.`)) return;
    setBusy(true);
    setFeedback(null);
    try {
      const publishedVersion = await actions.restore(version, revision);
      const refreshed = await siteQuery.refetch();
      const restoredData = refreshed.data?.draftData ?? refreshed.data?.publishedData;
      if (restoredData) setWorkingData(restoredData);
      setRevision(refreshed.data?.draftRevision ?? (revision + 1));
      setFeedback({ kind: "success", message: `La versión ${version} quedó restaurada y publicada como versión ${publishedVersion}.` });
      setShowHistory(false);
      setIsPreview(false);
    } catch (error) {
      setFeedback({ kind: "error", message: error instanceof Error ? error.message : "No fue posible restaurar esta versión." });
    } finally {
      setBusy(false);
    }
  };

  if (siteQuery.isLoading || portalQuery.isLoading) {
    return <main className="communications-design-loading"><span className="communications-site-brand">jm</span><p>Cargando el editor del portal…</p></main>;
  }

  if (siteQuery.isError || portalQuery.isError) {
    return <main className="communications-design-loading"><h1>No pudimos abrir el editor</h1><p>Revisa tu conexión e inténtalo nuevamente.</p><button type="button" onClick={() => { void siteQuery.refetch(); void portalQuery.refetch(); }}>Reintentar</button></main>;
  }

  if (!canManage) {
    return <main className="communications-design-loading"><span className="communications-site-brand">jm</span><h1>Acceso restringido</h1><p>El diseño del portal solo puede editarlo el perfil Comunicador o un administrador.</p></main>;
  }

  if (!workingData || revision === null) return null;

  return (
    <CommunicationsSiteContextProvider value={renderContext}>
      <main className="communications-design-page">
        <header className="communications-design-toolbar">
          <div className="communications-design-brand"><a href="/recursos-humanos/comunicaciones" aria-label="Volver al portal">←</a><div><span>PORTAL DE COMUNICACIONES</span><h1>Diseñar portada</h1></div></div>
          <div className="communications-design-actions">
            <span className="communications-design-version">Publicado · v{siteQuery.data?.publishedVersion ?? 1}</span>
            <button type="button" className="communications-secondary-button" onClick={() => setShowHistory(true)} disabled={busy}>Historial</button>
            <button type="button" className="communications-secondary-button" onClick={() => setIsPreview((current) => !current)} disabled={busy}>{isPreview ? "Volver al editor" : "Vista previa"}</button>
            {!isPreview ? <button type="button" className="communications-secondary-button" onClick={() => void saveDraft()} disabled={busy}>{busy ? "Guardando…" : "Guardar borrador"}</button> : null}
            {isPreview ? <button type="button" className="communications-primary-button" onClick={() => void publish(workingData)} disabled={busy}>{busy ? "Publicando…" : "Publicar portal"}</button> : null}
          </div>
        </header>

        {feedback ? <div className={`communications-feedback is-${feedback.kind}`} role={feedback.kind === "error" ? "alert" : "status"}>{feedback.message}</div> : null}

        {isPreview ? (
          <div className="communications-design-preview"><CommunicationsSiteLayout data={workingData} /></div>
        ) : (
          <div className="communications-design-canvas"><Puck
            config={communicationsSiteConfig}
            data={workingData}
            iframe={{ syncHostStyles: true, waitForStyles: true }}
            headerTitle="Portada del Portal"
            viewports={viewports}
            onChange={(data) => setWorkingData(data as CommunicationsSiteData)}
            onPublish={publish}
            dictionary={{
              "header-publish": "Publicar portal",
              "header-published": "Publicado",
              "header-unpublished": "Cambios por publicar",
              "empty-placeholder": "Agrega una sección desde el panel"
            }}
          /></div>
        )}

        {showHistory ? <div className="communications-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setShowHistory(false); }}><section className="communications-history-dialog" role="dialog" aria-modal="true" aria-labelledby="communications-history-title"><header><div><span className="communications-kicker">PUBLICACIONES</span><h2 id="communications-history-title">Historial de versiones</h2></div><button type="button" className="communications-icon-button" aria-label="Cerrar historial" onClick={() => setShowHistory(false)}>×</button></header><p>Las versiones publicadas se conservan. Al restaurar, se crea una versión nueva.</p><ol>{(siteQuery.data?.versions ?? []).map((entry) => <li key={entry.version}><div><strong>Versión {entry.version}{entry.version === siteQuery.data?.publishedVersion ? " · Actual" : ""}</strong><small>{formatVersionDate(entry.publishedAt)}{entry.restoredFromVersion ? ` · Restaurada desde v${entry.restoredFromVersion}` : ""}</small></div>{entry.version !== siteQuery.data?.publishedVersion ? <button type="button" className="communications-secondary-button" onClick={() => void restore(entry.version)} disabled={busy}>Restaurar</button> : null}</li>)}</ol></section></div> : null}
      </main>
    </CommunicationsSiteContextProvider>
  );
}
