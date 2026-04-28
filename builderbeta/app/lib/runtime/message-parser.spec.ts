import { describe, expect, it, vi } from 'vitest';
import { StreamingMessageParser, type ActionCallback, type ArtifactCallback } from './message-parser';

interface ExpectedResult {
  output: string;
  callbacks?: {
    onArtifactOpen?: number;
    onArtifactClose?: number;
    onActionOpen?: number;
    onActionClose?: number;
  };
}

describe('StreamingMessageParser', () => {
  it('should pass through normal text', () => {
    const parser = new StreamingMessageParser();
    expect(parser.parse('test_id', 'Hello, world!')).toBe('Hello, world!');
  });

  it('should allow normal HTML tags', () => {
    const parser = new StreamingMessageParser();
    expect(parser.parse('test_id', 'Hello <strong>world</strong>!')).toBe('Hello <strong>world</strong>!');
  });

  describe('no artifacts', () => {
    it.each<[string | string[], ExpectedResult | string]>([
      ['Foo bar', 'Foo bar'],
      ['Foo bar <', 'Foo bar '],
      ['Foo bar <p', 'Foo bar <p'],
      [['Foo bar <', 's', 'p', 'an>some text</span>'], 'Foo bar <span>some text</span>'],
    ])('should correctly parse chunks and strip out flare artifacts (%#)', (input, expected) => {
      runTest(input, expected);
    });
  });

  describe('invalid or incomplete artifacts', () => {
    it.each<[string | string[], ExpectedResult | string]>([
      ['Foo bar <f', 'Foo bar '],
      ['Foo bar <fa', 'Foo bar <fa'],
      ['Foo bar <fla', 'Foo bar '],
      ['Foo bar <flare', 'Foo bar '],
      ['Foo bar <flarea', 'Foo bar <flarea'],
      ['Foo bar <flareA', 'Foo bar '],
      ['Foo bar <flareArtifacs></flareArtifact>', 'Foo bar <flareArtifacs></flareArtifact>'],
      ['Before <oltArtfiact>foo</flareArtifact> After', 'Before <oltArtfiact>foo</flareArtifact> After'],
      ['Before <flareArtifactt>foo</flareArtifact> After', 'Before <flareArtifactt>foo</flareArtifact> After'],
    ])('should correctly parse chunks and strip out flare artifacts (%#)', (input, expected) => {
      runTest(input, expected);
    });
  });

  describe('valid artifacts without actions', () => {
    it.each<[string | string[], ExpectedResult | string]>([
      [
        'Some text before <flareArtifact title="Some title" id="artifact_1">foo bar</flareArtifact> Some more text',
        {
          output: 'Some text before  Some more text',
          callbacks: { onArtifactOpen: 1, onArtifactClose: 1, onActionOpen: 0, onActionClose: 0 },
        },
      ],
      [
        [
          'Some text before <flareArti',
          'fact',
          ' title="Some title" id="artifact_1">foo</flareArtifact> Some more text',
        ],
        {
          output: 'Some text before  Some more text',
          callbacks: { onArtifactOpen: 1, onArtifactClose: 1, onActionOpen: 0, onActionClose: 0 },
        },
      ],
      [
        [
          'Some text before <flareArti',
          'fac',
          't title="Some title" id="artifact_1"',
          ' ',
          '>',
          'foo</flareArtifact> Some more text',
        ],
        {
          output: 'Some text before  Some more text',
          callbacks: { onArtifactOpen: 1, onArtifactClose: 1, onActionOpen: 0, onActionClose: 0 },
        },
      ],
      [
        [
          'Some text before <flareArti',
          'fact',
          ' title="Some title" id="artifact_1"',
          ' >fo',
          'o</flareArtifact> Some more text',
        ],
        {
          output: 'Some text before  Some more text',
          callbacks: { onArtifactOpen: 1, onArtifactClose: 1, onActionOpen: 0, onActionClose: 0 },
        },
      ],
      [
        [
          'Some text before <flareArti',
          'fact tit',
          'le="Some ',
          'title" id="artifact_1">fo',
          'o',
          '<',
          '/flareArtifact> Some more text',
        ],
        {
          output: 'Some text before  Some more text',
          callbacks: { onArtifactOpen: 1, onArtifactClose: 1, onActionOpen: 0, onActionClose: 0 },
        },
      ],
      [
        [
          'Some text before <flareArti',
          'fact title="Some title" id="artif',
          'act_1">fo',
          'o<',
          '/flareArtifact> Some more text',
        ],
        {
          output: 'Some text before  Some more text',
          callbacks: { onArtifactOpen: 1, onArtifactClose: 1, onActionOpen: 0, onActionClose: 0 },
        },
      ],
      [
        'Before <flareArtifact title="Some title" id="artifact_1">foo</flareArtifact> After',
        {
          output: 'Before  After',
          callbacks: { onArtifactOpen: 1, onArtifactClose: 1, onActionOpen: 0, onActionClose: 0 },
        },
      ],
    ])('should correctly parse chunks and strip out flare artifacts (%#)', (input, expected) => {
      runTest(input, expected);
    });
  });

  describe('valid artifacts with actions', () => {
    it.each<[string | string[], ExpectedResult | string]>([
      [
        'Before <flareArtifact title="Some title" id="artifact_1"><flareAction type="shell">npm install</flareAction></flareArtifact> After',
        {
          output: 'Before  After',
          callbacks: { onArtifactOpen: 1, onArtifactClose: 1, onActionOpen: 1, onActionClose: 1 },
        },
      ],
      [
        'Before <flareArtifact title="Some title" id="artifact_1"><flareAction type="shell">npm install</flareAction><flareAction type="file" filePath="index.js">some content</flareAction></flareArtifact> After',
        {
          output: 'Before  After',
          callbacks: { onArtifactOpen: 1, onArtifactClose: 1, onActionOpen: 2, onActionClose: 2 },
        },
      ],
    ])('should correctly parse chunks and strip out flare artifacts (%#)', (input, expected) => {
      runTest(input, expected);
    });
  });

  it('finalize closes unterminated shell action and artifact', () => {
    const callbacks = {
      onArtifactOpen: vi.fn<ArtifactCallback>(),
      onArtifactClose: vi.fn<ArtifactCallback>(),
      onActionOpen: vi.fn<ActionCallback>(),
      onActionClose: vi.fn<ActionCallback>(),
    };

    const parser = new StreamingMessageParser({
      artifactElement: () => '',
      callbacks,
    });

    const messageId = 'message_finalize_shell';
    parser.parse(
      messageId,
      'Before <flareArtifact title="Some title" id="artifact_1"><flareAction type="shell">npm install',
    );

    parser.finalize(messageId);

    expect(callbacks.onArtifactOpen).toHaveBeenCalledTimes(1);
    expect(callbacks.onActionOpen).toHaveBeenCalledTimes(1);
    expect(callbacks.onActionClose).toHaveBeenCalledTimes(1);
    expect(callbacks.onArtifactClose).toHaveBeenCalledTimes(1);

    expect(callbacks.onActionClose.mock.calls[0]?.[0]).toMatchObject({
      artifactId: 'artifact_1',
      action: {
        type: 'shell',
        content: 'npm install',
      },
    });
  });

  it('finalize closes unterminated file action and appends newline', () => {
    const callbacks = {
      onArtifactOpen: vi.fn<ArtifactCallback>(),
      onArtifactClose: vi.fn<ArtifactCallback>(),
      onActionOpen: vi.fn<ActionCallback>(),
      onActionClose: vi.fn<ActionCallback>(),
    };

    const parser = new StreamingMessageParser({
      artifactElement: () => '',
      callbacks,
    });

    const messageId = 'message_finalize_file';
    parser.parse(
      messageId,
      'Before <flareArtifact title="Some title" id="artifact_1"><flareAction type="file" filePath="index.ts">export const x = 1;',
    );

    parser.finalize(messageId);

    expect(callbacks.onActionClose).toHaveBeenCalledTimes(1);
    expect(callbacks.onArtifactClose).toHaveBeenCalledTimes(1);

    expect(callbacks.onActionClose.mock.calls[0]?.[0]).toMatchObject({
      action: {
        type: 'file',
        filePath: 'index.ts',
        content: 'export const x = 1;\n',
      },
    });
  });

  it('supports single-quoted action attributes', () => {
    const callbacks = {
      onArtifactOpen: vi.fn<ArtifactCallback>(),
      onArtifactClose: vi.fn<ArtifactCallback>(),
      onActionOpen: vi.fn<ActionCallback>(),
      onActionClose: vi.fn<ActionCallback>(),
    };

    const parser = new StreamingMessageParser({
      artifactElement: () => '',
      callbacks,
    });

    const message =
      "Before <flareArtifact title='Single Quote Artifact' id='artifact_1'><flareAction type='shell'>npm run build</flareAction></flareArtifact> After";

    runMessageThroughParser(parser, 'single_quote_case', message);

    expect(callbacks.onArtifactOpen).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'artifact_1',
        title: 'Single Quote Artifact',
      }),
    );

    expect(callbacks.onActionOpen).toHaveBeenCalledWith(
      expect.objectContaining({
        action: expect.objectContaining({ type: 'shell' }),
      }),
    );

    expect(callbacks.onActionClose).toHaveBeenCalledWith(
      expect.objectContaining({
        action: expect.objectContaining({
          type: 'shell',
          content: 'npm run build',
        }),
      }),
    );
  });
});

