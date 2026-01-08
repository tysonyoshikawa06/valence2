import fs from "fs";
import path from "path";
import { compileMDX } from "next-mdx-remote/rsc";
import ValComponent from "@/components/ValComponent";
import NodeProgress from "@/components/NodeProgress";
import NeighborsList from "@/components/NeighborsList";
import Link from "next/link";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

interface NodePageProps {
  params: { nodeId: string };
}

type Graph = {
  nodes: Node[];
  edges: Edge[];
};

type Node = {
  group: "nodes";
  data: {
    id: string;
    label: string;
    unit: string;
    description: string;
  };
};

type Edge = {
  group: "edges";
  data: {
    source: string;
    target: string;
    description?: string;
  };
};

export default async function NodePage({ params }: NodePageProps) {
  const { nodeId } = await params;

  // Get graph data from json file
  const filePath = path.join(process.cwd(), "public", "data", "apchem.json");
  const fileContents = fs.readFileSync(filePath, "utf-8");
  const graph: Graph = JSON.parse(fileContents);

  // Get node properties
  const node = graph.nodes.find((n: Node) => n.data.id === nodeId);
  const nodeLabel = node?.data.label ?? "Unknown";
  const nodeUnit = node?.data.unit ?? "Unknown";

  // Get neighbors with edge descriptions
  const neighbors: Array<{
    nodeId: string;
    label: string;
    edgeDescription: string;
  }> = [];

  graph.edges.forEach((edge) => {
    let neighborId: string | null = null;

    if (edge.data.source === nodeId) {
      neighborId = edge.data.target;
    } else if (edge.data.target === nodeId) {
      neighborId = edge.data.source;
    }

    if (neighborId) {
      const neighborNode = graph.nodes.find((n) => n.data.id === neighborId);
      if (neighborNode) {
        neighbors.push({
          nodeId: neighborId,
          label: neighborNode.data.label,
          edgeDescription: edge.data.description || "Related concept",
        });
      }
    }
  });

  // Read and compile MDX file with math support
  const contentPath = path.join(process.cwd(), "content", `${nodeId}.mdx`);
  if (!fs.existsSync(contentPath)) {
    return <>nodeId: {nodeId}</>;
  }

  const mdxSource = fs.readFileSync(contentPath, "utf-8");

  const { content } = await compileMDX({
    source: mdxSource,
    options: {
      mdxOptions: {
        remarkPlugins: [remarkMath],
        rehypePlugins: [rehypeKatex],
      },
    },
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <Link href={"/"}>
            <button className="text-blue-600 hover:text-blue-800 mb-2">
              ← Return to Graph
            </button>
          </Link>
          <h1 className="text-3xl font-bold">
            {nodeUnit}: {nodeLabel}
          </h1>
        </div>
      </div>

      {/* 3-Column Layout */}
      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-12 gap-6">
          {/* Left Sidebar - Neighbors */}
          <div className="col-span-3">
            <div className="sticky top-24">
              <NeighborsList neighbors={neighbors} currentNodeId={nodeId} />
            </div>
          </div>

          {/* Middle - Content */}
          <div className="col-span-6">
            {/* Node Progress */}
            <div className="mb-6">
              <NodeProgress nodeId={nodeId} />
            </div>

            {/* MDX Content */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="prose prose-lg max-w-none">{content}</div>
            </div>
          </div>

          {/* Right Sidebar - Chat */}
          <div className="col-span-3">
            <div className="sticky top-24">
              <div className="bg-white rounded-lg shadow-sm p-4">
                <h2 className="text-xl font-semibold mb-4">Chat with Val</h2>
                <ValComponent nodeLabel={nodeLabel} nodeId={nodeId} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
