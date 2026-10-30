import { useState } from "react";
import AssassinGame from "./components/AssassinGame";
import CharadesGame from "./components/CharadesGame";
import GameScreen from "./components/GameScreen";
import ImpostorGame from "./components/ImpostorGame";
import PlayersModal from "./components/PlayersModal";
import TruthDareGame from "./components/TruthDareGame";
import { usePlayers } from "./state/PlayersContext";

const gameModes = [
  {
    title: "¿Qué prefieres?",
    description: "Dilemas imposibles y decisiones cuestionables.",
    emoji: "🤔",
    color: "bg-bubblegum",
    tilt: "-rotate-[1deg]",
  },
  {
    title: "El Impostor",
    description: "Descubre quién está colando la trola.",
    emoji: "🕵️",
    color: "bg-mustard",
    tilt: "rotate-[1deg]",
  },
  {
    title: "El Asesino",
    description: "Reparte roles secretos y juega la partida con narrador.",
    emoji: "🔪",
    color: "bg-coral",
    tilt: "-rotate-[1deg]",
  },
  {
    title: "¿Quién es más probable que...?",
    description: "Señala a tus amigos. Luego niega haberlo hecho.",
    emoji: "👉",
    color: "bg-mint",
    tilt: "-rotate-[1deg]",
  },
  {
    title: "Verdad o Reto + Ruleta",
    description: "La suerte está echada. La dignidad, no tanto.",
    emoji: "🎡",
    color: "bg-sky",
    tilt: "rotate-[1deg]",
  },
  {
    title: "Charadas",
    description: "Mímica contrarreloj: adivina antes de que se te acabe el tiempo.",
    emoji: "🎭",
    color: "bg-coral",
    tilt: "-rotate-[1deg]",
  },
  {
    title: "Pasapalabra",
    description: "Adivina palabras antes de completar el rosco.",
    emoji: "🔤",
    color: "bg-sky",
    tilt: "rotate-[1deg]",
    status: "upcoming",
  },
  {
    title: "Palabras clave",
    description: "Da pistas y conecta palabras sin revelar demasiado.",
    emoji: "🗝️",
    color: "bg-mustard",
    tilt: "-rotate-[1deg]",
    status: "upcoming",
  },
  {
    title: "Teléfono descompuesto",
    description: "Pasa el mensaje y descubre cómo termina la historia.",
    emoji: "📞",
    color: "bg-mint",
    tilt: "rotate-[1deg]",
    status: "upcoming",
  },
  {
    title: "Yo nunca nunca",
    description: "Confesiones, anécdotas y dedos acusadores.",
    emoji: "🙈",
    color: "bg-bubblegum",
    tilt: "-rotate-[1deg]",
    status: "upcoming",
  },
  {
    title: "Tabú (Taboo)",
    description: "Haz que adivinen la palabra sin decir lo prohibido.",
    emoji: "🤐",
    color: "bg-coral",
    tilt: "rotate-[1deg]",
    status: "upcoming",
  },
  {
    title: "King's Cup",
    description: "Una baraja, reglas de grupo y una copa en el centro.",
    emoji: "👑",
    color: "bg-mustard",
    tilt: "-rotate-[1deg]",
    status: "upcoming",
  },
];

