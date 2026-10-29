/**
 * @typedef {"prefer" | "likely"} QuestionMode
 * @typedef {{ mode: QuestionMode, category: string, intensity: string }} GenerateQuestionsOptions
 */

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/+$/, "");

/**
 * Requests five card prompts from the backend proxy.
 * The Gemini API key is intentionally never sent by the client.
 * @param {GenerateQuestionsOptions} options
 * @returns {Promise<string[]>}
 */
export async function generateQuestions({ mode, category, intensity }) {
  if (!navigator.onLine) {
    throw new Error("Sin conexión: seguimos con las cartas guardadas en el mazo.");
  }

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 25_000);
  let response;
  try {
    response = await fetch(`${API_BASE_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode, category, intensity }),
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("La IA tardó demasiado. El mazo local sigue disponible.");
    }
    throw new Error(
      "No se pudo conectar con el servicio de IA. Seguimos con las cartas locales.",
    );
  } finally {
    window.clearTimeout(timeoutId);
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      typeof payload?.error === "string"
        ? payload.error
        : "No se pudieron generar preguntas. El mazo local sigue disponible.";
    throw new Error(message);
  }
  if (
    !Array.isArray(payload?.questions) ||
    payload.questions.length !== 5 ||
    !payload.questions.every(
      (question) => typeof question === "string" && question.trim().length > 0,
    ) ||
    (mode === "likely" &&
      !payload.questions.every((question) => question.includes("{player}")))
  ) {
    throw new Error(
      "El servicio de IA devolvió una respuesta no válida. El mazo local sigue disponible.",
    );
  }

  return payload.questions.map((question) => question.trim());
}
