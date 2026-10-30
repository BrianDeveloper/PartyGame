import { useState } from "react";
import promptsByIntensity from "../data/never-have-i-ever.json";
import CustomContentForm from "./CustomContentForm";
import { useCustomGameContent } from "../state/CustomGameContentContext";

type Intensity = keyof typeof promptsByIntensity;
type IntensityFilter = Intensity | "todas";
type Stage = "setup" | "playing" | "summary";
type FinishReason = "manual" | "fingers";

const intensities: { id: Intensity; label: string; emoji: string; color: string }[] = [
  { id: "suave", label: "Suave", emoji: "🌱", color: "bg-mint" },
  { id: "intenso", label: "Intenso", emoji: "🔥", color: "bg-bubblegum" },
  { id: "salvaje", label: "Salvaje", emoji: "😈", color: "bg-coral" },
];
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

function getPromptPool(
  intensity: IntensityFilter,
  customPrompts: { prompt: string; intensity?: Intensity }[],
) {
  const defaultPrompts =
    intensity === "todas"
    ? Object.values(promptsByIntensity).flat()
    : promptsByIntensity[intensity];
  return [
    ...defaultPrompts,
    ...customPrompts
      .filter(
        (entry) =>
          intensity === "todas" || entry.intensity === intensity,
      )
      .map((entry) => entry.prompt),
  ];
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

export default function NeverHaveIEverGame({
  onBack,
  onManagePlayers,
  playerCount,
}: {
  onBack: () => void;
  onManagePlayers: () => void;
  playerCount: number;
}) {
  const [stage, setStage] = useState<Stage>("setup");
  const [intensity, setIntensity] = useState<IntensityFilter>("suave");
  const [deck, setDeck] = useState<string[]>([]);
  const [cardIndex, setCardIndex] = useState(0);
  const [playedCount, setPlayedCount] = useState(0);
  const [finishReason, setFinishReason] = useState<FinishReason>("manual");
  const { entries: customContent } = useCustomGameContent();
  const customPrompts = customContent.filter(
    (entry): entry is Extract<typeof entry, { game: "never" }> =>
      entry.game === "never",
  );

  const currentPrompt = deck[cardIndex];
  const roundNumber = playedCount;

  function startGame() {
    setDeck(shuffle(getPromptPool(intensity, customPrompts)));
    setCardIndex(0);
    setPlayedCount(1);
    setStage("playing");
  }

  function finishGame(reason: FinishReason) {
    setFinishReason(reason);
    setStage("summary");
  }

  function nextPrompt() {
    if (cardIndex + 1 >= deck.length) {
      setDeck(
        shuffleWithoutImmediateRepeat(
          getPromptPool(intensity, customPrompts),
          currentPrompt ?? "",
        ),
      );
      setCardIndex(0);
    } else {
      setCardIndex((current) => current + 1);
    }
    setPlayedCount((count) => count + 1);
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
            Yo nunca nunca 🙈
          </h1>
          <button
            aria-label={`Gestionar jugadores, ${playerCount} apuntados`}
            className="shrink-0 rounded-full border-2 border-ink bg-mustard px-4 py-3 font-extrabold shadow-comic-sm"
            onClick={onManagePlayers}
            type="button"
          >
            👥 {playerCount}
          </button>
        </header>

        {stage === "setup" && (
          <section aria-labelledby="never-title">
            <div className="mb-5 text-center">
              <p className="text-sm font-extrabold uppercase tracking-widest text-ink/55">
                Cinco dedos arriba · cero obligación de confesar
              </p>
              <h2
                className="mt-1 font-display text-4xl font-semibold"
                id="never-title"
              >
                ¿Quién cae primero?
              </h2>
            </div>
            <div className="rounded-3xl border-2 border-ink bg-white p-5 shadow-comic sm:p-8">
              <details className="rounded-2xl border-2 border-ink bg-cream p-4">
                <summary className="cursor-pointer font-display text-xl font-semibold">
                  📖 Cómo se juega
                </summary>
                <ol className="mt-2 list-inside list-decimal space-y-1 text-sm font-semibold text-ink/75">
                  <li>Todo el mundo empieza con cinco dedos levantados.</li>
                  <li>
                    Quien haya hecho lo que dice la frase baja un dedo. No hace
                    falta contar la historia.
                  </li>
                  <li>
                    Jugad hasta que alguien se quede sin dedos o decidáis
                    terminar la partida. El mazo se vuelve a mezclar si se
                    agotan las frases.
                  </li>
                  <li>
                    Al final, gana quien conserve más dedos. Si hay empate,
                    compartís la gloria.
                  </li>
                </ol>
              </details>

              <fieldset className="mt-5">
                <legend className="mb-2 text-sm font-extrabold uppercase tracking-wide text-ink/60">
                  Intensidad
                </legend>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <button
                    aria-pressed={intensity === "todas"}
                    className={`rounded-xl border-2 border-ink px-2 py-3 text-sm font-extrabold shadow-comic-sm sm:text-base ${
                      intensity === "todas" ? "bg-mustard" : "bg-white"
                    }`}
                    onClick={() => setIntensity("todas")}
                    type="button"
                  >
                    🎲 Todas
                  </button>
                  {intensities.map((option) => (
                    <button
                      aria-pressed={intensity === option.id}
                      className={`rounded-xl border-2 border-ink px-2 py-3 text-sm font-extrabold shadow-comic-sm sm:text-base ${
                        intensity === option.id ? option.color : "bg-white"
                      }`}
                      key={option.id}
                      onClick={() => setIntensity(option.id)}
                      type="button"
                    >
                      {option.emoji} {option.label}
                    </button>
                  ))}
                </div>
              </fieldset>

              <CustomContentForm game="never" />
              <p className="mt-5 rounded-2xl border-2 border-ink bg-sky p-4 text-sm font-semibold">
                Sin puntos por beber ni castigos: cada quien decide si quiere
                compartir una anécdota y puede pasar sin dar explicaciones.
              </p>
              <button
                className="mt-6 w-full rounded-full border-2 border-ink bg-bubblegum px-6 py-4 font-display text-2xl font-semibold shadow-comic"
                onClick={startGame}
                type="button"
              >
                ¡Empezar! 🙈
              </button>
            </div>
          </section>
        )}

        {stage === "playing" && currentPrompt && (
          <section aria-labelledby="prompt-title" aria-live="polite">
            <div className="mb-4 flex items-center justify-between gap-3">
              <span className="rounded-full border-2 border-ink bg-mustard px-4 py-2 text-sm font-extrabold shadow-comic-sm">
                Frase {roundNumber}
              </span>
              <span
                className={`rounded-full border-2 border-ink px-4 py-2 text-sm font-extrabold shadow-comic-sm ${
                  intensities.find((option) => option.id === intensity)?.color ??
                  "bg-mustard"
                }`}
              >
                {intensity === "todas"
                  ? "Todas"
                  : intensities.find((option) => option.id === intensity)?.label}
              </span>
            </div>
            <article className="flex min-h-[22rem] flex-col justify-between rounded-3xl border-2 border-ink bg-white p-6 text-center shadow-comic sm:min-h-[25rem] sm:p-10">
              <span aria-hidden="true" className="text-6xl">
                🙈
              </span>
              <h2
                className="font-display text-3xl font-semibold leading-snug sm:text-4xl"
                id="prompt-title"
              >
                {currentPrompt}
              </h2>
              <p className="font-bold text-ink/60">
                Si te ha pasado, baja un dedo ☝️
              </p>
            </article>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <button
                className="rounded-full border-2 border-ink bg-white px-5 py-4 font-extrabold shadow-comic-sm"
                onClick={() => finishGame("fingers")}
                type="button"
              >
                Alguien se quedó sin dedos
              </button>
              <button
                className="rounded-full border-2 border-ink bg-mint px-5 py-4 font-extrabold shadow-comic-sm"
                onClick={nextPrompt}
                type="button"
              >
                Siguiente frase 👉
              </button>
              <button
                className="rounded-full border-2 border-ink bg-mustard px-5 py-4 font-extrabold shadow-comic-sm sm:col-span-2"
                onClick={() => finishGame("manual")}
                type="button"
              >
                Terminar y contar dedos 🎉
              </button>
            </div>
          </section>
        )}

        {stage === "summary" && (
          <section className="rounded-3xl border-2 border-ink bg-white p-6 text-center shadow-comic sm:p-10">
            <span className="text-7xl">🎉</span>
            <p className="mt-3 text-sm font-extrabold uppercase tracking-widest text-ink/55">
              Partida terminada
            </p>
            <h2 className="mt-1 font-display text-4xl font-semibold">
              {finishReason === "fingers"
                ? "¡Alguien se quedó sin dedos!"
                : "¡Partida terminada!"}
            </h2>
            <p className="mt-3 font-semibold text-ink/65">
              Jugasteis {roundNumber} {roundNumber === 1 ? "frase" : "frases"}.
              Contad los dedos que quedan: quien conserve más gana. Los empates
              se comparten.
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
