import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { TemplateManagerPage } from "../../pages/TemplateManagerPage";
import { TemplateBuilderPage } from "../../pages/TemplateBuilderPage";

export function TemplatesTab() {
  const [searchParams] = useSearchParams();
  const templateId = searchParams.get("id");

  return (
    <div className="tab-container">
      {templateId ? <TemplateBuilderPage /> : <TemplateManagerPage />}
    </div>
  );
}
