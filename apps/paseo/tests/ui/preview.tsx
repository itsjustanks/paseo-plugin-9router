import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AgentLinkSurface } from "../../client/surface";
const queryClient = new QueryClient();
const light = new URLSearchParams(location.search).has("light");
const colors = light ? {
  surface0: "#f5f6f8", surface1: "#ffffff", surface2: "#edf0f4", border: "#d7dbe1", foreground: "#20252d",
  foregroundMuted: "#606b78", accent: "#4f46e5", accentForeground: "#ffffff", statusSuccess: "#15803d", statusWarning: "#a16207", statusDanger: "#b91c1c",
} : {
  surface0: "#11151b", surface1: "#1a2029", surface2: "#252d38", border: "#394352", foreground: "#eef1f6",
  foregroundMuted: "#a2adbc", accent: "#a5b4fc", accentForeground: "#14192c", statusSuccess: "#6ee7a0", statusWarning: "#facc6b", statusDanger: "#fda4af",
};
function Preview() {
  const [compact, setCompact] = useState(innerWidth < 640);
  useEffect(() => { const resize = () => setCompact(innerWidth < 640); addEventListener("resize", resize); return () => removeEventListener("resize", resize); }, []);
  return <QueryClientProvider client={queryClient}><AgentLinkSurface theme={{ colors }} host={{ id: "preview", label: "My laptop" }} layout={{ compact, platform: "web" }} /></QueryClientProvider>;
}
createRoot(document.getElementById("root")!).render(<Preview />);
