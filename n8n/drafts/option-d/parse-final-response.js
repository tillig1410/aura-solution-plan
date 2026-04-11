/**
 * Parse Final Response — extrait le texte JSON de la 2e réponse Gemini
 * (celle qui a reçu le résultat du tool) et merge les tokens du 1er + 2e appel.
 *
 * Option D : Gemini function calling pattern.
 */
const geminiOutput = $input.first().json;
const candidate = geminiOutput.candidates?.[0];
const text = candidate?.content?.parts?.[0]?.text || '{}';
const usageMetadata = geminiOutput.usageMetadata || {};

let parsed;
try {
  parsed = JSON.parse(text);
} catch (e) {
  parsed = {
    response_text: text || "Désolé, je n'ai pas compris. Pouvez-vous reformuler ?",
    action: 'none',
    booking_data: {}
  };
}

const ctx = $('Build Tool Response').first().json;

// Merge tokens : 1er appel (depuis Parse Tool Call) + 2e appel (depuis cette réponse)
const call1Prompt = ctx.gemini_call1_prompt_tokens || 0;
const call1Completion = ctx.gemini_call1_completion_tokens || 0;
const call2Prompt = usageMetadata.promptTokenCount || 0;
const call2Completion = usageMetadata.candidatesTokenCount || 0;

return [{
  json: {
    ...ctx,
    response_text: parsed.response_text,
    action: parsed.action || 'none',
    booking_data: parsed.booking_data || {},
    // Tokens mergés 1er + 2e appel
    llm_provider: 'gemini',
    llm_model: 'gemini-2.5-flash-lite',
    llm_prompt_tokens: call1Prompt + call2Prompt,
    llm_completion_tokens: call1Completion + call2Completion,
    llm_total_tokens: call1Prompt + call1Completion + call2Prompt + call2Completion,
    llm_is_fallback: false,
    llm_error: null
  }
}];
