export async function withRetry(task, options = {}) {
  const retries = options.retries ?? 2;
  const delayMs = options.delayMs ?? 500;
  const shouldRetry = options.shouldRetry ?? ((error) => {
    if (!error?.response) {
      return true;
    }
    const status = Number(error.response.status || 0);
    return status >= 500;
  });

  let lastError = null;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const result = await task(attempt);
      if (typeof options.onSuccess === 'function') {
        await options.onSuccess({ attempt, result });
      }
      return result;
    } catch (error) {
      lastError = error;
      if (typeof options.onError === 'function') {
        await options.onError({ attempt, error });
      }
      if (attempt >= retries || !shouldRetry(error, attempt)) {
        if (typeof options.onFailure === 'function') {
          await options.onFailure({ attempt, error });
        }
        throw error;
      }
      if (typeof options.onRetry === 'function') {
        await options.onRetry({ attempt, error });
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs * (attempt + 1)));
    }
  }

  throw lastError;
}
