# Shell animation performance

Research and browser measurements, September 12, 2026.

The workspace slide now reserves its final docking space once and uses a Web Animations API transform to interpolate the workspace's previous visual bounds into its new bounds (FLIP). The sidebar stays at its full width and only translates. Mobile retains the overlay drawer. Both keep the 500ms timing and shared easing.

The palette keeps its real 0–24px blur and 500ms dissolve. Its fullscreen backdrop now dims without blurring the entire underlying app. Layout/style containment and a targeted `will-change: opacity, filter` hint limit the rendering work to the mounted palette. This is a rendering hint, not a guarantee that the filter animation runs entirely on the compositor.

## What the research supports

Prefer transforms and opacity for motion; width changes cause layout work. Profile before promoting layers, because extra layers consume memory. These remain the browser team's recommendations, even though the foundational guidance predates newer animation APIs. [Browser animation guidance](https://web.dev/articles/animations-guide), [MDN on will-change](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/will-change).

A GPU-backed blur still has a cost. Chrome's trace reports flag `4096` for the palette's pixel-moving filter, corresponding to `filterMayMovePixels` in Lighthouse. A blanket `translateZ(0)` does not remove that restriction. The final implementation intentionally retains this filter to preserve the chosen visual effect. [Lighthouse diagnostic implementation](https://github.com/GoogleChrome/lighthouse/blob/main/core/audits/non-composited-animations.js), [Chromium compositor checks](https://github.com/chromium/chromium/blob/main/third_party/blink/renderer/core/animation/compositor_animations.cc).

We tested crossfading a cached, fixed-blur copy inside a promoted opacity layer. That removed the filter animation warning, but increased total CPU work and changed the appearance of the dissolve. It is not included in the implementation. This is a useful technique when profiling supports its extra rasterization and memory cost. [Chrome's animated-blur explanation](https://developer.chrome.com/blog/animated-blur).

Element-scoped View Transitions are a newer option: Chrome's March 2026 guide demonstrates subtree snapshots and concurrent transitions in Chrome 147+. Canvas closing now uses this API as a progressive enhancement: the outgoing panel snapshot plays `surface-land` in reverse over 500ms above a stationary neighbor. The agent and tab strip stay outside the scope; reduced motion and unsupported browsers close immediately. This sidebar uses the established Web Animations API so it can reverse immediately without introducing another snapshot lifecycle alongside React's existing surface transitions. [Element-scoped View Transitions](https://developer.chrome.com/docs/css-ui/view-transitions/element-scoped-view-transitions), [Web Animations API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Animations_API/Using_the_Web_Animations_API).

## Measurements

See [the recorded metrics](animation-performance.json). Baseline: commit `937c44c`; implementation: `2195660`. Both measurements used production builds, headless Chrome 152.0.7977.120 with GPU compositing enabled, a 1440 × 1100 viewport at DPR 2, Alex Morgan on ALM, and three open/close cycles at normal speed and 4× CPU throttling. Each window includes the interaction and a 650ms observation period. CDP Performance metrics supplied layout/style/task time; trace events supplied paint counts and paint time. These are whole-page measurements, including the running status indicator and automation overhead.

Medians across the six open/close samples at 4× CPU slowdown:

| Measurement | Before | After |
| --- | ---: | ---: |
| Sidebar: Layout time (ms) | 33.47 | 13.20 |
| Sidebar: Paint events | 244.50 | 96.00 |
| Sidebar: Paint time (ms) | 47.40 | 27.17 |
| Sidebar: Total task time (ms) | 174.81 | 91.49 |
| Palette: Layout time (ms) | 1.16 | 1.21 |
| Palette: Paint events | 6.50 | 6.50 |
| Palette: Paint time (ms) | 2.17 | 0.91 |
| Palette: Total task time (ms) | 44.95 | 37.59 |

The sidebar's width animation and its unsupported-property warning are gone. Chrome still performs layout bookkeeping while the transformed overflow bounds change; this is not a claim of zero layout events. The workspace's contents settle into the new layout once, with horizontal scaling during the slide. That brief scaling is the visual tradeoff for avoiding continuous text reflow; the sidebar's text is never scaled.

CPU throttling does not simulate a slower GPU. The final run held approximately 16.7ms frame intervals at the 95th percentile. This headless machine did not reproduce the reported visible stutter reliably, so these measurements demonstrate lower rendering cost, not guaranteed frame rates on every display or device. Palette CPU gains were smaller and less consistent than the sidebar gains; its full-screen blur work has been removed.

To repeat manually, build and start the app in production mode, select Alex Morgan, open ALM, and record three workspace toggles and three palette open/close cycles in Chrome DevTools Performance. Repeat at 4× CPU slowdown. Inspect Layout, Paint, non-composited animation reasons, and frame delivery separately. Check real-device behavior at high refresh rates as well as normal motion and reduced motion.

## Interaction checks

Browser checks cover both directions, fixed panel width and no blur, the palette's original blur and duration, retained controls/state, Escape and backdrop dismissal, focus restoration, delayed selections and surface-snapshot handoff, rapid reopen cancellation, mobile overflow, and reduced motion. Additional frame checks keep the panel/workspace seam aligned during rapid reversals and verify that resizing or enabling reduced motion releases the active workspace transform. CSS reversal duration and start time are shared with the Web Animations API animation; finished animations are released.

Production build, TypeScript, and seven onboarding tests pass. Lint retains only the existing stylesheet warning in `src/app/layout.tsx`.
