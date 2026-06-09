import { AIChatWindow } from "../components/AIChatWindow";
import { AIKnowledgePanel } from "../components/AIKnowledgePanel";
import { AIChatHistory } from "../components/AIChatHistory";
import "../styles/ai-assistant.css";

export function AIAssistantHome() {
  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <div className="dashboard-greeting">
          <h2>Copiloto IA</h2>
          <p className="helper-copy">Consulta a ORION, tu asistente entrenado con los procesos de Buses JM.</p>
        </div>
      </header>

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
