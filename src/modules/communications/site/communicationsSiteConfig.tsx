import { createContext, useContext, type ReactNode } from "react";
import type { Config, Data } from "@puckeditor/core";
import type { CommunicationItem } from "../services/communicationsApi";
import { CommunicationAssetImage } from "../components/CommunicationAssetImage";

export type CommunicationsTheme = "buses-jm" | "andino" | "neutro" | "oceano" | "energia";
export type CommunicationsFont = "institucional" | "sistema" | "editorial";
export type CommunicationsTypeScale = "compacta" | "estandar" | "amplia";
export type CommunicationsContentWidth = "estandar" | "amplio";
export type CommunicationsShape = "recta" | "suave" | "redondeada";
export type CommunicationsTone = "destacado" | "claro" | "oscuro";
export type CommunicationsLayout = "grilla" | "lista";
export type CommunicationsEventsLayout = "lista" | "tarjetas-2" | "tarjetas-3";

export type CommunicationsRootProps = {
  title: string;
  tagline: string;
  theme: CommunicationsTheme;
  font: CommunicationsFont;
  typeScale: CommunicationsTypeScale;
  contentWidth: CommunicationsContentWidth;
  shape: CommunicationsShape;
  footer: string;
};

type HeroProps = { eyebrow: string; title: string; summary: string; tone: CommunicationsTone };
type FeaturedProps = { title: string; description: string };
type NewsProps = { title: string; description: string; limit: number; layout: CommunicationsLayout };
type EventsProps = { title: string; description: string; limit: number; layout: CommunicationsEventsLayout };
type BulletinsProps = { title: string; description: string; limit: number };
type MessageProps = { title: string; message: string; tone: CommunicationsTone };
type DividerProps = { label: string };

type CommunicationsComponents = {
  HeroSection: HeroProps;
  FeaturedSection: FeaturedProps;
  NewsSection: NewsProps;
  EventsSection: EventsProps;
  BulletinsSection: BulletinsProps;
  MessageSection: MessageProps;
  DividerSection: DividerProps;
};

export type CommunicationsSiteData = Data<CommunicationsComponents, CommunicationsRootProps>;

export type CommunicationsSiteRenderContext = {
  items: CommunicationItem[];
  featured: CommunicationItem | undefined;
  onOpen: (item: CommunicationItem) => void;
  onDownload: (item: CommunicationItem) => void;
};

const CommunicationsSiteContext = createContext<CommunicationsSiteRenderContext>({
  items: [],
  featured: undefined,
  onOpen: () => undefined,
  onDownload: () => undefined
});

export function CommunicationsSiteContextProvider({
  value,
  children
}: {
  value: CommunicationsSiteRenderContext;
  children: ReactNode;
}) {
  return <CommunicationsSiteContext.Provider value={value}>{children}</CommunicationsSiteContext.Provider>;
}

function useSiteContent() {
  return useContext(CommunicationsSiteContext);
}

function formatDate(value: string | null, includeTime = false) {
  if (!value) return "Fecha por confirmar";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Fecha por confirmar";
  return new Intl.DateTimeFormat("es-CL", {
    day: "numeric", month: "long", year: "numeric",
    ...(includeTime ? { hour: "2-digit", minute: "2-digit" } : {})
  }).format(date);
}

const kindLabels = { noticia: "Noticia", comunicado: "Comunicado", evento: "Evento", boletin: "Boletín" } as const;
const categoryLabels: Record<string, string> = { empresa: "Empresa", beneficios: "Beneficios", personas: "Personas", cultura: "Cultura", general: "General", operaciones: "Operaciones", seguridad: "Seguridad", reconocimientos: "Reconocimientos", contratos: "Contratos", equipos: "Equipos", actividades: "Actividades", campanas: "Campañas", aniversarios: "Aniversarios", hitos: "Hitos", procedimientos: "Procedimientos", instrucciones: "Instrucciones" };

