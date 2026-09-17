import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, open, readFile, readdir, rename, rm, stat, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writePrivateSession } from "./private-session-file.mjs";

test("private session replacement preserves token and command identity across disk failure and retry",async()=>{
  const directory=await mkdtemp(join(tmpdir(),"ufd-session-test-")),path=join(directory,"session.json"),before={token:"private-token",pending:{commandId:"same-reset"}},after={...before,pending:{commandId:"next-reset"}};
  try {
    await writePrivateSession(path,before);
    await assert.rejects(writePrivateSession(path,after,{open,unlink,rename:async()=>{throw Error("disk failure");}}),/disk failure/);
    assert.deepEqual(JSON.parse(await readFile(path,"utf8")),before);assert.deepEqual(await readdir(directory),["session.json"]);
    await writePrivateSession(path,after,{open,unlink,rename});assert.deepEqual(JSON.parse(await readFile(path,"utf8")),after);assert.equal((await stat(path)).mode & 0o777,0o600);
  } finally { await rm(directory,{recursive:true,force:true}); }
});
