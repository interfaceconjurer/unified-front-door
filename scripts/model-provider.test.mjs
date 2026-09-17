import test, { after } from "node:test";
import assert from "node:assert/strict";
import { testModules } from "./test-modules.mjs";
const modules = testModules(); after(modules.cleanup);
const { MODEL_POLICY, MODEL_SYSTEM_PROMPT, modelSettings, serializeModelRequest, completeModel, ModelProviderError } = modules.load("lib/server/model-provider");
const env = { AGENT_PROVIDER: "anthropic", ANTHROPIC_API_KEY: "synthetic-private-api-key" };
const prompt = { messages: [{ role: "user", content: "Explain the captured finding and propose next steps." }] };
const response = patch => ({ type: "message", id: "msg_test123", role: "assistant", model: MODEL_POLICY.model, container: null,
  stop_reason: "end_turn", stop_sequence: null, stop_details: null, content: [{ type: "text", text: "Proposal based on the captured demo evidence.", citations: null }],
  usage: { input_tokens: 321, output_tokens: 14, cache_creation_input_tokens: 0, cache_read_input_tokens: 0,
    output_tokens_details: null, server_tool_use: null, inference_geo: null, service_tier: "standard" }, ...patch });
const frame = value => `event: ${value.type}\ndata: ${JSON.stringify(value)}\n\n`;
const events = value => [
  { type: "message_start", message: { ...value, content: [], stop_reason: null, stop_details: null } },
  ...value.content.flatMap((block, index) => [
    { type: "content_block_start", index, content_block: { ...block, ...(block.type === "text" ? { text: "" } : {}) } },
    ...(block.type === "text" ? [{ type: "content_block_delta", index, delta: { type: "text_delta", text: block.text } }] : []),
    { type: "content_block_stop", index },
  ]),
  { type: "message_delta", delta: { stop_reason: value.stop_reason, stop_sequence: null, stop_details: value.stop_details ?? null, container: null },
    usage: { output_tokens: value.usage?.output_tokens, input_tokens: null, cache_creation_input_tokens: null, cache_read_input_tokens: null, output_tokens_details: null, server_tool_use: null } },
  { type: "message_stop" },
];
const stream = (values, headers = {}) => new Response(values.map(frame).join(""), { headers: { "content-type": "text/event-stream", "request-id": "req_safe123", ...headers } });
const json = value => stream(events(value));
const call = (fetch, options = {}) => completeModel(prompt, MODEL_POLICY, new AbortController().signal, { env, fetch, ...options });
const errorCode = (expected, dispatched = true) => error => {
  assert(error instanceof ModelProviderError); assert.equal(error.code, expected); assert.equal(error.dispatched, dispatched);
  assert(!JSON.stringify(error).includes(env.ANTHROPIC_API_KEY)); assert(!error.message.includes("private")); return true;
};

test("provider is explicitly enabled with server-only credentials, fixed model and bounded call caps", () => {
  assert.equal(modelSettings({}), null); assert.equal(modelSettings({ ...env, AGENT_PROVIDER: "demo" }), null);
  const settings = modelSettings(env); assert.deepEqual(settings.policy, MODEL_POLICY); assert.equal(settings.globalDailyCalls, 10); assert.equal(settings.namespaceDailyCalls, 5);
  assert(!JSON.stringify(settings).includes(env.ANTHROPIC_API_KEY));
  for (const patch of [{ AGENT_PROVIDER: "" }, { AGENT_PROVIDER: "arbitrary" }, { ANTHROPIC_API_KEY: "" }, { ANTHROPIC_API_KEY: "key\nsecret" }, { ANTHROPIC_API_KEY: " key" }, { ANTHROPIC_MODEL: "other-model" }, { ANTHROPIC_WORKSPACE_ID: "bad\nworkspace" }, { AGENT_GLOBAL_DAILY_CALLS: "0" }, { AGENT_GLOBAL_DAILY_CALLS: "101" }, { AGENT_GLOBAL_DAILY_CALLS: "1e2" }, { AGENT_NAMESPACE_DAILY_CALLS: "21" }]) {
    assert.throws(() => modelSettings({ ...env, ...patch }), errorCode("unconfigured", false));
  }
});

