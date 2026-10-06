export const DATABASE_TEST_FILES = Object.freeze({
  application: Object.freeze(["database.test.mjs", "expired-namespace-retention.test.mjs"]),
  agent: Object.freeze(["agent-database.test.mjs", "model-database.test.mjs"]),
});

export function pureTestFiles(files) {
  const database = new Set(Object.values(DATABASE_TEST_FILES).flat());
  return files.filter(name => name.endsWith(".test.mjs") && !database.has(name)).sort();
}
