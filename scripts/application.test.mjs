import test, { after, afterEach } from "node:test";
import assert from "node:assert/strict";
import { testModules } from "./test-modules.mjs";
const modules = testModules(); after(modules.cleanup); afterEach(() => { delete global.window; });
const { parseCommand, stableJson, ApplicationError } = modules.load("lib/application/contracts");
const { RemoteWorkspaceStore, EMPTY_APPLICATION } = modules.load("lib/application/remote-store");
const { decodeLegacy } = modules.load("lib/application/legacy");
const { canvasId } = modules.load("lib/surface-canvas/model");
const { AssessmentStore } = modules.load("lib/onboarding/persistence");
const session = { namespaceId: "namespace-a", profileId: "sp", generation: "generation-a", expiresAt: "2026-10-01" };
const canvas = { kind: "capability", title: "Build", params: { scope: "unbound", surface: "build", capability: "automation" } };
const target = { projectId: null, worktreeId: null, orgId: null };
const save = (fields) => ({ kind: "canvas.save", surface: "build", canvas, target, fields });
function browser(values = {}, blocked = false) { const disk = new Map(Object.entries(values)); global.window = { localStorage: { getItem: (key) => disk.get(key) ?? null, setItem: (key, value) => { if (blocked) throw new Error("Blocked"); disk.set(key, value); }, removeItem: (key) => disk.delete(key) }, addEventListener() {}, removeEventListener() {} }; return disk; }
function deferred() { let resolve, reject; const promise = new Promise((a,b) => { resolve=a;reject=b; }); return {promise,resolve,reject}; }
const snapshot = () => structuredClone({ ...EMPTY_APPLICATION, session });
function remote(options = {}) { let saved = snapshot(); const sent = []; const transport = { read: async () => structuredClone(saved), send: async (_session, command) => { sent.push(command); if (options.send) await options.send(command); const id = canvasId(canvas.kind, canvas.params), old = saved.canvases.find((c) => c.id === id); if (command.expectedRevision !== (old?.revision ?? 0)) throw new ApplicationError("conflict", "Changed",409); saved.canvases = [{ id, surface:"build",canvas,target,fields:{...old?.fields,...command.fields}, revision:(old?.revision??0)+1 }]; return {revision:saved.canvases[0].revision}; } }; const store = new RemoteWorkspaceStore(session, transport, "pending", () => {}); return {store,sent,transport,getSaved:()=>saved,setSaved:(value)=>{saved=value;}}; }

