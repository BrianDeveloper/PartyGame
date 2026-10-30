import { useEffect, useState } from "react";
import roscoData from "../data/pasapalabra.json";

type RoscoCell = {
  letter: string;
  clue: string;
  answer: string;
  status: "pending" | "correct" | "incorrect";
  passed: boolean;
};

type PlayerRosco = {
  player: string;
  cells: RoscoCell[];
  currentIndex: number;
  finished: boolean;
};

type Stage = "setup" | "playing" | "handoff" | "results";
const TURN_TIME_SECONDS = 120;
const HANDOFF_DELAY_MS = 450;

function createRosco(player: string): PlayerRosco {
  return {
    player,
    cells: roscoData.map((item) => ({
      ...item,
      status: "pending" as const,
      passed: false,
    })),
    currentIndex: 0,
    finished: false,
  };
}

function getNextPendingIndex(cells: RoscoCell[], currentIndex: number) {
  for (let offset = 1; offset <= cells.length; offset += 1) {
    const index = (currentIndex + offset) % cells.length;
    if (cells[index]?.status === "pending" && !cells[index]?.passed) {
      return index;
    }
  }

  const resetCells = cells.map((cell) =>
    cell.status === "pending" ? { ...cell, passed: false } : cell,
  );
  for (let offset = 1; offset <= resetCells.length; offset += 1) {
    const index = (currentIndex + offset) % resetCells.length;
    if (resetCells[index]?.status === "pending") {
      return index;
    }
  }
  return -1;
}

