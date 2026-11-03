/** Remove HTTP Basic credentials from a URL before it is logged or shown to a user. */
export function redactUrlCredentials(value: string): string {
  return value.replace(/(https?:\/\/)[^?#\s]*?@/gi, '$1');
}