test("command boundary rejects snapshots, invalid revisions, extra ownership and malformed field edits", () => {
  for (const value of [{ kind:"replace", state:{} }, { ...save({source:"x"}), commandId:"a",expectedRevision:-1 }, { ...save({source:"x"}), commandId:"a",expectedRevision:0,namespaceId:"other" }, { kind:"draft.edit",draftId:"d",edit:{field:"name",value:17},commandId:"a",expectedRevision:0 }]) assert.throws(() => parseCommand(value));
  const normalized = parseCommand({ ...save({source:"kept"}), canvas:{...canvas,id:"secret",draft:{source:"not identity"}},commandId:"a",expectedRevision:0 });
  assert.equal(normalized.canvas.draft, undefined); assert.equal(normalized.canvas.id, undefined); assert.equal(normalized.fields.source,"kept");
  assert.equal(stableJson({b:2,a:1}),stableJson({a:1,b:2}));
});
test("rapid field edits retain each observed revision and report saved only after acknowledgment", async () => {
  const disk = browser(), gate = deferred(); let first = true;
  const r = remote({ send: async () => { if(first){first=false;await gate.promise;} } }); await r.store.load();
  const a = r.store.enqueue(save({source:"first"}),"one"); const b = r.store.enqueue(save({notes:"second"}),"two");
  assert.equal(r.store.getPersistenceSnapshot(),"unsaved"); assert.deepEqual(r.store.getSnapshot().canvases[0].fields,{source:"first",notes:"second"});
  assert.equal(JSON.parse(disk.get("pending")).commands.length,2); gate.resolve(); assert.ok(await a);assert.ok(await b);
  assert.deepEqual(r.sent.map((c)=>c.expectedRevision),[0,1]); assert.deepEqual(r.getSaved().canvases[0].fields,{source:"first",notes:"second"}); assert.equal(r.store.getPersistenceSnapshot(),"saved"); assert.equal(disk.has("pending"),false);
});
test("unknown outcome retains exact command bytes and retries original identity", async () => {
  browser(); const r=remote(); let attempts=0; const accepted=new Map();
  r.transport.send=async (_s,c)=>{attempts++; if(accepted.has(c.commandId))return accepted.get(c.commandId); const result={revision:1}; accepted.set(c.commandId,result); if(attempts===1)throw new Error("response lost after commit");return result;};
  await r.store.load(); assert.equal(await r.store.enqueue(save({source:"preserve"}),"same-id"),null); const original=stableJson(r.store.getPending()[0]);
  assert.equal(r.store.getPersistenceSnapshot(),"unavailable");r.store.retryPersistence();await new Promise((r)=>setTimeout(r,20));assert.equal(attempts,2);assert.equal(r.store.getPending().length,0);assert.match(original,/same-id/);
});
test("session deactivation rejects late replies and never drains old queue into a new generation", async () => {
  const disk=browser(),gate=deferred();const r=remote({send:()=>gate.promise});await r.store.load();const pending=r.store.enqueue(save({source:"old scope"}),"old");r.store.deactivate();gate.resolve();assert.equal(await pending,null);await new Promise((r)=>setTimeout(r,5));
  assert.equal(r.store.getPending().length,1);assert.match(disk.get("pending"),/old scope/);assert.equal(await r.store.enqueue(save({source:"new"})),null);
  const wrong=new RemoteWorkspaceStore({...session,generation:"other"},r.transport,"pending",()=>{});assert.equal(wrong.getPersistenceSnapshot(),"invalid");assert.match(disk.get("pending"),/old scope/);
});
test("out-of-order refresh cannot replace the newer accepted projection", async () => {
  browser();const first=deferred(),second=deferred();let count=0;const transport={read:()=>++count===1?first.promise:second.promise,send:async()=>({revision:1})};const store=new RemoteWorkspaceStore(session,transport,"pending",()=>{});
  const a=store.load(),b=store.load();second.resolve({...snapshot(),assessmentRevision:2});assert.equal(await b,true);first.resolve({...snapshot(),assessmentRevision:1});assert.equal(await a,false);assert.equal(store.getSnapshot().assessmentRevision,2);
});
test("worker progress refreshes business state without changing its user command revision", async () => {
  browser(); const r = remote(); const initial = snapshot(); initial.assessmentRevision = 3; initial.assessment.status = "running"; r.setSaved(initial); await r.store.load();
  const completed = structuredClone(initial); completed.assessment.status = "complete"; completed.assessment.step = 4; r.setSaved(completed);
  assert.equal(await r.store.load(), true); assert.equal(r.store.getSnapshot().assessment.status, "complete");
  assert.equal(r.store.getSnapshot().assessmentRevision, 3); assert.equal(r.store.getPersistenceSnapshot(), "saved");
});
test("confirmed no-op corrects only unsent revision predictions once across lost ACK and reload", async () => {
  for (const mode of ["lost-ack", "reload", "other-user-change"]) {
    const disk = browser(), gate = deferred(), sent = [];
    let saved = snapshot(), starts = 0, lose = mode === "lost-ack";
    saved.assessmentRevision = 4; saved.assessment.status = "running";
    const transport = {
      read: async () => structuredClone(saved),
      send: async (_session, command) => {
        sent.push(structuredClone(command));
        if (command.kind === "assessment.start") {
          if (++starts === 1) await gate.promise;
          if (lose) { lose = false; throw Error("Acknowledgement lost"); }
          if (mode === "other-user-change") saved.assessmentRevision = 5;
          return { revision: 4 };
        }
        if (command.kind === "assessment.pause") {
          if (command.expectedRevision !== saved.assessmentRevision) throw new ApplicationError("conflict", "Another user's command changed the assessment", 409);
          saved.assessment.status = "paused"; return { revision: ++saved.assessmentRevision };
        }
        assert.equal(command.expectedRevision, 0, "unrelated canvas aggregate stays unchanged"); return { revision: 1 };
      },
    };
    let store = new RemoteWorkspaceStore(session, transport, "pending", () => {}); await store.load();
    const start = store.enqueue({ kind: "assessment.start" }, "join");
    void store.enqueue({ kind: "assessment.pause" }, "pause"); void store.enqueue(save({ notes: "Separate aggregate" }), "canvas");
    const originalHead = structuredClone(store.getPending()[0]); assert.equal(store.getPending()[1].expectedRevision, 5);
    if (mode === "reload") {
      store.deactivate(); gate.resolve(); await start;
      store = new RemoteWorkspaceStore(session, transport, "pending", () => {}); await store.load(); store.retryPersistence();
    } else {
      gate.resolve(); await start;
      if (mode === "lost-ack") { assert.deepEqual(store.getPending()[0], originalHead); assert.equal(store.getPending()[1].expectedRevision, 5); store.retryPersistence(); }
    }
    for (let i = 0; i < 100 && !["saved", "conflict"].includes(store.getPersistenceSnapshot()); i++) await new Promise(resolve => setTimeout(resolve, 2));
    assert.equal(store.getPersistenceSnapshot(), mode === "other-user-change" ? "conflict" : "saved", mode);
    assert.equal(sent.find(command => command.kind === "assessment.pause").expectedRevision, 4);
    for (const command of sent.filter(command => command.kind === "assessment.start")) assert.deepEqual(command, originalHead);
    if (mode === "other-user-change") {
      assert.equal(store.getPending()[0].expectedRevision, 4); assert.equal(store.getPending()[1].expectedRevision, 0);
      assert.equal(JSON.parse(disk.get("pending")).commands[0].expectedRevision, 4);
    } else { assert.equal(store.getPending().length, 0); assert.equal(disk.has("pending"), false); }
    store.deactivate();
  }
});
test("conflict keeps fields until explicit rebase applies them with a new command identity",async()=>{
  browser();const r=remote();await r.store.load();const saved=snapshot();saved.canvases=[{id:canvasId(canvas.kind,canvas.params),surface:"build",canvas,target,fields:{notes:"remote"},revision:1}];r.setSaved(saved);
  assert.equal(await r.store.enqueue(save({source:"mine"}),"stale"),null);assert.equal(r.store.getPersistenceSnapshot(),"conflict");assert.deepEqual(r.store.getSnapshot().canvases[0].fields,{notes:"remote",source:"mine"});r.store.keepLocalChanges();await new Promise((r)=>setTimeout(r,20));assert.equal(r.store.getPersistenceSnapshot(),"saved");assert.equal(r.sent[1].expectedRevision,1);assert.notEqual(r.sent[1].commandId,"stale");assert.deepEqual(r.getSaved().canvases[0].fields,{notes:"remote",source:"mine"});
});
test("blocked browser buffering remains honest while server acknowledgment still establishes durability",async()=>{
  browser({},true);const gate=deferred(),r=remote({send:()=>gate.promise});await r.store.load();const done=r.store.enqueue(save({source:"memory"}));assert.match(r.store.pendingLocation(),/only in this tab/);gate.resolve();assert.ok(await done);assert.equal(r.store.getPersistenceSnapshot(),"saved");
});
test("invalid local buffer bytes remain protected during reads, retries and explicit saved-version recovery",async()=>{
  const disk=browser({pending:"{broken"}),r=remote();await r.store.load();r.store.retryPersistence();r.store.useSavedVersion();assert.equal(await r.store.enqueue(save({source:"new"})),null);assert.equal(disk.get("pending"),"{broken");assert.equal(r.store.getPersistenceSnapshot(),"invalid");
});
test("explicit reviewed malformed-buffer discard resumes editing without accepting changed source bytes",async()=>{
  const key="ufd.pending.v1.namespace-a.sp.generation-a.old",disk=browser({[key]:"{broken"});global.localStorage=window.localStorage;
  const r=remote(),store=new RemoteWorkspaceStore(session,r.transport,"new-page",()=>{},key);await store.load();
  const {applicationClient}=modules.load("lib/application/client");applicationClient.workspace=store;
  const entry={key,raw:"{broken",label:"Malformed",memoryOnly:false};disk.set(key,"{different");applicationClient.discardRecovery(entry);
  assert.equal(disk.get(key),"{different");assert.equal(store.getPersistenceSnapshot(),"invalid");
  disk.set(key,"{broken");applicationClient.discardRecovery(entry);await new Promise(r=>setTimeout(r,10));
  assert.equal(disk.has(key),false);assert.equal(store.getPersistenceSnapshot(),"saved");assert.ok(await store.enqueue(save({source:"after explicit recovery"})));assert.equal(r.getSaved().canvases[0].fields.source,"after explicit recovery");
  applicationClient.workspace=null;delete global.localStorage;
});
test("explicit legacy import preserves historical plan scope and rejects malformed input instead of acknowledging empty state",()=>{
  const disk=browser(),store=new AssessmentStore("sp");store.start();for(let i=0;i<10;i++)store.advance();const state=store.getSnapshot(),f=state.runs[0].findings[0];store.beginDraft(state.currentRunId,{name:"Historical",goal:"Preserve",targetOrgId:"sit",findingIds:[f.id]});const draft=store.getSnapshot().draft;const p=store.createProject("Sam",{draftId:draft.id,expectedRevision:draft.revision,commandId:"create"});
  const input={kind:"improvement-project",title:p.name,params:{projectId:p.id}},id=canvasId(input.kind,input.params);const source={profileId:"sp",assessment:disk.get("ufd.org-assessment.v1.sp"),canvases:JSON.stringify({alm:{canvases:[{...input,id}],activeCanvasId:id}})};
  const imported=decodeLegacy(source);assert.equal(imported.canvases[0].target.orgId,p.targetOrgId);assert.deepEqual(imported.assessment.projects,[p]);
  assert.throws(()=>decodeLegacy({...source,assessment:"{invalid"}));assert.throws(()=>decodeLegacy({...source,assessment:JSON.stringify({__ufd:99,data:{}})}));
  const captured=JSON.parse(source.canvases);captured.alm.targets={[id]:{projectId:p.id,worktreeId:null,orgId:"retired-org"}};assert.equal(decodeLegacy({...source,canvases:JSON.stringify(captured)}).canvases[0].target.orgId,"retired-org");
});