export default function PassapalabraGame({
  onBack,
  onManagePlayers,
  players,
}: {
  onBack: () => void;
  onManagePlayers: () => void;
  players: string[];
}) {
  const [stage, setStage] = useState<Stage>("setup");
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [activeTurn, setActiveTurn] = useState(0);
  const [remainingTimes, setRemainingTimes] = useState([
    TURN_TIME_SECONDS,
    TURN_TIME_SECONDS,
  ]);
  const [roscos, setRoscos] = useState<PlayerRosco[]>([]);
  const [showAnswer, setShowAnswer] = useState(false);

  const activeRosco = roscos[activeTurn];
  const currentCell = activeRosco?.cells[activeRosco.currentIndex];
  const correctCount =
    activeRosco?.cells.filter((cell) => cell.status === "correct").length ?? 0;
  const pendingCount =
    activeRosco?.cells.filter((cell) => cell.status === "pending").length ?? 0;
  const secondsLeft = remainingTimes[activeTurn] ?? 0;

  useEffect(() => {
    if (stage !== "handoff") return;
    const timer = window.setTimeout(
      () => setStage("playing"),
      HANDOFF_DELAY_MS,
    );
    return () => window.clearTimeout(timer);
  }, [activeTurn, stage]);

  useEffect(() => {
    if (stage !== "playing") return;
    if (secondsLeft <= 0) {
      finishPlayerTurn(activeTurn);
      return;
    }

    const timer = window.setTimeout(() => {
      setRemainingTimes((times) =>
        times.map((time, index) =>
          index === activeTurn ? Math.max(0, time - 1) : time,
        ),
      );
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [activeTurn, roscos, secondsLeft, stage]);

  function togglePlayer(player: string) {
    setSelectedPlayers((current) => {
      if (current.includes(player)) {
        return current.filter((selected) => selected !== player);
      }
      if (current.length >= 2) return current;
      return [...current, player];
    });
  }

  function startMatch() {
    if (selectedPlayers.length !== 2) return;
    setRoscos(selectedPlayers.map(createRosco));
    setActiveTurn(0);
    setRemainingTimes([TURN_TIME_SECONDS, TURN_TIME_SECONDS]);
    setShowAnswer(false);
    setStage("playing");
  }

  function finishPlayerTurn(
    playerIndex: number,
    updatedRoscos: PlayerRosco[] = roscos,
  ) {
    setShowAnswer(false);
    const completedRoscos = updatedRoscos.map((rosco, index) =>
      index === playerIndex ? { ...rosco, finished: true } : rosco,
    );
    setRoscos(completedRoscos);
    const nextPlayer = playerIndex === 0 ? 1 : 0;

    if (!completedRoscos[nextPlayer]?.finished) {
      setActiveTurn(nextPlayer);
      setStage("handoff");
      return;
    }

    if (completedRoscos.every((rosco) => rosco.finished)) {
      setStage("results");
    }
  }

  function markCurrentLetter(status: "correct" | "incorrect" | "passed") {
    if (!activeRosco || !currentCell) return;

    const nextCells = activeRosco.cells.map((cell, index) =>
      index === activeRosco.currentIndex
        ? {
            ...cell,
            status: status === "passed" ? cell.status : status,
            passed: status === "passed",
          }
        : cell,
    );
    const nextIndex = getNextPendingIndex(nextCells, activeRosco.currentIndex);

    const updatedRosco = {
      ...activeRosco,
      cells: nextCells,
      currentIndex: nextIndex === -1 ? activeRosco.currentIndex : nextIndex,
    };
    const updatedRoscos = roscos.map((rosco, index) =>
      index === activeTurn ? updatedRosco : rosco,
    );
    setRoscos(updatedRoscos);
    setShowAnswer(false);

    if (nextIndex === -1) {
      finishPlayerTurn(activeTurn, updatedRoscos);
    } else if (status === "passed") {
      const nextPlayer = activeTurn === 0 ? 1 : 0;
      if (!updatedRoscos[nextPlayer]?.finished) {
        setActiveTurn(nextPlayer);
        setStage("handoff");
      }
    }
  }

  function selectLetter(index: number) {
    if (!activeRosco || activeRosco.cells[index]?.status !== "pending") return;
    setRoscos((current) =>
      current.map((rosco, turnIndex) =>
        turnIndex === activeTurn
          ? { ...rosco, currentIndex: index }
          : rosco,
      ),
    );
    setShowAnswer(false);
  }

  const resultRows = roscos.map((rosco) => ({
    player: rosco.player,
    correct: rosco.cells.filter((cell) => cell.status === "correct").length,
    incorrect: rosco.cells.filter((cell) => cell.status === "incorrect").length,
    pending: rosco.cells.filter((cell) => cell.status === "pending").length,
  }));
  const firstResult = resultRows[0];
  const secondResult = resultRows[1];
  const winner =
    firstResult && secondResult
      ? firstResult.correct === secondResult.correct
        ? null
        : firstResult.correct > secondResult.correct
          ? firstResult.player
          : secondResult.player
      : null;

  return (
    <main className="min-h-screen bg-cream px-5 pb-10 pt-5 sm:px-8 sm:pt-8">
      <div className="mx-auto max-w-4xl">
        <header className="mb-7 flex items-center justify-between gap-3">
          <button
            className="rounded-full border-2 border-ink bg-white px-4 py-3 font-extrabold shadow-comic-sm"
            onClick={onBack}
            type="button"
          >
            ← <span className="hidden sm:inline">Menú</span>
          </button>
          <h1 className="truncate text-right font-display text-xl font-semibold sm:text-2xl">
            Pasapalabra 🔤
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
          <section aria-labelledby="pasapalabra-title">
            <div className="mb-5 text-center">
              <p className="text-sm font-extrabold uppercase tracking-widest text-ink/55">
                Duelo de dos · rosco clásico de 27 letras
              </p>
              <h2
                className="mt-1 font-display text-4xl font-semibold"
                id="pasapalabra-title"
              >
                ¿Quién completa más?
              </h2>
            </div>
            <div className="rounded-3xl border-2 border-ink bg-white p-5 shadow-comic sm:p-8">
              <p className="font-semibold text-ink/70">
                Selecciona dos jugadores. Un narrador externo lee las pistas y
                decide si la respuesta es correcta. Cada persona tiene dos
                minutos de juego efectivo; al decir «Pasapalabra», su reloj se
                pausa y entra el otro jugador.
              </p>
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {players.map((player) => {
                  const selected = selectedPlayers.includes(player);
                  const disabled = !selected && selectedPlayers.length >= 2;
                  return (
                    <button
                      aria-pressed={selected}
                      className={`min-w-0 break-words rounded-2xl border-2 border-ink px-3 py-3 text-left font-extrabold shadow-comic-sm disabled:cursor-not-allowed disabled:opacity-40 ${
                        selected
                          ? ["bg-bubblegum", "bg-mint"][selectedPlayers.indexOf(player)]
                          : "bg-white"
                      }`}
                      disabled={disabled}
                      key={player}
                      onClick={() => togglePlayer(player)}
                      type="button"
                    >
                      {selected ? "☑ " : "☐ "}
                      {player}
                    </button>
                  );
                })}
              </div>
              {players.length < 2 && (
                <p className="mt-4 rounded-2xl border-2 border-ink bg-mustard p-4 font-bold">
                  Añade al menos dos jugadores para enfrentarse.
                </p>
              )}

              <div className="mt-5 rounded-2xl border-2 border-ink bg-sky p-4 text-sm font-semibold">
                La persona que narra lee las pistas y juzga las respuestas. La
                app controla los dos minutos individuales y alterna jugadores
                al pulsar «Pasapalabra».
              </div>
              <button
                className="mt-6 w-full rounded-full border-2 border-ink bg-bubblegum px-6 py-4 font-display text-2xl font-semibold shadow-comic disabled:cursor-not-allowed disabled:opacity-45"
                disabled={selectedPlayers.length !== 2}
                onClick={startMatch}
                type="button"
              >
                ¡Empezar el duelo! 🔤
              </button>
            </div>
          </section>
        )}

        {stage === "handoff" && activeRosco && (
          <section
            aria-live="assertive"
            className="turn-handoff mx-auto max-w-xl rounded-3xl border-2 border-ink bg-white p-6 text-center shadow-comic"
          >
            <div
              aria-hidden="true"
              className="turn-handoff-icon mx-auto grid h-16 w-16 place-items-center rounded-full border-2 border-ink bg-mustard text-4xl shadow-comic-sm"
            >
              🔤
            </div>
            <p className="mt-4 font-display text-2xl font-semibold">
              ¡Pasapalabra!
            </p>
          </section>
        )}

        {stage === "playing" && activeRosco && currentCell && (
          <section aria-label={`Rosco de ${activeRosco.player}`}>
            <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-display text-xl font-semibold">
                  Turno de {activeRosco.player}
                </p>
                <p className="text-sm font-bold text-ink/60">
                  Aciertos: {correctCount} · Pendientes: {pendingCount}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full border-2 border-ink bg-white px-3 py-2 text-xs font-extrabold shadow-comic-sm">
                  🎙️ Narrador
                </span>
                <span
                  aria-label={`${Math.floor(secondsLeft / 60)} minutos y ${secondsLeft % 60} segundos restantes para ${activeRosco.player}`}
                  className={`rounded-full border-2 border-ink px-4 py-2 font-display text-2xl font-bold shadow-comic-sm ${
                    secondsLeft <= 10 ? "bg-coral" : "bg-mustard"
                  }`}
                  role="timer"
                >
                  {Math.floor(secondsLeft / 60)}:
                  {String(secondsLeft % 60).padStart(2, "0")}
                </span>
              </div>
            </header>

            <div
              aria-label="Rosco circular: selecciona una letra pendiente"
              className="relative mx-auto mb-6 aspect-square w-full max-w-[360px]"
            >
              <div
                aria-hidden="true"
                className="absolute inset-[8%] rounded-full border-2 border-dashed border-ink/25"
              />
              {activeRosco.cells.map((cell, index) => {
                const angle = (index / activeRosco.cells.length) * Math.PI * 2;
                const isCurrent = index === activeRosco.currentIndex;
                const left = 50 + 45 * Math.sin(angle);
                const top = 50 - 45 * Math.cos(angle);
                const statusLabel =
                  cell.status === "correct"
                    ? "acertada"
                    : cell.status === "incorrect"
                      ? "fallada"
                      : cell.passed
                        ? "pasada"
                        : "pendiente";

                return (
                  <button
                    aria-label={`${cell.letter}: ${statusLabel}${isCurrent ? ", actual" : ""}`}
                    aria-pressed={isCurrent}
                    className={`absolute grid h-7 w-7 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-ink text-[11px] font-extrabold shadow-comic-sm transition-transform sm:h-9 sm:w-9 sm:text-sm ${
                      cell.status === "correct"
                        ? "bg-mint"
                        : cell.status === "incorrect"
                          ? "bg-coral"
                          : isCurrent
                            ? "z-10 scale-125 bg-mustard"
                            : cell.passed
                              ? "bg-sky"
                              : "bg-white"
                    }`}
                    disabled={cell.status !== "pending"}
                    key={cell.letter}
                    onClick={() => selectLetter(index)}
                    style={{ left: `${left}%`, top: `${top}%` }}
                    type="button"
                  >
                    {cell.letter}
                  </button>
                );
              })}

              <div className="absolute left-1/2 top-1/2 flex w-[42%] -translate-x-1/2 -translate-y-1/2 flex-col items-center text-center">
                <p className="text-[10px] font-extrabold uppercase leading-tight text-ink/55 sm:text-xs">
                  Rosco de
                </p>
                <p className="max-h-12 overflow-hidden break-words font-display text-sm font-semibold leading-tight sm:text-base">
                  {activeRosco.player}
                </p>
                <p className="mt-1 text-xs font-extrabold text-ink/60">
                  {correctCount}/27
                </p>
              </div>
            </div>

            <article className="rounded-3xl border-2 border-ink bg-white p-5 shadow-comic sm:p-8">
              <div className="mb-5 flex items-center gap-3">
                <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full border-2 border-ink bg-mustard font-display text-3xl font-bold shadow-comic-sm">
                  {currentCell.letter}
                </span>
                <p className="font-display text-xl font-semibold leading-snug sm:text-2xl">
                  {currentCell.clue}
                </p>
              </div>
              <button
                aria-expanded={showAnswer}
                className="mb-4 rounded-full border-2 border-ink bg-sky px-4 py-2 text-sm font-extrabold shadow-comic-sm"
                onClick={() => setShowAnswer((visible) => !visible)}
                type="button"
              >
                {showAnswer ? "Ocultar respuesta" : "Respuesta para el narrador"}
              </button>
              {showAnswer && (
                <p className="mb-4 rounded-2xl border-2 border-ink bg-mint p-3 font-extrabold">
                  {currentCell.answer}
                </p>
              )}

              <p className="mb-3 text-sm font-bold text-ink/60">
                El narrador marca el resultado de la respuesta:
              </p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  className="rounded-full border-2 border-ink bg-mint px-4 py-3 font-extrabold shadow-comic-sm"
                  onClick={() => markCurrentLetter("correct")}
                  type="button"
                >
                  ✅ Acierto
                </button>
                <button
                  className="rounded-full border-2 border-ink bg-coral px-4 py-3 font-extrabold shadow-comic-sm"
                  onClick={() => markCurrentLetter("incorrect")}
                  type="button"
                >
                  ❌ Fallo
                </button>
                <button
                  className="col-span-2 rounded-full border-2 border-ink bg-sky px-4 py-3 font-extrabold shadow-comic-sm"
                  onClick={() => markCurrentLetter("passed")}
                  type="button"
                >
                  Pasapalabra · pasar turno ⏭️
                </button>
              </div>
            </article>
          </section>
        )}

        {stage === "results" && firstResult && secondResult && (
          <section className="rounded-3xl border-2 border-ink bg-white p-6 text-center shadow-comic sm:p-10">
            <span className="text-7xl">{winner ? "🏆" : "🤝"}</span>
            <p className="mt-3 text-sm font-extrabold uppercase tracking-widest text-ink/55">
              Final del duelo
            </p>
            <h2 className="mt-1 break-words font-display text-4xl font-semibold">
              {winner ? `¡${winner} gana!` : "¡Empate!"}
            </h2>
            <p className="mt-3 font-semibold text-ink/65">
              {firstResult.player}: {firstResult.correct} aciertos ·{" "}
              {firstResult.incorrect} fallos · {firstResult.pending} pendientes
              <br />
              {secondResult.player}: {secondResult.correct} aciertos ·{" "}
              {secondResult.incorrect} fallos · {secondResult.pending} pendientes
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <button
                className="flex-1 rounded-full border-2 border-ink bg-mustard px-5 py-4 font-extrabold shadow-comic-sm"
                onClick={() => {
                  setStage("setup");
                  setRoscos([]);
                  setActiveTurn(0);
                }}
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
