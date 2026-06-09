import { AIChatWindow } from "../components/AIChatWindow";
import { AIKnowledgePanel } from "../components/AIKnowledgePanel";
import { AIChatHistory } from "../components/AIChatHistory";
import "../styles/ai-assistant.css";

export function AIAssistantHome() {
  return (
    <div className="dashboard-container" style={{ padding: 0 }}>
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