export default function App() {
  const { players } = usePlayers();
  const [isPlayersOpen, setIsPlayersOpen] = useState(false);
  const [pendingMode, setPendingMode] = useState<string | null>(null);
  const [selectedMode, setSelectedMode] = useState<string | null>(null);

  function selectMode(mode: string) {
    setSelectedMode(null);
    if (players.length < 3) {
      setPendingMode(mode);
      setIsPlayersOpen(true);
      return;
    }
    setSelectedMode(mode);
  }

  function continueToMode() {
    if (!pendingMode || players.length < 3) return;
    setSelectedMode(pendingMode);
    setPendingMode(null);
    setIsPlayersOpen(false);
  }

  function openPlayers() {
    setPendingMode(null);
    setIsPlayersOpen(true);
  }

  if (selectedMode === "El Impostor") {
    return (
      <>
        <ImpostorGame
          onBack={() => setSelectedMode(null)}
          onManagePlayers={openPlayers}
        />
        {isPlayersOpen && (
          <PlayersModal
            onClose={() => setIsPlayersOpen(false)}
            onContinue={() => setIsPlayersOpen(false)}
            pendingMode={null}
          />
        )}
      </>
    );
  }

  if (selectedMode === "El Asesino") {
    return (
      <>
        <AssassinGame
          onBack={() => setSelectedMode(null)}
          onManagePlayers={openPlayers}
        />
        {isPlayersOpen && (
          <PlayersModal
            onClose={() => setIsPlayersOpen(false)}
            onContinue={() => setIsPlayersOpen(false)}
            pendingMode={null}
          />
        )}
      </>
    );
  }

  if (selectedMode === "Verdad o Reto + Ruleta") {
    return (
      <>
        <TruthDareGame
          onBack={() => setSelectedMode(null)}
          onManagePlayers={openPlayers}
        />
        {isPlayersOpen && (
          <PlayersModal
            onClose={() => setIsPlayersOpen(false)}
            onContinue={() => setIsPlayersOpen(false)}
            pendingMode={null}
          />
        )}
      </>
    );
  }

  if (selectedMode === "Charadas") {
    return (
      <>
        <CharadesGame
          onBack={() => setSelectedMode(null)}
          onManagePlayers={openPlayers}
        />
        {isPlayersOpen && (
          <PlayersModal
            onClose={() => setIsPlayersOpen(false)}
            onContinue={() => setIsPlayersOpen(false)}
            pendingMode={null}
          />
        )}
      </>
    );
  }

  if (
    selectedMode === "¿Qué prefieres?" ||
    selectedMode === "¿Quién es más probable que...?"
  ) {
    return (
      <>
        <GameScreen
          mode={selectedMode}
          onBack={() => setSelectedMode(null)}
          onManagePlayers={openPlayers}
        />
        {isPlayersOpen && (
          <PlayersModal
            onClose={() => setIsPlayersOpen(false)}
            onContinue={() => setIsPlayersOpen(false)}
            pendingMode={null}
          />
        )}
      </>
    );
  }

  return (
    <main className="min-h-screen overflow-hidden bg-cream px-5 pb-12 pt-6 sm:px-8 sm:pt-10">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <span className="absolute -right-10 top-28 text-6xl opacity-30">✳</span>
        <span className="absolute -left-4 top-[27rem] text-5xl opacity-30">✦</span>
        <span className="absolute bottom-16 right-5 text-5xl opacity-30">〰</span>
      </div>

      <div className="relative mx-auto max-w-3xl">
        <header className="mb-10 flex items-center justify-between gap-4">
          <a aria-label="La Última Ronda, inicio" className="flex items-center gap-3" href="/">
            <span className="grid h-12 w-12 place-items-center rounded-2xl border-2 border-ink bg-mustard text-2xl shadow-comic-sm">
              🍻
            </span>
            <span className="font-display text-xl font-semibold leading-5 sm:text-2xl">
              La Última
              <br />
              Ronda
            </span>
          </a>
          <button
            className="rounded-full border-2 border-ink bg-white px-4 py-3 font-extrabold shadow-comic-sm transition-transform hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-none"
            onClick={openPlayers}
            type="button"
          >
            <span aria-hidden="true">👥 </span>
            <span className="hidden sm:inline">Jugadores</span>
            <span className="sm:hidden">{players.length}</span>
          </button>
        </header>

        <section aria-labelledby="page-title" className="mb-8">
          <p className="mb-3 inline-flex -rotate-2 rounded-full border-2 border-ink bg-coral px-4 py-1.5 text-xs font-extrabold tracking-widest shadow-comic-sm">
            CERO DRAMA. MUCHA BOCA.
          </p>
          <h1
            className="max-w-2xl font-display text-5xl font-semibold leading-[0.98] sm:text-7xl"
            id="page-title"
          >
            Se viene
            <br />
            <span className="relative inline-block">
              la ronda
              <span aria-hidden="true" className="absolute -bottom-1 left-0 -z-10 h-3 w-full -rotate-2 bg-bubblegum" />
            </span>
            <span className="text-coral">.</span>
          </h1>
          <p className="mt-5 max-w-lg text-base font-semibold leading-relaxed text-ink/70 sm:text-lg">
            Elige un juego, reúne a tu gente y que alguien se arrepienta mañana.
          </p>
        </section>

        <section aria-labelledby="modes-title">
          <div className="mb-4 flex items-end justify-between gap-3">
            <h2 className="font-display text-2xl font-semibold" id="modes-title">
              Elige vuestro veneno
            </h2>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-extrabold">
              {gameModes.length} MODOS
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {gameModes.map((mode) => (
              <button
                aria-label={
                  mode.status === "upcoming"
                    ? `${mode.title}, en desarrollo`
                    : `Seleccionar ${mode.title}`
                }
                className={`group flex min-h-40 flex-col items-start rounded-3xl border-2 border-ink p-5 text-left shadow-comic transition duration-150 ${
                  mode.status === "upcoming"
                    ? "cursor-not-allowed opacity-75"
                    : "hover:-translate-y-1 hover:rotate-0 hover:shadow-[6px_6px_0px_0px_rgba(30,30,30,1)] active:translate-x-1 active:translate-y-1 active:shadow-none"
                } ${mode.color} ${mode.tilt}`}
                disabled={mode.status === "upcoming"}
                key={mode.title}
                onClick={() => {
                  if (mode.status !== "upcoming") selectMode(mode.title);
                }}
                type="button"
              >
                <span className="mb-3 flex w-full items-center justify-between">
                  <span className="grid h-12 w-12 place-items-center rounded-2xl border-2 border-ink bg-white text-2xl">
                    {mode.emoji}
                  </span>
                  {mode.status === "upcoming" ? (
                    <span className="rounded-full border-2 border-ink bg-white px-3 py-1 text-xs font-extrabold uppercase tracking-wide shadow-comic-sm">
                      En desarrollo
                    </span>
                  ) : (
                    <span aria-hidden="true" className="text-2xl font-black transition-transform group-hover:translate-x-1">
                      ↗
                    </span>
                  )}
                </span>
                <span className="font-display text-2xl font-semibold leading-tight">
                  {mode.title}
                </span>
                <span className="mt-1 text-sm font-semibold text-ink/70">
                  {mode.description}
                </span>
              </button>
            ))}
          </div>
        </section>

        <section
          aria-label="Estado de la partida"
          className="mt-8 rounded-3xl border-2 border-ink bg-white p-5 shadow-comic-sm sm:flex sm:items-center sm:justify-between sm:gap-4"
        >
          <div>
            <p className="font-display text-xl font-semibold">
              {selectedMode ? `¡${selectedMode}!` : "¿Ya está toda la banda?"}
            </p>
            <p aria-live="polite" className="mt-1 text-sm font-semibold text-ink/65">
              {selectedMode
                ? "Modo seleccionado. Las partidas llegan en la siguiente fase."
                : players.length >= 3
                  ? `${players.length} jugadores listos para el desmadre.`
                  : `Hace falta un mínimo de 3 jugadores. Ahora sois ${players.length}.`}
            </p>
          </div>
          <button
            className="mt-4 w-full rounded-full border-2 border-ink bg-mustard px-5 py-3 font-extrabold shadow-comic-sm transition-transform hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-none sm:mt-0 sm:w-auto"
            onClick={openPlayers}
            type="button"
          >
            {players.length ? "Gestionar jugadores" : "Añadir jugadores"}
          </button>
        </section>

        <footer className="mt-8 text-center text-xs font-bold tracking-wide text-ink/45">
          SOLO PARA MAYORES · NO SE ACEPTAN RECLAMACIONES
        </footer>
      </div>

      {isPlayersOpen && (
        <PlayersModal
          onClose={() => {
            setPendingMode(null);
            setIsPlayersOpen(false);
          }}
          onContinue={continueToMode}
          pendingMode={pendingMode}
        />
      )}
    </main>
  );
}
