"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import cytoscape, { Core } from "cytoscape";

const Graph = ({ onCyInit }: { onCyInit?: (cyInstance: Core) => void }) => {
  const cyContainer = useRef<HTMLDivElement>(null);
  const cyInstance = useRef<Core | null>(null);
  const router = useRouter();
  const [resetting, setResetting] = useState(false);
  const [loading, setLoading] = useState(true);

  const API_URL = process.env.NEXT_PUBLIC_API_URL;

  const loadGraph = async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
      return;
    }

    try {
      setLoading(true);

      // STEP 1: Load graph structure immediately (no waiting!)
      const graphDataResponse = await fetch("/data/apchem.json");
      const graphData = await graphDataResponse.json();

      // STEP 2: Render graph immediately with default styling
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
                "background-color": "#9ca3af", // Default gray (locked)
              },
            },
            // Unit 1 - Locked (gray)
            {
              selector:
                'node[unit = "Unit 1: Atomic Structures and Properties"].locked',
              style: {
                "background-color": "#9ca3af",
              },
            },
            // Unit 1 - Unlocked & Incomplete (light blue)
            {
              selector:
                'node[unit = "Unit 1: Atomic Structures and Properties"].unlocked.incomplete',
              style: {
                "background-color": "#93c5fd",
              },
            },
            // Unit 1 - Unlocked & Complete (dark blue)
            {
              selector:
                'node[unit = "Unit 1: Atomic Structures and Properties"].unlocked.complete',
              style: {
                "background-color": "#1e40af",
              },
            },
            // Unit 2 - Locked (gray)
            {
              selector:
                'node[unit = "Unit 2: Compound Structure and Properties"].locked',
              style: {
                "background-color": "#9ca3af",
              },
            },
            // Unit 2 - Unlocked & Incomplete (light red)
            {
              selector:
                'node[unit = "Unit 2: Compound Structure and Properties"].unlocked.incomplete',
              style: {
                "background-color": "#fca5a5",
              },
            },
            // Unit 2 - Unlocked & Complete (dark red)
            {
              selector:
                'node[unit = "Unit 2: Compound Structure and Properties"].unlocked.complete',
              style: {
                "background-color": "#b91c1c",
              },
            },
            {
              selector: "edge",
              style: {
                "curve-style": "bezier",
                "line-color": "#999",
                "target-arrow-color": "#999",
              },
            },
          ],
        });

        // Apply default "locked" class to all nodes initially
        cy.nodes().forEach((node) => {
          node.addClass("locked");
          node.addClass("incomplete");
        });

        cy.on("tap", "node", (event) => {
          const node = event.target;
          const nodeId = node.id();
          router.push(`/${nodeId}`);
        });

        cyInstance.current = cy;

        if (onCyInit) {
          onCyInit(cy);
        }

        // Graph is visible now!
        setLoading(false);
      }

      // STEP 3: Fetch user data in background and update colors
      const [initResponse, userNodesResponse] = await Promise.all([
        fetch(`${API_URL}/api/initialize-graph`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_URL}/api/user-nodes`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (initResponse.status === 401 || userNodesResponse.status === 401) {
        localStorage.removeItem("token");
        router.push("/login");
        return;
      }

      const [initData, userNodesData] = await Promise.all([
        initResponse.ok ? initResponse.json() : null,
        userNodesResponse.ok ? userNodesResponse.json() : null,
      ]);

      console.log("Graph initialized:", initData);

      // STEP 4: Update node colors based on user progress
      if (userNodesData && cyInstance.current) {
        const cy = cyInstance.current;

        userNodesData.nodes.forEach((nodeData: any) => {
          const node = cy.getElementById(nodeData.node_id);

          if (node.length > 0) {
            // Remove default classes
            node.removeClass("locked");
            node.removeClass("unlocked");
            node.removeClass("complete");
            node.removeClass("incomplete");

            // Apply actual state
            if (nodeData.is_unlocked) {
              node.addClass("unlocked");
            } else {
              node.addClass("locked");
            }

            if (nodeData.is_completed) {
              node.addClass("complete");
            } else {
              node.addClass("incomplete");
            }
          }
        });

        console.log("Node colors updated with user progress");
      }
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
        if (cyInstance.current) {
          cyInstance.current.destroy();
        }
        await loadGraph();
      } else {
        console.error("Failed to reset graph");
      }
    } catch (error) {
      console.error("Error resetting graph:", error);
    } finally {
      setResetting(false);
    }
  };

  useEffect(() => {
    loadGraph();

    return () => {
      if (cyInstance.current) {
        cyInstance.current.destroy();
        cyInstance.current = null;
      }
    };
  }, []);

  return (
    <>
      <div className="mb-4 flex items-center gap-4">
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

      <div
        ref={cyContainer}
        style={{
          height: "600px",
          width: "100%",
          display: loading ? "none" : "block",
        }}
      />
    </>
  );
};

export default Graph;
