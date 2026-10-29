import { createServer } from "node:http";

const port = Number(process.env.PORT ?? 8787);
const apiKey = process.env.GEMINI_API_KEY;
const allowedOrigins = new Set(
  (process.env.APP_ORIGIN ?? "http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
);
let requestTimestamps = [];
const requestWindowMs = 60_000;
const requestLimit = 60;
const maxBodyBytes = 2_048;
const categoryIds = new Set([
  "chill",
  "picante",
  "escatologico",
  "turbio",
]);
const intensityIds = new Set(["suave", "intenso", "salvaje"]);
const modeIds = new Set(["prefer", "likely"]);

function sendJson(response, status, payload) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(payload));
}

function isRateLimited() {
  const now = Date.now();
  requestTimestamps = requestTimestamps.filter(
    (timestamp) => now - timestamp < requestWindowMs,
  );
  if (requestTimestamps.length >= requestLimit) return true;
  requestTimestamps.push(now);
  return false;
}

async function readJsonBody(request) {
  let body = "";
  for await (const chunk of request) {
    body += chunk;
    if (Buffer.byteLength(body) > maxBodyBytes) {
      throw new Error("El cuerpo de la solicitud es demasiado grande.");
    }
  }
  try {
    return JSON.parse(body);
  } catch {
    throw new Error("El cuerpo de la solicitud no es JSON válido.");
  }
}

function buildPrompt(mode, category, intensity) {
  const modeName =
    mode === "likely" ? "Quién es más probable" : "Qué prefieres";
  const categoryNames = {
    chill: "Chill",
    picante: "Picante",
    escatologico: "Escatológico",
    turbio: "Turbio",
  };
  const intensityNames = {
    suave: "Suave",
    intenso: "Intenso",
    salvaje: "Salvaje",
  };
  const modeInstruction =
    mode === "likely"
      ? 'Escribe afirmaciones tipo "¿Quién es más probable que {player} ...?". Conserva literalmente el marcador {player}.'
      : 'Escribe preguntas tipo "¿Qué prefieres: ... o ...?".';
  return [
    "Genera exactamente 5 preguntas originales, breves y aptas para un juego de fiesta entre adultos.",
    `Modo: ${modeName}.`,
    `Categoría: ${categoryNames[category]}.`,
    `Intensidad: ${intensityNames[intensity]}.`,
    modeInstruction,
    'Responde solo con JSON válido y con esta forma exacta: {"questions":["pregunta 1","pregunta 2","pregunta 3","pregunta 4","pregunta 5"]}.',
  ].join("\n");
}

async function generateQuestions({ mode, category, intensity }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: buildPrompt(mode, category, intensity) }] }],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
              type: "OBJECT",
              properties: {
                questions: {
                  type: "ARRAY",
                  items: { type: "STRING" },
                },
              },
              required: ["questions"],
            },
          },
        }),
        signal: controller.signal,
      },
    );
    if (!response.ok) {
      console.error("Gemini request failed with status", response.status);
      throw new Error("Gemini no está disponible ahora. El mazo local sigue funcionando.");
    }

    const payload = await response.json();
    const generatedText = payload?.candidates?.[0]?.content?.parts
      ?.map((part) => part.text)
      .filter((text) => typeof text === "string")
      .join("");
    if (typeof generatedText !== "string") {
      throw new Error("Gemini devolvió una respuesta vacía.");
    }

    let parsed;
    try {
      parsed = JSON.parse(generatedText);
    } catch {
      throw new Error("Gemini devolvió preguntas en un formato no válido.");
    }
    if (
      !Array.isArray(parsed?.questions) ||
      parsed.questions.length < 5 ||
      !parsed.questions.slice(0, 5).every(
        (question) =>
          typeof question === "string" && question.trim().length > 0,
      ) ||
      (mode === "likely" &&
        !parsed.questions
          .slice(0, 5)
          .every((question) => question.includes("{player}")))
    ) {
      throw new Error("Gemini no devolvió cinco preguntas válidas.");
    }
    return parsed.questions.slice(0, 5).map((question) => question.trim());
  } finally {
    clearTimeout(timeout);
  }
}

const server = createServer(async (request, response) => {
  const origin = request.headers.origin;
  if (origin && allowedOrigins.has(origin)) {
    response.setHeader("Access-Control-Allow-Origin", origin);
    response.setHeader("Vary", "Origin");
    response.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
    response.setHeader("Access-Control-Allow-Headers", "Content-Type");
  } else if (origin) {
    sendJson(response, 403, { error: "Origen no autorizado." });
    return;
  }

  if (request.method === "OPTIONS") {
    response.writeHead(204);
    response.end();
    return;
  }

  const requestUrl = new URL(request.url ?? "/", `http://${request.headers.host}`);
  if (request.method === "GET" && requestUrl.pathname === "/api/health") {
    sendJson(response, 200, { ok: true });
    return;
  }
  if (request.method !== "POST" || requestUrl.pathname !== "/api/generate") {
    sendJson(response, 404, { error: "Ruta no encontrada." });
    return;
  }
  if (!apiKey) {
    sendJson(response, 503, {
      error: "La IA no está configurada. El mazo local sigue disponible.",
    });
    return;
  }
  if (isRateLimited()) {
    sendJson(response, 429, {
      error: "Hay demasiadas peticiones seguidas. Prueba dentro de un minuto.",
    });
    return;
  }

  try {
    const body = await readJsonBody(request);
    if (
      !body ||
      !modeIds.has(body.mode) ||
      !categoryIds.has(body.category) ||
      !intensityIds.has(body.intensity)
    ) {
      sendJson(response, 400, {
        error: "El modo, la categoría o la intensidad no son válidos.",
      });
      return;
    }

    const questions = await generateQuestions(body);
    sendJson(response, 200, { questions });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error inesperado del servidor.";
    const status = message.includes("demasiado grande")
      ? 413
      : message.includes("no es JSON")
        ? 400
        : 502;
    console.error("Question generation failed:", message);
    sendJson(response, status, {
      error: `${message} El mazo local sigue disponible.`,
    });
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Gemini proxy listening on port ${port}`);
});
