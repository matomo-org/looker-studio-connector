/** Remove HTTP Basic credentials from a URL before it is logged or shown to a user. */
export function redactUrlCredentials(value: string): string {
  // The connector's Basic Auth parser accepts raw ? and # in userinfo. Handle
  // those when they appear before the authority's first slash, then redact
  // ordinary userinfo without treating query or fragment @ characters as auth.
  return value
    .replace(/(https?:\/\/)[^\/?#\s]+:[^?#\s]*[?#][^\s]*?@/gi, '$1')
    .replace(/(https?:\/\/)[^?#\s]*@/gi, '$1');
}

/** Redact credential-bearing URLs in nested values passed to the logger. */
export function redactUrlsInValue(value: unknown, seen = new WeakMap<object, unknown>()): unknown {
  if (typeof value === 'string') {
    return redactUrlCredentials(value);
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  const existing = seen.get(value);
  if (existing) {
    return existing;
  }

  if (Array.isArray(value)) {
    const redacted: unknown[] = [];
    seen.set(value, redacted);
    value.forEach((item) => redacted.push(redactUrlsInValue(item, seen)));
    return redacted;
  }

  const redacted: Record<string, unknown> = {};
  seen.set(value, redacted);
  Object.entries(value).forEach(([key, item]) => {
    redacted[key] = redactUrlsInValue(item, seen);
  });
  return redacted;
}
