const key = "clio.pending-verification-email";
const eventName = "clio:verification-email";

// Only a convenience hint for this tab. The server still validates every request.
export function rememberVerificationEmail(email: string) {
  try { sessionStorage.setItem(key, email); window.dispatchEvent(new Event(eventName)); } catch {}
}
export function forgetVerificationEmail() {
  try { sessionStorage.removeItem(key); window.dispatchEvent(new Event(eventName)); } catch {}
}
export function getVerificationEmail() {
  try { return sessionStorage.getItem(key) ?? ""; } catch { return ""; }
}
export function subscribeVerificationEmail(callback: () => void) {
  window.addEventListener(eventName, callback);
  window.addEventListener("storage", callback);
  return () => { window.removeEventListener(eventName, callback); window.removeEventListener("storage", callback); };
}