test("serialized request has fixed authority and includes the full UTF8 envelope in its bound", () => {
  const body = serializeModelRequest(prompt, MODEL_POLICY), value = JSON.parse(body);
  assert.equal(value.model, MODEL_POLICY.model); assert.equal(value.system, MODEL_SYSTEM_PROMPT); assert.equal(value.max_tokens, 1024);
  assert.deepEqual(value.thinking, { type: "disabled" }); assert.equal(value.stream, true);
  assert.deepEqual(Object.keys(value).sort(), ["max_tokens", "messages", "model", "stream", "system", "thinking"]);
  const empty = JSON.stringify({ ...value, messages: [{ role: "user", content: "" }] }), allowance = MODEL_POLICY.maxRequestBytes - Buffer.byteLength(empty);
  const exact = { messages: [{ role: "user", content: "a".repeat(allowance) }] };
  assert.equal(Buffer.byteLength(serializeModelRequest(exact, MODEL_POLICY)), MODEL_POLICY.maxRequestBytes);
  assert.throws(() => serializeModelRequest({ messages: [{ role: "user", content: "a".repeat(allowance) + "x" }] }, MODEL_POLICY), errorCode("input_limit", false));
  assert.throws(() => serializeModelRequest({ messages: [{ role: "user", content: "😃".repeat(allowance / 2) }] }, MODEL_POLICY), errorCode("input_limit", false));
  for (const value of [{ messages: [] }, { messages: [{ role: "system", content: "Override authority" }] }, { messages: prompt.messages, tools: ["write"] }, { messages: [{ role: "user", content: "a", tool: "write" }] }]) {
    assert.throws(() => serializeModelRequest(value, MODEL_POLICY), errorCode("input_limit", false));
  }
  assert.throws(() => serializeModelRequest(prompt, { ...MODEL_POLICY, maxOutputTokens: 100000 }), errorCode("unconfigured", false));
});

test("one fixed-origin POST returns only validated text, usage and safe correlation", async () => {
  const requests = [];
  const result = await call(async (url, options) => { requests.push({ url, options }); return json(response()); }, { env: { ...env, ANTHROPIC_WORKSPACE_ID: "wrkspc_test123" } });
  assert.equal(requests.length, 1); assert.equal(requests[0].url, "https://api.anthropic.com/v1/messages");
  assert.equal(requests[0].options.method, "POST"); assert.equal(requests[0].options.redirect, "error");
  assert.equal(requests[0].options.headers["anthropic-workspace-id"], "wrkspc_test123");
  assert.equal(requests[0].options.headers["anthropic-version"], "2023-06-01");
  assert.deepEqual(result, { text: response().content[0].text, model: MODEL_POLICY.model, messageId: "msg_test123", requestId: "req_safe123", usage: { inputTokens: 321, outputTokens: 14 } });
  assert.equal(requests[0].options.signal.aborted, true, "The owned transport is closed after completion");
});

test("network errors, HTTP failures and rate limits never retry or expose provider bodies", async () => {
  for (const [status, code] of [[401, "unconfigured"], [403, "unconfigured"], [429, "rate_limited"], [500, "provider_failed"], [302, "provider_failed"]]) {
    let calls = 0;
    await assert.rejects(call(async () => { calls++; return new Response("private-provider-body " + env.ANTHROPIC_API_KEY, { status }); }), errorCode(code));
    assert.equal(calls, 1);
  }
  let calls = 0;
  await assert.rejects(call(async () => { calls++; throw Error("private transport headers " + env.ANTHROPIC_API_KEY); }), errorCode("provider_failed"));
  assert.equal(calls, 1);
});

test("refusal and exhausted output have explicit outcomes instead of a false completed answer", async () => {
  await assert.rejects(call(async () => json(response({ stop_reason: "refusal" }))), errorCode("refused"));
  await assert.rejects(call(async () => json(response({ stop_reason: "end_turn", stop_details: { type: "refusal", explanation: "private provider explanation", category: "private" } }))), errorCode("refused"));
  await assert.rejects(call(async () => json(response({ stop_details: { type: "future-interruption" } }))), errorCode("invalid_response"));
  await assert.rejects(call(async () => json(response({ stop_reason: "max_tokens" }))), errorCode("incomplete"));
  assert.equal((await call(async () => json(response({ stop_details: null })))).text, response().content[0].text);
});

