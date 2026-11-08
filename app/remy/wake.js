// A name on its own is a call for attention; a sentence after it is a real request.
export function isWakeCall(text) {
  return /^(?:hey[\s,]+)?remy[\s!?.,]*$/i.test(String(text || '').trim());
}
