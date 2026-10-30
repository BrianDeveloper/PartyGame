import { useState } from "react";
import prompts from "../data/telephone-game.json";
import CustomContentForm from "./CustomContentForm";
import { useCustomGameContent } from "../state/CustomGameContentContext";

type Stage = "setup" | "prompt" | "relay" | "reveal" | "summary";

function shuffle<T>(items: readonly T[]): T[] {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [
      shuffled[swapIndex]!,
      shuffled[index]!,
    ];
  }
  return shuffled;
}

function shuffleWithoutImmediateRepeat(items: readonly string[], previous: string) {
  const shuffled = shuffle(items);
  if (shuffled.length > 1 && shuffled[0] === previous) {
    const differentIndex = shuffled.findIndex((item) => item !== previous);
    if (differentIndex > 0) {
      [shuffled[0], shuffled[differentIndex]] = [
        shuffled[differentIndex]!,
        shuffled[0]!,
      ];
    }
  }
  return shuffled;
}

export default function TelephoneGame({
  onBack,
  onManagePlayers,
  players,
}: {
  onBack: () => void;
  onManagePlayers: () => void;
  players: string[];
}) {
  const [stage, setStage] = useState<Stage>("setup");
  const [deck, setDeck] = useState<string[]>([]);
  const [roundIndex, setRoundIndex] = useState(0);
  const [roundNumber, setRoundNumber] = useState(1);
  const [completedRounds, setCompletedRounds] = useState(0);
  const { entries: customContent } = useCustomGameContent();
  const customPrompts = customContent
    .filter((entry) => entry.game === "telephone")
    .map((entry) => entry.prompt);
  const promptBank = [...prompts, ...customPrompts];

  const originalMessage = deck[roundIndex];
  const startingPlayer = players[(roundNumber - 1) % players.length];

  function startGame() {
    setDeck(shuffle(promptBank));
    setRoundIndex(0);
    setRoundNumber(1);
    setCompletedRounds(0);
    setStage("prompt");
  }

  function revealOriginal() {
    setStage("reveal");
  }

  function startNextRound() {
    setCompletedRounds((count) => count + 1);
    setRoundNumber((count) => count + 1);
    if (roundIndex + 1 >= deck.length) {
      setDeck(
        shuffleWithoutImmediateRepeat(promptBank, originalMessage ?? ""),
      );
      setRoundIndex(0);
    } else {
      setRoundIndex((index) => index + 1);
    }
    setStage("prompt");
  }

  function finishGame() {
    setCompletedRounds((count) =>
      stage === "reveal" ? count + 1 : count,
    );
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
            Teléfono descompuesto 📞
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
          <section aria-labelledby="telephone-title">
            <div className="mb-5 text-center">
              <p className="text-sm font-extrabold uppercase tracking-widest text-ink/55">
                La app pone la frase; la pandilla hace el resto
              </p>
              <h2
                className="mt-1 font-display text-4xl font-semibold"
                id="telephone-title"
              >
                ¿En qué acaba esto?
              </h2>
            </div>
            <div className="rounded-3xl border-2 border-ink bg-white p-5 shadow-comic sm:p-8">
              <details className="rounded-2xl border-2 border-ink bg-cream p-4">
                <summary className="cursor-pointer font-display text-xl font-semibold">
                  📖 Cómo se juega
                </summary>
                <ol className="mt-2 list-inside list-decimal space-y-1 text-sm font-semibold text-ink/75">
                  <li>
                    Quien empieza lee la frase en secreto y luego la pasa de
                    boca en boca, como en el juego tradicional.
                  </li>
                  <li>
                    Cuando la frase complete la vuelta, volved a la app para
                    revelar la original y comparar.
                  </li>
                </ol>
              </details>

              <CustomContentForm game="telephone" />
              <p className="mt-5 rounded-2xl border-2 border-ink bg-sky p-4 text-sm font-semibold">
                {players.length > 0
                  ? `Empieza ${players[0]}; el inicio rota entre jugadores en cada ronda. No hay límite de rondas.`
                  : "Reúne al menos a tres jugadores para empezar."}{" "}
                La app no guarda respuestas ni controla la cadena.
              </p>
              <button
                className="mt-6 w-full rounded-full border-2 border-ink bg-mint px-6 py-4 font-display text-2xl font-semibold shadow-comic disabled:cursor-not-allowed disabled:opacity-45"
                disabled={players.length < 3}
                onClick={startGame}
                type="button"
              >
                ¡Empezar el teléfono! 📞
              </button>
            </div>
          </section>
        )}

        {stage === "prompt" && originalMessage && (
          <>
          <section
            aria-labelledby="prompt-title"
            className="rounded-3xl border-2 border-ink bg-white p-6 text-center shadow-comic sm:p-10"
          >
            <p className="text-sm font-extrabold uppercase tracking-widest text-ink/55">
              Ronda {roundNumber}
            </p>
            <span aria-hidden="true" className="mt-4 block text-6xl">
              🤫
            </span>
            <h2
              className="mt-3 font-display text-2xl font-semibold"
              id="prompt-title"
            >
              {startingPlayer}, lee la frase en secreto
            </h2>
            <p className="mt-5 rounded-2xl border-2 border-ink bg-mustard p-5 text-xl font-extrabold">
              {originalMessage}
            </p>
            <p className="mt-4 text-sm font-semibold text-ink/60">
              Memorízala. No la leas en voz alta ni enseñes la pantalla.
            </p>
            <button
              className="mt-6 w-full rounded-full border-2 border-ink bg-bubblegum px-6 py-4 font-extrabold shadow-comic-sm"
              onClick={() => setStage("relay")}
              type="button"
            >
              Ya la memoricé. Empezar la cadena 🤐
            </button>
          </section>
          <button
            className="mt-3 w-full rounded-full border-2 border-ink bg-white px-6 py-3 font-extrabold shadow-comic-sm"
            onClick={finishGame}
            type="button"
          >
            Terminar partida
          </button>
          </>
        )}

        {stage === "relay" && (
          <>
          <section
            aria-labelledby="relay-title"
            className="rounded-3xl border-2 border-ink bg-white p-6 text-center shadow-comic sm:p-10"
          >
            <span aria-hidden="true" className="text-6xl">
              📞
            </span>
            <p className="mt-3 text-sm font-extrabold uppercase tracking-widest text-ink/55">
              Ronda {roundNumber}
            </p>
            <h2
              className="mt-2 font-display text-3xl font-semibold"
              id="relay-title"
            >
              ¡Que empiece el teléfono!
            </h2>
            <p className="mt-3 font-semibold text-ink/65">
              Pasad la frase de persona en persona, en voz baja. Cuando complete
              la vuelta, revelad la original.
            </p>
            <button
              className="mt-6 w-full rounded-full border-2 border-ink bg-sky px-6 py-4 font-extrabold shadow-comic-sm"
              onClick={revealOriginal}
              type="button"
            >
              La frase volvió. Revelar original 👀
            </button>
          </section>
          <button
            className="mt-3 w-full rounded-full border-2 border-ink bg-white px-6 py-3 font-extrabold shadow-comic-sm"
            onClick={finishGame}
            type="button"
          >
            Terminar partida
          </button>
          </>
        )}

        {stage === "reveal" && originalMessage && (
          <section
            aria-labelledby="reveal-title"
            aria-live="polite"
            className="rounded-3xl border-2 border-ink bg-white p-6 text-center shadow-comic sm:p-10"
          >
            <p className="text-sm font-extrabold uppercase tracking-widest text-ink/55">
              Ronda {roundNumber} · empezó {startingPlayer}
            </p>
            <span aria-hidden="true" className="mt-4 block text-6xl">
              📣
            </span>
            <h2
              className="mt-3 font-display text-3xl font-semibold"
              id="reveal-title"
            >
              La frase original era…
            </h2>
            <p className="mt-5 rounded-2xl border-2 border-ink bg-mustard p-5 text-xl font-extrabold">
              {originalMessage}
            </p>
            <p className="mt-4 font-semibold text-ink/65">
              Comparadla con la frase que llegó al final. ¿Cuánto sobrevivió?
            </p>
            <button
              className="mt-6 w-full rounded-full border-2 border-ink bg-mint px-6 py-4 font-extrabold shadow-comic-sm"
              onClick={startNextRound}
              type="button"
            >
              Siguiente ronda 👉
            </button>
            <button
              className="mt-3 w-full rounded-full border-2 border-ink bg-white px-6 py-3 font-extrabold shadow-comic-sm"
              onClick={finishGame}
              type="button"
            >
              Terminar partida 🎉
            </button>
          </section>
        )}

        {stage === "summary" && (
          <section className="rounded-3xl border-2 border-ink bg-white p-6 text-center shadow-comic sm:p-10">
            <span aria-hidden="true" className="text-7xl">
              🤣
            </span>
            <p className="mt-3 text-sm font-extrabold uppercase tracking-widest text-ink/55">
              Teléfono terminado
            </p>
            <h2 className="mt-1 font-display text-4xl font-semibold">
              {completedRounds}{" "}
              {completedRounds === 1 ? "ronda" : "rondas"} completadas…
            </h2>
            <p className="mt-3 font-semibold text-ink/65">
              No hay puntos: el plan era descubrir cuánto se deforma una frase
              al pasarla de boca en boca.
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
