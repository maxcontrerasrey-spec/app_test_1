import React, { useEffect, useState } from "react";
import { logger } from "../../../shared/lib/logger";
import { supabase } from "../../../shared/lib/supabase";

type NewsItem = {
  titulo: string;
  resumen: string;
  fuente: string;
  url: string;
  imagen_url: string;
  fecha_publicacion: string;
};

type NewsData = {
  mineria: NewsItem[];
  economia: NewsItem[];
  ultima_actualizacion: string | null;
};

export function DashboardNewsWidget() {
  const [data, setData] = useState<NewsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [economiaIndex, setEconomiaIndex] = useState(0);
  const [mineriaIndex, setMineriaIndex] = useState(0);

  useEffect(() => {
    async function loadNews() {
      try {
        if (!supabase) throw new Error("Supabase client not initialized");
        const { data: response, error } = await supabase.rpc('get_home_news');
        if (error) throw error;
        
        setData(response as NewsData);
      } catch (err) {
        logger.error("DashboardNewsWidget loadNews", err);
      } finally {
        setIsLoading(false);
      }
    }

    void loadNews();
  }, []);

  // Rotación automática cada 12 segundos
  useEffect(() => {
    if (!data) return;

    const timer = window.setInterval(() => {
      if (data.economia.length > 1) {
        setEconomiaIndex((current) => (current + 1) % data.economia.length);
      }
      if (data.mineria.length > 1) {
        setMineriaIndex((current) => (current + 1) % data.mineria.length);
      }
    }, 12000);

    return () => window.clearInterval(timer);
  }, [data]);

  if (isLoading || !data) {
    return (
      <div className="dashboard-news-widget" aria-label="Noticias globales">
        <article className="dashboard-news-capsule is-loading">
          <strong>Cargando...</strong>
        </article>
        <article className="dashboard-news-capsule is-loading">
          <strong>Cargando...</strong>
        </article>
      </div>
    );
  }

  const moveIndex = (
    category: "economia" | "mineria", 
    direction: "prev" | "next", 
    e: React.MouseEvent
  ) => {
    e.preventDefault();
    e.stopPropagation();

    if (category === "economia") {
      setEconomiaIndex((current) => {
        if (direction === "prev") {
          return current === 0 ? data.economia.length - 1 : current - 1;
        }
        return (current + 1) % data.economia.length;
      });
    } else {
      setMineriaIndex((current) => {
        if (direction === "prev") {
          return current === 0 ? data.mineria.length - 1 : current - 1;
        }
        return (current + 1) % data.mineria.length;
      });
    }
  };

  const renderCapsule = (
    categoryLabel: string, 
    items: NewsItem[], 
    currentIndex: number, 
    categoryKey: "economia" | "mineria"
  ) => {
    if (items.length === 0) {
      return (
        <article className="dashboard-news-capsule">
          <div className="dashboard-news-empty">No hay noticias de {categoryLabel}</div>
        </article>
      );
    }
    
    const item = items[currentIndex];
    const categoryPrefix = categoryLabel.charAt(0);

    return (
      <a 
        href={item.url} 
        target="_blank" 
        rel="noreferrer" 
        className="dashboard-news-capsule"
      >
        {item.imagen_url ? (
          <img 
            src={item.imagen_url} 
            alt={item.fuente} 
            className="dashboard-news-capsule-thumb" 
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
              (e.target as HTMLImageElement).nextElementSibling?.classList.remove('is-hidden');
            }} 
          />
        ) : null}
        <div className={`dashboard-news-capsule-fallback ${item.imagen_url ? 'is-hidden' : ''}`}>
          {categoryPrefix}
        </div>
        <div className="dashboard-news-capsule-content">
          <div className="dashboard-news-capsule-meta">
            {categoryLabel} · {item.fuente}
          </div>
          <h4 className="dashboard-news-capsule-title" title={item.titulo}>{item.titulo}</h4>
          <p className="dashboard-news-capsule-summary">{item.resumen}</p>
        </div>

        {items.length > 1 && (
          <div className="dashboard-news-capsule-controls" aria-label="Navegación de noticias">
            <button
              type="button"
              className="dashboard-news-capsule-control"
              onClick={(e) => moveIndex(categoryKey, "prev", e)}
              aria-label="Noticia anterior"
            >
              ‹
            </button>
            <button
              type="button"
              className="dashboard-news-capsule-control"
              onClick={(e) => moveIndex(categoryKey, "next", e)}
              aria-label="Siguiente noticia"
            >
              ›
            </button>
          </div>
        )}
      </a>
    );
  };

  return (
    <div className="dashboard-news-widget" aria-label="Noticias globales">
      {renderCapsule("Economía", data.economia, economiaIndex, "economia")}
      {renderCapsule("Minería", data.mineria, mineriaIndex, "mineria")}
    </div>
  );
}
