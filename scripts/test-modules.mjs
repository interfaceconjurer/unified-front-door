import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";
/** Compile real modules once per suite, preserving their actual import graph. */
export function testModules(extra = []) {
  const output = mkdtempSync(join(tmpdir(), "ufd-domain-test-"));
  symlinkSync(resolve("node_modules"), join(output, "node_modules"), "dir");
  const files = [];
  function walk(folder) { for (const entry of readdirSync(folder, { withFileTypes: true })) { const path = join(folder, entry.name); if (entry.isDirectory()) walk(path); else if (/\.[tj]s$/.test(path)) files.push(path); } }
  walk("src/lib");
  for (const path of [...files, ...extra]) {
    const name = relative("src", path);
    const source = readFileSync(path, "utf8").replace(/(["'])@\/([^"']+)\1/g, (_all, quote, target) => `${quote}./${relative(dirname(name), target)}${quote}`)
      .replace(/import styles from "[^"]+\.module\.css";/g, "const styles = {};");
    const target = join(output, name.replace(/\.tsx?$/, ".js")); mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText);
  }
  const require = createRequire(import.meta.url);
  return { load: (name) => require(join(output, `${name}.js`)), cleanup: () => rmSync(output, { recursive: true, force: true }) };
}
