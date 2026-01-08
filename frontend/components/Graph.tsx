"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import cytoscape, { Core } from "cytoscape";

interface EdgeInfo {
  source: string;
  target: string;
  description: string;
  x: number;
  y: number;
}

const Graph = ({ onCyInit }: { onCyInit?: (cyInstance: Core) => void }) => {
  const cyContainer = useRef<HTMLDivElement>(null);
  const cyInstance = useRef<Core | null>(null);
  const router = useRouter();
  const [resetting, setResetting] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedEdge, setSelectedEdge] = useState<EdgeInfo | null>(null);
  const isInitialized = useRef(false);

  const API_URL = process.env.NEXT_PUBLIC_API_URL;

  const updateNodeColors = async () => {
    const token = localStorage.getItem("token");
    if (!token || !cyInstance.current) return;

    try {
      const response = await fetch(`${API_URL}/api/user-nodes`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.status === 401) {
        localStorage.removeItem("token");
        router.push("/login");
        return;
      }

      if (response.ok) {
        const userNodesData = await response.json();
        const cy = cyInstance.current;

        userNodesData.nodes.forEach((nodeData: any) => {
          const node = cy.getElementById(nodeData.node_id);

          if (node.length > 0) {
            node.removeClass("locked unlocked complete incomplete");
            node.addClass(nodeData.is_unlocked ? "unlocked" : "locked");
            node.addClass(nodeData.is_completed ? "complete" : "incomplete");
          }
        });

        console.log("✅ Node colors updated");
      }
    } catch (error) {
      console.error("Error updating node colors:", error);
    }
  };

  const loadGraph = async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
      return;
    }

    try {
      setLoading(true);

      const graphDataResponse = await fetch("/data/apchem.json");
      const graphData = await graphDataResponse.json();

      if (cyContainer.current) {
        const cy = cytoscape({
          container: cyContainer.current,
          elements: [...graphData.nodes, ...graphData.edges],
          layout: {
            name: "cose",
            idealEdgeLength: 100,
            nodeRepulsion: 400000,
            gravity: 80,
            numIter: 300,
            padding: 125,
            animate: false,
          },

          style: [
            {
              selector: "node",
              style: {
                label: "data(label)",
                "text-valign": "center",
                "text-halign": "center",
                "background-color": "#9ca3af",
                "transition-property": "background-color",
                "transition-duration": "0.3s",
              },
            },
            {
              selector:
                'node[unit = "Unit 1: Atomic Structures and Properties"].locked',
              style: { "background-color": "#9ca3af" },
            },
            {
              selector:
                'node[unit = "Unit 1: Atomic Structures and Properties"].unlocked.incomplete',
              style: { "background-color": "#93c5fd" },
            },
            {
              selector:
                'node[unit = "Unit 1: Atomic Structures and Properties"].unlocked.complete',
              style: { "background-color": "#1e40af" },
            },
            {
              selector:
                'node[unit = "Unit 2: Compound Structure and Properties"].locked',
              style: { "background-color": "#9ca3af" },
            },
            {
              selector:
                'node[unit = "Unit 2: Compound Structure and Properties"].unlocked.incomplete',
              style: { "background-color": "#fca5a5" },
            },
            {
              selector:
                'node[unit = "Unit 2: Compound Structure and Properties"].unlocked.complete',
              style: { "background-color": "#b91c1c" },
            },
            {
              selector: "edge",
              style: {
                "curve-style": "bezier",
                "line-color": "#999",
                "target-arrow-color": "#999",
                width: 2,
                "transition-property": "line-color, width",
                "transition-duration": "0.3s",
              },
            },
            {
              selector: "edge:hover",
              style: {
                "line-color": "#3b82f6",
                width: 4,
              },
            },
          ],
        });

        // Apply default classes to nodes
        cy.nodes().forEach((node) => {
          node.addClass("locked");
          node.addClass("incomplete");
        });

        // Node tap event
        cy.on("tap", "node", (event) => {
          const node = event.target;
          const nodeId = node.id();
          router.push(`/${nodeId}`);
        });

        // Edge tap event
        cy.on("tap", "edge", (event) => {
          const edge = event.target;
          const edgeData = edge.data();

          // Get source and target node labels
          const sourceNode = cy.getElementById(edgeData.source);
          const targetNode = cy.getElementById(edgeData.target);

          // Get the position where the user clicked
          const renderedPosition = event.renderedPosition || event.position;

          setSelectedEdge({
            source: sourceNode.data("label") || edgeData.source,
            target: targetNode.data("label") || edgeData.target,
            description: edgeData.description || "No description available",
            x: renderedPosition.x,
            y: renderedPosition.y,
          });
        });

        // Close tooltip when clicking background
        cy.on("tap", (event) => {
          if (event.target === cy) {
            setSelectedEdge(null);
          }
        });

        cyInstance.current = cy;

        if (onCyInit) {
          onCyInit(cy);
        }

        setLoading(false);
        isInitialized.current = true;
      }

      // Initialize graph in background
      fetch(`${API_URL}/api/initialize-graph`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      // Update colors with user data
      await updateNodeColors();
    } catch (error) {
      console.error("Error loading graph:", error);
      setLoading(false);
    }
  };

  const resetGraph = async () => {
    if (
      !confirm(
        "Are you sure you want to reset the graph? All progress will be lost."
      )
    ) {
      return;
    }

    setResetting(true);
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/reset-graph`, {
        method: "DELETE",
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
        await updateNodeColors();
      } else {
        console.error("Failed to reset graph");
      }
    } catch (error) {
      console.error("Error resetting graph:", error);
    } finally {
      setResetting(false);
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

    setCompleting(true);
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/complete-all-nodes`, {
        method: "POST",
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
        await updateNodeColors();
        console.log("✅ All nodes completed");
      } else {
        console.error("Failed to complete all nodes");
      }
    } catch (error) {
      console.error("Error completing all nodes:", error);
    } finally {
      setCompleting(false);
    }
  };

  useEffect(() => {
    if (!isInitialized.current) {
      loadGraph();
    }

    const pollInterval = setInterval(() => {
      if (cyInstance.current && isInitialized.current) {
        updateNodeColors();
      }
    }, 2000);

    return () => {
      clearInterval(pollInterval);
    };
  }, []);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && isInitialized.current) {
        console.log("Page visible, updating colors...");
        updateNodeColors();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return (
    <>
      <div className="mb-4 flex items-center gap-4">
        <button
          onClick={completeAllNodes}
          disabled={completing || loading}
          className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          {completing ? "Completing..." : "Complete All Nodes"}
        </button>
        <button
          onClick={resetGraph}
          disabled={resetting || loading}
          className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          {resetting ? "Resetting..." : "Reset Graph"}
        </button>
        {loading && <span className="text-gray-600">Loading graph...</span>}
      </div>

      {loading && (
        <div className="relative w-full h-[600px] bg-gray-100 rounded-lg flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
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

        {/* Edge Description Tooltip */}
        {selectedEdge && (
          <div
            className="absolute z-50 pointer-events-none"
            style={{
              left: `${selectedEdge.x}px`,
              top: `${selectedEdge.y}px`,
              transform: "translate(-50%, -100%) translateY(-10px)",
            }}
          >
            <div className="pointer-events-auto bg-white rounded-lg shadow-xl border border-gray-200 p-4 max-w-xs animate-fade-in">
              {/* Tooltip arrow */}
              <div className="absolute left-1/2 -translate-x-1/2 -bottom-2 w-4 h-4 bg-white border-b border-r border-gray-200 transform rotate-45"></div>

              {/* Close button */}
              <button
                onClick={() => setSelectedEdge(null)}
                className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
              >
                ×
              </button>

              {/* Content */}
              <div className="space-y-2 pr-4">
                <div className="flex items-center gap-2 text-xs font-medium text-gray-500">
                  <span>{selectedEdge.source}</span>
                  <span>↔</span>
                  <span>{selectedEdge.target}</span>
                </div>

                <p className="text-sm text-gray-700 leading-relaxed">
                  {selectedEdge.description}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default Graph;
