import { useEffect, useState } from "react";
import { fetchCommunicationAssetUrl } from "../services/communicationsApi";

export function CommunicationAssetImage({ assetId, alt, className }: { assetId: string | null; alt: string; className?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!assetId) { setUrl(null); return; }
    let active = true;
    let objectUrl: string | null = null;
    void fetchCommunicationAssetUrl(assetId).then((value) => {
      objectUrl = value;
      if (active) setUrl(value);
      else URL.revokeObjectURL(value);
    }).catch(() => { if (active) setUrl(null); });
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [assetId]);
  return url ? <img className={className} src={url} alt={alt} loading="lazy" /> : <div className={`${className ?? ""} communications-image-placeholder`} role="img" aria-label={alt}><span>BUSES JM</span></div>;
}
