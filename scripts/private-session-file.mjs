import { open, rename, unlink } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { dirname } from "node:path";

/** Replace the private recovery record only after its complete successor reaches disk. */
export async function writePrivateSession(path, value, operations = { open, rename, unlink }) {
  const temporary = `${path}.${randomUUID()}.tmp`;
  let file;
  try {
    file = await operations.open(temporary, "wx", 0o600);
    await file.writeFile(JSON.stringify(value));
    await file.sync(); await file.close(); file = null;
    await operations.rename(temporary, path);
    file = await operations.open(dirname(path), "r");
    await file.sync(); await file.close(); file = null;
  } finally {
    await file?.close().catch(() => {});
    await operations.unlink(temporary).catch(() => {});
  }
}
