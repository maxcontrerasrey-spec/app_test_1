import { logger } from "../../../shared/lib/logger";
import { supabase } from "../../../shared/lib/supabase";

export type OrionKnowledgeDocument = {
  id: string;
  storagePath: string;
  name: string;
  type: "pdf" | "docx";
  sizeLabel: string;
  status: string;
};

function formatFileSize(sizeInBytes: number | null | undefined) {
  const safeSize = typeof sizeInBytes === "number" && Number.isFinite(sizeInBytes) ? sizeInBytes : 0;
  return `${(safeSize / 1024 / 1024).toFixed(1)} MB`;
}

function resolveDocumentType(fileName: string): OrionKnowledgeDocument["type"] {
  return fileName.toLowerCase().endsWith(".pdf") ? "pdf" : "docx";
}

function buildDocumentView(storagePath: string, sizeInBytes?: number | null): OrionKnowledgeDocument {
  const baseName = storagePath.split("/").pop() ?? storagePath;

  return {
    id: storagePath,
    storagePath,
    name: baseName.replace(/^\d+_/, ""),
    type: resolveDocumentType(baseName),
    sizeLabel: formatFileSize(sizeInBytes),
    status: "Procesado"
  };
}

export const orionKnowledgeService = {
  async listDocuments() {
    if (!supabase) {
      return [];
    }

    const { data: rootData, error: rootError } = await supabase.storage.from("orion_knowledge").list("", {
      sortBy: { column: "created_at", order: "desc" }
    });

    if (rootError) {
      logger.error("ORION listDocuments root", rootError);
      return [];
    }

    const { data: knowledgeData, error: knowledgeError } = await supabase.storage.from("orion_knowledge").list("knowledge", {
      sortBy: { column: "created_at", order: "desc" }
    });

    if (knowledgeError) {
      logger.error("ORION listDocuments knowledge", knowledgeError);
    }

    const rootFiles = (rootData ?? [])
      .filter((file) => file.name !== ".emptyFolderPlaceholder")
      .filter((file) => file.name !== "knowledge" && !file.name.includes("/"))
      .map((file) => buildDocumentView(file.name, file.metadata?.size));

    const knowledgeFiles = (knowledgeData ?? [])
      .filter((file) => file.name !== ".emptyFolderPlaceholder")
      .map((file) => buildDocumentView(`knowledge/${file.name}`, file.metadata?.size));

    return [...knowledgeFiles, ...rootFiles];
  },

  async uploadDocument(file: File) {
    if (!supabase) {
      throw new Error("Supabase no está configurado.");
    }

    const storagePath = `knowledge/${Date.now()}_${file.name}`;
    const { data, error } = await supabase.storage
      .from("orion_knowledge")
      .upload(storagePath, file);

    if (error || !data) {
      throw new Error(error?.message || "No fue posible subir el documento.");
    }

    return buildDocumentView(data.path, file.size);
  },

  async processDocument(storagePath: string) {
    if (!supabase) {
      throw new Error("Supabase no está configurado.");
    }

    const { data, error } = await supabase.functions.invoke("orion-document-processor", {
      body: { filePath: storagePath }
    });

    if (error) {
      throw new Error(error.message || "Falló el procesamiento del documento.");
    }

    if (data?.error) {
      throw new Error(data.error);
    }
  },

  async deleteDocument(storagePath: string) {
    if (!supabase) {
      throw new Error("Supabase no está configurado.");
    }

    const { error: storageError } = await supabase.storage.from("orion_knowledge").remove([storagePath]);
    if (storageError) {
      throw new Error(storageError.message || "No fue posible eliminar el archivo en Storage.");
    }

    const { error: knowledgeError } = await supabase
      .from("orion_knowledge_base")
      .delete()
      .eq("document_name", storagePath);

    if (knowledgeError) {
      logger.error("ORION deleteDocument knowledge_base", knowledgeError);
      throw new Error(knowledgeError.message || "No fue posible eliminar el documento vectorizado.");
    }
  }
};
