"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useCallback } from "react";
import cytoscape, { Core, LayoutOptions } from "cytoscape";

// ============================================================================
// TYPES
// ============================================================================

interface GraphProps {
  filter: {
    unit1: boolean;
    unit2: boolean;
  };
}

interface EdgeInfo {
  source: string;
  target: string;
  description: string;
  x: number;
  y: number;
}

interface LockedNodeInfo {
  label: string;
  x: number;
  y: number;
}

interface NodeState {
  node_id: string;
  is_unlocked: boolean;
  is_completed: boolean;
  curiosity_score: number;
  neighbors: string[];
}

interface UserNodesData {
  nodes: NodeState[];
}

// ============================================================================
// MODULE-LEVEL CACHE
// ============================================================================

let cachedGraphData: any = null;
let cachedLayout: any = null;
let cachedUserNodes: UserNodesData | null = null;
let lastFetchTime: number = 0;
let persistentCyInstance: Core | null = null;
let instanceContainer: HTMLDivElement | null = null;

// ============================================================================
// EXPORTED GRAPH ACTIONS HOOK
// ============================================================================

export const useGraphActions = () => {
  const API_URL = process.env.NEXT_PUBLIC_API_URL;

  const resetGraph = async () => {
    if (
      !confirm(
        "Are you sure you want to reset the graph? All progress will be lost."
      )
    ) {
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      await fetch(`${API_URL}/api/reset-graph`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      cachedUserNodes = null;
      lastFetchTime = 0;

      window.location.reload();
    } catch (error) {
      console.error("Error resetting graph:", error);
    }
  };

  const completeAllNodes = async () => {
    if (
      !confirm(
        "This will complete all nodes and unlock the entire graph. Continue?"
      )
    ) {
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      await fetch(`${API_URL}/api/complete-all-nodes`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      cachedUserNodes = null;
      lastFetchTime = 0;

      window.location.reload();
    } catch (error) {
      console.error("Error completing all nodes:", error);
    }
  };

  return { resetGraph, completeAllNodes };
};

export const refreshGraphFromExternal = () => {
  cachedUserNodes = null;
  lastFetchTime = 0;
};

// ============================================================================
// MAIN GRAPH COMPONENT
// ============================================================================

export default function Graph({ filter }: GraphProps) {
  const cyContainer = useRef<HTMLDivElement>(null);
  const cyInstance = useRef<Core | null>(null);
  const router = useRouter();
  const isInitialized = useRef(false);

  const [loading, setLoading] = useState(true);
  const [selectedEdge, setSelectedEdge] = useState<EdgeInfo | null>(null);
  const [lockedNode, setLockedNode] = useState<LockedNodeInfo | null>(null);

  const API_URL = process.env.NEXT_PUBLIC_API_URL;

  // ==========================================================================
  // APPLY NODE STATES (from user data)
  // ==========================================================================

  const applyNodeStates = useCallback((userNodesData: UserNodesData) => {
    if (!cyInstance.current) return;

    const cy = cyInstance.current;
    const stateMap = new Map<string, NodeState>(
      userNodesData.nodes.map((n) => [n.node_id, n])
    );

    cy.batch(() => {
      cy.nodes().forEach((node) => {
        const state = stateMap.get(node.id());
        if (state) {
          node.removeClass("locked unlocked complete incomplete");
          node.addClass(state.is_unlocked ? "unlocked" : "locked");
          node.addClass(state.is_completed ? "complete" : "incomplete");
          node.data("is_unlocked", state.is_unlocked);
        }
      });
    });
  }, []);

  // ==========================================================================
  // UPDATE NODE COLORS (fetch user progress)
  // ==========================================================================

  const updateNodeColors = useCallback(
    async (forceRefresh = false) => {
      const token = localStorage.getItem("token");
      if (!token || !cyInstance.current) return;

      try {
        const now = Date.now();

        if (!forceRefresh && cachedUserNodes && now - lastFetchTime < 2000) {
          applyNodeStates(cachedUserNodes);
          return;
        }

        const response = await fetch(`${API_URL}/api/user-nodes`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (response.status === 401) {
          localStorage.removeItem("token");
          router.push("/login");
          return;
        }

        if (response.ok) {
          const data: UserNodesData = await response.json();
          cachedUserNodes = data;
          lastFetchTime = now;
          applyNodeStates(data);
        }
      } catch (error) {
        console.error("Error updating node colors:", error);
        if (cachedUserNodes) {
          applyNodeStates(cachedUserNodes);
        }
      }
    },
    [API_URL, router, applyNodeStates]
  );

  // ==========================================================================
  // APPLY FILTER (show/hide nodes by unit)
  // ==========================================================================

  const applyFilter = useCallback(() => {
    if (!cyInstance.current) return;

    const cy = cyInstance.current;

    cy.batch(() => {
      cy.nodes().forEach((node) => {
        const unit = node.data("unit");
        let shouldShow = true;

        if (unit) {
          if (unit.includes("Unit 1") && !filter.unit1) shouldShow = false;
          if (unit.includes("Unit 2") && !filter.unit2) shouldShow = false;
        }

        node.style("display", shouldShow ? "element" : "none");
      });

      cy.edges().forEach((edge) => {
        const source = edge.source();
        const target = edge.target();
        const shouldShow =
          source.style("display") === "element" &&
          target.style("display") === "element";

        edge.style("display", shouldShow ? "element" : "none");
      });
    });
  }, [filter]);

  // ==========================================================================
  // INITIALIZE GRAPH
  // ==========================================================================

  const initializeGraph = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
      return;
    }

    try {
      setLoading(true);

      // Reuse persistent instance if available
      if (persistentCyInstance && cyContainer.current) {
        console.log("♻️ Reusing existing Cytoscape instance");

        persistentCyInstance.mount(cyContainer.current);
        cyInstance.current = persistentCyInstance;
        instanceContainer = cyContainer.current;
        isInitialized.current = true;

        if (cachedUserNodes) {
          // Have cached data — show immediately, then refresh in background
          applyNodeStates(cachedUserNodes);
          applyFilter();
          setLoading(false);
          await updateNodeColors(true);
        } else {
          // No cache (came from node page) — fetch first so graph appears fully up-to-date
          applyFilter();
          await updateNodeColors(true);
          setLoading(false);
        }
        return;
      }

      // Load graph structure
      let graphData = cachedGraphData;
      if (!graphData) {
        const response = await fetch("/data/apchem.json");
        graphData = await response.json();
        cachedGraphData = graphData;
      }

      if (!cyContainer.current) return;

      const layoutConfig: LayoutOptions = cachedLayout || {
        name: "cose",
        idealEdgeLength: 100,
        nodeRepulsion: 400000,
        gravity: 80,
        numIter: 300,
        padding: 125,
        animate: false,
        randomize: false,
      };

      const cy = cytoscape({
        container: cyContainer.current,
        elements: [...graphData.nodes, ...graphData.edges],
        layout: layoutConfig,
        hideEdgesOnViewport: false,
        textureOnViewport: false,
        pixelRatio: "auto",

        style: [
          {
            selector: "node",
            style: {
              label: "data(label)",
              "text-valign": "center",
              "text-halign": "center",
              "background-color": "#9ca3af",
              "font-size": "12px",
            },
          },
          {
            selector:
              'node[unit = "Unit 1: Atomic Structures and Properties"].locked',
            style: {
              "background-color": "#9ca3af",
              cursor: "not-allowed",
            } as any,
          },
          {
            selector:
              'node[unit = "Unit 1: Atomic Structures and Properties"].unlocked.incomplete',
            style: {
              "background-color": "#93c5fd",
              cursor: "pointer",
            } as any,
          },
          {
            selector:
              'node[unit = "Unit 1: Atomic Structures and Properties"].unlocked.complete',
            style: {
              "background-color": "#1e40af",
              cursor: "pointer",
            } as any,
          },
          {
            selector:
              'node[unit = "Unit 2: Compound Structure and Properties"].locked',
            style: {
              "background-color": "#9ca3af",
              cursor: "not-allowed",
            } as any,
          },
          {
            selector:
              'node[unit = "Unit 2: Compound Structure and Properties"].unlocked.incomplete',
            style: {
              "background-color": "#fca5a5",
              cursor: "pointer",
            } as any,
          },
          {
            selector:
              'node[unit = "Unit 2: Compound Structure and Properties"].unlocked.complete',
            style: {
              "background-color": "#b91c1c",
              cursor: "pointer",
            } as any,
          },
          {
            selector: "edge",
            style: {
              "curve-style": "bezier",
              "line-color": "#999",
              "target-arrow-color": "#999",
              width: 2,
            },
          },
          {
            selector: "edge:hover",
            style: {
              "line-color": "#3b82f6",
              width: 4,
            },
          },
        ] as any,
      });

      if (!cachedLayout) {
        cy.one("layoutstop", () => {
          const positions: any = {};
          cy.nodes().forEach((node) => {
            positions[node.id()] = node.position();
          });
          cachedLayout = {
            name: "preset",
            positions: (node: any) => positions[node.id()],
            fit: true,
            padding: 125,
          };
        });
      }

      cy.batch(() => {
        cy.nodes().forEach((node) => {
          node.addClass("locked incomplete");
          node.data("is_unlocked", false);
        });
      });

      if (cachedUserNodes) {
        applyNodeStates(cachedUserNodes);
      }

      cy.on("tap", "node", (event) => {
        const node = event.target;
        const isUnlocked = node.data("is_unlocked");

        if (!isUnlocked) {
          const pos = node.renderedPosition();
          setLockedNode({
            label: node.data("label"),
            x: pos.x,
            y: pos.y,
          });
          setTimeout(() => setLockedNode(null), 3000);
          return;
        }

        router.push(`/${node.id()}`);
      });

      cy.on("tap", "edge", (event) => {
        const edge = event.target;
        const source = cy.getElementById(edge.data("source"));
        const target = cy.getElementById(edge.data("target"));
        const pos = event.renderedPosition || event.position;

        setSelectedEdge({
          source: source.data("label") || edge.data("source"),
          target: target.data("label") || edge.data("target"),
          description: edge.data("description") || "No description available",
          x: pos.x,
          y: pos.y,
        });
      });

      cy.on("tap", (event) => {
        if (event.target === cy) {
          setSelectedEdge(null);
          setLockedNode(null);
        }
      });

      cyInstance.current = cy;
      persistentCyInstance = cy;
      instanceContainer = cyContainer.current;

      setLoading(false);
      isInitialized.current = true;

      fetch(`${API_URL}/api/initialize-graph`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      await updateNodeColors();
    } catch (error) {
      console.error("Error initializing graph:", error);
      setLoading(false);
    }
  }, [API_URL, router, applyNodeStates, updateNodeColors, applyFilter]);

  // ==========================================================================
  // EFFECTS
  // ==========================================================================

  useEffect(() => {
    if (!isInitialized.current) {
      initializeGraph();
    }
  }, [initializeGraph]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (cyInstance.current && isInitialized.current) {
        updateNodeColors();
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [updateNodeColors]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && isInitialized.current) {
        updateNodeColors(true);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [updateNodeColors]);

  useEffect(() => {
    if (isInitialized.current) {
      applyFilter();
    }
  }, [filter, applyFilter]);

  useEffect(() => {
    const handleRefreshGraph = () => {
      console.log("🔄 Refreshing graph from external trigger");
      updateNodeColors(true);
    };

    window.addEventListener("refreshGraph", handleRefreshGraph);
    return () => window.removeEventListener("refreshGraph", handleRefreshGraph);
  }, [updateNodeColors]);

  // ==========================================================================
  // RENDER
  // ==========================================================================

  return (
    <>
      {loading && (
        <div className="relative w-full h-[600px] bg-gray-100 rounded-lg flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4" />
            <p className="text-gray-600">Loading graph...</p>
          </div>
        </div>
      )}

      <div className="relative">
        <div
          ref={cyContainer}
          style={{
            height: "600px",
            width: "100%",
            display: loading ? "none" : "block",
          }}
        />

        {selectedEdge && (
          <div
            className="absolute z-50 pointer-events-none"
            style={{
              left: `${selectedEdge.x}px`,
              top: `${selectedEdge.y}px`,
              transform: "translate(-50%, -100%) translateY(-10px)",
            }}
          >
            <div className="pointer-events-auto bg-white rounded-lg shadow-xl border border-gray-200 p-4 max-w-xs">
              <div className="absolute left-1/2 -translate-x-1/2 -bottom-2 w-4 h-4 bg-white border-b border-r border-gray-200 rotate-45" />
              <button
                onClick={() => setSelectedEdge(null)}
                className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
              <div className="space-y-2 pr-4">
                <div className="flex items-center gap-2 text-xs font-medium text-gray-500">
                  <span>{selectedEdge.source}</span>
                  <span>↔</span>
                  <span>{selectedEdge.target}</span>
                </div>
                <p className="text-sm text-gray-700">
                  {selectedEdge.description}
                </p>
              </div>
            </div>
          </div>
        )}

        {lockedNode && (
          <div
            className="absolute z-50 pointer-events-none"
            style={{
              left: `${lockedNode.x}px`,
              top: `${lockedNode.y}px`,
              transform: "translate(-50%, -100%) translateY(-10px)",
            }}
          >
            <div className="pointer-events-auto bg-red-50 rounded-lg shadow-xl border-2 border-red-300 p-4 max-w-xs">
              <div className="absolute left-1/2 -translate-x-1/2 -bottom-2 w-4 h-4 bg-red-50 border-b-2 border-r-2 border-red-300 rotate-45" />
              <button
                onClick={() => setLockedNode(null)}
                className="absolute top-2 right-2 text-red-400 hover:text-red-600"
              >
                x
              </button>
              <div className="space-y-2 pr-4">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">🔒</span>
                  <span className="font-semibold text-red-900">Locked</span>
                </div>
                <p className="text-sm text-red-800">
                  Complete neighboring nodes to access{" "}
                  <strong>{lockedNode.label}</strong>
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