function PublicationCard({ item, layout = "grilla" }: { item: CommunicationItem; layout?: CommunicationsLayout }) {
  const { onOpen } = useSiteContent();
  return (
    <article className={`communications-item communications-item-${item.contentType} communications-layout-${layout}`}>
      {item.coverAssetId ? <CommunicationAssetImage assetId={item.coverAssetId} alt={item.title} className="communications-news-card-image" /> : null}
      <div className="communications-item-topline"><span className={`communications-type communications-type-${item.contentType}`}>{kindLabels[item.contentType]}</span><span>{categoryLabels[item.category] ?? item.category}</span>{item.requiresAcknowledgement ? <span className="communications-required-tag">Lectura requerida</span> : null}</div>
      <button className="communications-item-title" type="button" onClick={() => onOpen(item)}>{item.title}</button>
      <p>{item.summary}</p>
      <div className="communications-item-footer"><span>{formatDate(item.contentType === "evento" ? item.startsAt : item.publishAt ?? item.publishedAt, item.contentType === "evento")}</span><button className="communications-text-link" type="button" onClick={() => onOpen(item)}>Leer más <span aria-hidden="true">→</span></button></div>
    </article>
  );
}

function HeroSectionView({ eyebrow, title, summary, tone }: HeroProps) {
  const { featured, onOpen } = useSiteContent();
  return (
    <section className={`communications-site-hero tone-${tone}`}>
      <div className="communications-site-hero-copy"><span className="communications-kicker">{eyebrow}</span><h1>{title}</h1><p>{summary}</p>{featured ? <button className="communications-primary-button" type="button" onClick={() => onOpen(featured)}>Leer lo destacado <span aria-hidden="true">→</span></button> : null}</div>
      <div className="communications-site-hero-art" aria-hidden="true"><span className="communications-site-orbit" /><span className="communications-site-monogram">JM</span><span className="communications-site-art-label">EN COMUNIDAD</span></div>
    </section>
  );
}

function FeaturedSectionView({ title, description }: FeaturedProps) {
  const { featured, onOpen } = useSiteContent();
  return <section className="communications-feature-section" aria-label="Publicación destacada"><header className="communications-site-section-heading"><div><span className="communications-kicker">DESTACADO</span><h2>{title}</h2><p>{description}</p></div></header>{featured ? <button className="communications-feature-story" type="button" onClick={() => onOpen(featured)}><CommunicationAssetImage assetId={featured.coverAssetId} alt={featured.title} className="communications-feature-story-image" /><span className="communications-feature-story-copy"><small>{categoryLabels[featured.category] ?? featured.category} · {formatDate(featured.publishAt ?? featured.publishedAt)}</small><strong>{featured.title}</strong><span>{featured.summary}</span><em>Leer publicación <b aria-hidden="true">→</b></em></span></button> : <p className="communications-site-empty">La próxima historia destacada aparecerá aquí.</p>}</section>;
}

function NewsSectionView({ title, description, limit, layout }: NewsProps) {
  const { items } = useSiteContent();
  const news = items.filter((item) => item.contentType !== "boletin" && item.contentType !== "evento").slice(0, limit);
  return (
    <section className="communications-site-section">
      <header className="communications-site-section-heading"><div><span className="communications-kicker">ACTUALIDAD</span><h2>{title}</h2><p>{description}</p></div></header>
      {news.length ? <div className={`communications-site-news is-${layout}`}>{news.map((item) => <PublicationCard key={item.id} item={item} layout={layout} />)}</div> : <p className="communications-site-empty">Las noticias y comunicados publicados aparecerán aquí.</p>}
    </section>
  );
}

function EventsSectionView({ title, description, limit, layout = "lista" }: EventsProps) {
  const { items, onOpen } = useSiteContent();
  const events = items.filter((item) => item.contentType === "evento" && item.startsAt && new Date(item.startsAt).getTime() >= Date.now())
    .sort((left, right) => new Date(left.startsAt || 0).getTime() - new Date(right.startsAt || 0).getTime()).slice(0, limit);
  return (
    <section className={`communications-site-section communications-site-events is-${layout}`}>
      <header className="communications-site-section-heading"><div><span className="communications-kicker">ENCUENTROS</span><h2>{title}</h2><p>{description}</p></div></header>
      {events.length ? <div className={`communications-site-event-list is-${layout}`}>{events.map((event) => <button type="button" className="communications-site-event" key={event.id} onClick={() => onOpen(event)}><span className="communications-site-event-date">{event.startsAt ? new Intl.DateTimeFormat("es-CL", { day: "2-digit", month: "short" }).format(new Date(event.startsAt)) : "—"}</span><span><strong>{event.title}</strong><small>{formatDate(event.startsAt, true)}</small></span><span aria-hidden="true">→</span></button>)}</div> : <p className="communications-site-empty">Cuando haya actividades publicadas, las verás aquí.</p>}
    </section>
  );
}

