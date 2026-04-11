/**
 * Ensure Conversation — garantit qu'une conversation active existe pour
 * le couple (merchant_id, client_id, channel) et retourne son ID.
 *
 * Approche 2-step (GET puis POST si vide) via this.helpers.httpRequest.
 * Une optimisation future est possible via la RPC get_or_create_active_conversation
 * (migration 022) qui ferait l'opération en 1 call atomique.
 *
 * Input : Build Context output (merchant_id, client_id, channel)
 * Output : même objet avec `conversation_id` set
 */
const ctx = $input.first().json;

const SUPABASE_URL = 'https://txebdgmufdsnkrntzvwn.supabase.co';
const SERVICE_ROLE_BEARER = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR4ZWJkZ211ZmRzbmtybnR6dnduIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTI4ODI4NSwiZXhwIjoyMDkwODY0Mjg1fQ.Lhs0hpkH5IIEDlDnJoebaCt6saQ26K370VNe3s4j36o';

const authHeaders = {
  'apikey': SERVICE_ROLE_BEARER.replace('Bearer ', ''),
  'Authorization': SERVICE_ROLE_BEARER,
  'Content-Type': 'application/json'
};

// Étape 1 : chercher une conversation active existante
const findRes = await this.helpers.httpRequest({
  method: 'GET',
  url: `${SUPABASE_URL}/rest/v1/conversations`,
  qs: {
    merchant_id: `eq.${ctx.merchant_id}`,
    client_id: `eq.${ctx.client_id}`,
    channel: `eq.${ctx.channel || 'whatsapp'}`,
    is_active: 'eq.true',
    select: 'id',
    order: 'created_at.desc',
    limit: '1'
  },
  headers: authHeaders,
  json: true
});

let conversationId;
let conversationCreated = false;

if (Array.isArray(findRes) && findRes.length > 0 && findRes[0].id) {
  conversationId = findRes[0].id;
} else {
  // Étape 2 : créer une nouvelle conversation
  const createRes = await this.helpers.httpRequest({
    method: 'POST',
    url: `${SUPABASE_URL}/rest/v1/conversations`,
    headers: {
      ...authHeaders,
      'Prefer': 'return=representation'
    },
    body: {
      merchant_id: ctx.merchant_id,
      client_id: ctx.client_id,
      channel: ctx.channel || 'whatsapp',
      is_active: true
    },
    json: true
  });
  const createdRow = Array.isArray(createRes) ? createRes[0] : createRes;
  conversationId = createdRow?.id;
  conversationCreated = true;
}

if (!conversationId) {
  throw new Error('Ensure Conversation: conversation_id not obtained from GET or POST');
}

return [{
  json: {
    ...ctx,
    conversation_id: conversationId,
    conversation_created: conversationCreated
  }
}];
