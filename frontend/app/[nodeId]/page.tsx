import fs from "fs";
import path from "path";
import { MDXRemote } from "next-mdx-remote/rsc";
import ValComponent from "@/components/ValComponent";

interface NodePageProps {
  params: { nodeId: string };
}

type Graph = {
  nodes: Node[];
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

export default async function NodePage({ params }: NodePageProps) {
  const { nodeId } = await params;

  // Get node label
  function getGraphData(): Graph {
    const filePath = path.join(process.cwd(), "public", "data", "apchem.json");

    const fileContents = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(fileContents) as Graph;
  }

  function getPropertyByNodeId(
    nodeId: string,
    property: "label" | "unit"
  ): string {
    const graph = getGraphData();
    const node = graph.nodes.find((n: Node) => n.data.id === nodeId);
    return node?.data[property] ?? "Unknown";
  }

  const nodeLabel = getPropertyByNodeId(nodeId, "label");
  const nodeUnit = getPropertyByNodeId(nodeId, "unit");

  // Read mdx file
  const contentPath = path.join(process.cwd(), "content", `${nodeId}.mdx`);
  if (!fs.existsSync(contentPath)) {
    return <>nodeId: {nodeId}</>;
  }
  const mdxContent = fs.readFileSync(contentPath, "utf-8");

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-3xl font-bold mb-4">
        {nodeUnit}: {nodeLabel}
      </h1>

      <MDXRemote source={mdxContent} />

      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-4">Chat with Val</h2>
        <ValComponent nodeLabel={nodeLabel} />
      </div>
    </div>
  );
}
