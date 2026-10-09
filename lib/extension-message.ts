export function runtimeAlive(readId: () => string | undefined): boolean {
  try {
    return Boolean(readId());
  } catch {
    return false;
  }
}

// Chrome throws synchronously after a reload. `await runtime.sendMessage().catch()`
// never attaches, because the property read fails before `.catch` runs.
export async function sendExtensionMessage(send: () => Promise<unknown> | unknown): Promise<unknown> {
  try {
    return await send();
  } catch {
    return null;
  }
}
