import { useState, useRef, useEffect } from "react";

type Message = {
  id: string;
  text: string;
  sender: "user" | "ai";
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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

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

    // Mock response delay
    setTimeout(() => {
      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        text: "Esta es una respuesta simulada de ORION. En el futuro, aquí es donde Llama 3 procesará tu consulta utilizando los documentos de la base de datos.",
        sender: "ai",
      };
      setMessages((prev) => [...prev, aiMsg]);
      setIsTyping(false);
    }, 1500);
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
        <div className="orion-header-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z"/>
            <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z"/>
          </svg>
        </div>
        <div className="orion-header-text">
          <h2>ORION</h2>
          <p>Cerebro Llama 3 · Listo para ayudarte</p>
        </div>
      </header>

      <div className="orion-chat-area">
        {messages.map((msg) => (
          <div key={msg.id} className={`orion-message ${msg.sender}`}>
            <div className="orion-message-avatar">
              {msg.sender === "user" ? "Tú" : "O"}
            </div>
            <div className="orion-message-content">
              {msg.text}
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="orion-message ai">
            <div className="orion-message-avatar">O</div>
            <div className="orion-message-content">
              <div className="orion-typing">
                <span className="orion-typing-dot"></span>
                <span className="orion-typing-dot"></span>
                <span className="orion-typing-dot"></span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="orion-input-area">
        <div className="orion-input-wrapper">
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
