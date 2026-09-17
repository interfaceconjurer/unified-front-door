process.env.AGENT_PROVIDER = "demo";
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { testModules } from "./test-modules.mjs";
if (!process.env.DATABASE_TEST_URL) throw new Error("DATABASE_TEST_URL must explicitly identify an isolated development/test database.");
process.env.DATABASE_URL = process.env.DATABASE_TEST_URL;
process.env.DATABASE_URL_UNPOOLED = process.env.DATABASE_TEST_URL_UNPOOLED ?? "";
const modules = testModules();
const { transaction, databasePool } = modules.load("lib/db");
const { bootstrap, changeSession, requireSession, findSession, seedWorkspace } = modules.load("lib/server/session");
const { executeCommand } = modules.load("lib/server/application");
const { readWorkspace } = modules.load("lib/server/repository");
const { workerTick, claimRun, applyStep } = modules.load("lib/server/agent-worker");
const { observeAgent, executeAgentCommand } = modules.load("lib/server/agent");
const { demoAdapter } = modules.load("lib/agent/demo");
const fastAdapter = { async step(...args) { const result = await demoAdapter.step(...args); return result.kind === "progress" ? { ...result, delayMs: 0 } : result; } };
const { readImportedSource } = modules.load("lib/server/import");
const { lockCanvasQuota, DEMO_LIMITS } = modules.load("lib/server/quota");
const { canvasId } = modules.load("lib/surface-canvas/model");
const namespaces = [];
const namespaceJournal = join(tmpdir(), `ufd-phase5-application-test-namespaces-${process.pid}-${randomUUID()}.json`);
const journalNamespaces = () => writeFileSync(namespaceJournal, JSON.stringify(namespaces), { mode: 0o600 });
after(async () => {
  for (const id of namespaces) await transaction(async c => {
    await c.query("DELETE FROM session_receipts WHERE session_id IN (SELECT id FROM demo_sessions WHERE namespace_id=$1)",[id]);
    await c.query("DELETE FROM demo_sessions WHERE namespace_id=$1",[id]);
    await c.query("DELETE FROM workspaces WHERE namespace_id=$1",[id]);
    await c.query("DELETE FROM demo_namespaces WHERE id=$1",[id]);
  });
  namespaces.length = 0; journalNamespaces();
  await databasePool().end();modules.cleanup();
});
async function scope(profileId="sp") { const boot=await transaction(c=>bootstrap(c));namespaces.push(boot.session.namespaceId); journalNamespaces();const session=await transaction(c=>changeSession(c,boot.token,{action:"select",profileId,generation:boot.session.generation,commandId:randomUUID()}));return{session,token:boot.token}; }
const read = s=>transaction(async c=>{await c.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ");return readWorkspace(c,await requireSession(c,s.token,s.session.generation));});
const run = (s,command)=>transaction(c=>executeCommand(c,s.token,s.session.generation,command));
const command = (kind,expectedRevision,fields={})=>({kind,expectedRevision,commandId:randomUUID(),...fields});
async function complete(s) { let snap=await read(s);await run(s,command("assessment.start",snap.assessmentRevision));const execution=(await transaction(c=>observeAgent(c,s.token,s.session.generation))).runs.find(r=>r.kind==="assessment");for(let step=0;step<12;step++){await workerTick({runId:execution.id,adapter:fastAdapter});snap=await read(s);if(snap.assessment.status==="complete")return snap;}throw Error("Assessment worker did not complete"); }
async function draft(s) { const snap=await complete(s);await run(s,command("draft.begin",snap.assessmentRevision,{runId:snap.assessment.currentRunId,fields:{name:"Integration project",goal:"Preserve captured evidence",targetOrgId:"sit",findingIds:[snap.assessment.runs[0].findings[0].id]}}));return read(s); }
const canvas={kind:"capability",title:"Automation",params:{scope:"unbound",surface:"build",capability:"automation"}},target={projectId:null,worktreeId:null,orgId:null};
const save = (fields,expectedRevision=0)=>command("canvas.save",expectedRevision,{canvas,target,surface:"build",fields});

test("repeatable seed and concurrent same-command execution commit once; changed reuse conflicts",async()=>{
  const s=await scope();await transaction(async c=>{await seedWorkspace(c,s.session.namespaceId,"sp");await seedWorkspace(c,s.session.namespaceId,"sp");});
  const start=command("assessment.start",0);const results=await Promise.all(Array.from({length:8},()=>run(s,start)));for(const result of results)assert.deepEqual(result,results[0]);const snap=await read(s);assert.equal(snap.assessment.runs.length,1);assert.equal(snap.assessmentRevision,1);
  await assert.rejects(run(s,{...start,kind:"assessment.pause"}),e=>e.code==="conflict");await assert.rejects(run(s,command("assessment.pause",0)),e=>e.code==="conflict");
});
test("project creation consumes correct draft atomically and status+receipt roll back together",async()=>{
  const s=await scope(),snap=await draft(s),create=command("project.create",snap.assessmentRevision,{draftId:snap.assessment.draft.id,draftRevision:snap.assessment.draft.revision});
  const results=await Promise.all(Array.from({length:5},()=>run(s,create)));assert.ok(results[0].project);for(const result of results)assert.deepEqual(result,results[0]);const current=await read(s);assert.equal(current.assessment.draft,null);assert.equal(current.assessment.projects.length,1);const p=current.assessment.projects[0],item=p.workItems[0];assert.deepEqual(item.finding,current.assessment.runs[0].findings.find(f=>f.id===item.findingId));
  const update=command("work.status",p.revision,{projectId:p.id,itemId:item.id,status:"done"});await assert.rejects(transaction(async c=>{await executeCommand(c,s.token,s.session.generation,update);throw Error("force rollback");}),/force rollback/);assert.equal((await read(s)).assessment.projects[0].workItems[0].status,"todo");await run(s,update);assert.equal((await read(s)).assessment.projects[0].workItems[0].status,"done");
  const other=await scope();await assert.rejects(run(other,command("work.status",1,{projectId:p.id,itemId:item.id,status:"done"})),e=>e.code==="invalid");await assert.rejects(run(other,command("canvas.save",0,{canvas:{kind:"improvement-project",title:"foreign",params:{projectId:p.id}},target:{projectId:p.id,worktreeId:null,orgId:"sit"},surface:"alm",fields:{notes:"claim"}})),e=>e.code==="invalid");
  const reset={action:"reset",generation:s.session.generation,commandId:randomUUID()},oldEpoch=s.session.workspaceEpoch;s.session=await transaction(c=>changeSession(c,s.token,reset));assert.notEqual(s.session.workspaceEpoch,oldEpoch);assert.equal((await read(s)).assessment.projects.length,0);await run(s,command("assessment.start",0));const repeated=await transaction(c=>changeSession(c,s.token,reset));assert.equal(repeated.workspaceEpoch,s.session.workspaceEpoch);assert.equal((await read(s)).assessment.runs.length,1);
});
test("expired/revoked tokens and stale generations cannot claim namespace; reset epoch is read-only on reconnect",async()=>{
  const s=await scope(),original=s.session;const selected=await transaction(c=>changeSession(c,s.token,{action:"select",profileId:"am",generation:original.generation,commandId:randomUUID()}));await assert.rejects(run(s,command("assessment.start",0)),e=>e.code==="session_changed");s.session=selected;const observed=await transaction(c=>findSession(c,s.token));assert.equal(observed.workspaceEpoch,selected.workspaceEpoch);
  await transaction(c=>c.query("UPDATE demo_sessions SET revoked=true WHERE namespace_id=$1",[s.session.namespaceId]));await assert.rejects(read(s),e=>e.code==="unauthorized");const expired=await scope();await transaction(c=>c.query("UPDATE demo_sessions SET expires_at=now()-interval '1 second' WHERE namespace_id=$1",[expired.session.namespaceId]));assert.equal(await transaction(c=>findSession(c,expired.token)),null);
});
test("signed-out profile reset restores only its original workspace and receipt replay preserves later work", async () => {
  const s = await scope("sp"), originalEpoch = s.session.workspaceEpoch, other = await scope("sp");
  await run(s, save({ source: "Sam saved work" }));
  await run(other, save({ source: "Another browser's saved work" }));
  s.session = await transaction(c => changeSession(c, s.token, { action: "select", profileId: "jw", generation: s.session.generation, commandId: randomUUID() }));
  await run(s, save({ source: "Jordan saved work" }));
  const jordanEpoch = s.session.workspaceEpoch;
  s.session = await transaction(c => changeSession(c, s.token, { action: "signout", generation: s.session.generation, commandId: randomUUID() }));
  const signedOut = s.session, clear = { action: "reset-profile", profileId: "sp", generation: signedOut.generation, commandId: randomUUID() };
  const results = await Promise.all(Array.from({ length: 3 }, () => transaction(c => changeSession(c, s.token, clear))));
  for (const result of results) assert.deepEqual(result, signedOut, "Clearing a profile must not sign in or rotate the signed-out session");
  assert.equal((await transaction(c => findSession(c, s.token))).profileId, null);
  assert.equal((await read(other)).canvases[0].fields.source, "Another browser's saved work");
  s.session = await transaction(c => changeSession(c, s.token, { action: "select", profileId: "jw", generation: s.session.generation, commandId: randomUUID() }));
  assert.equal(s.session.workspaceEpoch, jordanEpoch);
  assert.equal((await read(s)).canvases[0].fields.source, "Jordan saved work");
  s.session = await transaction(c => changeSession(c, s.token, { action: "select", profileId: "sp", generation: s.session.generation, commandId: randomUUID() }));
  assert.notEqual(s.session.workspaceEpoch, originalEpoch);
  const fresh = await read(s);
  assert.equal(fresh.assessment.status, "idle");
  assert.equal(fresh.assessmentRevision, 0);
  assert.deepEqual(fresh.assessment.runs, []);
  assert.deepEqual(fresh.canvases, []);
  await run(s, save({ source: "Work saved after clear" }));
  const replay = await transaction(c => changeSession(c, s.token, clear));
  assert.deepEqual(replay, s.session, "An old receipt returns current authority, not its old signed-out result");
  assert.equal((await read(s)).canvases[0].fields.source, "Work saved after clear");
  await assert.rejects(transaction(c => changeSession(c, s.token, { ...clear, profileId: "jw" })), e => e.code === "conflict");
  await assert.rejects(transaction(c => changeSession(c, s.token, { ...clear, commandId: randomUUID() })), e => e.code === "session_changed");
});
test("clearing another profile preserves the selected workspace, generation and active worker lease", async () => {
  const s = await scope("sp");
  await run(s, save({ source: "Clear Sam only" }));
  s.session = await transaction(c => changeSession(c, s.token, { action: "select", profileId: "am", generation: s.session.generation, commandId: randomUUID() }));
  await run(s, save({ source: "Keep Alex" }));
  const accepted = await transaction(c => executeAgentCommand(c, s.token, s.session.generation, {
    kind: "submit", requestId: randomUUID(), context: { target, surface: "home" }, text: "Keep this active attempt",
  }));
  const lease = await transaction(c => claimRun(c, accepted.runId)); assert.ok(lease);
  const before = await read(s), runBefore = (await transaction(c => c.query("SELECT * FROM agent_runs WHERE id=$1", [accepted.runId]))).rows[0];
  const result = await transaction(c => changeSession(c, s.token, { action: "reset-profile", profileId: "sp", generation: s.session.generation, commandId: randomUUID() }));
  assert.deepEqual(result, s.session);
  assert.deepEqual(await read(s), before);
  assert.deepEqual((await transaction(c => c.query("SELECT * FROM agent_runs WHERE id=$1", [accepted.runId]))).rows[0], runBefore);
  assert.equal(await transaction(c => applyStep(c, lease, { kind: "complete", text: "Finished in the unchanged workspace" })), true);
});
test("current-profile reset fences stale writes and workers without refunding model reservations", async () => {
  const s = await scope("jw"), original = s.session, budgetScope = `profile-clear-test-${s.session.namespaceId}`;
  const accepted = await transaction(c => executeAgentCommand(c, s.token, s.session.generation, {
    kind: "submit", requestId: randomUUID(), context: { target, surface: "home" }, text: "Fence this old attempt",
  }));
  const lease = await transaction(c => claimRun(c, accepted.runId)); assert.ok(lease);
  try {
    await transaction(async c => {
      await c.query("INSERT INTO model_call_budgets(scope,day,reserved,call_limit) VALUES($1,CURRENT_DATE,1,5)", [budgetScope]);
      await c.query("INSERT INTO model_dispatch_slots(scope,run_id,expires_at) VALUES($1,$2,clock_timestamp()+interval '1 minute')", [budgetScope, accepted.runId]);
    });
    const reservations = await transaction(async c => ({ budget: (await c.query("SELECT * FROM model_call_budgets WHERE scope=$1", [budgetScope])).rows, slots: (await c.query("SELECT * FROM model_dispatch_slots WHERE scope=$1", [budgetScope])).rows }));
    s.session = await transaction(c => changeSession(c, s.token, { action: "reset-profile", profileId: "jw", generation: original.generation, commandId: randomUUID() }));
    assert.equal(s.session.profileId, "jw");
    assert.notEqual(s.session.generation, original.generation);
    assert.notEqual(s.session.workspaceEpoch, original.workspaceEpoch);
    await assert.rejects(run({ ...s, session: original }, save({ source: "Stale write" })), e => e.code === "session_changed");
    assert.equal(await transaction(c => applyStep(c, lease, { kind: "complete", text: "Stale completion" })), false);
    assert.deepEqual((await transaction(c => observeAgent(c, s.token, s.session.generation))).runs, []);
    assert.deepEqual(await transaction(async c => ({ budget: (await c.query("SELECT * FROM model_call_budgets WHERE scope=$1", [budgetScope])).rows, slots: (await c.query("SELECT * FROM model_dispatch_slots WHERE scope=$1", [budgetScope])).rows })), reservations);
  } finally {
    await transaction(async c => { await c.query("DELETE FROM model_dispatch_slots WHERE scope=$1", [budgetScope]); await c.query("DELETE FROM model_call_budgets WHERE scope=$1", [budgetScope]); });
  }
});
test("profile reset rejects untrusted targets and atomically rolls back deletion, epoch and receipt", async () => {
  const s = await scope("sp"); await run(s, save({ source: "Keep on failed reset" }));
  const clear = { action: "reset-profile", profileId: "sp", generation: s.session.generation, commandId: randomUUID() }, before = await read(s);
  for (const input of [{ ...clear, profileId: "unknown" }, { ...clear, profileId: null }, { ...clear, namespaceId: randomUUID() }]) {
    await assert.rejects(transaction(c => changeSession(c, s.token, input)), e => e.code === "invalid");
  }
  await assert.rejects(transaction(c => changeSession(c, undefined, clear)), e => e.code === "unauthorized");
  await assert.rejects(transaction(async c => { await changeSession(c, s.token, clear); throw Error("force clear rollback"); }), /force clear rollback/);
  assert.deepEqual(await read(s), before);
  assert.equal((await transaction(c => c.query("SELECT command_id FROM session_receipts WHERE command_id=$1", [clear.commandId]))).rowCount, 0);
  s.session = await transaction(c => changeSession(c, s.token, clear));
  assert.notEqual(s.session.workspaceEpoch, before.session.workspaceEpoch);
  assert.deepEqual((await read(s)).canvases, []);
});
test("SQL rejects a same-owner finding allocated through a project from a different run",async()=>{
  const s=await scope(),snap=await draft(s);await run(s,command("project.create",snap.assessmentRevision,{draftId:snap.assessment.draft.id,draftRevision:snap.assessment.draft.revision}));const p=(await read(s)).assessment.projects[0];
  await assert.rejects(transaction(async c=>{
    const owner=[s.session.namespaceId,s.session.profileId];
    await c.query("INSERT INTO assessment_runs(namespace_id,profile_id,id,record) VALUES($1,$2,'other-run','{}')",owner);
    await c.query("INSERT INTO assessment_findings(namespace_id,profile_id,run_id,id,record) VALUES($1,$2,'other-run','other-finding','{}')",owner);
    await c.query("INSERT INTO project_work_items(namespace_id,profile_id,project_id,id,run_id,finding_id,status,record) VALUES($1,$2,$3,'wrong-item','other-run','other-finding','todo','{}')",[...owner,p.id]);
  }),error=>error.code==="23503");
  const after=await read(s);assert.equal(after.assessment.runs.length,1);assert.equal(after.assessment.projects[0].workItems.length,p.workItems.length);
});
test("legacy import validates observed revision, preserves source/evidence and repeats without overwriting later edits",async()=>{
  const s=await scope(),sourceScope=await scope(),planned=await draft(sourceScope);await run(sourceScope,command("project.create",planned.assessmentRevision,{draftId:planned.assessment.draft.id,draftRevision:planned.assessment.draft.revision}));const original=(await read(sourceScope)).assessment;
  const source={profileId:"sp",assessment:JSON.stringify({__ufd:1,data:original}),canvases:null};await assert.rejects(run(s,command("legacy.import",999,{source})),e=>e.code==="conflict");const imported=await run(s,command("legacy.import",0,{source}));assert.equal(imported.revision,1);const p=(await read(s)).assessment.projects[0];await run(s,command("work.status",p.revision,{projectId:p.id,itemId:p.workItems[0].id,status:"done"}));const again=await run(s,command("legacy.import",0,{source}));assert.equal(again.revision,1);assert.equal((await read(s)).assessment.projects[0].workItems[0].status,"done");
  const broken=structuredClone(original);broken.projects[0].workItems[0].finding.summary="contradictory evidence";await assert.rejects(run(s,command("legacy.import",1,{source:{...source,assessment:JSON.stringify(broken)}})),e=>e.code==="invalid");
  const raw=await transaction(c=>c.query("SELECT source FROM legacy_import_sources WHERE namespace_id=$1 AND profile_id='sp'",[s.session.namespaceId]));assert.equal(raw.rows[0].source.assessment,source.assessment);
});
test("new-draft save cannot overwrite a concurrent import after waiting for the capacity lock",async()=>{
  const s=await scope(),id=canvasId(canvas.kind,canvas.params),source={profileId:"sp",assessment:null,canvases:JSON.stringify({build:{canvases:[{...canvas,id,draft:{source:"imported original"}}],activeCanvasId:id}})};
  let pending,pid;
  try {
    await transaction(async a=>{
      await lockCanvasQuota(a,[s.session.namespaceId,s.session.profileId]);
      pending=transaction(async c=>{pid=(await c.query("SELECT pg_backend_pid() AS pid")).rows[0].pid;return executeCommand(c,s.token,s.session.generation,save({source:"must not overwrite"}));}).then(result=>({result}),error=>({error}));
      let waiting=false;
      for(let attempt=0;attempt<100;attempt++){
        if(pid && (await a.query("SELECT wait_event FROM pg_stat_activity WHERE pid=$1",[pid])).rows[0]?.wait_event==="advisory"){waiting=true;break;}
        await new Promise(r=>setTimeout(r,10));
      }
      assert.equal(waiting,true,"save must observe absent record and wait on the canvas capacity lock");
      await executeCommand(a,s.token,s.session.generation,command("legacy.import",0,{source}));
    });
    assert.equal((await pending).error?.code,"conflict");assert.equal((await read(s)).canvases[0].fields.source,"imported original");
  } finally { if(pending)await pending; }
});
test("preserved source exports retain exact bytes and enforce namespace, persona, generation and reset scope",async()=>{
  const s=await scope(),source={profileId:"sp",assessment:null,canvases:JSON.stringify({build:{canvases:[{id:"unknown-legacy",kind:"retired-kind",title:"Preserve this",draft:{source:"original recovery text"}}],activeCanvasId:"unknown-legacy"}})};
  const imported=await run(s,command("legacy.import",0,{source}));assert.equal(imported.imported.recovery,1);
  const exportSource=(owner,hash=imported.imported.sourceHash)=>transaction(async c=>readImportedSource(c,await requireSession(c,owner.token,owner.session.generation),hash));
  const exported=await exportSource(s);assert.deepEqual(exported.source,source);assert.equal(exported.recovery.length,1);assert.match(JSON.stringify(exported.recovery),/original recovery text/);assert.equal((await read(s)).imports[0].sourceHash,imported.imported.sourceHash);
  await assert.rejects(exportSource(s,"invalid hash"),e=>e.code==="invalid");const other=await scope();await assert.rejects(exportSource(other),e=>e.status===404);
  const original=s.session;s.session=await transaction(c=>changeSession(c,s.token,{action:"select",profileId:"am",generation:original.generation,commandId:randomUUID()}));await assert.rejects(exportSource(s),e=>e.status===404);await assert.rejects(exportSource({...s,session:original}),e=>e.code==="session_changed");
  s.session=await transaction(c=>changeSession(c,s.token,{action:"select",profileId:"sp",generation:s.session.generation,commandId:randomUUID()}));assert.deepEqual((await exportSource(s)).source,source);
  s.session=await transaction(c=>changeSession(c,s.token,{action:"reset",generation:s.session.generation,commandId:randomUUID()}));await assert.rejects(exportSource(s),e=>e.status===404);assert.equal((await read(s)).imports.length,0);
});
test("UTF8 quota boundary rejects excess without changing saved bytes or revision",async()=>{
  const s=await scope();const size=DEMO_LIMITS.canvasFieldsBytes-new TextEncoder().encode(JSON.stringify({source:""})).length;await run(s,save({source:"x".repeat(size)}));const before=await read(s);await assert.rejects(run(s,save({source:"x".repeat(size+1)},1)),e=>e.code==="invalid");assert.deepEqual((await read(s)).canvases,before.canvases);
});
test("actual transaction timeouts apply, rollback and leave pooled connections reusable",async()=>{
  const limits=await transaction(async c=>({statement:(await c.query("SHOW statement_timeout")).rows[0].statement_timeout,lock:(await c.query("SHOW lock_timeout")).rows[0].lock_timeout,idle:(await c.query("SHOW idle_in_transaction_session_timeout")).rows[0].idle_in_transaction_session_timeout}));assert.deepEqual(limits,{statement:"10s",lock:"5s",idle:"15s"});
  await assert.rejects(transaction(async c=>{await c.query("SET LOCAL statement_timeout='20ms'");await c.query("SELECT pg_sleep(0.1)");}),e=>e.code==="57014");assert.equal((await transaction(c=>c.query("SELECT 1 AS healthy"))).rows[0].healthy,1);
});

test("snapshot reads recover a concurrent session change and enforce its fresh generation or revocation", async () => {
  const { readAgentSnapshot, readApplicationSnapshot } = modules.load("lib/server/snapshots");
  const reads = [readAgentSnapshot, readApplicationSnapshot,
    (token, generation) => readAgentSnapshot(token, generation, randomUUID(), 0)];
  for (const readSnapshot of reads) {
    for (const revoke of [false, true]) {
      const s = await scope(); let pending;
      const records = [], previousInfo = console.info;
      console.info = value => { records.push(JSON.parse(value)); };
      try {
        await transaction(async writer => {
          const writerPid = (await writer.query("SELECT pg_backend_pid() AS pid")).rows[0].pid;
          await writer.query(revoke ? "UPDATE demo_sessions SET revoked=true WHERE namespace_id=$1" : "UPDATE demo_sessions SET generation=$2 WHERE namespace_id=$1", revoke ? [s.session.namespaceId] : [s.session.namespaceId, randomUUID()]);
          pending = readSnapshot(s.token, s.session.generation).then(result => ({ result }), error => ({ error }));
          let blocked = false;
          for (let i = 0; i < 60; i++) {
            // Inspect only waiters on this test's held session row. A PID read
            // before BEGIN can change when Neon uses transaction pooling.
            const waiting = await writer.query("SELECT EXISTS(SELECT 1 FROM pg_locks WHERE NOT granted AND $1=ANY(pg_blocking_pids(pid))) AS blocked", [writerPid]);
            if (waiting.rows[0].blocked) { blocked = true; break; }
            await new Promise(resolve => setTimeout(resolve, 10));
          }
          assert.equal(blocked, true, "Observation must wait on the concurrent session update before it commits");
        });
        const result = await pending;
        assert.equal(result.error?.code, revoke ? "unauthorized" : "session_changed");
        assert.equal(result.error?.status, revoke ? 401 : 409);
        assert.equal(result.result, undefined, "No data from superseded authority is returned");
        assert.equal(records.filter(record => record.event === "database.snapshot_retry").length, 1,
          "The locked repeatable-read observation is retried once after serialization rollback");
      } finally { if (pending) await pending; console.info = previousInfo; }
    }
  }
});