test("discard uses the clicked command set and preserves edits typed while its read is pending", async () => {
  browser(); const r = remote(); await r.store.load();
  r.transport.send = async () => { throw new ApplicationError("conflict", "Changed",409); };
  await r.store.enqueue(save({source:"discard this"}),"old");
  const gate=deferred();r.transport.read=()=>gate.promise;r.store.useSavedVersion();
  void r.store.enqueue(save({notes:"typed after discard click"}),"new");
  gate.resolve(snapshot());await new Promise((r)=>setTimeout(r,10));
  assert.deepEqual(r.store.getPending().map((c)=>c.commandId),["new"]);assert.equal(r.store.getSnapshot().canvases[0].fields.notes,"typed after discard click");assert.equal(r.store.getPersistenceSnapshot(),"conflict");
});
test("duplicate pages write distinct buffers and never erase a newer source queue", async()=>{
  const {allocateBuffer}=modules.load("lib/application/buffer");const pointer=new Map(),sessionStorage={getItem:(k)=>pointer.get(k)??null,setItem:(k,v)=>pointer.set(k,v)};
  const first=allocateBuffer(session,sessionStorage,"first-page"),second=allocateBuffer(session,sessionStorage,"second-page");assert.notEqual(first.key,second.key);assert.equal(second.restoreKey,first.key);
  const command={...save({source:"restored"}),commandId:"same",expectedRevision:0},raw=JSON.stringify({session,commands:[command]});const disk=browser({[first.key]:raw});const gate=deferred();const r=remote({send:()=>gate.promise});
  const copied=new RemoteWorkspaceStore(session,r.transport,second.key,()=>{},second.restoreKey);await copied.load();copied.retryPersistence();await new Promise((r)=>setTimeout(r,1));
  const newer=JSON.stringify({session,commands:[command,{...save({notes:"newer original page edit"}),commandId:"newer",expectedRevision:1}]});disk.set(first.key,newer);gate.resolve();await new Promise((r)=>setTimeout(r,10));assert.equal(disk.get(first.key),newer);assert.equal(disk.has(second.key),false);
});
test("same-page re-adoption uses a fresh writer and cannot erase unread previous bytes",async()=>{
  const {allocateBuffer}=modules.load("lib/application/buffer"),pointer=new Map(),sessionStorage={getItem:k=>pointer.get(k)??null,setItem:(k,v)=>pointer.set(k,v)};
  const first=allocateBuffer(session,sessionStorage),second=allocateBuffer(session,sessionStorage);assert.notEqual(first.key,second.key);assert.equal(second.restoreKey,first.key);
  const original=JSON.stringify({session,commands:[{...save({source:"unread prior edits"}),commandId:"prior",expectedRevision:0}]}),disk=browser({[first.key]:original});const get=window.localStorage.getItem;window.localStorage.getItem=()=>{throw Error("transient read denial");};
  const r=remote(),store=new RemoteWorkspaceStore(session,r.transport,second.key,()=>{},second.restoreKey);window.localStorage.getItem=get;store.retryPersistence();await new Promise(r=>setTimeout(r,10));
  assert.equal(disk.get(first.key),original);assert.ok(await store.enqueue(save({source:"new explicit edit"})));assert.equal(disk.get(first.key),original);
});
test("a conflicting stored target wins the live projection while the rejected pending fields stay recoverable",async()=>{
  browser();const r=remote();await r.store.load();const changed=snapshot();changed.canvases=[{id:canvasId(canvas.kind,canvas.params),canvas,surface:"build",target:{...target,orgId:"other"},fields:{source:"saved"},revision:1}];r.setSaved(changed);
  await r.store.enqueue(save({source:"pending"}),"conflict-target");assert.equal(r.store.getSnapshot().canvases[0].target.orgId,"other");assert.equal(r.store.getSnapshot().canvases[0].fields.source,"saved");assert.equal(r.store.getPending()[0].fields.source,"pending");assert.equal(r.store.canKeepLocalChanges(),false);
});

