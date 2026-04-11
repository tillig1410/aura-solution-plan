/**
 * Sanitize Prompt Inputs (ASI01 — Prompt Injection Prevention)
 *
 * Option D refactor : Check Availability est retiré du flow main.
 * Les slots sont maintenant chargés à la demande via tool calling (get_available_slots),
 * donc safe_available_slots_text est un placeholder pour le fallback Mistral.
 */

const MAX_NAME = 80;
const MAX_MESSAGE = 500;
const MAX_HISTORY = 2000;
const MAX_FIELD = 200;

function sanitize(s, maxLen) {
  if (!s) return '';
  s = String(s)
    .replace(/\b(system|assistant|admin)\s*:/gi, '[FILTERED]')
    .replace(/\b(tu\s+es|you\s+are)\s+(now|maintenant|désormais)/gi, '[FILTERED]')
    .replace(/\bACT\s+AS\b/gi, '[FILTERED]')
    .replace(/\bRÈGLES?\s*:/gi, '[FILTERED]')
    .replace(/\bINSTRUCTION[S]?\s*:/gi, '[FILTERED]');
  if (s.length > maxLen) s = s.substring(0, maxLen) + '…';
  return s;
}

const ctx = $('Build Context').first().json;

const packagesData = $('Check Client Packages').first()?.json || [];
const subscriptionsData = $('Check Client Subscriptions').first()?.json || [];
const now = new Date().toISOString();

const packages = Array.isArray(packagesData) ? packagesData : [];
const subscriptions = Array.isArray(subscriptionsData) ? subscriptionsData : [];

const activePackages = packages.filter(cp => {
  if (!cp.package || !cp.package.is_active) return false;
  if (cp.expires_at && cp.expires_at < now) return false;
  return true;
});

const activeSubscriptions = subscriptions;

let coverageSummary = 'aucun';
if (activePackages.length > 0 || activeSubscriptions.length > 0) {
  const parts = [];
  activePackages.forEach(cp => {
    parts.push(`Forfait "${cp.package.name}" (${cp.remaining_uses} séances restantes)`);
  });
  activeSubscriptions.forEach(sub => {
    parts.push(`Abonnement "${sub.name}" (actif)`);
  });
  coverageSummary = parts.join(', ');
}

// Option D : placeholder. Gemini utilisera le tool get_available_slots pour charger les slots.
// Mistral Fallback (degraded mode) verra ce message et répondra "je vérifie et recontacte".
const slotsText = 'Les créneaux sont vérifiés à la demande via la fonction get_available_slots.';

return [{
  json: {
    ...ctx,
    safe_client_name: sanitize(ctx.client_name, MAX_NAME) || 'Inconnu',
    safe_message_text: sanitize(ctx.message_text, MAX_MESSAGE),
    safe_preferred_service: sanitize(ctx.preferred_service, MAX_FIELD) || 'aucun',
    safe_preferred_practitioner: sanitize(ctx.preferred_practitioner, MAX_FIELD) || 'aucun',
    safe_active_package: sanitize(coverageSummary, MAX_FIELD) || 'aucun',
    safe_conversation_history: sanitize(ctx.conversation_history, MAX_HISTORY) || 'Première interaction',
    safe_available_slots_text: slotsText,
    safe_loyalty_points: Number(ctx.loyalty_points) || 0,
    safe_cancellation_delay: Number(ctx.cancellation_delay_minutes) || 120,
    has_active_coverage: activePackages.length > 0 || activeSubscriptions.length > 0
  }
}];
