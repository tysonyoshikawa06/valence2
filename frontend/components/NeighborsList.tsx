"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";

interface Neighbor {
  nodeId: string;
  label: string;
  edgeDescription: string;
}

interface NeighborsListProps {
  neighbors: Neighbor[];
  currentNodeId: string;
}

type NodeState = {
  is_unlocked: boolean;
  is_completed: boolean;
};

export default function NeighborsList({
  neighbors,
  currentNodeId,
}: NeighborsListProps) {
  const [neighborStates, setNeighborStates] = useState<
    Record<string, NodeState>
  >({});
  const [expandedNeighbor, setExpandedNeighbor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const fetchTimeoutRef = useRef<NodeJS.Timeout>();

  const API_URL = process.env.NEXT_PUBLIC_API_URL;

  const fetchNeighborStates = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      const response = await fetch(`${API_URL}/api/user-nodes`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        const states: Record<string, NodeState> = {};

        data.nodes.forEach((node: any) => {
          states[node.node_id] = {
            is_unlocked: node.is_unlocked,
            is_completed: node.is_completed,
          };
        });

        setNeighborStates(states);
        setLoading(false);
      }
    } catch (error) {
      console.error("Error fetching neighbor states:", error);
      setLoading(false);
    }
  };

  // Fetch on mount and when currentNodeId changes
  useEffect(() => {
    setLoading(true);

    if (fetchTimeoutRef.current) {
      clearTimeout(fetchTimeoutRef.current);
    }

    fetchNeighborStates();

    fetchTimeoutRef.current = setTimeout(() => {
      fetchNeighborStates();
    }, 500);

    return () => {
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
    };
  }, [currentNodeId]);

  // Poll for updates every 2 seconds
  useEffect(() => {
    const pollInterval = setInterval(() => {
      fetchNeighborStates();
    }, 2000);

    return () => clearInterval(pollInterval);
  }, []);

  const handleNeighborClick = (neighborId: string) => {
    if (expandedNeighbor === neighborId) {
      setExpandedNeighbor(null);
    } else {
      setExpandedNeighbor(neighborId);
    }
  };

  const handleVisitNode = (neighborId: string) => {
    router.push(`/${neighborId}`);
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-4">
        <h2 className="text-lg font-semibold mb-4">Connected Concepts</h2>
        <p className="text-gray-400 text-sm">Loading...</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm p-4">
      <h2 className="text-lg font-semibold mb-4">Connected Concepts</h2>

      {neighbors.length === 0 ? (
        <p className="text-gray-500 text-sm">No connected concepts</p>
      ) : (
        <div className="space-y-2">
          {neighbors.map((neighbor) => {
            const state = neighborStates[neighbor.nodeId];
            const isUnlocked = state?.is_unlocked ?? false;
            const isCompleted = state?.is_completed ?? false;
            const isExpanded = expandedNeighbor === neighbor.nodeId;

            return (
              <div
                key={neighbor.nodeId}
                className="border rounded-lg overflow-hidden"
              >
                {/* Neighbor Header */}
                <button
                  onClick={() => handleNeighborClick(neighbor.nodeId)}
                  className="w-full text-left p-3 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        {isCompleted && (
                          <span className="text-green-600 text-lg font-bold">
                            ✓
                          </span>
                        )}
                        {!isUnlocked && (
                          <span className="text-gray-400 text-lg">🔒</span>
                        )}
                        <span
                          className={`font-medium ${
                            isCompleted
                              ? "text-green-700"
                              : isUnlocked
                              ? "text-gray-900"
                              : "text-gray-400"
                          }`}
                        >
                          {neighbor.label}
                        </span>
                      </div>
                    </div>
                    <span className="text-gray-400 text-sm">
                      {isExpanded ? "▼" : "▶"}
                    </span>
                  </div>
                </button>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="border-t bg-gray-50 p-3 space-y-3">
                    <p className="text-sm text-gray-600">
                      {neighbor.edgeDescription}
                    </p>
                    <button
                      onClick={() => handleVisitNode(neighbor.nodeId)}
                      disabled={!isUnlocked}
                      className={`w-full py-2 px-4 rounded-lg font-medium transition-colors ${
                        isUnlocked
                          ? "bg-blue-500 text-white hover:bg-blue-600"
                          : "bg-gray-300 text-gray-500 cursor-not-allowed"
                      }`}
                    >
                      {isUnlocked ? "Visit Node" : "Locked"}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
