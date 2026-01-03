"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import cytoscape, { Core } from "cytoscape";

const Graph = ({ onCyInit }: { onCyInit?: (cyInstance: Core) => void }) => {
  const cyContainer = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    const initializeUserGraph = async () => {
      const token = localStorage.getItem("token");
      if (!token) {
        console.error("No auth token found");
        return;
      }

      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/initialize-graph`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (response.ok) {
          const data = await response.json();
          console.log("Graph initialized:", data);
        } else {
          console.error("Failed to initialize graph");
        }
      } catch (error) {
        console.error("Error initializing graph:", error);
      }
    };

    const loadGraph = async () => {
      // Initialize user's graph data in database
      await initializeUserGraph();

      // Load graph
      const res = await fetch("/data/apchem.json");
      const data = await res.json();

      if (cyContainer.current) {
        const cyInstance = cytoscape({
          container: cyContainer.current,
          elements: [...data.nodes, ...data.edges],
          layout: {
            name: "cose",
            idealEdgeLength: 100,
            nodeRepulsion: 400000,
            gravity: 80,
            numIter: 1000,
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
                "background-color": "#ccc",
              },
            },
            {
              selector:
                'node[unit = "Unit 1: Atomic Structures and Properties"]',
              style: {
                "background-color": "#60a5fa",
              },
            },
            {
              selector:
                'node[unit = "Unit 2: Compound Structure and Properties"]',
              style: {
                "background-color": "#F87171",
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

        cyInstance.on("tap", "node", (event) => {
          const node = event.target;
          const nodeId = node.id();
          router.push(`/${nodeId}`);
        });

        if (onCyInit) {
          onCyInit(cyInstance);
        }
      }
    };

    loadGraph();
  }, [router, onCyInit]);

  return (
    <>
      <div ref={cyContainer} style={{ height: "600px", width: "100%" }} />
    </>
  );
};

export default Graph;
