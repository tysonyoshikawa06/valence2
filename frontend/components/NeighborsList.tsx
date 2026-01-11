"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";

// ============================================================================
// TYPES
// ============================================================================

interface Neighbor {
  nodeId: string;
  label: string;
  edgeDescription: string;
}

interface NeighborsListProps {
  neighbors: Neighbor[];
  currentNodeId: string;
}

interface NodeState {
  is_unlocked: boolean;
  is_completed: boolean;
}

// ============================================================================
// MODULE-LEVEL CACHE
// ============================================================================

let cachedStates: Record<string, NodeState> = {};
let lastFetchTime = 0;
const CACHE_TTL = 2000; // 2 seconds

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function NeighborsList({
  neighbors,
  currentNodeId,
}: NeighborsListProps) {
  const [neighborStates, setNeighborStates] =
    useState<Record<string, NodeState>>(cachedStates);
  const [expandedNeighbor, setExpandedNeighbor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const API_URL = process.env.NEXT_PUBLIC_API_URL;

  // ==========================================================================
  // FETCH NEIGHBOR STATES (with caching)
  // ==========================================================================

  const fetchNeighborStates = useCallback(
    async (forceRefresh = false) => {
      const token = localStorage.getItem("token");
      if (!token) {
        setLoading(false);
        return;
      }

      const now = Date.now();

      // Use cache if recent and not forcing refresh
      if (!forceRefresh && cachedStates && now - lastFetchTime < CACHE_TTL) {
        setNeighborStates(cachedStates);
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`${API_URL}/api/user-nodes`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (response.ok) {
          const data = await response.json();

          // Build state map
          const states: Record<string, NodeState> = {};
          data.nodes.forEach((node: any) => {
            states[node.node_id] = {
              is_unlocked: node.is_unlocked,
              is_completed: node.is_completed,
            };
          });

          // Update cache
          cachedStates = states;
          lastFetchTime = now;

          setNeighborStates(states);
          setLoading(false);
        }
      } catch (error) {
        console.error("Error fetching neighbor states:", error);

        // Fallback to cache if available
        if (cachedStates && Object.keys(cachedStates).length > 0) {
          setNeighborStates(cachedStates);
        }

        setLoading(false);
      }
    },
    [API_URL]
  );

  // ==========================================================================
  // EFFECTS
  // ==========================================================================

  // Initial fetch when component mounts or currentNodeId changes
  useEffect(() => {
    setLoading(true);
    fetchNeighborStates();

    // Delayed fetch to catch any just-completed nodes
    const delayedFetch = setTimeout(() => {
      fetchNeighborStates();
    }, 500);

    return () => clearTimeout(delayedFetch);
  }, [currentNodeId, fetchNeighborStates]);

  // Poll for updates every 3 seconds
  useEffect(() => {
    const pollInterval = setInterval(() => {
      fetchNeighborStates();
    }, 3000);

    return () => clearInterval(pollInterval);
  }, [fetchNeighborStates]);

  // Refresh on tab focus
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetchNeighborStates(true);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [fetchNeighborStates]);

  // ==========================================================================
  // EVENT HANDLERS
  // ==========================================================================

  const handleNeighborClick = useCallback((neighborId: string) => {
    setExpandedNeighbor((prev) => (prev === neighborId ? null : neighborId));
  }, []);

  const handleVisitNode = useCallback(
    (neighborId: string) => {
      router.push(`/${neighborId}`);
    },
    [router]
  );

  // ==========================================================================
  // MEMOIZED COMPUTATIONS
  // ==========================================================================

  const enrichedNeighbors = useMemo(() => {
    return neighbors.map((neighbor) => {
      const state = neighborStates[neighbor.nodeId];
      return {
        ...neighbor,
        isUnlocked: state?.is_unlocked ?? false,
        isCompleted: state?.is_completed ?? false,
        isExpanded: expandedNeighbor === neighbor.nodeId,
      };
    });
  }, [neighbors, neighborStates, expandedNeighbor]);

  // ==========================================================================
  // RENDER
  // ==========================================================================

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-4">
        <h2 className="text-lg font-semibold mb-4 text-gray-900">
          Connected Concepts
        </h2>
        <div className="flex items-center gap-2 text-gray-400 text-sm">
          <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  if (neighbors.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-4">
        <h2 className="text-lg font-semibold mb-4 text-gray-900">
          Connected Concepts
        </h2>
        <div className="flex flex-col items-center justify-center py-8 text-gray-400">
          <svg
            className="w-12 h-12 mb-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 10V3L4 14h7v7l9-11h-7z"
            />
          </svg>
          <p className="text-sm">No connected concepts</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">
          Connected Concepts
        </h2>
        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
          {neighbors.length}
        </span>
      </div>

      {/* Neighbors List */}
      <div className="space-y-2">
        {enrichedNeighbors.map((neighbor) => (
          <NeighborCard
            key={neighbor.nodeId}
            neighbor={neighbor}
            onToggle={handleNeighborClick}
            onVisit={handleVisitNode}
          />
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// NEIGHBOR CARD SUB-COMPONENT
// ============================================================================

interface NeighborCardProps {
  neighbor: {
    nodeId: string;
    label: string;
    edgeDescription: string;
    isUnlocked: boolean;
    isCompleted: boolean;
    isExpanded: boolean;
  };
  onToggle: (nodeId: string) => void;
  onVisit: (nodeId: string) => void;
}

function NeighborCard({ neighbor, onToggle, onVisit }: NeighborCardProps) {
  const {
    nodeId,
    label,
    edgeDescription,
    isUnlocked,
    isCompleted,
    isExpanded,
  } = neighbor;

  return (
    <div className="border rounded-lg overflow-hidden transition-all hover:shadow-md">
      {/* Header */}
      <button
        onClick={() => onToggle(nodeId)}
        className="w-full text-left p-3 hover:bg-gray-50 transition-colors"
        aria-expanded={isExpanded}
        aria-controls={`neighbor-${nodeId}`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {/* Status Icons */}
            {isCompleted && (
              <span
                className="text-green-600 text-lg flex-shrink-0"
                title="Completed"
              >
                ✓
              </span>
            )}
            {!isUnlocked && (
              <span
                className="text-gray-400 text-lg flex-shrink-0"
                title="Locked"
              >
                🔒
              </span>
            )}

            {/* Label */}
            <span
              className={`font-medium truncate ${
                isCompleted
                  ? "text-green-700"
                  : isUnlocked
                  ? "text-gray-900"
                  : "text-gray-400"
              }`}
            >
              {label}
            </span>
          </div>

          {/* Expand Arrow */}
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${
              isExpanded ? "rotate-90" : ""
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </div>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div
          id={`neighbor-${nodeId}`}
          className="border-t bg-gray-50 p-3 space-y-3 animate-fade-in"
        >
          {/* Edge Description */}
          <p className="text-sm text-gray-600 leading-relaxed">
            {edgeDescription}
          </p>

          {/* Visit Button */}
          <button
            onClick={() => onVisit(nodeId)}
            disabled={!isUnlocked}
            className={`w-full py-2 px-4 rounded-lg font-medium transition-all ${
              isUnlocked
                ? "bg-blue-500 text-white hover:bg-blue-600 hover:shadow-md active:scale-95"
                : "bg-gray-300 text-gray-500 cursor-not-allowed"
            }`}
          >
            {isUnlocked ? "Visit Node →" : "🔒 Locked"}
          </button>
        </div>
      )}
    </div>
  );
}
