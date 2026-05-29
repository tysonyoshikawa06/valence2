"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";

interface NodeProgressProps {
  nodeId: string;
}

export default function NodeProgress({ nodeId }: NodeProgressProps) {
  const [curiosityScore, setCuriosityScore] = useState<number>(0);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);
  const [isUnlocked, setIsUnlocked] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  const [showCompletionMessage, setShowCompletionMessage] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const lastManualUpdate = useRef<number>(0);
  const router = useRouter();

  const API_URL = process.env.NEXT_PUBLIC_API_URL;

  const fetchNodeState = async () => {
    const token = localStorage.getItem("token");
    if (!token) { router.push("/login"); return; }

    if (Date.now() - lastManualUpdate.current < 2000) return;

    try {
      const response = await fetch(`${API_URL}/api/user-nodes/${nodeId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.status === 401) {
        localStorage.removeItem("token");
        router.push("/login");
        return;
      }

      if (response.ok) {
        const node = await response.json();
        setCuriosityScore(node.curiosity_score);
        setIsCompleted(node.is_completed);
        setIsUnlocked(node.is_unlocked);

        if (node.is_completed && !isCompleted) {
          setShowCompletionMessage(true);
          setTimeout(() => setShowCompletionMessage(false), 4000);
        }
      }
    } catch (error) {
      console.error("Error fetching node state:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchNodeState(); }, [nodeId]);

  useEffect(() => {
    const handleCuriosityUpdate = (e: CustomEvent) => {
      const { newScore, isCompleted: completed } = e.detail;
      if (newScore !== null && newScore !== undefined) {
        setCuriosityScore(newScore);
        if (completed) {
          setIsCompleted(true);
          setShowCompletionMessage(true);
          setTimeout(() => setShowCompletionMessage(false), 4000);
          window.dispatchEvent(new Event("nodeCompleted"));
        }
        lastManualUpdate.current = Date.now();
      }
    };
    window.addEventListener("curiosityUpdate", handleCuriosityUpdate as EventListener);
    return () => window.removeEventListener("curiosityUpdate", handleCuriosityUpdate as EventListener);
  }, []);

  useEffect(() => {
    if (!isUnlocked || isCompleted) return;
    const interval = setInterval(fetchNodeState, 1000);
    return () => clearInterval(interval);
  }, [isUnlocked, isCompleted, nodeId]);

  const updateCuriosityScore = async (delta: number) => {
    const token = localStorage.getItem("token");
    if (!token) { router.push("/login"); return; }

    const newScore = curiosityScore + delta;
    if (newScore < 0 || (newScore > 5 && !isCompleted)) return;

    lastManualUpdate.current = Date.now();
    const previousScore = curiosityScore;
    setCuriosityScore(newScore);
    setAdminOpen(false);

    const willComplete = newScore > 4 && !isCompleted;
    if (willComplete) {
      setIsCompleted(true);
      setShowCompletionMessage(true);
      setTimeout(() => setShowCompletionMessage(false), 4000);
      window.dispatchEvent(new Event("nodeCompleted"));
    }

    fetch(`${API_URL}/api/user-nodes/${nodeId}/curiosity?score_delta=${delta}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) {
          setCuriosityScore(previousScore);
          if (willComplete) { setIsCompleted(false); setShowCompletionMessage(false); }
        }
      })
      .catch(() => {
        setCuriosityScore(previousScore);
        if (willComplete) { setIsCompleted(false); setShowCompletionMessage(false); }
      });

    if (willComplete) {
      fetch(`${API_URL}/api/user-nodes/${nodeId}/complete`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
    }
  };

  if (loading) return null;

  if (!isUnlocked) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-[#edf9fe] rounded-lg">
        <span className="text-xs text-[#93a0ba]">🔒 Locked</span>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2.5 px-1">
        {/* Status badge */}
        <span className={`text-xs font-medium flex-shrink-0 ${isCompleted ? "text-[#001554]" : "text-[#93a0ba]"}`}>
          {isCompleted ? "✓ Done" : `${curiosityScore}/5`}
        </span>

        {/* Progress bar */}
        <div className="flex-1 bg-[#edf9fe] rounded-full h-1.5 overflow-hidden">
          <div
            className="bg-[#001554] h-1.5 rounded-full transition-all duration-500"
            style={{ width: `${(curiosityScore / 5) * 100}%` }}
          />
        </div>

        {/* Admin gear */}
        {!isCompleted && (
          <div className="relative flex-shrink-0">
            <button
              onClick={() => setAdminOpen(!adminOpen)}
              className="p-1 hover:bg-[#edf9fe] rounded-md transition-colors cursor-pointer"
              title="Adjust score"
            >
              <svg className="w-3.5 h-3.5 text-[#93a0ba]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>

            {adminOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setAdminOpen(false)} />
                <div className="absolute right-0 bottom-7 w-40 bg-white rounded-xl shadow-xl border border-[#93a0ba]/20 z-50 overflow-hidden">
                  <div className="p-1">
                    <button
                      onClick={() => updateCuriosityScore(1)}
                      disabled={curiosityScore >= 5}
                      className="w-full text-left px-3 py-2 text-sm text-[#001554] hover:bg-[#edf9fe] rounded-lg transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      + Increase score
                    </button>
                    <button
                      onClick={() => updateCuriosityScore(-1)}
                      disabled={curiosityScore <= 0}
                      className="w-full text-left px-3 py-2 text-sm text-[#001554] hover:bg-[#edf9fe] rounded-lg transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      − Decrease score
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {showCompletionMessage && (
        <div className="mt-2 bg-[#001554] text-white text-xs rounded-lg px-3 py-2 text-center">
          🎉 Node completed — neighbors unlocked!
        </div>
      )}
    </div>
  );
}
