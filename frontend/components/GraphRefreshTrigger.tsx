"use client";

import { useEffect } from "react";
import { refreshGraphFromExternal } from "./Graph";

/**
 * This component triggers a graph refresh when mounted on node pages.
 * It ensures the graph updates when users make progress on nodes.
 */
export default function GraphRefreshTrigger() {
  useEffect(() => {
    // Invalidate cache when node page is loaded
    refreshGraphFromExternal();

    // Dispatch event to refresh graph if it's mounted
    window.dispatchEvent(new Event("refreshGraph"));

    // Set up interval to refresh while on node page (in case progress is made)
    const interval = setInterval(() => {
      window.dispatchEvent(new Event("refreshGraph"));
    }, 5000); // Refresh every 5 seconds while on node page

    return () => clearInterval(interval);
  }, []);

  return null; // This component doesn't render anything
}
