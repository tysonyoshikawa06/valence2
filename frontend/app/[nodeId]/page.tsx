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
import GraphRefreshTrigger from "@/components/GraphRefreshTrigger";

// ============================================================================
// TYPES
// ============================================================================

interface NodePageProps {
  params: Promise<{ nodeId: string }>;
}

interface Graph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

interface GraphNode {
  group: "nodes";
  data: {
    id: string;
    label: string;
    unit: string;
    description: string;
  };
}

interface GraphEdge {
  group: "edges";
  data: {
    source: string;
    target: string;
    description?: string;
  };
}

interface Neighbor {
  nodeId: string;
  label: string;
  edgeDescription: string;
}

// ============================================================================
// HELPERS
// ============================================================================

function loadGraphData(): Graph {
  const filePath = path.join(process.cwd(), "public", "data", "apchem.json");
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

function findNode(graph: Graph, nodeId: string): GraphNode | undefined {
  return graph.nodes.find((n) => n.data.id === nodeId);
}

function getNodeNeighbors(graph: Graph, nodeId: string): Neighbor[] {
  const neighbors: Neighbor[] = [];

  graph.edges.forEach((edge) => {
    let neighborId: string | null = null;
    if (edge.data.source === nodeId) neighborId = edge.data.target;
    else if (edge.data.target === nodeId) neighborId = edge.data.source;

    if (neighborId) {
      const neighborNode = findNode(graph, neighborId);
      if (neighborNode) {
        neighbors.push({
          nodeId: neighborId,
          label: neighborNode.data.label,
          edgeDescription: edge.data.description || "Related concept",
        });
      }
    }
  });

  return neighbors;
}

async function loadMDXContent(nodeId: string) {
  const contentPath = path.join(process.cwd(), "content", `${nodeId}.mdx`);
  if (!fs.existsSync(contentPath)) return null;

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
  return content;
}

// ============================================================================
// PAGE
// ============================================================================

export default async function NodePage({ params }: NodePageProps) {
  const { nodeId } = await params;

  const graph = loadGraphData();
  const node = findNode(graph, nodeId);

  if (!node) {
    return (
      <div className="min-h-screen bg-[#edf9fe] flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-[#001554] mb-2">Node Not Found</h1>
          <p className="text-[#93a0ba] mb-4">The node "{nodeId}" does not exist.</p>
          <Link href="/">
            <button className="px-4 py-2 bg-[#001554] text-white rounded-lg hover:bg-[#001554]/80 transition-colors cursor-pointer">
              Return to Graph
            </button>
          </Link>
        </div>
      </div>
    );
  }

  const nodeLabel = node.data.label;
  const nodeUnit = node.data.unit;
  const neighbors = getNodeNeighbors(graph, nodeId);
  const content = await loadMDXContent(nodeId);

  if (!content) {
    return (
      <div className="min-h-screen bg-[#edf9fe]">
        <GraphRefreshTrigger />

        <header className="bg-[#001554] sticky top-0 z-10">
          <div className="container mx-auto px-4 py-4">
            <Link href="/">
              <button className="text-[#93a0ba] hover:text-white font-medium mb-2 flex items-center gap-1 transition-colors cursor-pointer text-sm">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to Graph
              </button>
            </Link>
            <h1 className="text-2xl font-bold text-white">{nodeUnit}: {nodeLabel}</h1>
          </div>
        </header>

        <div className="container mx-auto px-4 py-12">
          <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-sm p-8 text-center">
            <div className="text-5xl mb-4">📝</div>
            <h2 className="text-xl font-bold text-[#001554] mb-2">Content Coming Soon</h2>
            <p className="text-[#93a0ba] mb-6">
              The educational content for <strong>{nodeLabel}</strong> is currently being developed.
            </p>
            <Link href="/">
              <button className="px-4 py-2 bg-[#001554] text-white rounded-lg hover:bg-[#001554]/80 transition-colors cursor-pointer">
                Return to Graph
              </button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#edf9fe]">
      <GraphRefreshTrigger />

      {/* Header */}
      <header className="bg-[#001554] sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <Link href="/">
            <button className="text-[#93a0ba] hover:text-white font-medium mb-1.5 flex items-center gap-1 transition-colors cursor-pointer text-sm">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Graph
            </button>
          </Link>
          <h1 className="text-2xl font-bold text-white">{nodeUnit}: {nodeLabel}</h1>
        </div>
      </header>

      {/* 3-column layout */}
      <main className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Neighbors */}
          <aside className="lg:col-span-3">
            <div className="lg:sticky lg:top-24">
              <NeighborsList neighbors={neighbors} currentNodeId={nodeId} />
            </div>
          </aside>

          {/* Center: MDX content */}
          <section className="lg:col-span-6">
            <article className="bg-white rounded-xl shadow-sm p-6 lg:p-8">
              <div className="prose prose-lg max-w-none prose-headings:text-[#001554] prose-a:text-[#001554]">
                {content}
              </div>
            </article>
          </section>

          {/* Right: Chat + Progress */}
          <aside className="lg:col-span-3">
            <div className="lg:sticky lg:top-24 space-y-3">
              {/* Val chat */}
              <div className="bg-white rounded-xl shadow-sm p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-7 h-7 bg-[#001554] rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-xs font-bold">V</span>
                  </div>
                  <h2 className="text-base font-semibold text-[#001554]">Chat with Val</h2>
                </div>
                <ValComponent nodeLabel={nodeLabel} nodeId={nodeId} />
              </div>

              {/* Progress bar — below chat */}
              <div className="bg-white rounded-xl shadow-sm px-4 py-3">
                <NodeProgress nodeId={nodeId} />
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
