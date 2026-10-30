import { useEffect, useState } from "react";
import cards from "../data/taboo.json";

type TabooCard = {
  word: string;
  forbidden: string[];
};

type Stage = "setup" | "handoff" | "countdown" | "playing" | "turn-result" | "summary";
type TurnStats = {
  correct: number;
  passed: number;
  forbidden: number;
};

const turnDuration = 60;
const roundOptions = [1, 2, 3];
const typedCards = cards as TabooCard[];

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

function splitTeams(players: string[]) {
  return [
    players.filter((_, index) => index % 2 === 0),
    players.filter((_, index) => index % 2 === 1),
  ];
}

function formatTime(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export default function TabooGame({
  onBack,
  onManagePlayers,
  players,
}: {
  onBack: () => void;
  onManagePlayers: () => void;
  players: string[];
}) {
  const [stage, setStage] = useState<Stage>("setup");
  const [turnsPerTeam, setTurnsPerTeam] = useState(2);
  const [teams, setTeams] = useState<string[][]>([[], []]);
  const [turnIndex, setTurnIndex] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(turnDuration);
  const [countdown, setCountdown] = useState(3);
  const [currentCard, setCurrentCard] = useState<TabooCard | null>(null);
  const [remainingCards, setRemainingCards] = useState<TabooCard[]>([]);
  const [teamScores, setTeamScores] = useState([0, 0]);
  const [turnStats, setTurnStats] = useState<TurnStats>({
    correct: 0,
    passed: 0,
    forbidden: 0,
  });

  const activeTeamIndex = turnIndex % 2;
  const activeTeam = teams[activeTeamIndex] ?? [];
  const activePlayer =
    activeTeam[Math.floor(turnIndex / 2) % Math.max(activeTeam.length, 1)];
  const currentRound = Math.floor(turnIndex / 2) + 1;
  const totalTurns = turnsPerTeam * 2;

  useEffect(() => {
    if (stage !== "countdown") return;
    if (countdown <= 1) {
      setSecondsLeft(turnDuration);
      setStage("playing");
      return;
    }

    const timer = window.setTimeout(
      () => setCountdown((remaining) => remaining - 1),
      1000,
    );
    return () => window.clearTimeout(timer);
  }, [countdown, stage]);

  useEffect(() => {
    if (stage !== "playing") return;
    if (secondsLeft <= 0) {
      setStage("turn-result");
      return;
    }

    const timer = window.setTimeout(
      () => setSecondsLeft((remaining) => remaining - 1),
      1000,
    );
    return () => window.clearTimeout(timer);
  }, [secondsLeft, stage]);

  function drawNextCard(deck: TabooCard[]) {
    const nextDeck = deck.length > 0 ? deck : shuffle(typedCards);
    setCurrentCard(nextDeck[0] ?? null);
    setRemainingCards(nextDeck.slice(1));
  }

  function startGame() {
    const shuffledCards = shuffle(typedCards);
    setTeams(splitTeams(players));
    setTeamScores([0, 0]);
    setTurnStats({ correct: 0, passed: 0, forbidden: 0 });
    setTurnIndex(0);
    drawNextCard(shuffledCards);
    setStage("handoff");
  }

  function beginTurn() {
    setTurnStats({ correct: 0, passed: 0, forbidden: 0 });
    setCountdown(3);
    setStage("countdown");
  }

  function recordCardResult(result: keyof TurnStats) {
    if (stage !== "playing") return;
    setTurnStats((stats) => ({ ...stats, [result]: stats[result] + 1 }));

    if (result === "correct") {
      setTeamScores((scores) =>
        scores.map((score, index) =>
          index === activeTeamIndex ? score + 1 : score,
        ),
      );
    } else if (result === "forbidden") {
      setTeamScores((scores) =>
        scores.map((score, index) =>
          index === activeTeamIndex ? score - 1 : score,
        ),
      );
    }

    drawNextCard(remainingCards);
  }

  function continueGame() {
    if (turnIndex + 1 >= totalTurns) {
      setStage("summary");
      return;
    }

    setTurnIndex((index) => index + 1);
    setTurnStats({ correct: 0, passed: 0, forbidden: 0 });
    drawNextCard(remainingCards);
    setStage("handoff");
  }

  const winner =
    teamScores[0] === teamScores[1]
      ? null
      : (teamScores[0] ?? 0) > (teamScores[1] ?? 0)
        ? "Equipo 1"
        : "Equipo 2";

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
            Tabú 🤐
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
          <section aria-labelledby="taboo-title">
            <div className="mb-5 text-center">
              <p className="text-sm font-extrabold uppercase tracking-widest text-ink/55">
                Dos equipos · 60 segundos · palabras prohibidas
              </p>
              <h2
                className="mt-1 font-display text-4xl font-semibold"
                id="taboo-title"
              >
                Que lo adivinen sin liarla
              </h2>
            </div>
            <div className="rounded-3xl border-2 border-ink bg-white p-5 shadow-comic sm:p-8">
              <div className="grid gap-3 sm:grid-cols-2">
                {splitTeams(players).map((team, index) => (
                  <div
                    className={`rounded-2xl border-2 border-ink p-4 ${
                      index === 0 ? "bg-bubblegum" : "bg-sky"
                    }`}
                    key={index}
                  >
                    <h3 className="font-display text-xl font-semibold">
                      Equipo {index + 1}
                    </h3>
                    <p className="mt-1 text-sm font-bold">
                      {team.length ? team.join(", ") : "Sin jugadores"}
                    </p>
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded-2xl border-2 border-ink bg-cream p-4">
                <h3 className="font-display text-xl font-semibold">
                  Cómo se juega
                </h3>
                <ol className="mt-2 list-inside list-decimal space-y-1 text-sm font-semibold text-ink/75">
                  <li>
                    Por turnos, una persona da pistas para que su equipo
                    adivine la palabra de la tarjeta.
                  </li>
                  <li>
                    No puede decir la palabra ni ninguna de las cinco
                    prohibidas. El otro equipo vigila y marca las infracciones.
                  </li>
                  <li>
                    Acierto: +1 punto. Pasar: 0. Palabra prohibida: −1 punto.
                    Cada turno dura 60 segundos.
                  </li>
                </ol>
              </div>

              <fieldset className="mt-5">
                <legend className="mb-2 text-sm font-extrabold uppercase tracking-wide text-ink/60">
                  Turnos por equipo
                </legend>
                <div className="grid grid-cols-3 gap-2">
                  {roundOptions.map((count) => (
                    <button
                      aria-pressed={turnsPerTeam === count}
                      className={`rounded-xl border-2 border-ink py-3 font-extrabold shadow-comic-sm ${
                        turnsPerTeam === count ? "bg-mustard" : "bg-white"
                      }`}
                      key={count}
                      onClick={() => setTurnsPerTeam(count)}
                      type="button"
                    >
                      {count} {count === 1 ? "turno" : "turnos"}
                    </button>
                  ))}
                </div>
              </fieldset>

              {players.length < 4 && (
                <p className="mt-4 rounded-2xl border-2 border-ink bg-coral p-4 text-sm font-bold">
                  Hacen falta al menos 4 jugadores para formar dos equipos.
                </p>
              )}
              <button
                className="mt-6 w-full rounded-full border-2 border-ink bg-bubblegum px-6 py-4 font-display text-2xl font-semibold shadow-comic disabled:cursor-not-allowed disabled:opacity-45"
                disabled={players.length < 4}
                onClick={startGame}
                type="button"
              >
                ¡A jugar! 🤐
              </button>
            </div>
          </section>
        )}

        {stage === "handoff" && (
          <section className="rounded-3xl border-2 border-ink bg-white p-6 text-center shadow-comic sm:p-10">
            <span aria-hidden="true" className="text-6xl">
              {activeTeamIndex === 0 ? "🩷" : "💙"}
            </span>
            <p className="mt-3 text-sm font-extrabold uppercase tracking-widest text-ink/55">
              Ronda {currentRound} de {turnsPerTeam} · Equipo {activeTeamIndex + 1}
            </p>
            <h2 className="mt-2 break-words font-display text-3xl font-semibold">
              Le toca a {activePlayer}
            </h2>
            <p className="mt-3 font-semibold text-ink/65">
              Dale el móvil a quien da las pistas. El otro equipo puede vigilar
              las palabras prohibidas.
            </p>
            <button
              className="mt-6 w-full rounded-full border-2 border-ink bg-mint px-6 py-4 font-extrabold shadow-comic-sm"
              onClick={beginTurn}
              type="button"
            >
              Preparar turno ▶
            </button>
          </section>
        )}

        {stage === "countdown" && (
          <section
            aria-live="assertive"
            className="rounded-3xl border-2 border-ink bg-white p-10 text-center shadow-comic"
          >
            <p className="text-sm font-extrabold uppercase tracking-widest text-ink/55">
              Turno de {activePlayer}
            </p>
            <p className="mt-3 font-display text-8xl font-semibold text-ink">
              {countdown || "¡YA!"}
            </p>
            <p className="mt-3 font-bold text-ink/60">
              ¡Que el equipo se prepare!
            </p>
          </section>
        )}

        {stage === "playing" && currentCard && (
          <section aria-label={`Turno de ${activePlayer}`}>
            <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-display text-xl font-semibold">
                  {activePlayer} · Equipo {activeTeamIndex + 1}
                </p>
                <p className="text-sm font-bold text-ink/60">
                  Equipo 1: {teamScores[0]} · Equipo 2: {teamScores[1]}
                </p>
              </div>
              <div
                aria-label={`${secondsLeft} segundos restantes`}
                className={`rounded-full border-2 border-ink px-5 py-2 font-display text-2xl font-bold shadow-comic-sm ${
                  secondsLeft <= 10 ? "bg-coral" : "bg-mustard"
                }`}
                role="timer"
              >
                {formatTime(secondsLeft)}
              </div>
            </header>

            <article className="rounded-3xl border-2 border-ink bg-white p-6 text-center shadow-comic sm:p-8">
              <p className="text-xs font-extrabold uppercase tracking-widest text-ink/55">
                Solo quien da pistas debe mirar
              </p>
              <h2 className="mt-3 font-display text-4xl font-semibold sm:text-5xl">
                {currentCard.word}
              </h2>
              <div className="mt-5 rounded-2xl border-2 border-ink bg-coral/25 p-4">
                <p className="text-xs font-extrabold uppercase tracking-widest">
                  🚫 No puedes decir
                </p>
                <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
                  {currentCard.forbidden.map((word) => (
                    <li
                      className="rounded-xl border-2 border-ink bg-white px-2 py-2 text-sm font-extrabold"
                      key={word}
                    >
                      {word}
                    </li>
                  ))}
                </ul>
              </div>
              <p className="mt-4 font-semibold text-ink/65">
                Puntos de este turno: {turnStats.correct} aciertos ·{" "}
                {turnStats.forbidden} infracciones · {turnStats.passed} pasadas
              </p>
            </article>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                className="rounded-full border-2 border-ink bg-mint px-4 py-4 font-extrabold shadow-comic-sm"
                onClick={() => recordCardResult("correct")}
                type="button"
              >
                ✅ Adivinada (+1)
              </button>
              <button
                className="rounded-full border-2 border-ink bg-white px-4 py-4 font-extrabold shadow-comic-sm"
                onClick={() => recordCardResult("passed")}
                type="button"
              >
                ⏭️ Pasar
              </button>
              <button
                className="col-span-2 rounded-full border-2 border-ink bg-coral px-4 py-4 font-extrabold shadow-comic-sm"
                onClick={() => recordCardResult("forbidden")}
                type="button"
              >
                🚫 Dijeron una prohibida (−1)
              </button>
              <button
                className="col-span-2 rounded-full px-4 py-2 text-sm font-bold text-ink/55 underline underline-offset-2"
                onClick={() => setStage("turn-result")}
                type="button"
              >
                Terminar turno ahora
              </button>
            </div>
          </section>
        )}

        {stage === "turn-result" && (
          <section className="rounded-3xl border-2 border-ink bg-white p-6 text-center shadow-comic sm:p-10">
            <span aria-hidden="true" className="text-6xl">
              ⏱️
            </span>
            <p className="mt-3 text-sm font-extrabold uppercase tracking-widest text-ink/55">
              Turno terminado · Equipo {activeTeamIndex + 1}
            </p>
            <h2 className="mt-2 font-display text-3xl font-semibold">
              {activePlayer}: {turnStats.correct} aciertos
            </h2>
            <p className="mt-3 font-semibold text-ink/65">
              {turnStats.forbidden} infracciones · {turnStats.passed} pasadas
            </p>
            <p className="mt-4 font-display text-2xl font-semibold">
              Equipo 1: {teamScores[0]} · Equipo 2: {teamScores[1]}
            </p>
            <button
              className="mt-6 w-full rounded-full border-2 border-ink bg-mint px-6 py-4 font-extrabold shadow-comic-sm"
              onClick={continueGame}
              type="button"
            >
              {turnIndex + 1 >= totalTurns
                ? "Ver resultados 🏆"
                : "Siguiente turno 👉"}
            </button>
          </section>
        )}

        {stage === "summary" && (
          <section className="rounded-3xl border-2 border-ink bg-white p-6 text-center shadow-comic sm:p-10">
            <span aria-hidden="true" className="text-7xl">
              {winner ? "🏆" : "🤝"}
            </span>
            <p className="mt-3 text-sm font-extrabold uppercase tracking-widest text-ink/55">
              Fin de la partida
            </p>
            <h2 className="mt-1 font-display text-4xl font-semibold">
              {winner ? `¡Gana ${winner}!` : "¡Empate!"}
            </h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {teams.map((team, index) => (
                <article
                  className={`rounded-2xl border-2 border-ink p-4 ${
                    index === 0 ? "bg-bubblegum" : "bg-sky"
                  }`}
                  key={index}
                >
                  <p className="font-display text-2xl font-semibold">
                    Equipo {index + 1}
                  </p>
                  <p className="mt-1 text-4xl font-extrabold">
                    {teamScores[index]}
                  </p>
                  <p className="mt-1 text-sm font-bold">{team.join(", ")}</p>
                </article>
              ))}
            </div>
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
