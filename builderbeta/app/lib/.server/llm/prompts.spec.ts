import { describe, expect, it } from 'vitest';
import { getSystemPrompt } from './prompts';

describe('getSystemPrompt workspace path directives', () => {
  it('uses /home/project as the persistent workspace path', () => {
    const prompt = getSystemPrompt();

    expect(prompt).toContain('The current working directory is `/home/project`.');
    expect(prompt).toContain('Your environment and files in `/home/project` persist across actions');
    expect(prompt).not.toContain('/home/user');
  });
});
