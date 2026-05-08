const mockAskLLM = jest.fn();
jest.mock('../../../src/modules/chat/llm', () => ({ askLLM: mockAskLLM }));
jest.mock('../../../src/modules/history', () => ({ getHistory: jest.fn().mockReturnValue([]) }));

const mockGetToolByName = jest.fn();
const mockGetToolNames = jest.fn().mockReturnValue('calculator, web_search');
jest.mock('../../../src/tools/registry', () => ({
  getToolByName: mockGetToolByName,
  getToolNames: mockGetToolNames,
  buildToolsDescription: jest.fn().mockReturnValue('tool list'),
}));

import { runAgent } from '../../../src/modules/chat/agent';

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

const finalAnswer = (text: string) => JSON.stringify({ final_answer: text });
const toolCall = (action: string, args: any) =>
  JSON.stringify({ thought: 'thinking', action, args });

describe('runAgent', () => {
  it('returns final_answer directly from first LLM response', async () => {
    mockAskLLM.mockResolvedValue(finalAnswer('Hello there!'));
    expect(await runAgent('hi', 1)).toBe('Hello there!');
  });

  it('executes a tool and uses the observation in the next step', async () => {
    const mockTool = { execute: jest.fn().mockResolvedValue('result: 42') };
    mockGetToolByName.mockReturnValue(mockTool);
    mockAskLLM
      .mockResolvedValueOnce(toolCall('calculator', { expression: '6*7' }))
      .mockResolvedValueOnce(finalAnswer('The answer is 42'));

    const result = await runAgent('what is 6*7?', 1);
    expect(mockTool.execute).toHaveBeenCalledWith({ expression: '6*7' });
    expect(result).toBe('The answer is 42');
  });

  it('accepts plain string args passed to a tool', async () => {
    const mockTool = { execute: jest.fn().mockResolvedValue('found results') };
    mockGetToolByName.mockReturnValue(mockTool);
    mockAskLLM
      .mockResolvedValueOnce(toolCall('web_search', 'typescript jest'))
      .mockResolvedValueOnce(finalAnswer('done'));

    await runAgent('search for jest', 1);
    expect(mockTool.execute).toHaveBeenCalledWith('typescript jest');
  });

  it('passes unknown-tool error as observation and continues', async () => {
    mockGetToolByName.mockReturnValue(undefined);
    mockAskLLM
      .mockResolvedValueOnce(toolCall('nonexistent_tool', {}))
      .mockResolvedValueOnce(finalAnswer('sorry'));

    const result = await runAgent('do something', 1);
    const secondCallMessages = mockAskLLM.mock.calls[1][0];
    const observationMsg = secondCallMessages.find((m: any) =>
      m.content?.includes('unknown tool')
    );
    expect(observationMsg).toBeDefined();
    expect(result).toBe('sorry');
  });

  it('retries with a fix prompt on invalid JSON, then continues', async () => {
    mockAskLLM
      .mockResolvedValueOnce('not json at all')
      .mockResolvedValueOnce(finalAnswer('recovered'));

    const result = await runAgent('test', 1);
    expect(result).toBe('recovered');
    const fixMessages = mockAskLLM.mock.calls[1][0];
    expect(fixMessages.some((m: any) => m.content?.includes('valid JSON'))).toBe(true);
  });

  it('returns error message when JSON is still invalid after retry', async () => {
    mockAskLLM.mockResolvedValue('still not json');
    const result = await runAgent('test', 1);
    expect(result).toContain('trouble formatting');
  });

  it('sends a nudge when action is null and continues', async () => {
    mockAskLLM
      .mockResolvedValueOnce(JSON.stringify({ thought: 'hmm', action: null, args: {} }))
      .mockResolvedValueOnce(finalAnswer('ok'));

    await runAgent('test', 1);
    const nudgeMessages = mockAskLLM.mock.calls[1][0];
    expect(nudgeMessages.some((m: any) => m.content?.includes('null'))).toBe(true);
  });

  it('returns answer when action is "final_answer" with object args', async () => {
    mockAskLLM.mockResolvedValue(
      JSON.stringify({ thought: 'done', action: 'final_answer', args: { answer: 'my answer' } })
    );
    expect(await runAgent('test', 1)).toBe('my answer');
  });

  it('returns answer when action is "final_answer" with string args', async () => {
    mockAskLLM.mockResolvedValue(
      JSON.stringify({ thought: 'done', action: 'final_answer', args: 'direct answer' })
    );
    expect(await runAgent('test', 1)).toBe('direct answer');
  });

  it('returns max-steps message when all steps are exhausted', async () => {
    // AGENT_MAX_STEPS=3, return a tool call each time so it never finishes
    const mockTool = { execute: jest.fn().mockResolvedValue('ok') };
    mockGetToolByName.mockReturnValue(mockTool);
    mockAskLLM.mockResolvedValue(toolCall('calculator', {}));

    const result = await runAgent('loop forever', 1);
    expect(result).toContain('maximum reasoning steps');
    expect(mockAskLLM).toHaveBeenCalledTimes(3);
  });

  it('strips markdown code fences from LLM response before parsing', async () => {
    mockAskLLM.mockResolvedValue('```json\n' + finalAnswer('clean') + '\n```');
    expect(await runAgent('test', 1)).toBe('clean');
  });
});
