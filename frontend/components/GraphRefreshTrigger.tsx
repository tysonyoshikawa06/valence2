"use client";

import { useEffect } from "react";
import { refreshGraphFromExternal } from "./Graph";

/**
 * This component triggers a graph refresh when mounted on node pages.
 * It ensures the graph updates when users make progress on nodes.
 */
export default function GraphRefreshTrigger() {
  useEffect(() => {
    refreshGraphFromExternal();
  }, []);

  return null; // This component doesn't render anything
}
