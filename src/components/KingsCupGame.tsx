import { useEffect, useState, type FormEvent } from "react";
import cardData from "../data/kings-cup.json";

type Rank = "A" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "J" | "Q" | "K";
type PlayingCard = {
  id: string;
  rank: Rank;
  suit: string;
  color: "red" | "black";
};
type Stage = "setup" | "ready" | "card" | "summary";
type Rule = { title: string; description: string };

const ranks = cardData.ranks as Rank[];
const suits = cardData.suits as { symbol: string; color: "red" | "black" }[];
const defaultRules = cardData.rules as Record<Rank, Rule>;
const rulesStorageKey = "la-ultima-ronda.kings-cup-rules";

function isRuleSet(value: unknown): value is Record<Rank, Rule> {
  if (typeof value !== "object" || value === null) return false;
  return ranks.every((rank) => {
    const rule = (value as Record<string, unknown>)[rank];
    if (typeof rule !== "object" || rule === null) return false;
    const candidate = rule as Record<string, unknown>;
    return (
      typeof candidate.title === "string" &&
      typeof candidate.description === "string"
    );
  });
}

function shuffle<T>(items: readonly T[]): T[] {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [
      shuffled[swapIndex],
      shuffled[index],
    ];
  }
  return shuffled;
}

function createDeck(): PlayingCard[] {
  return shuffle(
    suits.flatMap(({ symbol, color }) =>
      ranks.map((rank) => ({
        id: `${rank}-${symbol}`,
        rank,
        suit: symbol,
        color,
      })),
    ),
  );
}

