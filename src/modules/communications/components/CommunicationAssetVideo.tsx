import { useEffect, useState } from "react";
import { fetchCommunicationAssetUrl } from "../services/communicationsApi";

export function CommunicationAssetVideo({ assetId, label }: { assetId: string; label: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    void fetchCommunicationAssetUrl(assetId).then((value) => { objectUrl = value; if (active) setUrl(value); else URL.revokeObjectURL(value); }).catch(() => { if (active) setUrl(null); });
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [assetId]);
  return url ? <video className="communications-reading-video" controls preload="metadata" aria-label={label} src={url} /> : <p className="communications-side-empty">El video no está disponible.</p>;
}
