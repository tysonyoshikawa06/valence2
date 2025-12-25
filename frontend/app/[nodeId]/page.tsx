import fs from "fs";
import path from "path";
import { MDXRemote } from "next-mdx-remote/rsc";
import { notFound } from "next/navigation";

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
    <div className="container mx-auto p-8 prose prose-lg">
      <h1 className="text-3xl font-bold mb-4">{nodeId}</h1>
      <MDXRemote source={mdxContent} />
    </div>
  );
}