export default function KingsCupGame({
  onBack,
  onManagePlayers,
  players,
}: {
  onBack: () => void;
  onManagePlayers: () => void;
  players: string[];
}) {
  const [stage, setStage] = useState<Stage>("setup");
  const [deck, setDeck] = useState<PlayingCard[]>([]);
  const [drawIndex, setDrawIndex] = useState(0);
  const [playerOrder, setPlayerOrder] = useState<string[]>([]);
  const [kingCount, setKingCount] = useState(0);
  const [rules, setRules] = useState<Record<Rank, Rule>>(defaultRules);
  const [draftRules, setDraftRules] = useState<Record<Rank, Rule>>(defaultRules);
  const [rulesError, setRulesError] = useState("");
  const [rulesSaved, setRulesSaved] = useState(false);

  useEffect(() => {
    try {
      const savedRules = localStorage.getItem(rulesStorageKey);
      if (!savedRules) return;

      const parsedRules: unknown = JSON.parse(savedRules);
      if (!isRuleSet(parsedRules)) {
        throw new Error("El formato guardado no es válido.");
      }

      setRules(parsedRules);
      setDraftRules(parsedRules);
    } catch (error) {
      setRulesError(
        error instanceof Error
          ? `No se pudieron cargar las reglas guardadas: ${error.message}`
          : "No se pudieron cargar las reglas guardadas.",
      );
    }
  }, []);

  const currentCard = deck[drawIndex - 1];
  const currentPlayer =
    playerOrder.length > 0
      ? playerOrder[(drawIndex - 1) % playerOrder.length]
      : undefined;
  const currentRule = currentCard ? rules[currentCard.rank] : undefined;

  function saveRules(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      localStorage.setItem(rulesStorageKey, JSON.stringify(draftRules));
      setRules(draftRules);
      setRulesError("");
      setRulesSaved(true);
    } catch (error) {
      setRulesSaved(false);
      setRulesError(
        error instanceof Error
          ? `No se pudieron guardar las reglas: ${error.message}`
          : "No se pudieron guardar las reglas.",
      );
    }
  }

  function restoreDefaultRules() {
    try {
      localStorage.setItem(rulesStorageKey, JSON.stringify(defaultRules));
      setRules(defaultRules);
      setDraftRules(defaultRules);
      setRulesError("");
      setRulesSaved(true);
    } catch (error) {
      setRulesSaved(false);
      setRulesError(
        error instanceof Error
          ? `No se pudieron restaurar las reglas: ${error.message}`
          : "No se pudieron restaurar las reglas.",
      );
    }
  }

  function updateDraftRule(rank: Rank, field: keyof Rule, value: string) {
    setDraftRules((current) => ({
      ...current,
      [rank]: { ...current[rank], [field]: value },
    }));
    setRulesSaved(false);
  }

  function startGame() {
    setDeck(createDeck());
    setPlayerOrder(shuffle(players));
    setDrawIndex(0);
    setKingCount(0);
    setStage("ready");
  }

  function drawCard() {
    if (drawIndex >= deck.length) {
      setStage("summary");
      return;
    }

    const nextCard = deck[drawIndex];
    if (!nextCard) return;
    setDrawIndex((index) => index + 1);
    if (nextCard.rank === "K") {
      setKingCount((count) => count + 1);
    }
    setStage("card");
  }

  function continueTurn() {
    if (kingCount >= 4 || drawIndex >= deck.length) {
      setStage("summary");
      return;
    }
    setStage("ready");
  }

  function finishGame() {
    setStage("summary");
  }

  return (
    <main className="min-h-screen bg-cream px-5 pb-10 pt-5 sm:px-8 sm:pt-8">
      <div className="mx-auto max-w-3xl">
        <header className="mb-7 flex items-center justify-between gap-3">
          <button
            className="rounded-full border-2 border-ink bg-white px-4 py-3 font-extrabold shadow-comic-sm"
            onClick={onBack}
            type="button"
          >
            ← <span className="hidden sm:inline">Menú</span>
          </button>
          <h1 className="truncate text-right font-display text-xl font-semibold sm:text-2xl">
            King&apos;s Cup 👑
          </h1>
          <button
            aria-label={`Gestionar jugadores, ${players.length} apuntados`}
            className="shrink-0 rounded-full border-2 border-ink bg-mustard px-4 py-3 font-extrabold shadow-comic-sm"
            onClick={onManagePlayers}
            type="button"
          >
            👥 {players.length}
          </button>
        </header>

        {stage === "setup" && (
          <section aria-labelledby="kings-cup-title">
            <div className="mb-5 text-center">
              <p className="text-sm font-extrabold uppercase tracking-widest text-ink/55">
                Baraja virtual · reglas de grupo
              </p>
              <h2
                className="mt-1 font-display text-4xl font-semibold"
                id="kings-cup-title"
              >
                La corona está en juego
              </h2>
            </div>
            <div className="rounded-3xl border-2 border-ink bg-white p-5 shadow-comic sm:p-8">
              <details className="rounded-2xl border-2 border-ink bg-cream p-4">
                <summary className="cursor-pointer font-display text-xl font-semibold">
                  📖 Cómo se juega
                </summary>
                <ol className="mt-2 list-inside list-decimal space-y-1 text-sm font-semibold text-ink/75">
                  <li>
                    La app mezcla una baraja estándar y asigna los turnos al
                    grupo.
                  </li>
                  <li>
                    En cada turno, una persona roba una carta y el grupo sigue
                    la regla de su valor.
                  </li>
                  <li>
                    Cada Rey permite proponer una regla colectiva. Al cuarto
                    Rey, acuerden un reto final y termina la partida.
                  </li>
                </ol>
              </details>
              <details className="mt-4 rounded-2xl border-2 border-ink bg-cream p-4">
                <summary className="cursor-pointer font-display text-xl font-semibold">
                  ⚙️ Personalizar las reglas
                </summary>
                <p className="mt-2 text-sm font-semibold text-ink/70">
                  Edita el título y la descripción de cada carta. Se guardan en
                  este dispositivo y se aplican también a las partidas nuevas.
                </p>
                <form className="mt-4 space-y-3" onSubmit={saveRules}>
                  {ranks.map((rank) => (
                    <fieldset
                      className="rounded-2xl border-2 border-ink bg-white p-3"
                      key={rank}
                    >
                      <legend className="px-2 font-display text-lg font-semibold">
                        Carta {rank}
                      </legend>
                      <label className="block text-sm font-bold">
                        Título
                        <input
                          className="mt-1 w-full rounded-xl border-2 border-ink px-3 py-2 font-semibold"
                          onChange={(event) =>
                            updateDraftRule(rank, "title", event.target.value)
                          }
                          value={draftRules[rank].title}
                        />
                      </label>
                      <label className="mt-3 block text-sm font-bold">
                        Descripción
                        <textarea
                          className="mt-1 min-h-20 w-full rounded-xl border-2 border-ink px-3 py-2 font-semibold"
                          onChange={(event) =>
                            updateDraftRule(
                              rank,
                              "description",
                              event.target.value,
                            )
                          }
                          value={draftRules[rank].description}
                        />
                      </label>
                    </fieldset>
                  ))}
                  <button
                    className="w-full rounded-full border-2 border-ink bg-mint px-5 py-3 font-extrabold shadow-comic-sm"
                    type="submit"
                  >
                    Guardar reglas 💾
                  </button>
                </form>
                <button
                  className="mt-3 w-full rounded-full border-2 border-ink bg-mustard px-5 py-3 font-extrabold shadow-comic-sm"
                  onClick={restoreDefaultRules}
                  type="button"
                >
                  Restaurar reglas originales
                </button>
                {rulesSaved && (
                  <p className="mt-3 text-center text-sm font-bold text-ink">
                    Reglas guardadas en este dispositivo.
                  </p>
                )}
                {rulesError && (
                  <p className="mt-3 rounded-xl border-2 border-ink bg-coral p-3 text-sm font-bold">
                    {rulesError}
                  </p>
                )}
              </details>
              <p className="mt-5 rounded-2xl border-2 border-ink bg-sky p-4 text-sm font-semibold">
                Beber no es obligatorio y no hay penalizaciones por negarse.
                Todas las reglas se pueden hacer con bebidas sin alcohol o
                cambiar por una alternativa que le venga bien al grupo.
              </p>
              <p className="mt-3 text-center text-sm font-bold text-ink/65">
                {players.length} jugadores · 52 cartas · partida termina con el
                cuarto Rey
              </p>
              <button
                className="mt-6 w-full rounded-full border-2 border-ink bg-mustard px-6 py-4 font-display text-2xl font-semibold shadow-comic"
                disabled={players.length < 3}
                onClick={startGame}
                type="button"
              >
                ¡Empezar partida! 👑
              </button>
              {players.length < 3 && (
                <p className="mt-3 text-center font-bold text-coral">
                  Añade al menos 3 jugadores para empezar.
                </p>
              )}
            </div>
          </section>
        )}

        {stage === "ready" && (
          <section className="rounded-3xl border-2 border-ink bg-white p-6 text-center shadow-comic sm:p-10">
            <span className="text-6xl">🃏</span>
            <p className="mt-3 text-sm font-extrabold uppercase tracking-widest text-ink/55">
              Turno {drawIndex + 1} de {deck.length}
            </p>
            <h2 className="mt-1 break-words font-display text-3xl font-semibold sm:text-4xl">
              {playerOrder[drawIndex % playerOrder.length]}, roba una carta
            </h2>
            <p className="mt-3 font-semibold text-ink/65">
              Robos: {drawIndex} · Reyes: {kingCount} / 4
            </p>
            <button
              className="mt-6 w-full rounded-full border-2 border-ink bg-bubblegum px-6 py-4 font-display text-2xl font-semibold shadow-comic"
              onClick={drawCard}
              type="button"
            >
              Robar carta 🎴
            </button>
            <button
              className="mt-3 rounded-full px-5 py-3 font-bold underline decoration-2 underline-offset-2"
              onClick={finishGame}
              type="button"
            >
              Terminar partida
            </button>
          </section>
        )}

        {stage === "card" && currentCard && currentRule && (
          <section aria-live="polite">
            <div className="mb-4 flex items-center justify-between gap-3">
              <span className="rounded-full border-2 border-ink bg-mustard px-4 py-2 text-sm font-extrabold shadow-comic-sm">
                {currentPlayer} · Carta {drawIndex} de {deck.length}
              </span>
              <span className="rounded-full border-2 border-ink bg-white px-4 py-2 text-sm font-extrabold shadow-comic-sm">
                Reyes {kingCount} / 4
              </span>
            </div>
            <article
              className={`flex min-h-[22rem] flex-col items-center justify-between rounded-3xl border-2 border-ink p-6 text-center shadow-comic sm:min-h-[25rem] sm:p-10 ${
                currentCard.color === "red" ? "bg-bubblegum" : "bg-white"
              }`}
            >
              <div
                aria-label={`${currentCard.rank} de ${currentCard.suit}`}
                className={`text-left font-display text-6xl font-bold ${
                  currentCard.color === "red" ? "text-rose-700" : "text-ink"
                }`}
              >
                {currentCard.rank}
                <span className="ml-2">{currentCard.suit}</span>
              </div>
              <div>
                <h2 className="font-display text-3xl font-semibold sm:text-4xl">
                  {currentRule.title}
                </h2>
                <p className="mt-4 font-semibold leading-relaxed text-ink/75 sm:text-lg">
                  {currentRule.description}
                </p>
              </div>
              {currentCard.rank === "K" && kingCount === 4 ? (
                <span className="rounded-full border-2 border-ink bg-mustard px-4 py-2 text-sm font-extrabold">
                  ¡Cuarto Rey! Reto final del grupo
                </span>
              ) : (
                <span className="text-sm font-extrabold uppercase tracking-widest text-ink/55">
                  Si alguien prefiere pasar, no pasa nada.
                </span>
              )}
            </article>
            <button
              className="mt-5 w-full rounded-full border-2 border-ink bg-mint px-6 py-4 font-display text-xl font-semibold shadow-comic-sm"
              onClick={continueTurn}
              type="button"
            >
              {kingCount >= 4 || drawIndex >= deck.length
                ? "Terminar partida 🎉"
                : "Siguiente turno 👉"}
            </button>
          </section>
        )}

        {stage === "summary" && (
          <section className="rounded-3xl border-2 border-ink bg-white p-6 text-center shadow-comic sm:p-10">
            <span className="text-7xl">👑</span>
            <p className="mt-3 text-sm font-extrabold uppercase tracking-widest text-ink/55">
              Partida terminada
            </p>
            <h2 className="mt-1 font-display text-4xl font-semibold">
              {kingCount === 4 ? "¡El cuarto Rey cayó!" : "¡Partida cerrada!"}
            </h2>
            <p className="mt-3 font-semibold text-ink/65">
              Robasteis {drawIndex} {drawIndex === 1 ? "carta" : "cartas"} y
              salieron {kingCount} {kingCount === 1 ? "Rey" : "Reyes"}. El grupo
              puede elegir un reto final o dar la partida por cerrada.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <button
                className="flex-1 rounded-full border-2 border-ink bg-mustard px-5 py-4 font-extrabold shadow-comic-sm"
                onClick={startGame}
                type="button"
              >
                Otra partida
              </button>
              <button
                className="flex-1 rounded-full border-2 border-ink bg-mint px-5 py-4 font-extrabold shadow-comic-sm"
                onClick={onBack}
                type="button"
              >
                Volver al menú
              </button>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