test("provider shape, model, tool blocks, stop reason and usage are checked at runtime", async () => {
  const patches = [
    { type: "other" }, { role: "user" }, { model: "unapproved-model" }, { id: "private\nrequest" }, { stop_reason: "tool_use" },
    { content: [{ type: "tool_use", name: "write", input: {} }] }, { content: [{ type: "thinking", thinking: "private" }] },
    { content: [{ type: "text", text: " " }] }, { content: [{ type: "text", text: "x".repeat(32001) }] },
    { usage: { input_tokens: -1, output_tokens: 1 } }, { usage: { input_tokens: 3, output_tokens: 1025 } },
    { usage: { input_tokens: 3, output_tokens: 1, cache_creation_input_tokens: 50 } },
    { usage: { input_tokens: "3", output_tokens: 1 } }, { usage: null },
  ];
  for (const patch of patches) await assert.rejects(call(async () => json(response(patch))), errorCode("invalid_response"));
  await assert.rejects(call(async () => new Response("not json", { headers: { "content-type": "application/json" } })), errorCode("invalid_response"));
  await assert.rejects(call(async () => new Response(JSON.stringify(response()), { headers: { "content-type": "text/html" } })), errorCode("invalid_response"));
  const result = await call(async () => stream(events(response()), { "request-id": "arbitrary-user-controlled-value" }));
  assert.equal(result.requestId, undefined);
});

test("response byte bound cancels the body before unbounded parsing", async () => {
  let cancelled = false;
  const body = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(1024 * 1024 + 1)); }, cancel() { cancelled = true; } });
  await assert.rejects(call(async () => new Response(body, { headers: { "content-type": "text/event-stream" } })), errorCode("invalid_response"));
  assert.equal(cancelled, true);
});

test("cancel before dispatch prevents a call; cancellation during fetch propagates and returns promptly", async () => {
  const before = new AbortController(); before.abort(); let calls = 0;
  await assert.rejects(completeModel(prompt, MODEL_POLICY, before.signal, { env, fetch: async () => { calls++; return json(response()); } }), errorCode("aborted", false));
  assert.equal(calls, 0);
  const during = new AbortController(); let transport;
  const pending = completeModel(prompt, MODEL_POLICY, during.signal, { env, fetch: async (_url, options) => { transport = options.signal; return new Promise(() => {}); } });
  during.abort(); await assert.rejects(pending, errorCode("aborted")); assert.equal(transport.aborted, true);
});

test("a wall-clock deadline contains an uncooperative fetch without retry", async t => {
  t.mock.timers.enable({ apis: ["setTimeout"] }); let calls = 0, transport;
  const pending = call(async (_url, options) => { calls++; transport = options.signal; return new Promise(() => {}); });
  const rejection = assert.rejects(pending, errorCode("timeout"));
  t.mock.timers.tick(MODEL_POLICY.timeoutMs); await rejection; assert.equal(calls, 1); assert.equal(transport.aborted, true);
});

test("the same deadline also bounds a successful response whose body stops arriving", async t => {
  t.mock.timers.enable({ apis: ["setTimeout"] }); let transport;
  const pending = call(async (_url, options) => {
    transport = options.signal;
    return new Response(new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode('event: message_start\ndata: {"type":')); } }), { headers: { "content-type": "text/event-stream" } });
  });
  const rejection = assert.rejects(pending, errorCode("timeout"));
  await Promise.resolve(); await Promise.resolve();
  t.mock.timers.tick(MODEL_POLICY.timeoutMs); await rejection; assert.equal(transport.aborted, true);
});

