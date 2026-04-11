/**
 * Parse Tool Call — détecte si Gemini veut appeler une fonction (get_available_slots)
 * ou a directement répondu en texte JSON.
 *
 * Option D : Gemini function calling pattern.
 *
 * Output fields:
 *   - has_tool_call: bool — true si Gemini veut appeler une fonction
 *   - tool_name, tool_args, tool_call_id : metadata de la fonction appelée (si has_tool_call)
 *   - conversation_parts : sauvegarde de la réponse model (functionCall) pour le 2e appel
 *   - gemini_call1_* : tokens consommés par le 1er appel (seront mergés au 2e appel plus tard)
 *   - response_text, action, booking_data : si PAS de tool call (réponse text direct)
 *   - llm_* : tokens finaux (si pas de tool call — sinon, Parse Final Response les mergera)
 */
const geminiOutput = $input.first().json;
const candidate = geminiOutput.candidates?.[0];
const parts = candidate?.content?.parts || [];
const usageMetadata = geminiOutput.usageMetadata || {};

// Chercher un functionCall dans les parts
const fnCallPart = parts.find(p => p.functionCall);
const fnCall = fnCallPart?.functionCall;
const textPart = parts.find(p => p.text !== undefined)?.text;

const ctx = $('Compute Budget Status').first().json;

if (fnCall) {
  // Gemini veut appeler une fonction — on va router vers Check Availability
  return [{
    json: {
      ...ctx,
      has_tool_call: true,
      tool_name: fnCall.name,
      tool_args: fnCall.args || {},
      tool_call_id: fnCall.id || null,
      // Sauvegarde des parts model pour le 2e appel (Gemini exige le même contenu model)
      conversation_parts: parts,
      // Tokens du 1er appel (seront mergés dans Parse Final Response)
      gemini_call1_prompt_tokens: usageMetadata.promptTokenCount || 0,
      gemini_call1_completion_tokens: usageMetadata.candidatesTokenCount || 0,
      gemini_call1_total_tokens: usageMetadata.totalTokenCount || 0
    }
  }];
}

// Pas de tool call : Gemini a répondu directement en texte JSON
let parsed;
try {
  parsed = JSON.parse(textPart || '{}');
} catch (e) {
  parsed = {
    response_text: textPart || "Désolé, je n'ai pas compris. Pouvez-vous reformuler ?",
    action: 'none',
    booking_data: {}
  };
}

return [{
  json: {
    ...ctx,
    has_tool_call: false,
    response_text: parsed.response_text || textPart || '',
    action: parsed.action || 'none',
    booking_data: parsed.booking_data || {},
    // Token tracking (no tool call = un seul appel)
    llm_provider: 'gemini',
    llm_model: 'gemini-2.5-flash-lite',
    llm_prompt_tokens: usageMetadata.promptTokenCount || 0,
    llm_completion_tokens: usageMetadata.candidatesTokenCount || 0,
    llm_total_tokens: usageMetadata.totalTokenCount || 0,
    llm_is_fallback: false,
    llm_error: null
  }
}];
