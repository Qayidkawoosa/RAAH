const MODEL = process.env.GEMINI_MODEL || 'gemini-flash-latest';

// The free tier allows very few requests per minute, so responses are cached
// and a rate-limit puts Gemini on a short cooldown (callers fall back to
// heuristics meanwhile — the app never breaks or spams the quota).
const cache = new Map();
let rateLimitedUntil = 0;

const getCached = (key) => {
  const hit = key && cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value;
  if (hit) cache.delete(key);
  return null;
};

/**
 * Calls Gemini and parses a JSON object out of the response. Returns null on
 * any failure so callers fall back to deterministic heuristics.
 */
export async function askGeminiJson(instruction, payload, cacheKey = null, ttlMs = 600000) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const cached = getCached(cacheKey);
  if (cached) return cached;
  if (Date.now() < rateLimitedUntil) return null;

  const prompt = `${instruction}\n\nRespond with ONLY a valid JSON object, no markdown fences.\n\nDATA:\n${JSON.stringify(payload).slice(0, 12000)}`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.4, responseMimeType: 'application/json' },
        }),
      }
    );
    if (response.status === 429) {
      rateLimitedUntil = Date.now() + 30000;
      console.warn('Gemini free-tier rate limit hit — serving fallbacks for 30s.');
      return null;
    }
    if (!response.ok) {
      console.warn(`Gemini API error ${response.status} — serving fallback.`);
      return null;
    }
    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;
    const parsed = JSON.parse(text.replace(/^```json\s*|```\s*$/g, ''));
    if (cacheKey) cache.set(cacheKey, { value: parsed, expires: Date.now() + ttlMs });
    return parsed;
  } catch (error) {
    console.warn('Gemini call failed:', error.message);
    return null;
  }
}
