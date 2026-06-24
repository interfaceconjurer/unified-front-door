// Copies the SLDS 2 (Cosmos) bundled stylesheet from node_modules into
// public/vendor/slds so it can be served as a static <link> stylesheet.
//
// Why not `import` the CSS in layout.tsx? The bundled SLDS CSS references
// optional decorative assets via url('../../public/...') that the package
// doesn't ship. Next's bundler treats those as hard build errors, while a
// plain <link> stylesheet simply 404s them harmlessly. Loading SLDS as a
// static stylesheet is also the Salesforce-documented approach.
//
// Runs automatically via the `predev` / `prebuild` npm scripts.
import { copyFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const pkgRoot = dirname(
  require.resolve("@salesforce-ux/design-system-2/package.json")
);
const src = resolve(pkgRoot, "dist/css/bundled/slds2.cosmos.css");
const destDir = resolve(root, "public/vendor/slds");
const dest = resolve(destDir, "slds2.cosmos.css");

await mkdir(destDir, { recursive: true });
await copyFile(src, dest);
console.log("[copy-slds] -> public/vendor/slds/slds2.cosmos.css");