function BulletinsSectionView({ title, description, limit }: BulletinsProps) {
  const { items, onDownload } = useSiteContent();
  const bulletins = items.filter((item) => item.contentType === "boletin" && item.hasPdf).slice(0, limit);
  return (
    <section className="communications-site-section communications-site-bulletins">
      <header className="communications-site-section-heading"><div><span className="communications-kicker">EDICIONES</span><h2>{title}</h2><p>{description}</p></div></header>
      {bulletins.length ? <div className="communications-site-bulletin-list">{bulletins.map((item) => <article className="communications-site-bulletin" key={item.id}><div><strong>{item.title}</strong><small>{formatDate(item.publishedAt)} · PDF</small></div><button type="button" aria-label={`Descargar ${item.title}`} onClick={() => onDownload(item)}>Descargar <span aria-hidden="true">↓</span></button></article>)}</div> : <p className="communications-site-empty">Aún no hay boletines publicados.</p>}
    </section>
  );
}

function MessageSectionView({ title, message, tone }: MessageProps) {
  return <section className={`communications-site-message tone-${tone}`}><span className="communications-kicker">MENSAJE</span><h2>{title}</h2><p>{message}</p></section>;
}

function DividerSectionView({ label }: DividerProps) {
  return <div className="communications-site-divider"><span>{label || " "}</span></div>;
}

const selectOptions = (values: Array<[string, string]>) => values.map(([value, label]) => ({ value, label }));

