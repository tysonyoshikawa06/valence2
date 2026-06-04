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

export default function Sidebar({ filter, setFilter }: SidebarProps) {
  const [nodes, setNodes] = useState<NodeData[]>([]);
  const [graphData, setGraphData] = useState<{ nodes: GraphNode[] } | null>(null);
  const [showAllUpNext, setShowAllUpNext] = useState(false);
  const [showAllCompleted, setShowAllCompleted] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
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
  // FETCH USER NODES
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
        const enrichedNodes = data.nodes.map((node: NodeData) => {
          const graphNode = graphData.nodes.find((gn) => gn.data.id === node.node_id);
          return { ...node, unit: graphNode?.data.unit };
        });
        setNodes(enrichedNodes);
      }
    } catch (error) {
      console.error("Error fetching nodes:", error);
    }
  }, [API_URL, graphData]);

  useEffect(() => {
    if (graphData) fetchNodes();
  }, [graphData, fetchNodes]);

  // ==========================================================================
  // HELPERS
  // ==========================================================================

  const getNodeDot = (unit?: string, isCompleted?: boolean): string => {
    if (!unit) return "bg-[#93a0ba]";
    if (unit.includes("Unit 1")) return isCompleted ? "bg-[#001554]/80" : "bg-[#2563eb]";
    if (unit.includes("Unit 2")) return isCompleted ? "bg-[#b91c1c]/80" : "bg-[#ef4444]";
    return "bg-[#93a0ba]";
  };

  const formatNodeLabel = (nodeId: string): string =>
    nodeId.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");

  const filterByUnit = (nodeList: NodeData[]): NodeData[] =>
    nodeList.filter((node) => {
      if (!node.unit) return true;
      if (node.unit.includes("Unit 1") && !filter.unit1) return false;
      if (node.unit.includes("Unit 2") && !filter.unit2) return false;
      return true;
    });

  const handleFilterChange = (unit: "unit1" | "unit2", checked: boolean) => {
    setFilter({ ...filter, [unit]: checked });
    setShowAllUpNext(false);
    setShowAllCompleted(false);
  };

  const handleNodeClick = (nodeId: string) => {
    router.push(`/${nodeId}`);
  };

  // ==========================================================================
  // COMPUTED LISTS
  // ==========================================================================

  const upNextNodes = filterByUnit(nodes.filter((n) => n.is_unlocked && !n.is_completed));
  const completedNodes = filterByUnit(nodes.filter((n) => n.is_completed));
  const displayedUpNext = showAllUpNext ? upNextNodes : upNextNodes.slice(0, 5);
  const displayedCompleted = showAllCompleted ? completedNodes : completedNodes.slice(0, 5);

  // ==========================================================================
  // RENDER
  // ==========================================================================

  return (
    <>
      {/* Mobile toggle button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-[4.5rem] left-3 z-50 bg-white border border-[#93a0ba]/20 rounded-lg p-2 shadow-sm"
        aria-label="Open sidebar"
      >
        <svg className="w-5 h-5 text-[#001554]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/20 z-40"
          onClick={() => setMobileOpen(false)}
        />
      )}

    <aside className={`fixed top-16 left-0 h-[calc(100vh-4rem)] w-64 bg-white border-r border-[#93a0ba]/20 z-50 overflow-y-auto transition-transform duration-300 lg:translate-x-0 ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}>
      <div className="p-4">
        {/* Mobile close button */}
        <button
          onClick={() => setMobileOpen(false)}
          className="lg:hidden absolute top-3 right-3 p-1.5 rounded-lg hover:bg-[#edf9fe] transition-colors"
          aria-label="Close sidebar"
        >
          <svg className="w-4 h-4 text-[#93a0ba]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* ====== FILTER ====== */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3 pr-7 lg:pr-0">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#93a0ba]">Filter</span>
            <span className="text-xs text-[#93a0ba]">
              {upNextNodes.length + completedNodes.length} nodes
            </span>
          </div>

          <div className="space-y-1.5">
            <label className="flex items-center gap-2.5 cursor-pointer hover:bg-[#edf9fe] p-2 rounded-lg transition-colors">
              <input
                type="checkbox"
                checked={filter.unit1}
                onChange={(e) => handleFilterChange("unit1", e.target.checked)}
                className="rounded accent-[#001554] cursor-pointer"
              />
              <span className="w-2.5 h-2.5 rounded-full bg-[#2563eb]" />
              <span className="text-sm text-[#001554]">Unit 1: Atomic Structures</span>
            </label>

            <label className="flex items-center gap-2.5 cursor-pointer hover:bg-[#edf9fe] p-2 rounded-lg transition-colors">
              <input
                type="checkbox"
                checked={filter.unit2}
                onChange={(e) => handleFilterChange("unit2", e.target.checked)}
                className="rounded accent-[#001554] cursor-pointer"
              />
              <span className="w-2.5 h-2.5 rounded-full bg-[#ef4444]" />
              <span className="text-sm text-[#001554]">Unit 2: Compound Structure</span>
            </label>
          </div>
        </div>

        {/* ====== UP NEXT ====== */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#93a0ba]">Up Next</span>
            <span className="text-xs text-[#93a0ba]">{upNextNodes.length}</span>
          </div>

          <div className="space-y-0.5">
            {displayedUpNext.map((node) => (
              <button
                key={node.node_id}
                onClick={() => handleNodeClick(node.node_id)}
                className="flex items-center gap-2.5 w-full text-left px-2 py-2 rounded-lg hover:bg-[#edf9fe] transition-colors cursor-pointer"
              >
                <span className={`w-2 h-2 flex-shrink-0 rounded-full ${getNodeDot(node.unit, false)}`} />
                <span className="text-sm text-[#001554] truncate">{formatNodeLabel(node.node_id)}</span>
              </button>
            ))}

            {upNextNodes.length > 5 && !showAllUpNext && (
              <button
                onClick={() => setShowAllUpNext(true)}
                className="text-xs text-[#93a0ba] hover:text-[#001554] pl-2 pt-1 transition-colors cursor-pointer"
              >
                Show all ({upNextNodes.length})
              </button>
            )}
            {showAllUpNext && upNextNodes.length > 5 && (
              <button
                onClick={() => setShowAllUpNext(false)}
                className="text-xs text-[#93a0ba] hover:text-[#001554] pl-2 pt-1 transition-colors cursor-pointer"
              >
                Show less
              </button>
            )}
            {upNextNodes.length === 0 && (
              <p className="text-xs text-[#93a0ba] italic pl-2">No nodes available</p>
            )}
          </div>
        </div>

        {/* ====== COMPLETED ====== */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#93a0ba]">Completed</span>
            <span className="text-xs text-[#93a0ba]">{completedNodes.length}</span>
          </div>

          <div className="space-y-0.5">
            {displayedCompleted.map((node) => (
              <button
                key={node.node_id}
                onClick={() => handleNodeClick(node.node_id)}
                className="flex items-center gap-2.5 w-full text-left px-2 py-2 rounded-lg hover:bg-[#edf9fe] transition-colors cursor-pointer"
              >
                <span className={`w-2 h-2 flex-shrink-0 rounded-full ${getNodeDot(node.unit, true)}`} />
                <span className="text-sm text-[#001554] truncate">{formatNodeLabel(node.node_id)}</span>
              </button>
            ))}

            {completedNodes.length > 5 && !showAllCompleted && (
              <button
                onClick={() => setShowAllCompleted(true)}
                className="text-xs text-[#93a0ba] hover:text-[#001554] pl-2 pt-1 transition-colors cursor-pointer"
              >
                Show all ({completedNodes.length})
              </button>
            )}
            {showAllCompleted && completedNodes.length > 5 && (
              <button
                onClick={() => setShowAllCompleted(false)}
                className="text-xs text-[#93a0ba] hover:text-[#001554] pl-2 pt-1 transition-colors cursor-pointer"
              >
                Show less
              </button>
            )}
            {completedNodes.length === 0 && (
              <p className="text-xs text-[#93a0ba] italic pl-2">No completed nodes yet</p>
            )}
          </div>
        </div>
      </div>
    </aside>
    </>
  );
}