test("recovery keeps the latest memory-only version beside differing stale disk bytes and clears known acknowledged archives",async()=>{
  const disk=new Map();let blocked=false;const storage={getItem:k=>disk.get(k)??null,setItem:(k,v)=>{if(blocked)throw Error("quota");disk.set(k,v);},removeItem:k=>disk.delete(k),get length(){return disk.size;},key:i=>[...disk.keys()][i]??null};global.window={localStorage:storage,addEventListener(){},removeEventListener(){}};global.localStorage=storage;
  const key="ufd.pending.v1.namespace-a.sp.generation-a.page",r=remote();r.transport.send=async()=>{throw Error("offline");};const store=new RemoteWorkspaceStore(session,r.transport,key,()=>{});await store.load();await store.enqueue(save({source:"disk copy"}),"one");blocked=true;void store.enqueue(save({notes:"latest memory"}),"two");
  const {applicationClient}=modules.load("lib/application/client");applicationClient.workspace=store;applicationClient.showRecovery();const entries=applicationClient.getSnapshot().recovery;assert.equal(entries.length,2);const memory=entries.find(e=>e.memoryOnly);assert.equal(JSON.parse(memory.raw).commands.length,2);assert.match(memory.label,/session generati/);assert.equal(JSON.parse(entries.find(e=>!e.memoryOnly).raw).commands.length,1);assert.equal(store.hasBufferFailure(),true);
  store.useSavedVersion();await new Promise(r=>setTimeout(r,10));blocked=false;applicationClient.showRecovery();assert.equal(applicationClient.getSnapshot().recovery.length,0);applicationClient.workspace=null;delete global.localStorage;
});
