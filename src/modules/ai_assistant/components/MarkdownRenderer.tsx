import { Suspense } from "react";
import { lazyWithRetry } from "../../../shared/lib/lazyWithRetry";

type MarkdownRendererProps = {
  text: string;
  fallback?: string;
};

const MarkdownRendererContent = lazyWithRetry(
  "orion-markdown-renderer",
  async () => {
    const module = await import("./MarkdownRendererContent");
    return { default: module.MarkdownRendererContent };
  }
);

export function MarkdownRenderer({
  text,
  fallback = "Renderizando mensaje..."
}: MarkdownRendererProps) {
  return (
    <Suspense fallback={<p>{fallback}</p>}>
      <MarkdownRendererContent text={text} />
    </Suspense>
  );
}
