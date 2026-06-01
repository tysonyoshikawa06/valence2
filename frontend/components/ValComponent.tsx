"use client";

import { useState, useRef, useEffect } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ValComponentProps {
  nodeLabel: string;
  nodeId: string;
}

export default function ValComponent({ nodeLabel, nodeId }: ValComponentProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [curiosityNotification, setCuriosityNotification] = useState<string | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const API_URL = process.env.NEXT_PUBLIC_API_URL;

  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  };

  const didMountRef = useRef(false);
  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (!loadingHistory) scrollToBottom();
  }, [loadingHistory]);

  const loadChatHistory = async () => {
    const token = localStorage.getItem("token");
    if (!token) { setLoadingHistory(false); return; }

    try {
      const response = await fetch(`${API_URL}/api/chat-history/${nodeId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        if (data.messages?.length > 0) setMessages(data.messages);
      }
    } catch (error) {
      console.error("Error loading chat history:", error);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    loadChatHistory();
  }, [nodeId]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage: Message = { role: "user", content: input };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const messagesToSend = newMessages.slice(-15);
      const token = localStorage.getItem("token");

      const response = await fetch(`${API_URL}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ messages: messagesToSend, node_id: nodeId }),
      });

      if (!response.ok) throw new Error("Failed to get response");

      const data = await response.json();

      setMessages((prev) => [...prev, { role: "assistant", content: data.message }].slice(-15));

      if (data.curiosity_increased) {
        setCuriosityNotification("Good question!");
        setTimeout(() => setCuriosityNotification(null), 4000);

        window.dispatchEvent(
          new CustomEvent("curiosityUpdate", {
            detail: { newScore: data.new_curiosity_score, isCompleted: data.is_completed },
          })
        );
      }
    } catch (error) {
      console.error("Chat error:", error);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, I encountered an error. Please try again." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (loadingHistory) {
    return (
      <div className="flex flex-col h-[28rem] items-center justify-center">
        <div className="w-5 h-5 border-2 border-[#93a0ba] border-t-[#001554] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[28rem] relative">
      {/* Curiosity notification */}
      {curiosityNotification && (
        <div className="absolute top-2 left-2 right-2 z-10 bg-[#001554] text-white text-xs rounded-lg px-3 py-2 shadow-lg">
          ✦ {curiosityNotification}
        </div>
      )}

      {/* Messages */}
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <p className="text-[#93a0ba] text-sm">Ask me anything about {nodeLabel}</p>
            <p className="text-[#93a0ba]/60 text-xs mt-1">Curious questions unlock new topics</p>
          </div>
        ) : (
          messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-[#001554] text-white rounded-br-sm"
                    : "bg-[#edf9fe] text-[#001554] rounded-bl-sm"
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))
        )}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-[#edf9fe] rounded-2xl rounded-bl-sm px-4 py-3">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-[#93a0ba] rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1.5 h-1.5 bg-[#93a0ba] rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-1.5 h-1.5 bg-[#93a0ba] rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-[#93a0ba]/15 p-3 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask a question..."
          disabled={loading}
          className="flex-1 bg-[#edf9fe] border border-[#93a0ba]/30 rounded-xl px-3.5 py-2 text-sm text-[#001554] placeholder-[#93a0ba] focus:outline-none focus:ring-2 focus:ring-[#001554]/20 focus:border-[#001554]/40 transition-all"
        />
        <button
          onClick={sendMessage}
          disabled={loading || !input.trim()}
          className="bg-[#001554] text-white w-9 h-9 flex items-center justify-center rounded-xl hover:bg-[#001554]/80 disabled:bg-[#93a0ba]/30 disabled:cursor-not-allowed transition-colors cursor-pointer flex-shrink-0"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}
