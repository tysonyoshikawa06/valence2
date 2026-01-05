"use client";

import { useEffect, useState } from "react";

interface NodeProgressProps {
  nodeId: string;
}

export default function NodeProgress({ nodeId }: NodeProgressProps) {
  const [curiosityScore, setCuriosityScore] = useState<number>(0);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);
  const [isUnlocked, setIsUnlocked] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  const [showCompletionMessage, setShowCompletionMessage] = useState(false);

  const API_URL = process.env.NEXT_PUBLIC_API_URL;

  // Fetch single node state
  const fetchNodeState = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      const response = await fetch(`${API_URL}/api/user-nodes/${nodeId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const node = await response.json();

        // // Check if score increased (from chat)
        // const scoreIncreased =
        //   node.curiosity_score > curiosityScore && curiosityScore > 0;

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

  // Poll for updates every .5 seconds when unlocked and not completed
  useEffect(() => {
    if (!isUnlocked || isCompleted) return;

    const interval = setInterval(() => {
      fetchNodeState();
    }, 500); // Poll every .5 seconds

    return () => clearInterval(interval);
  }, [isUnlocked, isCompleted, nodeId]);

  const updateCuriosityScore = async (delta: number) => {
    const token = localStorage.getItem("token");
    if (!token) return;

    const newScore = curiosityScore + delta;

    // Prevent going below 0 or above 5 (unless completing)
    if (newScore < 0 || (newScore > 5 && !isCompleted)) return;

    // Update UI immediately (optimistic)
    const previousScore = curiosityScore;
    setCuriosityScore(newScore);

    // Check if this will trigger completion (optimistic)
    const willComplete = newScore > 4 && !isCompleted;
    if (willComplete) {
      setIsCompleted(true);
      setShowCompletionMessage(true);
      setTimeout(() => setShowCompletionMessage(false), 5000);
    }

    try {
      // Update curiosity score in db
      const response = await fetch(
        `${API_URL}/api/user-nodes/${nodeId}/curiosity?score_delta=${delta}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        // Revert on error
        setCuriosityScore(previousScore);
        if (willComplete) {
          setIsCompleted(false);
          setShowCompletionMessage(false);
        }
        console.error("Failed to update curiosity score");
        return;
      }

      // If increase completes, call the complete endpoint but don't wait for it
      if (willComplete) {
        fetch(`${API_URL}/api/user-nodes/${nodeId}/complete`, {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }).catch((error) => {
          console.error("Error completing node:", error);
        });
      }
    } catch (error) {
      // Revert on error
      setCuriosityScore(previousScore);
      if (willComplete) {
        setIsCompleted(false);
        setShowCompletionMessage(false);
      }
      console.error("Error updating curiosity score:", error);
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
