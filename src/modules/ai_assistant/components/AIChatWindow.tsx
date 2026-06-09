import { useState, useRef, useEffect } from "react";
import orionLogo from "../../../assets/orion-logo.png";

type Message = {
  id: string;
  text: string;
  sender: "user" | "ai";
};

type AgentStep = {
  id: string;
  text: string;
  status: "pending" | "loading" | "done";
};

export function AIChatWindow() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      text: "Hola, soy ORION, el asistente de inteligencia artificial de Buses JM. He leído todos nuestros manuales y protocolos. ¿En qué te puedo ayudar hoy?",
      sender: "ai",
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [agentSteps, setAgentSteps] = useState<AgentStep[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping, agentSteps]);

  const handleSend = () => {
    if (!inputValue.trim()) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      text: inputValue,
      sender: "user",
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputValue("");
    setIsTyping(true);

    // Mock Agentic Thinking Sequence
    const steps: AgentStep[] = [
      { id: "s1", text: "Analizando intención del usuario...", status: "pending" },
      { id: "s2", text: "Buscando en Base de Conocimiento (Supabase)...", status: "pending" },
      { id: "s3", text: "Procesando vectores con pgvector...", status: "pending" },
      { id: "s4", text: "Generando respuesta con Llama 3...", status: "pending" }
    ];
    
    setAgentSteps(steps);

    // Step 1
    setTimeout(() => {
      setAgentSteps(prev => prev.map((s, i) => i === 0 ? { ...s, status: "loading" } : s));
    }, 300);

    // Step 2
    setTimeout(() => {
      setAgentSteps(prev => prev.map((s, i) => i === 0 ? { ...s, status: "done" } : i === 1 ? { ...s, status: "loading" } : s));
    }, 1200);

    // Step 3
    setTimeout(() => {
      setAgentSteps(prev => prev.map((s, i) => i === 1 ? { ...s, status: "done" } : i === 2 ? { ...s, status: "loading" } : s));
    }, 2400);

    // Step 4
    setTimeout(() => {
      setAgentSteps(prev => prev.map((s, i) => i === 2 ? { ...s, status: "done" } : i === 3 ? { ...s, status: "loading" } : s));
    }, 3200);

    // Final Response
    setTimeout(() => {
      setAgentSteps([]); // Clear steps
      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        text: "Esta es una respuesta simulada de ORION, generada tras analizar los documentos. En la Fase 2, aquí es donde conectaremos la IA real.",
        sender: "ai",
      };
      setMessages((prev) => [...prev, aiMsg]);
      setIsTyping(false);
    }, 4500);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="orion-main">
      <header className="orion-header">
        <div className="orion-header-text">
          <h2>ORION</h2>
          <p>Cerebro Llama 3 · Listo para ayudarte</p>
        </div>
      </header>

      <div className="orion-chat-area">
        {messages.map((msg) => (
          <div key={msg.id} className={`orion-message ${msg.sender}`}>
            <div className="orion-message-content">
              {msg.text}
            </div>
          </div>
        ))}
        
        {/* Agentic Thinking UI */}
        {isTyping && (
          <div className="orion-agent-steps">
            {agentSteps.map((step) => {
              if (step.status === "pending") return null;
              return (
                <div key={step.id} className={`orion-agent-step ${step.status}`}>
                  <div className="orion-step-icon">
                    {step.status === "loading" ? (
                      <div className="orion-spinner"></div>
                    ) : (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                    )}
                  </div>
                  <span className="orion-step-text">{step.text}</span>
                </div>
              );
            })}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="orion-input-area">
        <div className="orion-input-wrapper">
          <button className="orion-attach-btn" aria-label="Adjuntar documento para esta sesión" title="Adjuntar archivo temporal">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
            </svg>
          </button>
          <textarea
            className="orion-input"
            placeholder="Pregúntale a ORION sobre procedimientos, manuales o dudas operativas..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
          />
          <button 
            className="orion-send-btn" 
            onClick={handleSend}
            disabled={!inputValue.trim() || isTyping}
            aria-label="Enviar mensaje"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"></line>
              <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
