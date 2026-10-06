import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const advisory = "https://github.com/advisories/GHSA-vfj7-8cjw-p6xm";
const knownDevChain = new Map([
  ["eslint-config-next", "@next/eslint-plugin-next"],
  ["@next/eslint-plugin-next", "fast-glob"],
  ["fast-glob", "micromatch"],
  ["micromatch", "braces"],
  ["braces", advisory],
]);
const lock = JSON.parse(readFileSync(new URL("../package-lock.json", import.meta.url), "utf8"));

function audit(args, includeDev) {
  const env = { ...process.env };
  if (includeDev) env.NPM_CONFIG_INCLUDE = "dev";
  else delete env.NPM_CONFIG_INCLUDE;
  const result = spawnSync("npm", ["audit", "--json", "--audit-level=moderate", ...args], {
    encoding: "utf8", env, maxBuffer: 16 * 1024 * 1024,
  });
  if (result.error || ![0, 1].includes(result.status)) {
    throw new Error(`npm audit failed: ${result.error?.message ?? result.stderr}`);
  }
  let report;
  try { report = JSON.parse(result.stdout); }
  catch { throw new Error(`npm audit returned invalid JSON: ${result.stderr}`); }
  if (report.error || !report.vulnerabilities) {
    throw new Error(`npm audit did not return a vulnerability report: ${JSON.stringify(report.error)}`);
  }
  return report.vulnerabilities;
}

try {
  const production = audit(["--omit=dev"], false);
  if (Object.keys(production).length) {
    throw new Error(`Production dependency audit found: ${Object.keys(production).join(", ")}`);
  }

  const all = audit(["--include=dev"], true);
  if (Object.keys(all).length) {
    const expected = [...knownDevChain.keys()].sort();
    const actual = Object.keys(all).sort();
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw new Error(`Unexpected dependency audit findings: ${actual.join(", ")}`);
    }
    for (const [name, next] of knownDevChain) {
      const finding = all[name];
      const dependency = lock.packages[`node_modules/${name}`];
      if (!dependency?.dev || finding.severity !== "high" || finding.via.length !== 1) {
        throw new Error(`The known development-only audit exception changed: ${name}`);
      }
      const via = finding.via[0];
      if (name === "braces"
        ? dependency.version !== "3.0.3" || via?.url !== next || via?.name !== name
        : via !== next) {
        throw new Error(`The known development-only audit path changed: ${name}`);
      }
    }
    console.warn(`Temporary development-only audit exception: ${advisory}`);
  }
  console.log("Dependency audit passed.");
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
