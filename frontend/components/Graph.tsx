"use client";
import { useRouter } from "next/navigation";
import React, { useEffect, useRef, useState } from "react";
import cytoscape, { Core } from "cytoscape";

// onCyInit is an optional prop; if provided, must take a Core parameter
const Graph = ({ onCyInit }: { onCyInit?: (cyInstance: Core) => void }) => {
  // creates pointer to div element (initialized below through ref={cy})
  const cyContainer = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    const loadGraph = async () => {
      const res = await fetch("/data/apchem.json");
      const data = await res.json();

      if (cyContainer.current) {
        const cyInstance = cytoscape({
          // this container is the div element that cyContainer.current references
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
                "background-color": "#ccc", // default color
              },
            },
            {
              selector:
                'node[unit = "Unit 1: Atomic Structures and Properties"]',
              style: {
                "background-color": "#60a5fa", // tailwind's blue 400
              },
            },
            {
              selector:
                'node[unit = "Unit 2: Compound Structure and Properties"]',
              style: {
                "background-color": "#F87171", // tailwind's red 400
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
          const nodeId = node.id(); // unique node id
          router.push(`/${nodeId}`); // navigate to dynamic route
        });

        // pass instance back to parent
        // check to see if onCyInit exists since it is typed as an optional prop
        if (onCyInit) {
          onCyInit(cyInstance);
        }
      }
    };
    loadGraph();
  }, []);

  return (
    <>
      <div ref={cyContainer} style={{ height: "600px", width: "100%" }} />
    </>
  );
};

export default Graph;
