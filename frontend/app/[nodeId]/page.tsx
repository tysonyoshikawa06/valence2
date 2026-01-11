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
// HELPER FUNCTIONS
// ============================================================================

/**
 * Load graph structure from JSON file
 */
function loadGraphData(): Graph {
  const filePath = path.join(process.cwd(), "public", "data", "apchem.json");
  const fileContents = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(fileContents);
}

/**
 * Find a node by ID
 */
function findNode(graph: Graph, nodeId: string): GraphNode | undefined {
  return graph.nodes.find((n) => n.data.id === nodeId);
}

/**
 * Get all neighbors of a node with edge descriptions
 */
function getNodeNeighbors(graph: Graph, nodeId: string): Neighbor[] {
  const neighbors: Neighbor[] = [];

  graph.edges.forEach((edge) => {
    // Determine if this edge connects to our node
    let neighborId: string | null = null;

    if (edge.data.source === nodeId) {
      neighborId = edge.data.target;
    } else if (edge.data.target === nodeId) {
      neighborId = edge.data.source;
    }

    // If connected, add neighbor info
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

/**
 * Load and compile MDX content
 */
async function loadMDXContent(nodeId: string) {
  const contentPath = path.join(process.cwd(), "content", `${nodeId}.mdx`);

  // Check if file exists
  if (!fs.existsSync(contentPath)) {
    return null;
  }

  // Read and compile
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
// MAIN PAGE COMPONENT
// ============================================================================

export default async function NodePage({ params }: NodePageProps) {
  // Await params (Next.js 15+ requirement)
  const { nodeId } = await params;

  // Load graph data
  const graph = loadGraphData();

  // Get node information
  const node = findNode(graph, nodeId);
  if (!node) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Node Not Found
          </h1>
          <p className="text-gray-600 mb-4">
            The node "{nodeId}" does not exist.
          </p>
          <Link href="/">
            <button className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600">
              Return to Graph
            </button>
          </Link>
        </div>
      </div>
    );
  }

  const nodeLabel = node.data.label;
  const nodeUnit = node.data.unit;

  // Get neighbors
  const neighbors = getNodeNeighbors(graph, nodeId);

  // Load MDX content
  const content = await loadMDXContent(nodeId);

  // Handle missing content
  if (!content) {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b sticky top-0 z-10">
          <div className="container mx-auto px-4 py-4">
            <Link href="/">
              <button className="text-blue-600 hover:text-blue-800 font-medium mb-2 flex items-center gap-1">
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
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
                Return to Graph
              </button>
            </Link>
            <h1 className="text-3xl font-bold text-gray-900">
              {nodeUnit}: {nodeLabel}
            </h1>
          </div>
        </div>

        {/* Content Missing Message */}
        <div className="container mx-auto px-4 py-12">
          <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-sm p-8 text-center">
            <div className="text-6xl mb-4">📝</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Content Coming Soon
            </h2>
            <p className="text-gray-600 mb-6">
              The educational content for <strong>{nodeLabel}</strong> is
              currently being developed.
            </p>
            <Link href="/">
              <button className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600">
                Return to Graph
              </button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // RENDER FULL PAGE
  // ============================================================================

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ====== HEADER ====== */}
      <header className="bg-white border-b sticky top-0 z-10 shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <Link href="/">
            <button className="text-blue-600 hover:text-blue-800 font-medium mb-2 flex items-center gap-1 transition-colors">
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
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              Return to Graph
            </button>
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">
            {nodeUnit}: {nodeLabel}
          </h1>
        </div>
      </header>

      {/* ====== 3-COLUMN LAYOUT ====== */}
      <main className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* ====== LEFT SIDEBAR - NEIGHBORS ====== */}
          <aside className="lg:col-span-3">
            <div className="lg:sticky lg:top-24">
              <NeighborsList neighbors={neighbors} currentNodeId={nodeId} />
            </div>
          </aside>

          {/* ====== MIDDLE - MAIN CONTENT ====== */}
          <section className="lg:col-span-6">
            {/* Progress Component */}
            <div className="mb-6">
              <NodeProgress nodeId={nodeId} />
            </div>

            {/* MDX Content */}
            <article className="bg-white rounded-lg shadow-sm p-6 lg:p-8">
              <div className="prose prose-lg prose-blue max-w-none">
                {content}
              </div>
            </article>
          </section>

          {/* ====== RIGHT SIDEBAR - CHAT ====== */}
          <aside className="lg:col-span-3">
            <div className="lg:sticky lg:top-24">
              <div className="bg-white rounded-lg shadow-sm p-4">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                    <span className="text-white text-sm font-bold">V</span>
                  </div>
                  <h2 className="text-xl font-semibold text-gray-900">
                    Chat with Val
                  </h2>
                </div>
                <ValComponent nodeLabel={nodeLabel} nodeId={nodeId} />
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
