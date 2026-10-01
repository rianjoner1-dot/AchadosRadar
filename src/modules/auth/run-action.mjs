export async function runAuthAction(action) {
  try {
    const result = await action();
    return !result?.error;
  } catch {
    return false;
  }
}
