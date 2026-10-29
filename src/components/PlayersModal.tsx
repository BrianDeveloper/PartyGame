import { useState, type FormEvent } from "react";
import { usePlayers } from "../state/PlayersContext";

const chipColors = [
  "bg-bubblegum",
  "bg-mint",
  "bg-mustard",
  "bg-sky",
  "bg-coral",
];

type PlayersModalProps = {
  onClose: () => void;
  pendingMode: string | null;
  onContinue: () => void;
};

export default function PlayersModal({
  onClose,
  pendingMode,
  onContinue,
}: PlayersModalProps) {
  const { players, addPlayer, removePlayer } = usePlayers();
  const [name, setName] = useState("");
  const [feedback, setFeedback] = useState("");
  const canStart = players.length >= 3;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) {
      setFeedback("Escribe un nombre antes de añadirlo.");
      return;
    }
    if (!addPlayer(cleanName)) {
      setFeedback("Ese nombre ya está en la lista.");
      return;
    }

    setName("");
    setFeedback("");
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 p-0 sm:items-center sm:p-5"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        aria-labelledby="players-title"
        aria-modal="true"
        className="w-full max-w-lg rounded-t-[2rem] border-2 border-ink bg-white p-6 shadow-comic sm:rounded-[2rem] sm:p-8"
        role="dialog"
      >
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="mb-1 text-sm font-extrabold uppercase tracking-wider text-ink/60">
              La pandilla
            </p>
            <h2
              className="font-display text-3xl font-semibold leading-tight"
              id="players-title"
            >
              ¿Quién juega?
            </h2>
          </div>
          <button
            aria-label="Cerrar gestión de jugadores"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full border-2 border-ink bg-cream text-xl font-bold shadow-comic-sm transition-transform hover:-translate-y-0.5"
            onClick={onClose}
            type="button"
          >
            ×
          </button>
        </div>

        <form className="flex gap-2" onSubmit={handleSubmit}>
          <label className="sr-only" htmlFor="player-name">
            Nombre del jugador
          </label>
          <input
            autoFocus
            className="min-w-0 flex-1 rounded-full border-2 border-ink bg-cream px-5 py-3 font-semibold outline-none placeholder:text-ink/45 focus:ring-2 focus:ring-bubblegum"
            id="player-name"
            maxLength={24}
            onChange={(event) => setName(event.target.value)}
            placeholder="Ej. La prima del Javi"
            value={name}
          />
          <button
            className="rounded-full border-2 border-ink bg-mustard px-5 py-3 font-extrabold shadow-comic-sm transition-transform hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-none"
            type="submit"
          >
            Añadir
          </button>
        </form>

        <p aria-live="polite" className="mt-2 min-h-5 text-sm font-semibold text-coral">
          {feedback}
        </p>

        <div className="mt-3 min-h-24">
          {players.length ? (
            <ul aria-label="Jugadores añadidos" className="flex flex-wrap gap-3">
              {players.map((player, index) => (
                <li
                  className={`flex max-w-full items-center gap-2 rounded-full border-2 border-ink px-4 py-2 font-bold shadow-[2px_2px_0px_0px_rgba(30,30,30,1)] ${chipColors[index % chipColors.length]}`}
                  key={player}
                >
                  <span className="min-w-0 break-all">{player}</span>
                  <button
                    aria-label={`Eliminar a ${player}`}
                    className="grid h-6 w-6 place-items-center rounded-full border border-ink bg-white/70 text-sm leading-none hover:bg-white"
                    onClick={() => removePlayer(player)}
                    type="button"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-2xl border-2 border-dashed border-ink/30 px-4 py-6 text-center font-semibold text-ink/60">
              Aún no hay nadie. Qué triste.
            </p>
          )}
        </div>

        <div className="mt-4 rounded-2xl bg-cream p-4">
          <p className="font-bold">
            {players.length} {players.length === 1 ? "jugador" : "jugadores"}{" "}
            apuntados
          </p>
          <p className="mt-1 text-sm font-medium text-ink/70">
            {canStart
              ? "Ya podéis montar una buena."
              : `Necesitáis ${3 - players.length} ${
                  3 - players.length === 1 ? "jugador más" : "jugadores más"
                } para jugar.`}
          </p>
        </div>

        <button
          className="mt-5 w-full rounded-full border-2 border-ink bg-mint px-6 py-4 font-extrabold shadow-comic transition-transform hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-none disabled:cursor-not-allowed disabled:bg-ink/10 disabled:text-ink/45 disabled:shadow-none disabled:hover:translate-y-0"
          disabled={Boolean(pendingMode) && !canStart}
          onClick={pendingMode && canStart ? onContinue : onClose}
          type="button"
        >
          {pendingMode
            ? canStart
              ? `Continuar con ${pendingMode}`
              : "Añade al menos 3 jugadores"
            : "Listo, volver al menú"}
        </button>
      </section>
    </div>
  );
}
