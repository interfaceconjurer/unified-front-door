/**
 * Inline SVG icon set.
 *
 * SLDS 2 ships no icon sprite in the npm package (the `icon` component is
 * CSS-only and expects you to supply the SVG), so for this self-contained
 * prototype we hand-roll a small set of line icons. Each inherits `currentColor`
 * and is marked `aria-hidden` — accessible names live on the surrounding
 * control (link/button), not the glyph.
 */
import type { SVGProps } from "react";

export type IconComponent = (props: SVGProps<SVGSVGElement>) => React.ReactElement;

function Svg(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    />
  );
}

export const HomeIcon: IconComponent = (p) => (
  <Svg {...p}>
    <path d="M3 11 12 4l9 7" />
    <path d="M5 10v9h14v-9" />
    <path d="M10 19v-5h4v5" />
  </Svg>
);

export const ChartIcon: IconComponent = (p) => (
  <Svg {...p}>
    <path d="M5 4v16h15" />
    <path d="M9 18v-4" />
    <path d="M13 18v-8" />
    <path d="M17 18v-3" />
  </Svg>
);

export const ChevronLeftIcon: IconComponent = (p) => (
  <Svg {...p}>
    <path d="M14 6l-6 6 6 6" />
  </Svg>
);

export const ChevronRightIcon: IconComponent = (p) => (
  <Svg {...p}>
    <path d="M10 6l6 6-6 6" />
  </Svg>
);

export const LayersIcon: IconComponent = (p) => (
  <Svg {...p}>
    <path d="M12 4 3 9l9 5 9-5-9-5z" />
    <path d="M3 14l9 5 9-5" />
  </Svg>
);

export const SparklesIcon: IconComponent = (p) => (
  <Svg {...p}>
    <path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6z" />
    <path d="M18.5 14l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z" />
  </Svg>
);

export const SendIcon: IconComponent = (p) => (
  <Svg {...p}>
    <path d="M12 20V6" />
    <path d="M6 12l6-6 6 6" />
  </Svg>
);

export const SearchIcon: IconComponent = (p) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="6" />
    <path d="M20 20l-3.5-3.5" />
  </Svg>
);

export const FolderIcon: IconComponent = (p) => (
  <Svg {...p}>
    <path d="M3 7a1 1 0 0 1 1-1h4.5l2 2H20a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" />
  </Svg>
);

export const GridIcon: IconComponent = (p) => (
  <Svg {...p}>
    <rect x="4" y="4" width="7" height="7" rx="1.5" />
    <rect x="13" y="4" width="7" height="7" rx="1.5" />
    <rect x="4" y="13" width="7" height="7" rx="1.5" />
    <rect x="13" y="13" width="7" height="7" rx="1.5" />
  </Svg>
);

export const PuzzleIcon: IconComponent = (p) => (
  <Svg {...p}>
    <path d="M10 5a2 2 0 1 1 4 0h4a1 1 0 0 1 1 1v4a2 2 0 1 0 0 4v4a1 1 0 0 1-1 1h-4a2 2 0 1 1-4 0H6a1 1 0 0 1-1-1v-4a2 2 0 1 0 0-4V6a1 1 0 0 1 1-1z" />
  </Svg>
);

export const ShieldIcon: IconComponent = (p) => (
  <Svg {...p}>
    <path d="M12 3l7 3v5c0 4.5-3 7.6-7 9-4-1.4-7-4.5-7-9V6z" />
    <path d="M9 12l2 2 4-4" />
  </Svg>
);

export const ListCheckIcon: IconComponent = (p) => (
  <Svg {...p}>
    <path d="M10 6h10M10 12h10M10 18h10" />
    <path d="M4 5.6l1.2 1.2L7.5 4.5" />
    <path d="M4 11.6l1.2 1.2L7.5 10.5" />
    <path d="M4 17.6l1.2 1.2L7.5 16.5" />
  </Svg>
);

export const GitBranchIcon: IconComponent = (p) => (
  <Svg {...p}>
    <circle cx="6" cy="6" r="2.5" />
    <circle cx="6" cy="18" r="2.5" />
    <circle cx="18" cy="9" r="2.5" />
    <path d="M6 8.5v7" />
    <path d="M18 11.5a6 6 0 0 1-6 6H8.5" />
  </Svg>
);

export const BeakerIcon: IconComponent = (p) => (
  <Svg {...p}>
    <path d="M9 3h6" />
    <path d="M10 3v5.5L5.2 17A2 2 0 0 0 7 20h10a2 2 0 0 0 1.8-3L14 8.5V3" />
    <path d="M7.5 14h9" />
  </Svg>
);

export const DatabaseIcon: IconComponent = (p) => (
  <Svg {...p}>
    <ellipse cx="12" cy="6" rx="7" ry="3" />
    <path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6" />
    <path d="M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" />
  </Svg>
);

export const WorkflowIcon: IconComponent = (p) => (
  <Svg {...p}>
    <rect x="3" y="3" width="8" height="8" rx="2" />
    <rect x="13" y="13" width="8" height="8" rx="2" />
    <path d="M7 11v4a2 2 0 0 0 2 2h4" />
  </Svg>
);

export const FileIcon: IconComponent = (p) => (
  <Svg {...p}>
    <path d="M6 3h8l4 4v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
    <path d="M14 3v4h4" />
  </Svg>
);

export const ClipboardIcon: IconComponent = (p) => (
  <Svg {...p}>
    <path d="M9 4H7a1 1 0 0 0-1 1v15a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1h-2" />
    <rect x="9" y="3" width="6" height="3.2" rx="1" />
    <path d="M9 11h6M9 15h4" />
  </Svg>
);

export const LinkIcon: IconComponent = (p) => (
  <Svg {...p}>
    <path d="M10 13a4 4 0 0 0 5.7.4l2.6-2.6a4 4 0 0 0-5.7-5.7L11 6.6" />
    <path d="M14 11a4 4 0 0 0-5.7-.4L5.7 13.2a4 4 0 0 0 5.7 5.7L13 17.4" />
  </Svg>
);

export const PlusIcon: IconComponent = (p) => (
  <Svg {...p}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);

export const CloseIcon: IconComponent = (p) => (
  <Svg {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Svg>
);

export const SunIcon: IconComponent = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </Svg>
);

export const CheckIcon: IconComponent = (p) => (
  <Svg {...p}>
    <path d="M5 12.5l4 4L19 7" />
  </Svg>
);

export const PanelIcon: IconComponent = (p) => (
  <Svg {...p}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M9.5 4v16" />
  </Svg>
);

export const ServerIcon: IconComponent = (p) => (
  <Svg {...p}>
    <rect x="3" y="4" width="18" height="7" rx="1.5" />
    <rect x="3" y="13" width="18" height="7" rx="1.5" />
    <path d="M7 7.5h.01M7 16.5h.01" />
  </Svg>
);
