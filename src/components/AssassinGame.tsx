import { useEffect, useState } from "react";
import assassinData from "../data/assassin.json";
import { usePlayers } from "../state/PlayersContext";

type Role = "assassin" | "detective" | "doctor" | "civilian";
type Phase = "setup" | "deal" | "complete";

const minimumPlayers = 4;
const maximumPlayers = 8;
const playerColors = [
  "bg-bubblegum",
  "bg-mustard",
  "bg-mint",
  "bg-sky",
  "bg-coral",
];
const roleDetails = assassinData.roles as Record<
  Role,
  { name: string; emoji: string; color: string; instruction: string }
>;

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

export default function AssassinGame({
  onBack,
  onManagePlayers,
}: {
  onBack: () => void;
  onManagePlayers: () => void;
}) {
  const { players } = usePlayers();
  const [phase, setPhase] = useState<Phase>("setup");
  const [selectedPlayers, setSelectedPlayers] = useState(() =>
    players.slice(0, maximumPlayers),
  );
  const [doctorEnabled, setDoctorEnabled] = useState(false);
  const [roundPlayers, setRoundPlayers] = useState<string[]>([]);
  const [roles, setRoles] = useState<Record<string, Role>>({});
  const [turnIndex, setTurnIndex] = useState(0);
  const [isRevealed, setIsRevealed] = useState(false);
  const [hasRevealedTurn, setHasRevealedTurn] = useState(false);

  useEffect(() => {
    setSelectedPlayers((current) => {
      const currentAvailable = current.filter((player) =>
        players.includes(player),
      );
      const newlyAvailable = players.filter(
        (player) => !currentAvailable.includes(player),
      );
      return [...currentAvailable, ...newlyAvailable].slice(0, maximumPlayers);
    });
  }, [players]);

  const currentPlayer = roundPlayers[turnIndex];
  const roleCounts = {
    doctor: doctorEnabled ? 1 : 0,
    civilian: selectedPlayers.length - 2 - (doctorEnabled ? 1 : 0),
  };

  function togglePlayer(player: string) {
    setSelectedPlayers((current) => {
      if (current.includes(player)) {
        return current.filter((selected) => selected !== player);
      }
      if (current.length >= maximumPlayers) return current;
      return [...current, player];
    });
  }

  function startGame() {
    if (
      selectedPlayers.length < minimumPlayers ||
      selectedPlayers.length > maximumPlayers ||
      (doctorEnabled && selectedPlayers.length < 5)
    ) {
      return;
    }

    const order = shuffle(selectedPlayers);
    const assignedRoles = shuffle<Role>([
      "assassin",
      "detective",
      ...(doctorEnabled ? (["doctor"] as Role[]) : []),
      ...Array.from(
        { length: order.length - 2 - (doctorEnabled ? 1 : 0) },
        () => "civilian" as Role,
      ),
    ]);

    setRoundPlayers(order);
    setRoles(
      Object.fromEntries(
        order.map((player, index) => [player, assignedRoles[index]]),
      ),
    );
    setTurnIndex(0);
    setIsRevealed(false);
    setHasRevealedTurn(false);
    setPhase("deal");
  }

  function revealRole() {
    if (!isRevealed) setIsRevealed(true);
  }

  function hideRole() {
    if (isRevealed) setHasRevealedTurn(true);
    setIsRevealed(false);
  }

  function passRolePhone() {
    if (turnIndex + 1 >= roundPlayers.length) {
      setPhase("complete");
      return;
    }
    setIsRevealed(false);
    setHasRevealedTurn(false);
    setTurnIndex((index) => index + 1);
  }

  return (
    <GameLayout
      onBack={onBack}
      onManagePlayers={onManagePlayers}
      playerCount={players.length}
      title="El Asesino"
    >
      {phase === "setup" && (
        <section aria-labelledby="assassin-setup-title">
          <div className="mb-5 text-center">
            <p className="text-sm font-extrabold uppercase tracking-widest text-ink/55">
              Repartidor de roles · teléfono compartido
            </p>
            <h2
              className="mt-1 font-display text-4xl font-semibold"
              id="assassin-setup-title"
            >
              Configura la partida
            </h2>
          </div>

          <div className="rounded-3xl border-2 border-ink bg-white p-5 shadow-comic sm:p-7">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-display text-2xl font-semibold">
                  Elige a la banda
                </h3>
                <p className="mt-1 text-sm font-semibold text-ink/60">
                  De 4 a 8 jugadores · {selectedPlayers.length} seleccionados
                </p>
              </div>
              <button
                aria-label={`Gestionar jugadores, ${players.length} apuntados`}
                className="shrink-0 rounded-full border-2 border-ink bg-mustard px-4 py-2 font-extrabold shadow-comic-sm"
                onClick={onManagePlayers}
                type="button"
              >
                👥 {players.length}
              </button>
            </div>

            {players.length === 0 ? (
              <p className="mt-5 rounded-2xl border-2 border-ink bg-mustard p-4 font-bold">
                Añade jugadores para preparar la partida.
              </p>
            ) : (
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {players.map((player, index) => {
                  const selected = selectedPlayers.includes(player);
                  const disabled =
                    !selected && selectedPlayers.length >= maximumPlayers;
                  return (
                    <button
                      aria-pressed={selected}
                      className={`min-w-0 break-words rounded-2xl border-2 border-ink px-3 py-3 text-left font-extrabold shadow-comic-sm disabled:cursor-not-allowed disabled:opacity-40 ${
                        selected
                          ? playerColors[index % playerColors.length]
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
            )}

            <div className="mt-6 rounded-2xl border-2 border-ink bg-cream p-4">
              <h3 className="font-display text-xl font-semibold">
                Roles de esta partida
              </h3>
              <ul className="mt-3 grid gap-2 text-sm font-semibold sm:grid-cols-2">
                <li>🔪 1 Asesino</li>
                <li>🔍 1 Detective</li>
                <li>👥 {roleCounts.civilian} Civiles</li>
                <li>🩺 {doctorEnabled ? "1 Médico" : "Médico desactivado"}</li>
              </ul>
              <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border-2 border-ink bg-white p-3 font-bold">
                <input
                  checked={doctorEnabled}
                  className="mt-1 h-5 w-5 accent-emerald-500"
                  onChange={(event) => setDoctorEnabled(event.target.checked)}
                  type="checkbox"
                />
                <span>
                  Incluir Médico
                  <span className="mt-1 block text-xs font-semibold text-ink/60">
                    Puede salvar a alguien cada noche, pero no repetir a quien
                    protegió la noche anterior.
                  </span>
                </span>
              </label>
              {doctorEnabled && selectedPlayers.length < 5 && (
                <p className="mt-2 text-sm font-bold text-coral">
                  Para incluir al Médico hacen falta al menos 5 jugadores.
                </p>
              )}
            </div>

            <details className="mt-5 rounded-2xl border-2 border-ink bg-sky p-4">
              <summary className="cursor-pointer font-extrabold">
                📖 Resumen de reglas
              </summary>
              <RulesSummary doctorEnabled={doctorEnabled} />
            </details>

            <div className="mt-5 rounded-2xl border-2 border-ink bg-bubblegum p-4 text-sm font-semibold">
              La app solo reparte los roles: para jugar la partida hace falta un
              narrador externo. Idealmente, que no sea uno de los jugadores.
            </div>

            <button
              className="mt-6 w-full rounded-full border-2 border-ink bg-coral px-6 py-4 font-display text-2xl font-semibold shadow-comic disabled:cursor-not-allowed disabled:opacity-45"
              disabled={
                selectedPlayers.length < minimumPlayers ||
                (doctorEnabled && selectedPlayers.length < 5)
              }
              onClick={startGame}
              type="button"
            >
              Repartir roles 🔒
            </button>
          </div>
        </section>
      )}

      {phase === "deal" && currentPlayer && (
        <section aria-live="polite">
          <StepHeading
            eyebrow={`Reparto de roles · ${turnIndex + 1} de ${roundPlayers.length}`}
            title={`Pásale el móvil a ${currentPlayer}`}
            description="Que nadie mire la pantalla por encima del hombro."
          />
          <div className="rounded-3xl border-2 border-ink bg-white p-5 shadow-comic sm:p-8">
            <button
              aria-label={
                isRevealed
                  ? `Rol de ${currentPlayer} revelado`
                  : `Mantener para revelar el rol de ${currentPlayer}`
              }
              className={`flex min-h-56 w-full select-none flex-col items-center justify-center rounded-3xl border-2 border-ink px-5 py-8 text-center shadow-comic active:translate-y-1 active:shadow-none ${
                isRevealed ? roleDetails[roles[currentPlayer]].color : "bg-mustard"
              }`}
              onContextMenu={(event) => event.preventDefault()}
              onPointerCancel={hideRole}
              onPointerDown={(event) => {
                event.preventDefault();
                event.currentTarget.setPointerCapture(event.pointerId);
                revealRole();
              }}
              onPointerUp={hideRole}
              onKeyDown={(event) => {
                if (
                  event.repeat ||
                  (event.key !== " " && event.key !== "Enter")
                ) {
                  return;
                }
                event.preventDefault();
                revealRole();
              }}
              onKeyUp={(event) => {
                if (event.key === " " || event.key === "Enter") {
                  event.preventDefault();
                  hideRole();
                }
              }}
              type="button"
            >
              {isRevealed ? (
                <>
                  <span className="text-6xl">
                    {roleDetails[roles[currentPlayer]].emoji}
                  </span>
                  <span className="mt-3 font-display text-3xl font-semibold">
                    {roleDetails[roles[currentPlayer]].name.toUpperCase()}
                  </span>
                  <span className="mt-2 text-sm font-bold">
                    {roleDetails[roles[currentPlayer]].instruction}
                  </span>
                </>
              ) : (
                <>
                  <span className="text-5xl">🕵️</span>
                  <span className="mt-4 font-display text-3xl font-semibold">
                    Mantén pulsado para ver tu rol
                  </span>
                  <span className="mt-2 text-sm font-bold text-ink/65">
                    La información desaparece al soltar.
                  </span>
                </>
              )}
            </button>
            {!isRevealed && hasRevealedTurn && (
              <button
                className="mt-5 w-full rounded-full border-2 border-ink bg-mint px-6 py-4 font-extrabold shadow-comic-sm"
                onClick={passRolePhone}
                type="button"
              >
                {turnIndex + 1 === roundPlayers.length
                  ? "Terminar reparto · ¡a jugar!"
                  : "Rol visto · Pasar teléfono"}
              </button>
            )}
          </div>
        </section>
      )}

      {phase === "complete" && (
        <section className="rounded-3xl border-2 border-ink bg-white p-6 text-center shadow-comic sm:p-10">
          <span className="text-7xl">🎭</span>
          <p className="mt-3 text-sm font-extrabold uppercase tracking-widest text-ink/55">
            Reparto completado
          </p>
          <h2 className="mt-1 font-display text-4xl font-semibold">
            ¡Ya podéis empezar!
          </h2>
          <p className="mt-3 font-semibold text-ink/65">
            La app no dirige la partida. Pasad el teléfono al narrador externo y
            jugad alrededor de la mesa.
          </p>
          <div className="mt-6 rounded-2xl border-2 border-ink bg-cream p-4 text-left text-sm font-semibold">
            <p>🌙 El narrador guía la noche y despierta a cada rol.</p>
            <p className="mt-2">
              ☀️ De día, debatid y votad a quién expulsar.
            </p>
            <p className="mt-2">
              🔎 El pueblo gana al expulsar al Asesino; el Asesino gana cuando
              iguala o supera al resto de jugadores vivos.
            </p>
          </div>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <button
              className="flex-1 rounded-full border-2 border-ink bg-mustard px-5 py-4 font-extrabold shadow-comic-sm"
              onClick={startGame}
              type="button"
            >
              Repartir de nuevo
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

function RulesSummary({ doctorEnabled }: { doctorEnabled: boolean }) {
  return (
    <section
      aria-label="Resumen de reglas"
      className="mt-3 rounded-2xl border-2 border-ink bg-white p-4 text-sm"
    >
      <p className="font-bold">
        Hace falta un narrador externo. La app solo asigna roles; el narrador
        organiza las noches, las eliminaciones y las votaciones.
      </p>
      <ul className="mt-3 space-y-2 font-semibold text-ink/75">
        <li>
          🔪 El Asesino elige a una víctima cada noche y trata de no ser
          descubierto.
        </li>
        <li>
          🔍 El Detective investiga a alguien por noche; el narrador le confirma
          en secreto si es el Asesino.
        </li>
        {doctorEnabled && (
          <li>
            🩺 El Médico protege a alguien por noche; no puede repetir objetivo
            en noches consecutivas.
          </li>
        )}
        <li>
          👥 Los demás son Civiles: debaten y votan durante el día para expulsar
          al Asesino.
        </li>
        <li>
          🪦 Quien es eliminado deja de participar y no revela su rol, salvo que
          el grupo acuerde otra regla.
        </li>
        <li>
          🏆 El pueblo gana si expulsa al Asesino. El Asesino gana cuando iguala
          o supera en número al resto de jugadores vivos.
        </li>
      </ul>
    </section>
  );
}

function StepHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="mb-5 text-center">
      <p className="text-sm font-extrabold uppercase tracking-widest text-ink/55">
        {eyebrow}
      </p>
      <h2 className="mt-1 break-words font-display text-4xl font-semibold [overflow-wrap:anywhere]">
        {title}
      </h2>
      <p className="mt-2 font-semibold text-ink/65">{description}</p>
    </div>
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
            {title} 🐺
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
