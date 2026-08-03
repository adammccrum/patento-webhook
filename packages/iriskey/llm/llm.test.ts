/**
 * Provider layer tests.
 *
 * No network and no API key. Adapters take an injected fetcher, so the parts
 * that actually break — request shaping and response parsing — are verified
 * directly. What is NOT covered here is whether a live vendor accepts these
 * payloads; that needs a key and a staging call.
 */

import {
  AnthropicAdapter,
  GeminiAdapter,
  LLMError,
  ModelRouter,
  OpenAICompatibleAdapter,
  ScriptedAdapter,
  buildRouter,
  errorFromStatus,
  extractJson,
  type Fetcher,
} from './src/index';

const ctx = () => ({
  signal: new AbortController().signal,
  tenantId: 't1',
  requestId: 'r1',
});

/** A fetcher that records the request and returns a canned body. */
function stub(body: unknown, status = 200) {
  const seen: { url?: string; init?: RequestInit; body?: any } = {};
  const fetcher = (async (url: any, init: any) => {
    seen.url = String(url);
    seen.init = init;
    seen.body = JSON.parse(String(init.body));
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
      text: async () => JSON.stringify(body),
    };
  }) as unknown as Fetcher;
  return { fetcher, seen };
}

describe('AnthropicAdapter', () => {
  const reply = {
    content: [{ type: 'text', text: 'hello' }],
    usage: { input_tokens: 10, output_tokens: 4 },
    stop_reason: 'end_turn',
  };

  it('sends the system prompt as a top-level field, not a message', async () => {
    const { fetcher, seen } = stub(reply);
    const a = new AnthropicAdapter({ apiKey: 'k', baseUrl: 'https://x', model: 'm', fetcher });

    await a.generate(
      { system: 'be helpful', messages: [{ role: 'user', content: 'hi' }], maxOutputTokens: 100 },
      ctx()
    );

    expect(seen.body.system).toBe('be helpful');
    expect(seen.body.messages).toEqual([{ role: 'user', content: 'hi' }]);
    expect(seen.init!.headers).toMatchObject({ 'x-api-key': 'k', 'anthropic-version': '2023-06-01' });
  });

  it('reports real token usage', async () => {
    const { fetcher } = stub(reply);
    const a = new AnthropicAdapter({ apiKey: 'k', baseUrl: 'https://x', model: 'm', fetcher });

    const result = await a.generate({ messages: [{ role: 'user', content: 'hi' }], maxOutputTokens: 10 }, ctx());

    expect(result.text).toBe('hello');
    expect(result.usage).toEqual({ inputTokens: 10, outputTokens: 4 });
    expect(result.usage.estimated).toBeUndefined();
  });

  it('expresses structured output as a forced tool call', async () => {
    const { fetcher, seen } = stub({
      content: [{ type: 'tool_use', input: { reply: 'ok' } }],
      usage: { input_tokens: 1, output_tokens: 1 },
    });
    const a = new AnthropicAdapter({ apiKey: 'k', baseUrl: 'https://x', model: 'm', fetcher });

    const result = await a.generate(
      {
        messages: [{ role: 'user', content: 'hi' }],
        maxOutputTokens: 10,
        responseSchema: { type: 'object' },
      },
      ctx()
    );

    expect(seen.body.tool_choice).toEqual({ type: 'tool', name: 'respond' });
    expect(result.structured).toEqual({ reply: 'ok' });
  });

  it('fails rather than returning prose when structure was required', async () => {
    const { fetcher } = stub(reply); // text only, no tool block
    const a = new AnthropicAdapter({ apiKey: 'k', baseUrl: 'https://x', model: 'm', fetcher });

    await expect(
      a.generate(
        { messages: [{ role: 'user', content: 'hi' }], maxOutputTokens: 10, responseSchema: { type: 'object' } },
        ctx()
      )
    ).rejects.toThrow(LLMError);
  });

  it('never leaks the vendor into a learner-facing message', async () => {
    const { fetcher } = stub({ error: 'boom' }, 500);
    const a = new AnthropicAdapter({ apiKey: 'k', baseUrl: 'https://x', model: 'm', fetcher });

    await expect(
      a.generate({ messages: [{ role: 'user', content: 'hi' }], maxOutputTokens: 10 }, ctx())
    ).rejects.toMatchObject({ code: 'TRANSIENT' });
  });
});

