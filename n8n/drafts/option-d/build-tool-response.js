/**
 * Build Tool Response — formate les slots retournés par Check Availability
 * en objet response utilisable par Gemini (2e appel) dans le functionResponse part.
 *
 * Option D : Gemini function calling pattern.
 *
 * Cette version SIMPLIFIÉE ne construit PAS le contents[] complet (ce travail
 * est fait inline dans le jsonBody de Gemini AI Final via JSON.stringify sur
 * les expressions n8n). Ici on prépare uniquement `tool_response_data`.
 */
const availItems = $('Check Availability').all() || [];
const validSlots = availItems.filter(it => it && it.json && it.json.slot_start);

let tool_response_data;
if (validSlots.length === 0) {
  tool_response_data = {
    slots: [],
    count: 0,
    message: "Aucun créneau disponible pour cette date."
  };
} else {
  const timeFmt = new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
  const formatted = validSlots.map(it => ({
    time: timeFmt.format(new Date(it.json.slot_start)),
    iso: it.json.slot_start,
    practitioner: it.json.practitioner_name,
    practitioner_id: it.json.practitioner_id
  }));
  tool_response_data = {
    slots: formatted,
    count: formatted.length
  };
}

// Parse Gemini Response porte le contexte + les tokens call1 + conversation_parts
const ctx = $('Parse Gemini Response').first().json;

return [{
  json: {
    ...ctx,
    tool_response_data: tool_response_data
  }
}];
