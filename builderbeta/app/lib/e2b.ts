import { Sandbox } from '@e2b/code-interpreter';

export async function createSandbox() {
  return await Sandbox.create();
}