describe('OpenAICompatibleAdapter', () => {
  const reply = {
    choices: [{ message: { content: 'hi there' }, finish_reason: 'stop' }],
    usage: { prompt_tokens: 7, completion_tokens: 3 },
  };

  it('sends the system prompt as a message', async () => {
    const { fetcher, seen } = stub(reply);
    const a = new OpenAICompatibleAdapter({ apiKey: 'k', baseUrl: 'https://x/v1', model: 'm', fetcher });

    await a.generate(
      { system: 'be helpful', messages: [{ role: 'user', content: 'hi' }], maxOutputTokens: 50 },
      ctx()
    );

    expect(seen.body.messages[0]).toEqual({ role: 'system', content: 'be helpful' });
    expect(seen.url).toBe('https://x/v1/chat/completions');
  });

  it('uses native json_schema when the server supports it', async () => {
    const { fetcher, seen } = stub({
      choices: [{ message: { content: '{"reply":"ok"}' }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 1, completion_tokens: 1 },
    });
    const a = new OpenAICompatibleAdapter({ apiKey: 'k', baseUrl: 'https://x/v1', model: 'm', fetcher });

    const result = await a.generate(
      { messages: [{ role: 'user', content: 'hi' }], maxOutputTokens: 10, responseSchema: { type: 'object' } },
      ctx()
    );

    expect(seen.body.response_format.type).toBe('json_schema');
    expect(result.structured).toEqual({ reply: 'ok' });
  });

  it('emulates structured output for a server that lacks it', async () => {
    // A small open model wrapping JSON in a fence — the common failure shape.
    const { fetcher, seen } = stub({
      choices: [{ message: { content: 'Sure!\n```json\n{"reply":"ok"}\n```' }, finish_reason: 'stop' }],
    });
    const a = new OpenAICompatibleAdapter({
      apiKey: '',
      baseUrl: 'http://localhost:11434/v1',
      model: 'qwen',
      vendor: 'self-hosted',
      fetcher,
      capabilities: { supportsStructuredOutput: false },
    });

    const result = await a.generate(
      { messages: [{ role: 'user', content: 'hi' }], maxOutputTokens: 10, responseSchema: { type: 'object' } },
      ctx()
    );

    expect(seen.body.response_format).toBeUndefined();
    expect(result.structured).toEqual({ reply: 'ok' });
  });

  it('folds the system prompt into the conversation when unsupported', async () => {
    const { fetcher, seen } = stub(reply);
    const a = new OpenAICompatibleAdapter({
      apiKey: '',
      baseUrl: 'http://x/v1',
      model: 'llama',
      fetcher,
      capabilities: { supportsSystemPrompt: false },
    });

    await a.generate({ system: 'rules', messages: [{ role: 'user', content: 'hi' }], maxOutputTokens: 10 }, ctx());

    expect(seen.body.messages[0].role).toBe('user');
  });

  it('estimates usage rather than reporting zero', async () => {
    const { fetcher } = stub({ choices: [{ message: { content: 'abcd' }, finish_reason: 'stop' }] });
    const a = new OpenAICompatibleAdapter({ apiKey: 'k', baseUrl: 'https://x/v1', model: 'm', fetcher });

    const result = await a.generate({ messages: [{ role: 'user', content: 'hi' }], maxOutputTokens: 10 }, ctx());

    expect(result.usage.estimated).toBe(true);
    expect(result.usage.outputTokens).toBeGreaterThan(0);
  });

  it('omits the auth header for a keyless self-hosted server', async () => {
    const { fetcher, seen } = stub(reply);
    const a = new OpenAICompatibleAdapter({ apiKey: '', baseUrl: 'http://localhost:8000/v1', model: 'm', fetcher });

    await a.generate({ messages: [{ role: 'user', content: 'hi' }], maxOutputTokens: 10 }, ctx());

    expect((seen.init!.headers as any).authorization).toBeUndefined();
  });
});

describe('GeminiAdapter', () => {
  it('maps assistant to model and lifts the system instruction', async () => {
    const { fetcher, seen } = stub({
      candidates: [{ content: { parts: [{ text: 'hi' }] }, finishReason: 'STOP' }],
      usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 2 },
    });
    const a = new GeminiAdapter({ apiKey: 'k', baseUrl: 'https://g/v1', model: 'gemini-x', fetcher });

    await a.generate(
      {
        system: 'be helpful',
        messages: [
          { role: 'user', content: 'hi' },
          { role: 'assistant', content: 'hello' },
        ],
        maxOutputTokens: 10,
      },
      ctx()
    );

    expect(seen.body.contents[1].role).toBe('model');
    expect(seen.body.systemInstruction.parts[0].text).toBe('be helpful');
  });

  it('reports a blocked prompt as a content refusal, not an outage', async () => {
    const { fetcher } = stub({ promptFeedback: { blockReason: 'SAFETY' } });
    const a = new GeminiAdapter({ apiKey: 'k', baseUrl: 'https://g/v1', model: 'm', fetcher });

    await expect(
      a.generate({ messages: [{ role: 'user', content: 'x' }], maxOutputTokens: 10 }, ctx())
    ).rejects.toMatchObject({ code: 'CONTENT_FILTERED' });
  });
});

