import fs from "fs";
import path from "path";
import { MDXRemote } from "next-mdx-remote/rsc";
import { notFound } from "next/navigation";
import ValComponent from "@/components/ValComponent";

interface NodePageProps {
  params: { nodeId: string };
}

export default async function NodePage({ params }: NodePageProps) {
  const { nodeId } = await params;

  // Read mdx file
  const contentPath = path.join(process.cwd(), "content", `${nodeId}.mdx`);
  if (!fs.existsSync(contentPath)) {
    return <>nodeId: {nodeId}</>;
  }
  const mdxContent = fs.readFileSync(contentPath, "utf-8");

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-3xl font-bold mb-4">{nodeId}</h1>

      <MDXRemote source={mdxContent} />

      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-4">Chat with Val</h2>
        <ValComponent nodeId={nodeId} />
      </div>
    </div>
  );
}
