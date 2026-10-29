import { useEffect, useMemo, useState } from "react";
import minigameData from "../data/minigames.json";
import { usePlayers } from "../state/PlayersContext";

type Phase = "reveal" | "discussion" | "voting" | "results";

const discussionSeconds = 60;
const voteColors = [
  "bg-bubblegum",
  "bg-mustard",
  "bg-mint",
  "bg-sky",
  "bg-coral",
];

function shuffle<T>(items: T[]): T[] {
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

function randomItem<T>(items: T[]): T {
  const item = items[Math.floor(Math.random() * items.length)];
  if (item === undefined) throw new Error("No hay suficientes datos para iniciar la ronda.");
  return item;
}

export default function ImpostorGame({
  onBack,
  onManagePlayers,
}: {
  onBack: () => void;
  onManagePlayers: () => void;
}) {
  const { players } = usePlayers();
  const [roundPlayers, setRoundPlayers] = useState(() => shuffle(players));
  const [secretWord, setSecretWord] = useState(() =>
    randomItem(minigameData.impostorWords),
  );
  const [impostor, setImpostor] = useState(() => randomItem(players));
  const [turnIndex, setTurnIndex] = useState(0);
  const [isRevealed, setIsRevealed] = useState(false);
  const [hasRevealedTurn, setHasRevealedTurn] = useState(false);
  const [phase, setPhase] = useState<Phase>("reveal");
  const [secondsLeft, setSecondsLeft] = useState(discussionSeconds);
  const [voterIndex, setVoterIndex] = useState(0);
  const [votes, setVotes] = useState<Record<string, number>>({});
  const [selectedSuspect, setSelectedSuspect] = useState<string | null>(null);

  const currentPlayer = roundPlayers[turnIndex];
  const currentVoter = roundPlayers[voterIndex];
  const voteResults = useMemo(
    () =>
      roundPlayers
        .map((player) => ({ player, votes: votes[player] ?? 0 }))
        .sort((left, right) => right.votes - left.votes),
    [roundPlayers, votes],
  );
  const topVotes = voteResults[0]?.votes ?? 0;
  const accusedPlayers = voteResults.filter(
    (result) => result.votes === topVotes && topVotes > 0,
  );
  const impostorCaught = accusedPlayers.some(
    (result) => result.player === impostor,
  );

  useEffect(() => {
    if (phase !== "discussion" || secondsLeft <= 0) return;
    const timer = window.setTimeout(
      () => setSecondsLeft((seconds) => Math.max(0, seconds - 1)),
      1000,
    );
    return () => window.clearTimeout(timer);
  }, [phase, secondsLeft]);

  function passPhone() {
    if (turnIndex + 1 >= roundPlayers.length) {
      setPhase("discussion");
      return;
    }
    setIsRevealed(false);
    setHasRevealedTurn(false);
    setTurnIndex((index) => index + 1);
  }

  function castVote() {
    if (!selectedSuspect) return;
    setVotes((currentVotes) => ({
      ...currentVotes,
      [selectedSuspect]: (currentVotes[selectedSuspect] ?? 0) + 1,
    }));
    setSelectedSuspect(null);
    if (voterIndex + 1 >= roundPlayers.length) {
      setPhase("results");
      return;
    }
    setVoterIndex((index) => index + 1);
  }

  function startNewRound() {
    setRoundPlayers(shuffle(players));
    setSecretWord(randomItem(minigameData.impostorWords));
    setImpostor(randomItem(players));
    setTurnIndex(0);
    setIsRevealed(false);
    setHasRevealedTurn(false);
    setPhase("reveal");
    setSecondsLeft(discussionSeconds);
    setVoterIndex(0);
    setVotes({});
    setSelectedSuspect(null);
  }

  return (
    <GameLayout
      onBack={onBack}
      onManagePlayers={onManagePlayers}
      playerCount={players.length}
      title="El Impostor"
    >
      {phase === "reveal" && currentPlayer && (
        <section aria-live="polite">
          <div className="mb-5 text-center">
            <p className="text-sm font-extrabold uppercase tracking-widest text-ink/55">
              Turno {turnIndex + 1} de {roundPlayers.length}
            </p>
            <h2 className="mt-1 break-words font-display text-4xl font-semibold [overflow-wrap:anywhere]">
              Pásale el móvil a {currentPlayer}
            </h2>
            <p className="mt-2 font-semibold text-ink/65">
              Que nadie mire. Ni el que está leyendo por encima del hombro.
            </p>
          </div>

          <div className="rounded-3xl border-2 border-ink bg-white p-5 shadow-comic sm:p-8">
            <button
              aria-label={
                isRevealed
                  ? `Rol de ${currentPlayer} revelado`
                  : `Mantener para revelar el rol de ${currentPlayer}`
              }
              className={`flex min-h-56 w-full select-none flex-col items-center justify-center rounded-3xl border-2 border-ink px-5 py-8 text-center shadow-comic transition-transform active:translate-y-1 active:shadow-none ${
                isRevealed ? "bg-bubblegum" : "bg-mustard"
              }`}
              onContextMenu={(event) => event.preventDefault()}
              onPointerCancel={() => {
                if (isRevealed) setHasRevealedTurn(true);
                setIsRevealed(false);
              }}
              onPointerDown={(event) => {
                event.preventDefault();
                event.currentTarget.setPointerCapture(event.pointerId);
                setIsRevealed(true);
              }}
              onPointerUp={() => {
                if (isRevealed) setHasRevealedTurn(true);
                setIsRevealed(false);
              }}
              onKeyDown={(event) => {
                if (event.repeat || (event.key !== " " && event.key !== "Enter")) return;
                event.preventDefault();
                setIsRevealed(true);
              }}
              onKeyUp={(event) => {
                if (event.key === " " || event.key === "Enter") {
                  event.preventDefault();
                  if (isRevealed) setHasRevealedTurn(true);
                  setIsRevealed(false);
                }
              }}
              type="button"
            >
              {isRevealed ? (
                currentPlayer === impostor ? (
                  <>
                    <span className="text-5xl">❌</span>
                    <span className="mt-3 font-display text-3xl font-semibold">
                      ERES EL IMPOSTOR
                    </span>
                    <span className="mt-2 font-bold">Disimula y no te pillen.</span>
                  </>
                ) : (
                  <>
                    <span className="text-sm font-extrabold uppercase tracking-widest">
                      La palabra secreta
                    </span>
                    <span className="mt-3 font-display text-5xl font-semibold">
                      {secretWord}
                    </span>
                  </>
                )
              ) : (
                <>
                  <span className="text-5xl">🕵️</span>
                  <span className="mt-4 font-display text-3xl font-semibold">
                    Mantener para revelar rol
                  </span>
                  <span className="mt-2 text-sm font-bold text-ink/65">
                    No sueltes todavía…
                  </span>
                </>
              )}
            </button>
            {!isRevealed && hasRevealedTurn && (
              <button
                className="mt-5 w-full rounded-full border-2 border-ink bg-mint px-6 py-4 font-extrabold shadow-comic-sm transition-transform hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-none"
                onClick={passPhone}
                type="button"
              >
                {turnIndex + 1 === roundPlayers.length
                  ? "Todos listos · A discutir"
                  : `Pasar teléfono a ${roundPlayers[turnIndex + 1]}`}
              </button>
            )}
          </div>
          <p className="mt-4 text-center text-xs font-bold text-ink/50">
            La información se oculta al soltar. Pásalo cuando estés listo.
          </p>
        </section>
      )}

      {phase === "discussion" && (
        <section className="rounded-3xl border-2 border-ink bg-white p-6 text-center shadow-comic sm:p-10">
          <span className="text-6xl">🗣️</span>
          <p className="mt-3 text-sm font-extrabold uppercase tracking-widest text-ink/55">
            Debate de acusaciones
          </p>
          <h2 className="mt-1 font-display text-4xl font-semibold">
            ¿Quién está colando la trola?
          </h2>
          <p className="mt-2 font-semibold text-ink/65">
            Discutidlo antes de votar. El reloj corre.
          </p>
          <div
            aria-label={`${secondsLeft} segundos restantes`}
            className="mx-auto my-6 grid h-36 w-36 place-items-center rounded-full border-4 border-ink bg-mustard shadow-comic"
            role="timer"
          >
            <span className="font-display text-6xl font-semibold tabular-nums">
              {String(Math.floor(secondsLeft / 60)).padStart(2, "0")}:
              {String(secondsLeft % 60).padStart(2, "0")}
            </span>
          </div>
          <button
            className="w-full rounded-full border-2 border-ink bg-bubblegum px-6 py-4 font-extrabold shadow-comic-sm transition-transform hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-none sm:w-auto"
            onClick={() => {
              setVoterIndex(0);
              setPhase("voting");
            }}
            type="button"
          >
            A votar, panda de detectives
          </button>
        </section>
      )}

      {phase === "voting" && currentVoter && (
        <section className="rounded-3xl border-2 border-ink bg-white p-6 shadow-comic sm:p-8">
          <p className="text-sm font-extrabold uppercase tracking-widest text-ink/55">
            Voto {voterIndex + 1} de {roundPlayers.length}
          </p>
          <h2 className="mt-1 break-words font-display text-3xl font-semibold [overflow-wrap:anywhere]">
            {currentVoter}, ¿quién es el impostor?
          </h2>
          <p className="mb-5 mt-2 font-semibold text-ink/65">
            Elige en secreto y pasa el teléfono al siguiente.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {roundPlayers.map((player, index) => (
              <button
                aria-pressed={selectedSuspect === player}
                className={`min-w-0 break-words rounded-2xl border-2 border-ink px-4 py-4 text-left font-extrabold shadow-comic-sm transition-transform hover:-translate-y-0.5 [overflow-wrap:anywhere] ${
                  selectedSuspect === player
                    ? "bg-ink text-white"
                    : voteColors[index % voteColors.length]
                }`}
                key={player}
                onClick={() => setSelectedSuspect(player)}
                type="button"
              >
                {player}
              </button>
            ))}
          </div>
          <button
            className="mt-6 w-full rounded-full border-2 border-ink bg-mint px-6 py-4 font-extrabold shadow-comic-sm transition-transform hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-none disabled:cursor-not-allowed disabled:bg-ink/10 disabled:text-ink/40 disabled:shadow-none"
            disabled={!selectedSuspect}
            onClick={castVote}
            type="button"
          >
            {voterIndex + 1 === roundPlayers.length
              ? "Revelar resultado"
              : "Voto secreto · pasar teléfono"}
          </button>
        </section>
      )}

      {phase === "results" && (
        <section className="rounded-3xl border-2 border-ink bg-white p-6 shadow-comic sm:p-8">
          <div className="text-center">
            <span className="text-6xl">{impostorCaught ? "🎯" : "🫠"}</span>
            <h2 className="mt-3 font-display text-4xl font-semibold">
              {impostorCaught
                ? "¡Impostor descubierto!"
                : "El impostor se salió con la suya"}
            </h2>
            <p className="mt-2 break-words font-semibold text-ink/70 [overflow-wrap:anywhere]">
              {accusedPlayers.length > 1 ? "Empate entre " : "El grupo señaló a "}
              <strong>{accusedPlayers.map((result) => result.player).join(", ")}</strong>
              . El impostor era <strong>{impostor}</strong>.
            </p>
          </div>
          <ol className="mt-6 space-y-2">
            {voteResults.map(({ player, votes: voteCount }, index) => (
              <li
                className={`flex items-center justify-between rounded-2xl border-2 border-ink px-4 py-3 font-bold ${voteColors[index % voteColors.length]}`}
                key={player}
              >
                <span className="min-w-0 break-words [overflow-wrap:anywhere]">{player}</span>
                <span>
                  {voteCount} {voteCount === 1 ? "voto" : "votos"}
                </span>
              </li>
            ))}
          </ol>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              className="flex-1 rounded-full border-2 border-ink bg-mustard px-5 py-4 font-extrabold shadow-comic-sm"
              disabled={players.length < 3}
              onClick={startNewRound}
              type="button"
            >
              {players.length >= 3 ? "Otra ronda" : "Añade 3 jugadores para otra ronda"}
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
    </GameLayout>
  );
}

function GameLayout({
  children,
  onBack,
  onManagePlayers,
  playerCount,
  title,
}: {
  children: React.ReactNode;
  onBack: () => void;
  onManagePlayers: () => void;
  playerCount: number;
  title: string;
}) {
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
          <h1 className="truncate text-right font-display text-2xl font-semibold">
            {title}
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
        {children}
      </div>
    </main>
  );
}
