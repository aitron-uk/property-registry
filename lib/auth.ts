// Cookie holds a hash of APP_PASSWORD, so changing the password logs everyone out.
export async function authToken() {
  const bytes = new TextEncoder().encode(`property-registry:${process.env.APP_PASSWORD}`);
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return Array.from(hash, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function isAuthed(cookie: string | undefined) {
  return !process.env.APP_PASSWORD || cookie === (await authToken());
}