function runTest(input: string | string[], outputOrExpectedResult: string | ExpectedResult) {
  let expected: ExpectedResult;

  if (typeof outputOrExpectedResult === 'string') {
    expected = { output: outputOrExpectedResult };
  } else {
    expected = outputOrExpectedResult;
  }

  const callbacks = {
    onArtifactOpen: vi.fn<ArtifactCallback>((data) => {
      expect(data).toMatchSnapshot('onArtifactOpen');
    }),
    onArtifactClose: vi.fn<ArtifactCallback>((data) => {
      expect(data).toMatchSnapshot('onArtifactClose');
    }),
    onActionOpen: vi.fn<ActionCallback>((data) => {
      expect(data).toMatchSnapshot('onActionOpen');
    }),
    onActionClose: vi.fn<ActionCallback>((data) => {
      expect(data).toMatchSnapshot('onActionClose');
    }),
  };

  const parser = new StreamingMessageParser({
    artifactElement: () => '',
    callbacks,
  });

  let message = '';
  let result = '';

  const chunks = Array.isArray(input) ? input : input.split('');

  for (const chunk of chunks) {
    message += chunk;

    result += parser.parse('message_1', message);
  }

  for (const name in expected.callbacks) {
    const callbackName = name;

    expect(callbacks[callbackName as keyof typeof callbacks]).toHaveBeenCalledTimes(
      expected.callbacks?.[callbackName as keyof typeof expected.callbacks] ?? 0,
    );
  }

  expect(result).toEqual(expected.output);
}

function runMessageThroughParser(parser: StreamingMessageParser, messageId: string, message: string) {
  let accumulated = '';

  for (const char of message) {
    accumulated += char;
    parser.parse(messageId, accumulated);
  }
}
