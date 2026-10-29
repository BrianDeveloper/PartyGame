import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import minigameData from "../data/minigames.json";
import { usePlayers } from "../state/PlayersContext";

const segmentColors = ["#FF9FCB", "#FFD45C", "#9CE8C2", "#9FD8FF", "#FF8D78"];
const challengeColors = {
  verdad: "bg-sky",
  reto: "bg-coral",
};

type ChallengeType = keyof typeof challengeColors;
type Stage = "wheel" | "choice" | "challenge";
type ChallengeCard = {
  id: string;
  category: string;
  intensity: string;
  text: string;
};

const categoryStyles: Record<string, { label: string; emoji: string; color: string }> = {
  chill: { label: "CHILL", emoji: "🧊", color: "bg-mint" },
  picante: { label: "PICANTE", emoji: "🔥", color: "bg-bubblegum" },
  escatologico: { label: "ESCATOLÓGICO", emoji: "💩", color: "bg-coral" },
  turbio: { label: "TURBIO", emoji: "😈", color: "bg-mustard" },
};

const intensityLabels: Record<string, string> = {
  suave: "SUAVE",
  intenso: "INTENSO",
  salvaje: "SALVAJE",
};

export default function TruthDareGame({
  onBack,
  onManagePlayers,
}: {
  onBack: () => void;
  onManagePlayers: () => void;
}) {
  const { players } = usePlayers();
  const [stage, setStage] = useState<Stage>("wheel");
  const [rotation, setRotation] = useState(0);
  const [pendingPlayer, setPendingPlayer] = useState<string | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const [challengeType, setChallengeType] = useState<ChallengeType | null>(null);
  const [challenge, setChallenge] = useState<ChallengeCard | null>(null);
  const [usedTruths, setUsedTruths] = useState<string[]>([]);
  const [usedDares, setUsedDares] = useState<string[]>([]);
  const [consecutiveTruths, setConsecutiveTruths] = useState<
    Record<string, number>
  >({});
  const spinTimeout = useRef<number | null>(null);
  const truthCount = selectedPlayer
    ? consecutiveTruths[selectedPlayer] ?? 0
    : 0;
  const mustDoDare = truthCount >= 2;

  useEffect(
    () => () => {
      if (spinTimeout.current !== null) {
        window.clearTimeout(spinTimeout.current);
      }
    },
    [],
  );

  function finishSpin(player: string) {
    if (spinTimeout.current !== null) {
      window.clearTimeout(spinTimeout.current);
      spinTimeout.current = null;
    }
    setSelectedPlayer(player);
    setPendingPlayer(null);
    setStage("choice");
  }

  function spinWheel() {
    if (players.length === 0 || pendingPlayer) return;
    const chosenIndex = Math.floor(Math.random() * players.length);
    const chosenPlayer = players[chosenIndex];
    if (!chosenPlayer) return;

    const segmentAngle = 360 / players.length;
    const desiredRotation =
      (360 - ((chosenIndex + 0.5) * segmentAngle) % 360) % 360;
    const currentRotation = ((rotation % 360) + 360) % 360;
    const rotationDelta =
      (desiredRotation - currentRotation + 360) % 360;
    setSelectedPlayer(null);
    setPendingPlayer(chosenPlayer);
    setRotation(rotation + 5 * 360 + rotationDelta);
    spinTimeout.current = window.setTimeout(
      () => finishSpin(chosenPlayer),
      4_800,
    );
  }

  function drawChallenge(type: ChallengeType) {
    if (!selectedPlayer || (type === "verdad" && mustDoDare)) return;
    const allCards: ChallengeCard[] =
      type === "verdad" ? minigameData.truths : minigameData.dares;
    const usedCards = type === "verdad" ? usedTruths : usedDares;
    const availableCards = allCards.filter((card) => !usedCards.includes(card.id));
    const pool =
      availableCards.length > 0
        ? availableCards
        : allCards.filter((card) => card.id !== challenge?.id);
    const nextChallenge = pool[Math.floor(Math.random() * pool.length)];
    if (!nextChallenge) {
      throw new Error(`No hay tarjetas disponibles para ${type}.`);
    }

    if (type === "verdad") {
      setUsedTruths(
        availableCards.length > 0
          ? [...usedTruths, nextChallenge.id]
          : [nextChallenge.id],
      );
      setConsecutiveTruths((current) => ({
        ...current,
        [selectedPlayer]: (current[selectedPlayer] ?? 0) + 1,
      }));
    } else {
      setUsedDares(
        availableCards.length > 0
          ? [...usedDares, nextChallenge.id]
          : [nextChallenge.id],
      );
      setConsecutiveTruths((current) => ({
        ...current,
        [selectedPlayer]: 0,
      }));
    }
    setChallengeType(type);
    setChallenge(nextChallenge);
    setStage("challenge");
  }

  function resetTurn() {
    setSelectedPlayer(null);
    setPendingPlayer(null);
    setChallengeType(null);
    setChallenge(null);
    setStage("wheel");
  }

  const wheelSize = 320;
  const center = wheelSize / 2;
  const radius = 145;
  const segmentAngle = players.length ? 360 / players.length : 360;
  const nameFontSize = Math.max(8, Math.min(15, 120 / players.length));

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
            Verdad o Reto 🎡
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

        <section aria-labelledby="roulette-title" className="text-center">
          <p className="text-xs font-extrabold uppercase tracking-widest text-ink/55">
            La suerte decide
          </p>
          <h2
            className="mt-1 break-words font-display text-4xl font-semibold [overflow-wrap:anywhere] sm:text-5xl"
            id="roulette-title"
          >
            {stage === "wheel"
              ? "¿A quién le toca?"
              : stage === "choice"
                ? `Te toca, ${selectedPlayer}`
                : `${challengeType === "verdad" ? "Verdad" : "Reto"} para ${selectedPlayer}`}
          </h2>

          {stage === "wheel" && (
            <div className="mx-auto mt-5 max-w-sm">
              <div className="relative mx-auto aspect-square w-full max-w-[20rem]">
                <span
                  aria-hidden="true"
                  className="absolute -top-1 left-1/2 z-20 -translate-x-1/2 text-4xl drop-shadow"
                >
                  ▼
                </span>
                <div
                  className="h-full w-full"
                  onTransitionEnd={(event) => {
                    if (event.propertyName !== "transform" || !pendingPlayer) {
                      return;
                    }
                    finishSpin(pendingPlayer);
                  }}
                  style={{
                    transform: `rotate(${rotation}deg)`,
                    transition:
                      "transform 4.6s cubic-bezier(0.08, 0.76, 0.16, 1)",
                  }}
                >
                  <svg
                    aria-label="Ruleta con los nombres de los jugadores"
                    className="h-full w-full overflow-visible"
                    role="img"
                    viewBox={`0 0 ${wheelSize} ${wheelSize}`}
                  >
                  <circle
                    cx={center}
                    cy={center}
                    r={radius + 8}
                    fill="white"
                    stroke="#1E1E1E"
                    strokeWidth="5"
                  />
                  {players.map((player, index) => {
                    const startAngle = index * segmentAngle - 90;
                    const endAngle = (index + 1) * segmentAngle - 90;
                    const startRadians = (startAngle * Math.PI) / 180;
                    const endRadians = (endAngle * Math.PI) / 180;
                    const startX = center + radius * Math.cos(startRadians);
                    const startY = center + radius * Math.sin(startRadians);
                    const endX = center + radius * Math.cos(endRadians);
                    const endY = center + radius * Math.sin(endRadians);
                    const largeArc = segmentAngle > 180 ? 1 : 0;
                    const middleRadians =
                      (((index + 0.5) * segmentAngle - 90) * Math.PI) / 180;
                    const labelRadius = radius * 0.65;
                    const labelX = center + labelRadius * Math.cos(middleRadians);
                    const labelY = center + labelRadius * Math.sin(middleRadians);

                    return (
                      <g key={player}>
                        <path
                          d={`M ${center} ${center} L ${startX} ${startY} A ${radius} ${radius} 0 ${largeArc} 1 ${endX} ${endY} Z`}
                          fill={segmentColors[index % segmentColors.length]}
                          stroke="#1E1E1E"
                          strokeWidth="2"
                        />
                        <text
                          dominantBaseline="middle"
                          fontFamily="Plus Jakarta Sans, sans-serif"
                          fontSize={nameFontSize}
                          fontWeight="800"
                          textAnchor="middle"
                          x={labelX}
                          y={labelY}
                        >
                          {player.length > 13 ? `${player.slice(0, 12)}…` : player}
                        </text>
                      </g>
                    );
                  })}
                  <circle
                    cx={center}
                    cy={center}
                    r="16"
                    fill="#FFF8E7"
                    stroke="#1E1E1E"
                    strokeWidth="4"
                  />
                  </svg>
                </div>
              </div>
              <button
                className="mt-7 w-full rounded-full border-2 border-ink bg-mustard px-8 py-5 font-display text-3xl font-semibold shadow-comic transition-transform hover:-translate-y-1 active:translate-y-1 active:shadow-none disabled:cursor-wait disabled:opacity-70"
                disabled={players.length < 3 || Boolean(pendingPlayer)}
                onClick={spinWheel}
                type="button"
              >
                {pendingPlayer ? "GIRANDO…" : "¡GIRAR!"}
              </button>
              {players.length < 3 && (
                <p className="mt-3 font-semibold text-coral">
                  Hace falta un mínimo de 3 jugadores.
                </p>
              )}
            </div>
          )}

          {stage === "choice" && (
            <motion.div
              animate={{ opacity: 1, y: 0 }}
              className="mx-auto mt-7 grid max-w-xl gap-4 sm:grid-cols-2"
              initial={{ opacity: 0, y: 20 }}
            >
              <button
                aria-label={
                  mustDoDare
                    ? "Verdad bloqueada; jugador obligado a elegir reto"
                    : "Elegir verdad"
                }
                className={`min-h-40 rounded-3xl border-2 border-ink px-6 py-7 font-display text-4xl font-semibold shadow-comic transition-transform hover:-translate-y-1 active:translate-y-1 active:shadow-none disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-500 disabled:shadow-none disabled:hover:translate-y-0 ${challengeColors.verdad}`}
                disabled={mustDoDare}
                onClick={() => drawChallenge("verdad")}
                type="button"
              >
                💬
                <br />
                VERDAD
              </button>
              <button
                aria-label="Elegir reto"
                className={`min-h-40 rounded-3xl border-2 border-ink px-6 py-7 font-display text-4xl font-semibold shadow-comic transition-transform hover:-translate-y-1 active:translate-y-1 active:shadow-none ${challengeColors.reto}`}
                onClick={() => drawChallenge("reto")}
                type="button"
              >
                🔥
                <br />
                RETO
              </button>
              {mustDoDare && (
                <p
                  aria-live="polite"
                  className="col-span-full rounded-2xl border-2 border-ink bg-mustard p-4 text-center font-extrabold shadow-comic-sm"
                >
                  ¡Se acabó el blanqueo, te toca reto por cobarde! Ya elegiste
                  verdad dos veces seguidas.
                </p>
              )}
            </motion.div>
          )}

          {stage === "challenge" && (
            <motion.div
              animate={{ opacity: 1, y: 0, rotate: 0 }}
              className="mx-auto mt-7 max-w-xl rounded-3xl border-2 border-ink bg-white p-7 shadow-comic sm:p-10"
              initial={{ opacity: 0, y: 20, rotate: -1 }}
            >
              <span
                className={`inline-flex rounded-full border-2 border-ink px-4 py-2 text-sm font-extrabold shadow-comic-sm ${challengeType ? challengeColors[challengeType] : "bg-sky"}`}
              >
                {challengeType === "verdad" ? "💬 VERDAD" : "🔥 RETO"}
              </span>
              {challenge && (
                <div className="mt-4 flex flex-wrap gap-2">
                  <span
                    className={`rounded-full border-2 border-ink px-3 py-1 text-xs font-extrabold ${
                      categoryStyles[challenge.category]?.color ?? "bg-sky"
                    }`}
                  >
                    {categoryStyles[challenge.category]?.emoji ?? "🎲"}{" "}
                    {categoryStyles[challenge.category]?.label ??
                      challenge.category.toUpperCase()}
                  </span>
                  <span className="rounded-full border-2 border-ink/15 bg-cream px-3 py-1 text-xs font-extrabold text-ink/65">
                    {intensityLabels[challenge.intensity] ??
                      challenge.intensity.toUpperCase()}
                  </span>
                </div>
              )}
              <p className="my-8 font-display text-3xl font-semibold leading-snug sm:text-4xl">
                {challenge?.text}
              </p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  className="flex-1 rounded-full border-2 border-ink bg-mint px-5 py-4 font-extrabold shadow-comic-sm"
                  onClick={resetTurn}
                  type="button"
                >
                  Girar otra vez
                </button>
                <button
                  className="flex-1 rounded-full border-2 border-ink bg-mustard px-5 py-4 font-extrabold shadow-comic-sm"
                  onClick={() => {
                    setStage("choice");
                    setChallengeType(null);
                    setChallenge(null);
                  }}
                  type="button"
                >
                  Cambiar de carta
                </button>
              </div>
            </motion.div>
          )}
        </section>
      </div>
    </main>
  );
}
