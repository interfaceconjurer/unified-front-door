import { CanvasArea } from "@/components/canvas/CanvasArea";

// The middle work surface is the canvas area: a tab bar of open canvases over a
// canvas stage. The surrounding chrome — top bar, left nav, and the agent chat
// panel on the right — all live in AppShell (see src/app/layout.tsx).
export default function Home() {
  return <CanvasArea />;
}
