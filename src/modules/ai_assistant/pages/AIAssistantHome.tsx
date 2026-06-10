import { useEffect } from "react";
import { AIChatWindow } from "../components/AIChatWindow";
import { AIKnowledgePanel } from "../components/AIKnowledgePanel";
import { AIChatHistory } from "../components/AIChatHistory";
import { orionChatService } from "../services/orionChat";
import "../styles/ai-assistant.css";

export function AIAssistantHome() {
  useEffect(() => {
    orionChatService.pingEdgeFunction();
  }, []);

  return (
    <div className="dashboard-container">
      <main className="orion-layout">
        <AIChatHistory />
        <div className="orion-center">
          <AIChatWindow />
        </div>
        <AIKnowledgePanel />
      </main>
    </div>
  );
}
