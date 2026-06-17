import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type MarkdownRendererContentProps = {
  text: string;
};

export function MarkdownRendererContent({ text }: MarkdownRendererContentProps) {
  return <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>;
}
