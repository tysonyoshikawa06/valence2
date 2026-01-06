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
  const lastManualUpdate = useRef<number>(0); // Track last manual update time
  const router = useRouter();

  const API_URL = process.env.NEXT_PUBLIC_API_URL;

  // Fetch single node state
  const fetchNodeState = async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
      return;
    }

    // Skip polling if we just did a manual update (wait 2 seconds)
    const timeSinceUpdate = Date.now() - lastManualUpdate.current;
    if (timeSinceUpdate < 2000) {
      console.log("Skipping poll - recent manual update");
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/user-nodes/${nodeId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
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

        // Show completion message if just completed
        if (node.is_completed && !isCompleted) {
          setShowCompletionMessage(true);
          setTimeout(() => setShowCompletionMessage(false), 5000);
        }
      }
    } catch (error) {
      console.error("Error fetching node state:", error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch when nodeId changes
  useEffect(() => {
    fetchNodeState();
  }, [nodeId]);

  // Poll for updates every second when unlocked and not completed
  useEffect(() => {
    if (!isUnlocked || isCompleted) return;

    const interval = setInterval(() => {
      fetchNodeState();
    }, 1000);

    return () => clearInterval(interval);
  }, [isUnlocked, isCompleted, nodeId]);

  const updateCuriosityScore = async (delta: number) => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
      return;
    }

    const newScore = curiosityScore + delta;
    if (newScore < 0 || (newScore > 5 && !isCompleted)) return;

    // Record that we just did a manual update
    lastManualUpdate.current = Date.now();

    // Optimistic update - immediate UI response
    const previousScore = curiosityScore;
    setCuriosityScore(newScore);
    console.log("frontend updated");

    const willComplete = newScore > 4 && !isCompleted;
    if (willComplete) {
      setIsCompleted(true);
      setShowCompletionMessage(true);
      setTimeout(() => setShowCompletionMessage(false), 5000);
    }

    // Fire and forget - don't wait for response
    fetch(
      `${API_URL}/api/user-nodes/${nodeId}/curiosity?score_delta=${delta}`,
      {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      }
    )
      .then((response) => {
        if (!response.ok) {
          // ONLY revert on error
          console.error("Backend update failed, reverting");
          setCuriosityScore(previousScore);
          if (willComplete) {
            setIsCompleted(false);
            setShowCompletionMessage(false);
          }
        } else {
          // Success! Trust our optimistic update, no need to fetch
          console.log("Backend update successful");
        }
      })
      .catch((error) => {
        // ONLY revert on error
        console.error("Error updating curiosity score:", error);
        setCuriosityScore(previousScore);
        if (willComplete) {
          setIsCompleted(false);
          setShowCompletionMessage(false);
        }
      });

    // If completing, call complete endpoint (fire and forget)
    if (willComplete) {
      fetch(`${API_URL}/api/user-nodes/${nodeId}/complete`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
    }
  };

  if (loading) {
    return <div className="text-gray-500">Loading progress...</div>;
  }

  if (!isUnlocked) {
    return (
      <div className="bg-gray-100 border border-gray-300 rounded-lg p-4">
        <p className="text-gray-600">
          🔒 This node is locked. Complete neighboring nodes to unlock it.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
      {/* Completion message */}
      {showCompletionMessage && (
        <div className="mb-4 bg-green-100 border border-green-300 rounded-lg p-4 animate-fade-in">
          <p className="text-green-800 font-semibold">
            🎉 Node completed! Neighbors have been unlocked.
          </p>
        </div>
      )}

      {/* Completion status */}
      <div className="mb-4">
        <span
          className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${
            isCompleted
              ? "bg-green-100 text-green-800"
              : "bg-yellow-100 text-yellow-800"
          }`}
        >
          {isCompleted ? "✓ Complete" : "○ Incomplete"}
        </span>
      </div>

      {/* Curiosity score */}
      <div className="mb-4">
        <h3 className="text-lg font-semibold mb-2">Curiosity Score</h3>
        <div className="flex items-center gap-4">
          <button
            onClick={() => updateCuriosityScore(-1)}
            disabled={curiosityScore <= 0 || isCompleted}
            className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            −
          </button>

          <div className="flex items-center gap-2">
            <div className="text-3xl font-bold">{curiosityScore}</div>
            <div className="text-gray-500">/ 5</div>
          </div>

          <button
            onClick={() => updateCuriosityScore(1)}
            disabled={curiosityScore >= 5 || isCompleted}
            className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            +
          </button>
        </div>

        {/* Progress bar */}
        <div className="mt-4 w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${(curiosityScore / 5) * 100}%` }}
          ></div>
        </div>

        {!isCompleted && curiosityScore === 4 && (
          <p className="mt-2 text-sm text-gray-600">
            Increase one more time to complete this node!
          </p>
        )}
      </div>

      {/* Info text */}
      {!isCompleted && (
        <p className="text-sm text-gray-600">
          Ask curious questions in the chat to increase your score
          automatically!
        </p>
      )}
    </div>
  );
}