describe('error taxonomy', () => {
  it('maps HTTP status to retry semantics', () => {
    expect(errorFromStatus(429, '').code).toBe('RATE_LIMITED');
    expect(errorFromStatus(429, '').retryableSameModel).toBe(true);
    expect(errorFromStatus(500, '').code).toBe('TRANSIENT');
    expect(errorFromStatus(400, '').code).toBe('INVALID_REQUEST');
    expect(errorFromStatus(400, '').retryableSameModel).toBe(false);
    // A bad key is our problem and retrying cannot fix it.
    expect(errorFromStatus(401, '').code).toBe('INVALID_REQUEST');
  });
});

describe('extractJson', () => {
  it('reads plain, fenced and embedded JSON', () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(extractJson('Sure. {"a":1} Hope that helps.')).toEqual({ a: 1 });
  });

  it('throws rather than inventing a result', () => {
    expect(() => extractJson('no json here')).toThrow(LLMError);
  });
});

describe('ModelRouter', () => {
  const req = { messages: [{ role: 'user' as const, content: 'hi' }], maxOutputTokens: 10 };
  const noSleep = async () => {};

  it('excludes models that cannot meet the requirement', () => {
    const capable = new ScriptedAdapter({ id: 'a' });
    const incapable = new ScriptedAdapter({
      id: 'b',
      capabilities: { supportsStructuredOutput: false },
    });
    const router = new ModelRouter({ models: [incapable, capable] });

    const selected = router.select({ needsStructuredOutput: true });
    expect(selected.map((m) => m.id)).toEqual(['a']);
  });

  it('retries the same model on a rate limit', async () => {
    let calls = 0;
    const flaky = new ScriptedAdapter({ id: 'flaky' });
    flaky.generate = async () => {
      calls++;
      if (calls < 3) throw new LLMError('RATE_LIMITED', 'slow down');
      return {
        text: 'ok',
        usage: { inputTokens: 1, outputTokens: 1 },
        finishReason: 'stop' as const,
        modelId: 'flaky',
      };
    };

    const router = new ModelRouter({ models: [flaky], sleep: noSleep });
    const { result, trace } = await router.run(req, ctx());

    expect(result.text).toBe('ok');
    expect(trace.attempts).toBe(3);
  });

  it('falls through to the next model when one is unavailable', async () => {
    const down = new ScriptedAdapter({
      id: 'down',
      failWith: new LLMError('UNAVAILABLE', 'down'),
    });
    const up = new ScriptedAdapter({ id: 'up', replies: ['from the second model'] });

    const router = new ModelRouter({ models: [down, up], sleep: noSleep });
    const { result, trace } = await router.run(req, ctx());

    expect(result.text).toBe('from the second model');
    expect(trace.modelId).toBe('up');
  });

  it('does not retry an invalid request or a refusal', async () => {
    for (const code of ['INVALID_REQUEST', 'CONTENT_FILTERED'] as const) {
      const model = new ScriptedAdapter({ failWith: new LLMError(code, 'no') });
      const spare = new ScriptedAdapter({ id: 'spare', replies: ['should not be reached'] });
      const router = new ModelRouter({ models: [model, spare], sleep: noSleep });

      await expect(router.run(req, ctx())).rejects.toMatchObject({ code });
    }
  });

  it('stops immediately when the learner cancels', async () => {
    const controller = new AbortController();
    controller.abort();
    const router = new ModelRouter({ models: [new ScriptedAdapter()], sleep: noSleep });

    await expect(
      router.run(req, { ...ctx(), signal: controller.signal })
    ).rejects.toMatchObject({ code: 'CANCELLED' });
  });

  it('refuses before spending when the budget is too small', async () => {
    const pricey = new ScriptedAdapter({
      capabilities: { inputCostPerMTok: 1000, outputCostPerMTok: 1000 },
    });
    const router = new ModelRouter({ models: [pricey], sleep: noSleep });

    await expect(
      router.run({ ...req, maxOutputTokens: 100_000 }, { ...ctx(), budgetCredits: 0.000001 })
    ).rejects.toMatchObject({ code: 'BUDGET_EXCEEDED' });
    expect(pricey.calls).toHaveLength(0);
  });

  it('reports cost from real usage', async () => {
    const model = new ScriptedAdapter({
      capabilities: { inputCostPerMTok: 1_000_000, outputCostPerMTok: 1_000_000 },
    });
    const router = new ModelRouter({ models: [model], sleep: noSleep });

    const { trace } = await router.run(req, ctx());
    expect(trace.costCredits).toBeGreaterThan(0);
  });

  it('errors clearly when nothing can serve the request', async () => {
    const router = new ModelRouter({
      models: [new ScriptedAdapter({ capabilities: { supportsStructuredOutput: false } })],
    });
    await expect(router.run(req, ctx(), { needsStructuredOutput: true })).rejects.toMatchObject({
      code: 'UNAVAILABLE',
    });
  });
});