export const communicationsSiteConfig: Config<CommunicationsComponents, CommunicationsRootProps> = {
  root: {
    label: "Identidad y estilo",
    fields: {
      title: { type: "text", label: "Nombre del portal" },
      tagline: { type: "textarea", label: "Frase de bienvenida" },
      theme: { type: "select", label: "Paleta de colores", options: selectOptions([["buses-jm", "Buses JM"], ["andino", "Andino"], ["neutro", "Neutro"], ["oceano", "Océano"], ["energia", "Energía"]]) },
      font: { type: "select", label: "Tipografía", options: selectOptions([["institucional", "Moderna · Inter"], ["sistema", "Sistema"], ["editorial", "Editorial · serif"]]) },
      typeScale: { type: "select", label: "Tamaño de textos", options: selectOptions([["compacta", "Compacto"], ["estandar", "Estándar"], ["amplia", "Amplio"]]) },
      contentWidth: { type: "select", label: "Ancho del contenido", options: selectOptions([["estandar", "Estándar"], ["amplio", "Amplio"]]) },
      shape: { type: "select", label: "Forma de tarjetas", options: selectOptions([["recta", "Recta"], ["suave", "Suave"], ["redondeada", "Redondeada"]]) },
      footer: { type: "text", label: "Texto al pie" }
    },
    defaultProps: { title: "Comunicaciones", tagline: "Un espacio para informarnos, compartir y crecer juntos.", theme: "buses-jm", font: "institucional", typeScale: "estandar", contentWidth: "estandar", shape: "suave", footer: "Portal interno · Buses JM" },
    render: ({ children, title, tagline, theme, font, typeScale, contentWidth, shape, footer }) => <div className={siteLayoutClass({ theme, font, typeScale, contentWidth, shape })}><header className="communications-site-masthead"><span className="communications-site-brand">jm</span><div><strong>{title}</strong><small>{tagline}</small></div></header><main>{children}</main><footer className="communications-site-footer"><span>{title}</span><span>{footer}</span></footer></div>
  },
  categories: {
    contenido: { title: "Secciones", components: ["FeaturedSection", "HeroSection", "NewsSection", "EventsSection", "BulletinsSection", "MessageSection", "DividerSection"] }
  },
  components: {
    FeaturedSection: {
      label: "Historia destacada",
      fields: { title: { type: "text", label: "Título de sección" }, description: { type: "textarea", label: "Descripción" } },
      defaultProps: { title: "La historia de esta semana", description: "Personas, equipos e ideas que mueven a Buses JM." },
      render: (props) => <FeaturedSectionView {...props} />
    },
    HeroSection: {
      label: "Portada destacada",
      fields: {
        eyebrow: { type: "text", label: "Etiqueta pequeña" },
        title: { type: "text", label: "Título principal" },
        summary: { type: "textarea", label: "Texto de portada" },
        tone: { type: "select", label: "Estilo", options: selectOptions([["destacado", "Destacado"], ["claro", "Claro"], ["oscuro", "Oscuro"]]) }
      },
      defaultProps: { eyebrow: "PORTAL CORPORATIVO", title: "Comunicaciones Buses JM", summary: "Noticias, historias y novedades de nuestros equipos.", tone: "destacado" },
      render: (props) => <HeroSectionView {...props} />
    },
    NewsSection: {
      label: "Noticias y comunicados",
      fields: {
        title: { type: "text", label: "Título de sección" },
        description: { type: "textarea", label: "Descripción" },
        limit: { type: "number", label: "Cantidad de publicaciones", min: 1, max: 12 },
        layout: { type: "select", label: "Presentación", options: selectOptions([["grilla", "Grilla"], ["lista", "Lista"]]) }
      },
      defaultProps: { title: "Lo que está pasando", description: "Noticias y comunicados de nuestra comunidad.", limit: 6, layout: "grilla" },
      render: (props) => <NewsSectionView {...props} />
    },
    EventsSection: {
      label: "Agenda de eventos",
      fields: {
        title: { type: "text", label: "Título de sección" },
        description: { type: "textarea", label: "Descripción" },
        limit: { type: "number", label: "Cantidad de eventos", min: 1, max: 12 },
        layout: { type: "select", label: "Presentación", options: selectOptions([["lista", "Lista horizontal"], ["tarjetas-2", "Tarjetas · 2 columnas"], ["tarjetas-3", "Tarjetas · 3 columnas"]]) }
      },
      defaultProps: { title: "Próximas actividades", description: "Encuentros y actividades para nuestra comunidad.", limit: 3, layout: "lista" },
      render: (props) => <EventsSectionView {...props} />
    },
    BulletinsSection: {
      label: "Archivo de boletines",
      fields: {
        title: { type: "text", label: "Título de sección" },
        description: { type: "textarea", label: "Descripción" },
        limit: { type: "number", label: "Cantidad de ediciones", min: 1, max: 12 }
      },
      defaultProps: { title: "Nuestros boletines", description: "Lee y descarga las últimas ediciones.", limit: 4 },
      render: (props) => <BulletinsSectionView {...props} />
    },
    MessageSection: {
      label: "Texto e información",
      fields: {
        title: { type: "text", label: "Título" },
        message: { type: "textarea", label: "Texto" },
        tone: { type: "select", label: "Estilo", options: selectOptions([["destacado", "Destacado"], ["claro", "Claro"], ["oscuro", "Oscuro"]]) }
      },
      defaultProps: { title: "Un mensaje para todos", message: "Escribe aquí información relevante para nuestros equipos.", tone: "claro" },
      render: (props) => <MessageSectionView {...props} />
    },
    DividerSection: {
      label: "Separador de sección",
      fields: { label: { type: "text", label: "Texto del separador" } },
      defaultProps: { label: "" },
      render: (props) => <DividerSectionView {...props} />
    }
  }
};

