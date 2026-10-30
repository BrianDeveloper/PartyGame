import { useEffect, useMemo, useState } from "react";
import wordBank from "../data/impostor.json";
import CustomContentForm from "./CustomContentForm";
import { useCustomGameContent } from "../state/CustomGameContentContext";
import { usePlayers } from "../state/PlayersContext";

type GameMode = "classic" | "elimination";
type Winner = "impostors" | "crew";
type Phase =
  | "setup"
  | "reveal"
  | "discussion"
  | "voting"
  | "elimination-result"
  | "results";

const discussionDurationOptions = [30, 45, 60, 90, 120];
const DEFAULT_DISCUSSION_DURATION = 60;
const impostorCountOptions = [1, 2, 3];
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
  const { entries: customContent } = useCustomGameContent();
  const customWords = customContent
    .filter((entry) => entry.game === "impostor")
    .map((entry) => entry.word);
  const [gameMode, setGameMode] = useState<GameMode>("classic");
  const [selectedImpostorCount, setSelectedImpostorCount] = useState(1);
  const [roundPlayers, setRoundPlayers] = useState<string[]>([]);
  const [secretWord, setSecretWord] = useState("");
  const [impostors, setImpostors] = useState<string[]>([]);
  const [eliminatedPlayers, setEliminatedPlayers] = useState<string[]>([]);
  const [lastEliminated, setLastEliminated] = useState<string | null>(null);
  const [winner, setWinner] = useState<Winner | null>(null);
  const [meetingNumber, setMeetingNumber] = useState(1);
  const [lastMeetingResults, setLastMeetingResults] = useState<
    { player: string; votes: number }[]
  >([]);
  const [turnIndex, setTurnIndex] = useState(0);
  const [isRevealed, setIsRevealed] = useState(false);
  const [hasRevealedTurn, setHasRevealedTurn] = useState(false);
  const [phase, setPhase] = useState<Phase>("setup");
  const [selectedDiscussionDuration, setSelectedDiscussionDuration] =
    useState(DEFAULT_DISCUSSION_DURATION);
  const [secondsLeft, setSecondsLeft] = useState(DEFAULT_DISCUSSION_DURATION);
  const [voterIndex, setVoterIndex] = useState(0);
  const [votes, setVotes] = useState<Record<string, number>>({});
  const [selectedSuspect, setSelectedSuspect] = useState<string | null>(null);

  const activePlayers = useMemo(
    () => roundPlayers.filter((player) => !eliminatedPlayers.includes(player)),
    [eliminatedPlayers, roundPlayers],
  );
  const currentPlayer = roundPlayers[turnIndex];
  const currentVoter = activePlayers[voterIndex];
  const voteResults = useMemo(
    () =>
      activePlayers
        .map((player) => ({ player, votes: votes[player] ?? 0 }))
        .sort((left, right) => right.votes - left.votes),
    [activePlayers, votes],
  );
  const topVotes = voteResults[0]?.votes ?? 0;
  const accusedPlayers = voteResults.filter(
    (result) => result.votes === topVotes && topVotes > 0,
  );
  const accusedImpostors = accusedPlayers.filter((result) =>
    impostors.includes(result.player),
  );
  const impostorCaught = accusedImpostors.length > 0;
  const crewCount = players.length - selectedImpostorCount;
  const canStart =
    players.length >= 3 &&
    selectedImpostorCount < players.length &&
    (gameMode === "classic" || selectedImpostorCount < crewCount);

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
      setSecondsLeft(selectedDiscussionDuration);
      setPhase("discussion");
      return;
    }
    setIsRevealed(false);
    setHasRevealedTurn(false);
    setTurnIndex((index) => index + 1);
  }

  function startMatch() {
    if (!canStart) return;
    const shuffledPlayers = shuffle(players);
    setRoundPlayers(shuffledPlayers);
    setSecretWord(randomItem([...wordBank, ...customWords]));
    setImpostors(shuffle(shuffledPlayers).slice(0, selectedImpostorCount));
    setEliminatedPlayers([]);
    setLastEliminated(null);
    setWinner(null);
    setMeetingNumber(1);
    setLastMeetingResults([]);
    setTurnIndex(0);
    setIsRevealed(false);
    setHasRevealedTurn(false);
    setSecondsLeft(selectedDiscussionDuration);
    setVoterIndex(0);
    setVotes({});
    setSelectedSuspect(null);
    setPhase("reveal");
  }

  function castVote() {
    if (!selectedSuspect) return;
    const finalVotes = {
      ...votes,
    };
    finalVotes[selectedSuspect] = (finalVotes[selectedSuspect] ?? 0) + 1;
    setVotes(finalVotes);
    setSelectedSuspect(null);

    if (voterIndex + 1 < activePlayers.length) {
      setVoterIndex((index) => index + 1);
      return;
    }

    if (gameMode === "classic") {
      setPhase("results");
      return;
    }

    const sortedVotes = activePlayers
      .map((player) => ({ player, votes: finalVotes[player] ?? 0 }))
      .sort((left, right) => right.votes - left.votes);
    setLastMeetingResults(sortedVotes);
    const topVoteCount = sortedVotes[0]?.votes ?? 0;
    const votedOut =
      topVoteCount > 0 &&
      sortedVotes.filter((result) => result.votes === topVoteCount).length === 1
        ? sortedVotes[0]?.player ?? null
        : null;
    const nextEliminated = votedOut
      ? [...eliminatedPlayers, votedOut]
      : eliminatedPlayers;
    const remainingImpostors = impostors.filter(
      (player) => !nextEliminated.includes(player),
    );
    const remainingCrew = activePlayers.filter(
      (player) =>
        !impostors.includes(player) && player !== votedOut,
    );

    setLastEliminated(votedOut);
    setEliminatedPlayers(nextEliminated);
    if (remainingImpostors.length === 0) {
      setWinner("crew");
    } else if (remainingImpostors.length >= remainingCrew.length) {
      setWinner("impostors");
    } else {
      setWinner(null);
    }
    setPhase("elimination-result");
  }

  function startNextMeeting() {
    setMeetingNumber((number) => number + 1);
    setSecondsLeft(selectedDiscussionDuration);
    setVoterIndex(0);
    setVotes({});
    setSelectedSuspect(null);
    setLastMeetingResults([]);
    setPhase("discussion");
  }

  function startNewRound() {
    setPhase("setup");
    setEliminatedPlayers([]);
    setLastEliminated(null);
    setWinner(null);
    setVotes({});
    setSelectedSuspect(null);
    setLastMeetingResults([]);
  }

  return (
    <GameLayout
      onBack={onBack}
      onManagePlayers={onManagePlayers}
      playerCount={players.length}
      title="El Impostor"
    >
      {phase === "setup" && (
        <section className="rounded-3xl border-2 border-ink bg-white p-5 shadow-comic sm:p-8">
          <p className="text-sm font-extrabold uppercase tracking-widest text-ink/55">
            Configura la partida
          </p>
          <h2 className="mt-1 font-display text-3xl font-semibold">
            ¿Cómo vais a cazar al impostor?
          </h2>

          <fieldset className="mt-5">
            <legend className="mb-2 text-sm font-extrabold uppercase tracking-wide text-ink/60">
              Modo de juego
            </legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {(
                [
                  {
                    id: "classic",
                    title: "Ronda clásica",
                    description:
                      "Una votación y se revela el resultado de la ronda.",
                    color: "bg-mustard",
                  },
                  {
                    id: "elimination",
                    title: "Eliminación · estilo Among Us",
                    description:
                      "Se expulsa a alguien en cada votación y la partida continúa hasta que haya ganador.",
                    color: "bg-bubblegum",
                  },
                ] as const
              ).map((option) => (
                <button
                  aria-pressed={gameMode === option.id}
                  className={`rounded-2xl border-2 border-ink p-4 text-left shadow-comic-sm ${
                    gameMode === option.id ? option.color : "bg-white"
                  }`}
                  key={option.id}
                  onClick={() => setGameMode(option.id)}
                  type="button"
                >
                  <span className="block font-display text-xl font-semibold">
                    {option.title}
                  </span>
                  <span className="mt-1 block text-sm font-semibold text-ink/70">
                    {option.description}
                  </span>
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="mt-5">
            <legend className="mb-2 text-sm font-extrabold uppercase tracking-wide text-ink/60">
              Cantidad de impostores
            </legend>
            <div className="grid grid-cols-3 gap-2">
              {impostorCountOptions.map((count) => {
                const disabled =
                  count >= players.length ||
                  (gameMode === "elimination" && count * 2 >= players.length);
                return (
                  <button
                    aria-pressed={selectedImpostorCount === count}
                    className={`rounded-xl border-2 border-ink py-3 font-extrabold shadow-comic-sm disabled:cursor-not-allowed disabled:opacity-40 ${
                      selectedImpostorCount === count ? "bg-mustard" : "bg-cream"
                    }`}
                    disabled={disabled}
                    key={count}
                    onClick={() => setSelectedImpostorCount(count)}
                    type="button"
                  >
                    {count} {count === 1 ? "impostor" : "impostores"}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-sm font-semibold text-ink/60">
              En eliminación debe haber más tripulantes que impostores al
              empezar.
            </p>
          </fieldset>

          <fieldset className="mt-5">
            <legend className="mb-2 text-sm font-extrabold uppercase tracking-wide text-ink/60">
              Tiempo para debatir
            </legend>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {discussionDurationOptions.map((duration) => (
                <button
                  aria-pressed={selectedDiscussionDuration === duration}
                  className={`rounded-xl border-2 border-ink py-2 font-extrabold ${
                    selectedDiscussionDuration === duration
                      ? "bg-mustard"
                      : "bg-cream"
                  }`}
                  key={duration}
                  onClick={() => setSelectedDiscussionDuration(duration)}
                  type="button"
                >
                  {duration}s
                </button>
              ))}
            </div>
          </fieldset>

          {players.length < 3 && (
            <p className="mt-4 rounded-2xl border-2 border-ink bg-coral p-4 font-bold">
              Hacen falta al menos 3 jugadores para iniciar una partida.
            </p>
          )}
          {players.length >= 3 &&
            gameMode === "elimination" &&
            selectedImpostorCount >= crewCount && (
              <p className="mt-4 rounded-2xl border-2 border-ink bg-coral p-4 font-bold">
                En eliminación, la tripulación debe superar en número a los
                impostores al comenzar. Reduce la cantidad de impostores o
                añade jugadores.
              </p>
            )}
          <CustomContentForm game="impostor" />
          <button
            className="mt-6 w-full rounded-full border-2 border-ink bg-mint px-6 py-4 font-display text-2xl font-semibold shadow-comic-sm disabled:cursor-not-allowed disabled:opacity-45"
            disabled={!canStart}
            onClick={startMatch}
            type="button"
          >
            Repartir roles 🔒
          </button>
        </section>
      )}

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
                !isRevealed
                  ? "bg-mustard"
                  : impostors.includes(currentPlayer)
                    ? "bg-coral"
                    : "bg-mint"
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
                impostors.includes(currentPlayer) ? (
                  <>
                    <span className="text-5xl">❌</span>
                    <span className="mt-3 font-display text-3xl font-semibold">
                      ERES EL IMPOSTOR
                    </span>
                    <span className="mt-2 font-bold">
                      {impostors.length > 1
                        ? `Tu equipo: ${impostors
                            .filter((player) => player !== currentPlayer)
                            .join(", ")}.`
                        : "Disimula y no te pillen."}
                    </span>
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
            {gameMode === "elimination"
              ? `Reunión ${meetingNumber} · quedan ${activePlayers.length} jugadores`
              : "Debate de acusaciones"}
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
              setVotes({});
              setSelectedSuspect(null);
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
            Voto {voterIndex + 1} de {activePlayers.length}
          </p>
          <h2 className="mt-1 break-words font-display text-3xl font-semibold [overflow-wrap:anywhere]">
            {currentVoter}, ¿a quién señalas?
          </h2>
          <p className="mb-5 mt-2 font-semibold text-ink/65">
            Elige en secreto y pasa el teléfono al siguiente.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {activePlayers.map((player, index) => (
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
            {voterIndex + 1 === activePlayers.length
              ? "Revelar resultado"
              : "Voto secreto · pasar teléfono"}
          </button>
        </section>
      )}

      {phase === "elimination-result" && (
        <section className="rounded-3xl border-2 border-ink bg-white p-6 shadow-comic sm:p-8">
          <div className="text-center">
            <span className="text-6xl">
              {winner
                ? winner === "crew"
                  ? "🎯"
                  : "🕵️"
                : lastEliminated
                  ? "🚪"
                  : "🤝"}
            </span>
            <h2 className="mt-3 font-display text-3xl font-semibold">
              {winner
                ? winner === "crew"
                  ? "¡La tripulación ganó!"
                  : "¡Los impostores ganaron!"
                : lastEliminated
                  ? `${lastEliminated} fue expulsado`
                  : "Empate: nadie sale"}
            </h2>
            {lastEliminated && (
              <p className="mt-2 font-semibold text-ink/70">
                {impostors.includes(lastEliminated)
                  ? "Era impostor."
                  : "Era parte de la tripulación."}
              </p>
            )}
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 text-center">
            <p className="rounded-2xl border-2 border-ink bg-bubblegum p-3 font-extrabold">
              Impostores: {impostors.filter((player) => !eliminatedPlayers.includes(player)).length}
            </p>
            <p className="rounded-2xl border-2 border-ink bg-mint p-3 font-extrabold">
              Tripulación: {activePlayers.filter((player) => !impostors.includes(player)).length}
            </p>
          </div>

          <ol className="mt-5 space-y-2">
            {lastMeetingResults.map(({ player, votes: voteCount }, index) => (
              <li
                className={`flex items-center justify-between rounded-2xl border-2 border-ink px-4 py-3 font-bold ${voteColors[index % voteColors.length]}`}
                key={player}
              >
                <span className="min-w-0 break-words [overflow-wrap:anywhere]">
                  {player}
                </span>
                <span>
                  {voteCount} {voteCount === 1 ? "voto" : "votos"}
                </span>
              </li>
            ))}
          </ol>

          <button
            className="mt-6 w-full rounded-full border-2 border-ink bg-mustard px-5 py-4 font-extrabold shadow-comic-sm"
            onClick={winner ? startNewRound : startNextMeeting}
            type="button"
          >
            {winner ? "Jugar otra partida" : "Siguiente reunión"}
          </button>
          <button
            className="mt-3 w-full rounded-full border-2 border-ink bg-white px-5 py-4 font-extrabold shadow-comic-sm"
            onClick={onBack}
            type="button"
          >
            Volver al menú
          </button>
        </section>
      )}

      {phase === "results" && (
        <section className="rounded-3xl border-2 border-ink bg-white p-6 shadow-comic sm:p-8">
          <div className="text-center">
            <span className="text-6xl">{impostorCaught ? "🎯" : "🫠"}</span>
            <h2 className="mt-3 font-display text-4xl font-semibold">
              {impostorCaught
                ? accusedImpostors.length > 1
                  ? "¡Impostores descubiertos!"
                  : "¡Impostor descubierto!"
                : impostors.length > 1
                  ? "Los impostores se salieron con la suya"
                  : "El impostor se salió con la suya"}
            </h2>
            <p className="mt-2 break-words font-semibold text-ink/70 [overflow-wrap:anywhere]">
              {accusedPlayers.length > 1 ? "Empate entre " : "El grupo señaló a "}
              <strong>
                {accusedPlayers.map((result) => result.player).join(", ") ||
                  "nadie"}
              </strong>
              . {impostors.length > 1 ? "Los impostores eran " : "El impostor era "}
              <strong>{impostors.join(", ")}</strong>.
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
              disabled={players.length < 3 || !canStart}
              onClick={startNewRound}
              type="button"
            >
              {canStart ? "Otra partida" : "Añade jugadores para otra partida"}
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
        <details className="mb-5 rounded-3xl border-2 border-ink bg-white p-4 shadow-comic-sm">
          <summary className="cursor-pointer font-extrabold">
            📖 Cómo se juega · reglas rápidas
          </summary>
          <ol className="mt-3 list-inside list-decimal space-y-2 text-sm font-semibold text-ink/70">
            <li>
              Todos ven su rol en secreto. Los impostores no conocen la palabra;
              en partidas con varios, pueden reconocerse entre sí. El resto
              intenta describirla sin regalarla.
            </li>
            <li>
              Elegid entre la ronda clásica, que termina tras una votación, o
              eliminación, donde cada votación expulsa a quien tenga más votos
              (un empate no expulsa a nadie).
            </li>
            <li>
              En eliminación gana la tripulación cuando expulsa a todos los
              impostores; ellos ganan al igualar o superar en número a la
              tripulación restante. La duración del debate se configura antes
              de repartir roles.
            </li>
          </ol>
        </details>
        {children}
      </div>
    </main>
  );
}
