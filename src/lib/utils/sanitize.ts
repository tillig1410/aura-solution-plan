const CONTROL_CHARS = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F\u200B-\u200F\u2028-\u202F\uFEFF]/g;
const WHATSAPP_FORMAT = /[*_~`]/g;

export function sanitizeMessageText(text: string, maxLength = 100): string {
  return text
    .replace(CONTROL_CHARS, "")
    .replace(WHATSAPP_FORMAT, "")
    .replace(/[\r\n]+/g, " ")
    .trim()
    .slice(0, maxLength);
}
