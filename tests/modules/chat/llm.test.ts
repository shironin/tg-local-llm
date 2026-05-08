import { askLLM, askLLMShort } from '../../../src/modules/chat/llm';
import type { Message } from '../../../src/modules/history';

const MESSAGES: Message[] = [{ role: 'user', content: 'hello' }];

function makeOkResponse(content: string): Promise<Response> {
  return Promise.resolve({
    ok: true,
    status: 200,
    statusText: 'OK',
    json: () => Promise.resolve({ message: { role: 'assistant', content } }),
    text: () => Promise.resolve(''),
  } as Response);
}

function makeErrorResponse(status: number, body = 'error'): Promise<Response> {
  return Promise.resolve({
    ok: false,
    status,
    statusText: 'Error',
    json: () => Promise.reject(new Error('not json')),
    text: () => Promise.resolve(body),
  } as Response);
}

beforeEach(() => {
  // Fake timers prevent the real 3 s + 8 s retry delays from executing
  jest.useFakeTimers();
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

// Attach the assertion BEFORE draining timers so the rejection is never "unhandled"
async function assertRejects(promise: Promise<unknown>, matcher: string | RegExp): Promise<void> {
  const assertion = expect(promise).rejects.toThrow(matcher);
  await jest.runAllTimersAsync();
  await assertion;
}

describe('askLLM', () => {
  it('returns the model reply content on success', async () => {
    jest.spyOn(global, 'fetch').mockReturnValue(makeOkResponse('great answer'));
    expect(await askLLM(MESSAGES)).toBe('great answer');
  });

  it('sends the correct request body to Ollama', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch').mockReturnValue(makeOkResponse('ok'));
    await askLLM(MESSAGES, 'TestLabel');
    const [url, init] = fetchSpy.mock.calls[0];
    expect(String(url)).toContain('/api/chat');
    const body = JSON.parse(init!.body as string);
    expect(body.model).toBe('test-model');
    expect(body.stream).toBe(false);
    expect(body.messages[0]).toMatchObject({ role: 'user', content: 'hello' });
  });

  it('throws when Ollama returns a non-2xx status', async () => {
    jest.spyOn(global, 'fetch').mockReturnValue(makeErrorResponse(500, 'oops'));
    await assertRejects(askLLM(MESSAGES), 'Ollama returned 500');
  });

  it('throws when the response has no content', async () => {
    jest.spyOn(global, 'fetch').mockReturnValue(
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ message: { role: 'assistant', content: '' } }),
        text: () => Promise.resolve(''),
      } as Response)
    );
    await assertRejects(askLLM(MESSAGES), 'empty response');
  });

  it('throws with a timeout message when the request times out', async () => {
    const timeoutError = Object.assign(new Error('signal timed out'), { name: 'TimeoutError' });
    jest.spyOn(global, 'fetch').mockRejectedValue(timeoutError);
    await assertRejects(askLLM(MESSAGES), /timed out/i);
  });

  it('throws with a connectivity message for other network errors', async () => {
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('ECONNREFUSED'));
    await assertRejects(askLLM(MESSAGES), /Cannot reach Ollama/);
  });

  it('retries twice before throwing the last error', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch').mockRejectedValue(new Error('flaky'));
    await assertRejects(askLLM(MESSAGES), /Cannot reach Ollama/);
    expect(fetchSpy).toHaveBeenCalledTimes(3); // initial + 2 retries
  });

  it('succeeds on retry after an initial failure', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockRejectedValueOnce(new Error('temp error'))
      .mockReturnValue(makeOkResponse('recovered'));
    const promise = askLLM(MESSAGES);
    await jest.runAllTimersAsync();
    expect(await promise).toBe('recovered');
  });
});

describe('askLLMShort', () => {
  it('uses the summary model', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch').mockReturnValue(makeOkResponse('summary'));
    await askLLMShort(MESSAGES);
    const body = JSON.parse(fetchSpy.mock.calls[0][1]!.body as string);
    expect(body.model).toBe('summary-model');
  });
});