test("real deltas arrive before completion across split UTF8 and CRLF framing, and message_stop does not wait for EOF", async () => {
  const values = events(response({ content: [{ type: "text", text: "Hi 🌍" }] }));
  values.splice(2, 1,
    { type: "ping" }, { type: "future_informational_event", ignored: "private metadata" },
    { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "Hi " } },
    { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "🌍" } });
  const encoder = new TextEncoder(), early = encoder.encode(values.slice(0, -3).map(frame).join("").replaceAll("\n", "\r\n"));
  let controller, cancelled = false, finished = false;
  const observed = [];
  const body = new ReadableStream({ start(value) { controller = value; }, cancel() { cancelled = true; } });
  const pending = call(async () => new Response(body, { headers: { "content-type": "text/event-stream; charset=utf-8" } }), { onText: text => observed.push(text) }).then(value => { finished = true; return value; });
  for (const byte of early) controller.enqueue(Uint8Array.of(byte));
  for (let i = 0; i < early.length + 10; i++) await Promise.resolve();
  assert.deepEqual(observed, ["Hi ", "Hi 🌍"]); assert.equal(finished, false);
  controller.enqueue(encoder.encode(values.slice(-3).map(frame).join("")));
  assert.equal((await pending).text, "Hi 🌍"); assert.equal(cancelled, true);
});

test("truncated, reordered, unsupported and error streams never report completed replies", async () => {
  const normal = events(response());
  const invalid = [normal.slice(0, -1), [normal[1], ...normal], [normal[0], normal[0], ...normal.slice(1)],
    [normal[0], normal[1], { type: "content_block_delta", index: 1, delta: { type: "text_delta", text: "wrong block" } }],
    [normal[0], normal[1], { type: "content_block_delta", index: 0, delta: { type: "thinking_delta", thinking: "private" } }],
    [...normal.slice(0, -2), { type: "message_delta", delta: { stop_reason: "end_turn", model: "other" }, usage: { output_tokens: 14 } }, normal.at(-1)],
    [...normal.slice(0, -1), { type: "content_block_start", index: 1, content_block: { type: "text", text: "late" } }, normal.at(-1)],
  ];
  for (const values of invalid) await assert.rejects(call(async () => stream(values)), errorCode("invalid_response"));
  for (const [type, expected] of [["overloaded_error", "provider_failed"], ["rate_limit_error", "rate_limited"]]) {
    const observed = [];
    await assert.rejects(call(async () => stream([...normal.slice(0, 3), { type: "error", error: { type, message: "private provider data" } }]), { onText: text => observed.push(text) }), errorCode(expected));
    assert.equal(observed.length, 1);
  }
});

test("malformed UTF8, mismatched named events and unbounded frames are rejected", async () => {
  for (const body of [Uint8Array.of(0xff), "event: ping\ndata: {\"type\":\"message_stop\"}\n\n", "data: " + "x".repeat(65536)]) {
    await assert.rejects(call(async () => new Response(body, { headers: { "content-type": "text/event-stream" } })), errorCode("invalid_response"));
  }
});

test("cancelling a body stream preserves only deltas already delivered and closes its reader", async () => {
  const signal = new AbortController(), observed = [];
  let controller, cancelled = false;
  const pending = completeModel(prompt, MODEL_POLICY, signal.signal, { env, onText: text => observed.push(text), fetch: async () =>
    new Response(new ReadableStream({ start(value) { controller = value; }, cancel() { cancelled = true; } }), { headers: { "content-type": "text/event-stream" } }) });
  for (let i = 0; i < 10; i++) await Promise.resolve();
  controller.enqueue(new TextEncoder().encode(events(response()).slice(0, 3).map(frame).join("")));
  for (let i = 0; i < 10; i++) await Promise.resolve();
  assert.equal(observed.length, 1); signal.abort();
  await assert.rejects(pending, errorCode("aborted")); assert.equal(cancelled, true);
});

test("late fetch resolution after cancellation closes the body without exposing text", async () => {
  const signal = new AbortController(); let finish, cancelled = false;
  const observed = [], fetched = new Promise(resolve => { finish = resolve; });
  const pending = completeModel(prompt, MODEL_POLICY, signal.signal, { env, onText: text => observed.push(text), fetch: () => fetched });
  signal.abort(); await assert.rejects(pending, errorCode("aborted"));
  finish(new Response(new ReadableStream({ cancel() { cancelled = true; } }), { headers: { "content-type": "text/event-stream" } }));
  for (let i = 0; i < 20; i++) await Promise.resolve();
  assert.equal(cancelled, true); assert.deepEqual(observed, []);
});

