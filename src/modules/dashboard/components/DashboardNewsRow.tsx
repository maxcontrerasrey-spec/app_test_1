import React, { useEffect, useState } from "react";
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

export function DashboardNewsRow() {
  const [data, setData] = useState<NewsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadNews() {
      try {
        if (!supabase) throw new Error("Supabase client not initialized");
        const { data: response, error } = await supabase.rpc('get_home_news');
        if (error) throw error;
        
        setData(response as NewsData);
      } catch (err) {
        console.error("Error cargando noticias:", err);
      } finally {
        setIsLoading(false);
      }
    }

    void loadNews();
  }, []);

  if (isLoading || !data) {
    return (
      <section className="dashboard-news-row" aria-label="Noticias globales">
        <article className="dashboard-news-card is-loading">
          <div className="dashboard-news-head">
            <span className="dashboard-info-kicker">Noticias</span>
            <strong>Cargando...</strong>
          </div>
        </article>
        <article className="dashboard-news-card is-loading">
          <div className="dashboard-news-head">
            <span className="dashboard-info-kicker">Noticias</span>
            <strong>Cargando...</strong>
          </div>
        </article>
      </section>
    );
  }

  const renderNewsCard = (title: string, items: NewsItem[], categoryPrefix: string) => {
    return (
      <article className="dashboard-news-card">
        <div className="dashboard-news-head">
          <span className="dashboard-info-kicker">Noticias</span>
          <strong>{title}</strong>
        </div>
        
        {items.length === 0 ? (
          <div className="dashboard-news-empty">No hay noticias recientes en esta categoría.</div>
        ) : (
          <div className="dashboard-news-list">
            {items.map((item, index) => (
              <a 
                key={index} 
                href={item.url} 
                target="_blank" 
                rel="noreferrer" 
                className="dashboard-news-item"
              >
                {item.imagen_url ? (
                  <img 
                    src={item.imagen_url} 
                    alt={item.fuente} 
                    className="dashboard-news-thumb" 
                    onError={(e) => {
                     (e.target as HTMLImageElement).style.display = 'none';
                     (e.target as HTMLImageElement).nextElementSibling?.classList.remove('is-hidden');
                    }} 
                  />
                ) : null}
                <div className={`dashboard-news-thumb-fallback ${item.imagen_url ? 'is-hidden' : ''}`}>
                  {categoryPrefix}
                </div>
                <div className="dashboard-news-content">
                  <h4 className="dashboard-news-title" title={item.titulo}>{item.titulo}</h4>
                  <p className="dashboard-news-summary">{item.resumen}</p>
                  <div className="dashboard-news-meta">
                    <span className="dashboard-news-source">{item.fuente}</span>
                    <span className="dashboard-news-date">
                      {new Date(item.fecha_publicacion).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })}
                    </span>
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}
        {data.ultima_actualizacion && (
          <div className="dashboard-news-footer">
            Actualizado hoy a las {new Date(data.ultima_actualizacion).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
          </div>
        )}
      </article>
    );
  };

  return (
    <section className="dashboard-news-row" aria-label="Noticias globales">
      {renderNewsCard("Minería Chile", data.mineria, "M")}
      {renderNewsCard("Economía Chile", data.economia, "E")}
    </section>
  );
}