export const DEFAULT_COMMUNICATIONS_SITE: CommunicationsSiteData = {
  root: { props: { title: "Comunicaciones", tagline: "Un espacio para informarnos, compartir y crecer juntos.", theme: "buses-jm", font: "institucional", typeScale: "estandar", contentWidth: "estandar", shape: "suave", footer: "Portal interno · Buses JM" } },
  content: [
    { type: "FeaturedSection", props: { id: "destacada-inicial", title: "Una mirada a nuestra semana", description: "Novedades y buenas historias de nuestros equipos." } },
    { type: "NewsSection", props: { id: "noticias-inicial", title: "Últimas publicaciones", description: "Lo nuevo en Buses JM.", limit: 3, layout: "grilla" } },
    { type: "EventsSection", props: { id: "agenda-inicial", title: "Próximas actividades", description: "Encuentros y actividades para nuestra comunidad.", limit: 3, layout: "lista" } },
    { type: "BulletinsSection", props: { id: "boletines-inicial", title: "Boletines", description: "Lee y descarga las últimas ediciones.", limit: 4 } }
  ],
  zones: {}
};

function safeRootProps(data: CommunicationsSiteData): CommunicationsRootProps {
  return { ...communicationsSiteConfig.root!.defaultProps!, ...data.root?.props } as CommunicationsRootProps;
}

function siteLayoutClass(root: Pick<CommunicationsRootProps, "theme" | "font" | "typeScale" | "contentWidth" | "shape">) {
  const themes: CommunicationsTheme[] = ["buses-jm", "andino", "neutro", "oceano", "energia"];
  const fonts: CommunicationsFont[] = ["institucional", "sistema", "editorial"];
  const scales: CommunicationsTypeScale[] = ["compacta", "estandar", "amplia"];
  const widths: CommunicationsContentWidth[] = ["estandar", "amplio"];
  const shapes: CommunicationsShape[] = ["recta", "suave", "redondeada"];
  return ["communications-site-layout", `theme-${themes.includes(root.theme) ? root.theme : "buses-jm"}`, `font-${fonts.includes(root.font) ? root.font : "institucional"}`, `type-scale-${scales.includes(root.typeScale) ? root.typeScale : "estandar"}`, `content-width-${widths.includes(root.contentWidth) ? root.contentWidth : "estandar"}`, `shape-${shapes.includes(root.shape) ? root.shape : "suave"}`].join(" ");
}

function renderLayoutBlock(block: { type: string; props: Record<string, unknown> }, key: string) {
  const p = block.props;
  switch (block.type) {
    case "FeaturedSection": return <FeaturedSectionView key={key} title={String(p.title ?? "")} description={String(p.description ?? "")} />;
    case "HeroSection": return <HeroSectionView key={key} eyebrow={String(p.eyebrow ?? "")} title={String(p.title ?? "")} summary={String(p.summary ?? "")} tone={(p.tone as CommunicationsTone) ?? "destacado"} />;
    case "NewsSection": return <NewsSectionView key={key} title={String(p.title ?? "")} description={String(p.description ?? "")} limit={Number(p.limit ?? 6)} layout={(p.layout as CommunicationsLayout) ?? "grilla"} />;
    case "EventsSection": return <EventsSectionView key={key} title={String(p.title ?? "")} description={String(p.description ?? "")} limit={Number(p.limit ?? 3)} layout={(p.layout as CommunicationsEventsLayout) ?? "lista"} />;
    case "BulletinsSection": return <BulletinsSectionView key={key} title={String(p.title ?? "")} description={String(p.description ?? "")} limit={Number(p.limit ?? 4)} />;
    case "MessageSection": return <MessageSectionView key={key} title={String(p.title ?? "")} message={String(p.message ?? "")} tone={(p.tone as CommunicationsTone) ?? "claro"} />;
    case "DividerSection": return <DividerSectionView key={key} label={String(p.label ?? "")} />;
    default: return null;
  }
}

export function CommunicationsSiteLayout({ data }: { data: CommunicationsSiteData }) {
  const root = safeRootProps(data);
  return <div className={siteLayoutClass(root)}><header className="communications-site-masthead"><span className="communications-site-brand">jm</span><div><strong>{root.title}</strong><small>{root.tagline}</small></div></header><main>{data.content?.map((block, index) => renderLayoutBlock(block as { type: string; props: Record<string, unknown> }, String(block.props.id ?? index)))}</main><footer className="communications-site-footer"><span>{root.title}</span><span>{root.footer}</span></footer></div>;
}