test("later deltas cannot erase refusal, unsupported stop metadata or invalid usage", async () => {
  const normal = events(response());
  for (const [delta, usage, code] of [
    [{ stop_reason: "refusal" }, { output_tokens: 14 }, "refused"],
    [{ stop_reason: "end_turn", stop_details: { type: "refusal" } }, { output_tokens: 14 }, "refused"],
    [{ stop_reason: "end_turn", stop_details: { type: "future_stop" } }, { output_tokens: 14 }, "invalid_response"],
    [{ stop_reason: "end_turn" }, { output_tokens: 14, cache_read_input_tokens: 1 }, "invalid_response"],
  ]) {
    await assert.rejects(call(async () => stream([...normal.slice(0, -2), { type: "message_delta", delta, usage },
      { ...normal.at(-2), delta: { stop_reason: "end_turn", stop_details: null }, usage: { output_tokens: 14, cache_read_input_tokens: 0 } }, normal.at(-1)])), errorCode(code));
  }
});

test("token-sized SSE overhead may exceed 64KiB while text and cumulative usage remain bounded", async () => {
  const normal = events(response({ content: [{ type: "text", text: "x".repeat(1024) }], usage: { input_tokens: 321, output_tokens: 1024 } }));
  normal[0].message.usage.output_tokens = 1;
  normal.splice(2, 1, ...Array.from({ length: 1024 }, () => ({ type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "x" } })));
  normal.splice(-2, 0, { type: "message_delta", delta: {}, usage: { output_tokens: 1000 } });
  assert(Buffer.byteLength(normal.map(frame).join("")) > 65536);
  const result = await call(async () => stream(normal));
  assert.equal(result.text, "x".repeat(1024)); assert.equal(result.usage.outputTokens, 1024);
  normal.at(-2).usage.output_tokens = 999;
  await assert.rejects(call(async () => stream(normal)), errorCode("invalid_response"));
});

// These fields are nullable in Anthropic's official MessageDeltaUsage and
// RawMessageDeltaEvent.Delta schemas, rather than absent from every response.
for (const [name, delta, usage] of [
  ["container", { container: null }, {}],
  ["input_tokens", {}, { input_tokens: null }],
  ["cache_creation_input_tokens", {}, { cache_creation_input_tokens: null }],
  ["cache_read_input_tokens", {}, { cache_read_input_tokens: null }],
]) test(`official nullable ${name} metadata does not invalidate a completed text stream`, async () => {
  const values = events(response({ usage: { input_tokens: 321, output_tokens: 14, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 } }));
  values.at(-2).delta = { ...values.at(-2).delta, ...delta };
  values.at(-2).usage = { ...values.at(-2).usage, ...usage };
  const result = await call(async () => stream(values));
  assert.equal(result.text, response().content[0].text); assert.deepEqual(result.usage, { inputTokens: 321, outputTokens: 14 });
});

test("nullable usage preserves the latest validated measurement without permitting cache or container execution", async () => {
  const values = events(response({ usage: { input_tokens: 321, output_tokens: 1, cache_creation_input_tokens: null, cache_read_input_tokens: null } }));
  values.splice(-2, 0, { type: "message_delta", delta: {}, usage: { input_tokens: 350, output_tokens: 10, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 } });
  values.at(-2).usage.output_tokens = 14;
  assert.deepEqual((await call(async () => stream(values))).usage, { inputTokens: 350, outputTokens: 14 });
  for (const [delta, usage] of [[{ container: { id: "container_unrequested" } }, {}], [{}, { cache_creation_input_tokens: 1 }], [{}, { cache_read_input_tokens: 1 }], [{}, { input_tokens: "350" }]]) {
    const invalid = structuredClone(values);
    invalid.at(-2).delta = { ...invalid.at(-2).delta, ...delta };
    invalid.at(-2).usage = { ...invalid.at(-2).usage, ...usage };
    await assert.rejects(call(async () => stream(invalid)), errorCode("invalid_response"));
  }
});

test("known truncation remains incomplete even when reported output usage exceeds the requested cap", async () => {
  for (const reason of ["max_tokens", "model_context_window_exceeded"]) {
    const values = events(response());
    values.at(-2).delta.stop_reason = reason;
    values.at(-2).usage.output_tokens = MODEL_POLICY.maxOutputTokens + 1;
    await assert.rejects(call(async () => stream(values)), errorCode("incomplete"));
    values.at(-2).delta.stop_reason = "end_turn";
    await assert.rejects(call(async () => stream(values)), errorCode("invalid_response"));
  }
});