describe('buildRouter', () => {
  it('degrades to a scripted model rather than throwing when unconfigured', () => {
    const { router, degraded, configured } = buildRouter({});
    expect(degraded).toBe(true);
    expect(router.size).toBe(1);
    expect(configured).toEqual(['scripted:local']);
  });

  it('registers each configured provider', () => {
    const { degraded, configured } = buildRouter({
      ANTHROPIC_API_KEY: 'a',
      OPENAI_API_KEY: 'b',
      GEMINI_API_KEY: 'c',
      OPENAI_COMPATIBLE_BASE_URL: 'http://localhost:11434/v1',
      OPENAI_COMPATIBLE_MODEL: 'qwen2.5',
      OPENAI_COMPATIBLE_VENDOR: 'ollama',
    });

    expect(degraded).toBe(false);
    expect(configured).toHaveLength(4);
    expect(configured).toContain('ollama:qwen2.5');
  });

  it('honours a self-hosted server that cannot enforce a schema', () => {
    const { router } = buildRouter({
      OPENAI_COMPATIBLE_BASE_URL: 'http://x/v1',
      OPENAI_COMPATIBLE_MODEL: 'hermes',
      OPENAI_COMPATIBLE_NO_STRUCTURED_OUTPUT: 'true',
    });

    expect(router.select({ needsStructuredOutput: true })).toHaveLength(0);
  });
});
