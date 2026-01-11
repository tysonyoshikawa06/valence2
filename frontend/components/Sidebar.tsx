"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

// ============================================================================
// TYPES
// ============================================================================

interface FilterState {
  unit1: boolean;
  unit2: boolean;
}

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  filter: FilterState;
  setFilter: (filter: FilterState) => void;
}

interface NodeData {
  node_id: string;
  is_completed: boolean;
  is_unlocked: boolean;
  unit?: string;
}

interface GraphNode {
  data: {
    id: string;
    label: string;
    unit: string;
  };
}

// ============================================================================
// MAIN SIDEBAR COMPONENT
// ============================================================================

export default function Sidebar({
  isOpen,
  onClose,
  filter,
  setFilter,
}: SidebarProps) {
  const [nodes, setNodes] = useState<NodeData[]>([]);
  const [graphData, setGraphData] = useState<{ nodes: GraphNode[] } | null>(
    null
  );
  const [showAllUpNext, setShowAllUpNext] = useState(false);
  const [showAllCompleted, setShowAllCompleted] = useState(false);
  const router = useRouter();

  const API_URL = process.env.NEXT_PUBLIC_API_URL;

  // ==========================================================================
  // FETCH GRAPH STRUCTURE (once on mount)
  // ==========================================================================

  useEffect(() => {
    const fetchGraphStructure = async () => {
      try {
        const response = await fetch("/data/apchem.json");
        const data = await response.json();
        setGraphData(data);
      } catch (error) {
        console.error("Error fetching graph structure:", error);
      }
    };

    fetchGraphStructure();
  }, []);

  // ==========================================================================
  // FETCH USER NODES (when sidebar opens)
  // ==========================================================================

  const fetchNodes = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token || !graphData) return;

    try {
      const response = await fetch(`${API_URL}/api/user-nodes`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();

        // Enrich with unit information
        const enrichedNodes = data.nodes.map((node: NodeData) => {
          const graphNode = graphData.nodes.find(
            (gn) => gn.data.id === node.node_id
          );
          return {
            ...node,
            unit: graphNode?.data.unit,
          };
        });

        setNodes(enrichedNodes);
      }
    } catch (error) {
      console.error("Error fetching nodes:", error);
    }
  }, [API_URL, graphData]);

  useEffect(() => {
    if (isOpen && graphData) {
      fetchNodes();
    }
  }, [isOpen, graphData, fetchNodes]);

  // ==========================================================================
  // HELPER FUNCTIONS
  // ==========================================================================

  const getNodeColor = (unit?: string, isCompleted?: boolean): string => {
    if (!unit) return "bg-gray-400";

    if (unit.includes("Unit 1")) {
      return isCompleted ? "bg-blue-900" : "bg-blue-500";
    } else if (unit.includes("Unit 2")) {
      return isCompleted ? "bg-red-900" : "bg-red-500";
    }

    return "bg-gray-400";
  };

  const formatNodeLabel = (nodeId: string): string => {
    return nodeId
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  const filterByUnit = (nodeList: NodeData[]): NodeData[] => {
    return nodeList.filter((node) => {
      if (!node.unit) return true;

      const isUnit1 = node.unit.includes("Unit 1");
      const isUnit2 = node.unit.includes("Unit 2");

      if (isUnit1 && !filter.unit1) return false;
      if (isUnit2 && !filter.unit2) return false;

      return true;
    });
  };

  const handleFilterChange = (unit: "unit1" | "unit2", checked: boolean) => {
    setFilter({ ...filter, [unit]: checked });
    setShowAllUpNext(false);
    setShowAllCompleted(false);
  };

  const handleNodeClick = (nodeId: string) => {
    router.push(`/${nodeId}`);
    onClose();
  };

  // ==========================================================================
  // COMPUTE FILTERED LISTS
  // ==========================================================================

  const upNextNodes = filterByUnit(
    nodes.filter((n) => n.is_unlocked && !n.is_completed)
  );

  const completedNodes = filterByUnit(nodes.filter((n) => n.is_completed));

  const displayedUpNext = showAllUpNext ? upNextNodes : upNextNodes.slice(0, 5);
  const displayedCompleted = showAllCompleted
    ? completedNodes
    : completedNodes.slice(0, 5);

  // ==========================================================================
  // RENDER
  // ==========================================================================

  return (
    <aside
      className={`fixed top-16 left-0 h-[calc(100vh-4rem)] w-64 bg-white border-r border-gray-200 transform transition-transform duration-300 z-40 overflow-y-auto ${
        isOpen ? "translate-x-0" : "-translate-x-full"
      }`}
    >
      <div className="p-4">
        {/* ====== FILTER SECTION ====== */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <span className="font-semibold">Filter</span>
            <span className="text-xs text-gray-500">
              {upNextNodes.length + completedNodes.length} nodes
            </span>
          </div>

          <div className="space-y-2">
            {/* Unit 1 */}
            <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded">
              <input
                type="checkbox"
                checked={filter.unit1}
                onChange={(e) => handleFilterChange("unit1", e.target.checked)}
                className="rounded"
              />
              <span className="w-3 h-3 rounded-full bg-blue-500" />
              <span className="text-sm">Unit 1: Atomic Structures</span>
            </label>

            {/* Unit 2 */}
            <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded">
              <input
                type="checkbox"
                checked={filter.unit2}
                onChange={(e) => handleFilterChange("unit2", e.target.checked)}
                className="rounded"
              />
              <span className="w-3 h-3 rounded-full bg-red-500" />
              <span className="text-sm">Unit 2: Compound Structure</span>
            </label>
          </div>
        </div>

        {/* ====== UP NEXT SECTION ====== */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold">Up Next</h2>
              <svg
                className="w-4 h-4"
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
            <span className="text-xs text-gray-500">{upNextNodes.length}</span>
          </div>

          <div className="space-y-2">
            {displayedUpNext.map((node) => (
              <button
                key={node.node_id}
                onClick={() => handleNodeClick(node.node_id)}
                className="flex items-center gap-2 w-full text-left p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <span
                  className={`w-2 h-2 rounded-full ${getNodeColor(
                    node.unit,
                    false
                  )}`}
                />
                <span className="text-sm truncate">
                  {formatNodeLabel(node.node_id)}
                </span>
              </button>
            ))}

            {upNextNodes.length > 5 && !showAllUpNext && (
              <button
                onClick={() => setShowAllUpNext(true)}
                className="text-sm text-blue-600 hover:text-blue-800 pl-2"
              >
                Show All ({upNextNodes.length})
              </button>
            )}

            {showAllUpNext && upNextNodes.length > 5 && (
              <button
                onClick={() => setShowAllUpNext(false)}
                className="text-sm text-blue-600 hover:text-blue-800 pl-2"
              >
                Show Less
              </button>
            )}

            {upNextNodes.length === 0 && (
              <p className="text-sm text-gray-500 italic pl-2">
                No nodes available
              </p>
            )}
          </div>
        </div>

        {/* ====== COMPLETED SECTION ====== */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold">Completed</h2>
              <svg
                className="w-4 h-4 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <span className="text-xs text-gray-500">
              {completedNodes.length}
            </span>
          </div>

          <div className="space-y-2">
            {displayedCompleted.map((node) => (
              <button
                key={node.node_id}
                onClick={() => handleNodeClick(node.node_id)}
                className="flex items-center gap-2 w-full text-left p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <span
                  className={`w-2 h-2 rounded-full ${getNodeColor(
                    node.unit,
                    true
                  )}`}
                />
                <span className="text-sm truncate">
                  {formatNodeLabel(node.node_id)}
                </span>
              </button>
            ))}

            {completedNodes.length > 5 && !showAllCompleted && (
              <button
                onClick={() => setShowAllCompleted(true)}
                className="text-sm text-blue-600 hover:text-blue-800 pl-2"
              >
                Show All ({completedNodes.length})
              </button>
            )}

            {showAllCompleted && completedNodes.length > 5 && (
              <button
                onClick={() => setShowAllCompleted(false)}
                className="text-sm text-blue-600 hover:text-blue-800 pl-2"
              >
                Show Less
              </button>
            )}

            {completedNodes.length === 0 && (
              <p className="text-sm text-gray-500 italic pl-2">
                No completed nodes yet
              </p>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}
