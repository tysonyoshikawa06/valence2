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
  const [curiosityNotification, setCuriosityNotification] = useState<
    string | null
  >(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const API_URL = process.env.NEXT_PUBLIC_API_URL;

  // Scroll to new message (only if not on mount)
  const didMountRef = useRef(false);
  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadChatHistory = async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      setLoadingHistory(false);
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/chat-history/${nodeId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.messages && data.messages.length > 0) {
          setMessages(data.messages);
          console.log(`Loaded ${data.messages.length} messages from history`);
        }
      }
    } catch (error) {
      console.error("Error loading chat history:", error);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Load chat history when nodeId changes
  useEffect(() => {
    loadChatHistory();
  }, [nodeId]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage: Message = {
      role: "user",
      content: input,
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const messagesToSend = newMessages.slice(-10);
      const token = localStorage.getItem("token");

      console.log("Sending chat request with node_id:", nodeId);

      const response = await fetch(`${API_URL}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          messages: messagesToSend,
          node_id: nodeId,
        }),
      });

      if (!response.ok) throw new Error("Failed to get response");

      const data = await response.json();
      console.log("Chat response:", data);

      const assistantMessage: Message = {
        role: "assistant",
        content: data.message,
      };

      setMessages((prev) => [...prev, assistantMessage].slice(-10));

      // Show curiosity notification if score increased
      if (data.curiosity_increased) {
        console.log("Curiosity increased! Showing notification");
        setCuriosityNotification(
          data.curiosity_reason ||
            "Great question! Your curiosity score increased! 🌟"
        );
        setTimeout(() => setCuriosityNotification(null), 5000);
      }
    } catch (error) {
      console.error("Chat error:", error);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, I encountered an error. Please try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (loadingHistory) {
    return (
      <div className="flex flex-col h-96 border rounded-lg items-center justify-center">
        <div className="text-gray-500">Loading chat history...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-96 border rounded-lg relative">
      {/* Curiosity Notification */}
      {curiosityNotification && (
        <div className="absolute top-2 left-1/2 transform -translate-x-1/2 z-10 bg-green-100 border border-green-300 rounded-lg px-4 py-2 shadow-lg animate-fade-in">
          <p className="text-green-800 font-semibold flex items-center gap-2">
            <span className="text-xl">🌟</span>
            {curiosityNotification}
          </p>
        </div>
      )}

      {/* Chat messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-gray-400 text-center mt-8">
            Ask me anything about {nodeLabel}...
            <p className="text-sm mt-2">
              💡 Tip: Ask questions that connect concepts to increase your
              curiosity score!
            </p>
          </div>
        ) : (
          messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex ${
                msg.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[70%] rounded-lg px-4 py-2 ${
                  msg.role === "user"
                    ? "bg-blue-500 text-white"
                    : "bg-gray-200 text-gray-800"
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))
        )}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-200 text-gray-800 rounded-lg px-4 py-2">
              <span className="animate-pulse">Thinking...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="border-t p-4 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Type a message..."
          disabled={loading}
          className="flex-1 border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={sendMessage}
          disabled={loading || !input.trim()}
          className="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          {loading ? "..." : "→"}
        </button>
      </div>
    </div>
  );
}
