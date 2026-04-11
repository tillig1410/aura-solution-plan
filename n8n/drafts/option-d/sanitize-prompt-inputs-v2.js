/**
 * Sanitize Prompt Inputs v2 — Option D polish 4
 *
 * Changements par rapport à v1 :
 * - Lit maintenant l'output de Load Conversation History et formate safe_conversation_history
 * - Passe `conversation_id` depuis Ensure Conversation (upstream) dans le context
 *
 * ASI01 : prompt injection prevention + dates pré-calculées + next_open_day.
 */

const MAX_NAME = 80;
const MAX_MESSAGE = 500;
const MAX_HISTORY = 2000;
const MAX_FIELD = 200;
const MAX_HISTORY_MESSAGES = 10;

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

// On récupère le contexte depuis Ensure Conversation (qui a déjà injecté conversation_id)
// ou depuis Build Context en fallback
let ctx;
try {
  ctx = $('Ensure Conversation').first().json;
} catch (e) {
  ctx = $('Build Context').first().json;
}

const packagesData = $('Check Client Packages').first()?.json || [];
const subscriptionsData = $('Check Client Subscriptions').first()?.json || [];
const nowIso = new Date().toISOString();

const packages = Array.isArray(packagesData) ? packagesData : [];
const subscriptions = Array.isArray(subscriptionsData) ? subscriptionsData : [];

const activePackages = packages.filter(cp => {
  if (!cp.package || !cp.package.is_active) return false;
  if (cp.expires_at && cp.expires_at < nowIso) return false;
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

// --- Option D polish 4 : formatage de l'historique de conversation ---
// Load Conversation History v2 query directement /rest/v1/messages
// filtré par conversation_id (pas conversations embarquées). Output = array de messages.
let conversationHistoryText = 'Première interaction';
try {
  const lchData = $('Load Conversation History').first()?.json;
  const messages = Array.isArray(lchData) ? lchData : [];
  if (messages.length > 0) {
    const msgs = messages
      .filter(m => m && m.content && m.sender)
      .sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''))
      .slice(-MAX_HISTORY_MESSAGES);
    if (msgs.length > 0) {
      conversationHistoryText = msgs
        .map(m => {
          const role = m.sender === 'ai' ? 'IA' : 'Client';
          return `[${role}] ${m.content}`;
        })
        .join('\n');
    }
  }
} catch (e) {
  conversationHistoryText = 'Première interaction';
}

const slotsText = 'Les créneaux sont vérifiés à la demande via la fonction get_available_slots.';

// Pré-calcul des dates de référence (Europe/Paris timezone)
const tz = 'Europe/Paris';
const nowDt = DateTime.now().setZone(tz);
const nowFr = nowDt.setLocale('fr');
const todayWeekday = nowDt.weekday;

function nextWeekday(targetIso) {
  const daysAhead = ((targetIso - todayWeekday + 7) % 7) || 7;
  return nowDt.plus({ days: daysAhead }).toFormat('yyyy-MM-dd');
}

const nextMondayIso = nextWeekday(1);
const weekAfterNextMondayDt = DateTime.fromISO(nextMondayIso, { zone: tz }).plus({ days: 7 });

// Prochain jour d'ouverture du salon
const weekdayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const openingHours = ctx.opening_hours || {};
let nextOpenDay = nowDt.plus({ days: 1 }).toFormat('yyyy-MM-dd');
for (let i = 1; i <= 14; i++) {
  const candidate = nowDt.plus({ days: i });
  const dayName = weekdayNames[candidate.weekday - 1];
  const dayConfig = openingHours[dayName];
  if (dayConfig && dayConfig.open) {
    nextOpenDay = candidate.toFormat('yyyy-MM-dd');
    break;
  }
}

const ref_dates = {
  today: nowDt.toFormat('yyyy-MM-dd'),
  today_label: nowFr.toFormat('cccc yyyy-MM-dd'),
  tomorrow: nowDt.plus({ days: 1 }).toFormat('yyyy-MM-dd'),
  day_after_tomorrow: nowDt.plus({ days: 2 }).toFormat('yyyy-MM-dd'),
  next_open_day: nextOpenDay,
  next_monday: nextMondayIso,
  next_tuesday: nextWeekday(2),
  next_wednesday: nextWeekday(3),
  next_thursday: nextWeekday(4),
  next_friday: nextWeekday(5),
  next_saturday: nextWeekday(6),
  next_sunday: nextWeekday(7),
  week_after_next_monday: weekAfterNextMondayDt.toFormat('yyyy-MM-dd'),
  week_after_next_tuesday: weekAfterNextMondayDt.plus({ days: 1 }).toFormat('yyyy-MM-dd'),
  week_after_next_wednesday: weekAfterNextMondayDt.plus({ days: 2 }).toFormat('yyyy-MM-dd'),
  week_after_next_thursday: weekAfterNextMondayDt.plus({ days: 3 }).toFormat('yyyy-MM-dd'),
  week_after_next_friday: weekAfterNextMondayDt.plus({ days: 4 }).toFormat('yyyy-MM-dd'),
  week_after_next_saturday: weekAfterNextMondayDt.plus({ days: 5 }).toFormat('yyyy-MM-dd')
};

return [{
  json: {
    ...ctx,
    safe_client_name: sanitize(ctx.client_name, MAX_NAME) || 'Inconnu',
    safe_message_text: sanitize(ctx.message_text, MAX_MESSAGE),
    safe_preferred_service: sanitize(ctx.preferred_service, MAX_FIELD) || 'aucun',
    safe_preferred_practitioner: sanitize(ctx.preferred_practitioner, MAX_FIELD) || 'aucun',
    safe_active_package: sanitize(coverageSummary, MAX_FIELD) || 'aucun',
    safe_conversation_history: sanitize(conversationHistoryText, MAX_HISTORY),
    safe_available_slots_text: slotsText,
    safe_loyalty_points: Number(ctx.loyalty_points) || 0,
    safe_cancellation_delay: Number(ctx.cancellation_delay_minutes) || 120,
    has_active_coverage: activePackages.length > 0 || activeSubscriptions.length > 0,
    ref_dates: ref_dates,
    // Option D polish 4 : propage conversation_id pour Save Client Message et Save AI Message
    conversation_id: ctx.conversation_id || null
  }
}];
