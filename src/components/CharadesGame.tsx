import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Capacitor,
  SystemBars,
} from "@capacitor/core";
import {
  ScreenOrientation,
  type OrientationLockType,
} from "@capacitor/screen-orientation";
import charadesData from "../data/charades.json";
import { usePlayers } from "../state/PlayersContext";
import {
  useCharadesSensors,
  type CharadesAction,
} from "./useCharadesSensors";

type Subcategory = {
  id: string;
  name: string;
  icon?: string;
  words: string[];
};

type Category = {
  id: string;
  name: string;
  subcategories: Subcategory[];
};

type CharadesData = {
  categories: Category[];
};

type Phase = "setup" | "playing" | "summary";
type Feedback = CharadesAction | null;

const turnDuration = 60;
const turnDurationOptions = [30, 60, 90, 120];
const categories = (charadesData as CharadesData).categories;
const categoryColors = ["bg-bubblegum", "bg-mustard", "bg-mint", "bg-sky"];

type FullscreenDocument = Document & {
  webkitExitFullscreen?: () => Promise<void> | void;
};

type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

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

function normalizeSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase();
}

export default function CharadesGame({
  onBack,
  onManagePlayers,
}: {
  onBack: () => void;
  onManagePlayers: () => void;
}) {
  const { players } = usePlayers();
  const [phase, setPhase] = useState<Phase>("setup");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [subcategoryId, setSubcategoryId] = useState<string | null>(null);
  const [subcategorySearch, setSubcategorySearch] = useState("");
  const [selectedTurnDuration, setSelectedTurnDuration] =
    useState(turnDuration);
  const [isStartingTurn, setIsStartingTurn] = useState(false);
  const [playerIndex, setPlayerIndex] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(turnDuration);
  const [turnEndsAt, setTurnEndsAt] = useState<number | null>(null);
  const [currentWord, setCurrentWord] = useState("");
  const [remainingWords, setRemainingWords] = useState<string[]>([]);
  const [correctWords, setCorrectWords] = useState<string[]>([]);
  const [skippedWords, setSkippedWords] = useState<string[]>([]);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [orientationMessage, setOrientationMessage] = useState("");
  const originalOrientation = useRef<OrientationLockType | null>(null);
  const orientationWasLocked = useRef(false);
  const systemBarsWereHidden = useRef(false);
  const fullscreenWasEntered = useRef(false);
  const immersiveModeRequested = useRef(false);
  const selectedCategory = categories.find(
    (category) => category.id === categoryId,
  );
  const selectedSubcategory = selectedCategory?.subcategories.find(
    (subcategory) => subcategory.id === subcategoryId,
  );
  const filteredSubcategories = useMemo(() => {
    if (!selectedCategory) return [];
    const query = normalizeSearchText(subcategorySearch.trim());
    if (!query) return selectedCategory.subcategories;
    return selectedCategory.subcategories.filter((subcategory) =>
      normalizeSearchText(subcategory.name).includes(query),
    );
  }, [selectedCategory, subcategorySearch]);
  const activePlayer = players[playerIndex] ?? players[0];
  const sortedScores = useMemo(
    () =>
      players
        .map((player) => ({ player, score: scores[player] ?? 0 }))
        .sort((left, right) => right.score - left.score),
    [players, scores],
  );

  useEffect(() => {
    if (phase !== "playing" || turnEndsAt === null) return;

    let timer = 0;
    const updateTime = () => {
      const remaining = Math.max(
        0,
        Math.ceil((turnEndsAt - Date.now()) / 1000),
      );
      setSecondsLeft(remaining);
      if (remaining > 0) timer = window.setTimeout(updateTime, 200);
    };

    updateTime();
    return () => window.clearTimeout(timer);
  }, [phase, turnEndsAt]);

  useEffect(() => {
    if (phase !== "playing" || secondsLeft > 0) return;
    if (!activePlayer) {
      setPhase("summary");
      return;
    }
    setScores((current) => ({
      ...current,
      [activePlayer]: (current[activePlayer] ?? 0) + correctWords.length,
    }));
    setPhase("summary");
  }, [activePlayer, correctWords.length, phase, secondsLeft]);

  useEffect(() => {
    if (!feedback) return;
    const timeout = window.setTimeout(() => setFeedback(null), 450);
    return () => window.clearTimeout(timeout);
  }, [feedback]);

  const handleAction = useCallback(
    (action: CharadesAction) => {
      if (phase !== "playing" || !currentWord) return;

      if (action === "correct") {
        setCorrectWords((current) => [...current, currentWord]);
      } else {
        setSkippedWords((current) => [...current, currentWord]);
      }
      setFeedback(action);
      if ("vibrate" in navigator) navigator.vibrate(140);

      let nextWord = remainingWords[0];
      let nextRemaining = remainingWords.slice(1);
      if (!nextWord && selectedSubcategory) {
        const nextDeck = shuffle(selectedSubcategory.words);
        if (nextDeck.length > 1 && nextDeck[0] === currentWord) {
          [nextDeck[0], nextDeck[1]] = [nextDeck[1], nextDeck[0]];
        }
        [nextWord, ...nextRemaining] = nextDeck;
      }
      setCurrentWord(nextWord ?? "");
      setRemainingWords(nextRemaining);
    },
    [currentWord, phase, remainingWords, selectedSubcategory],
  );

  const { message: sensorMessage, requestSensorAccess, status: sensorStatus } =
    useCharadesSensors(phase === "playing", handleAction);

  const leaveImmersiveMode = useCallback(async () => {
    immersiveModeRequested.current = false;

    if (systemBarsWereHidden.current) {
      systemBarsWereHidden.current = false;
      try {
        await SystemBars.show();
      } catch (error) {
        console.error("No se pudieron mostrar de nuevo las barras del sistema.", error);
      }
    }

    if (fullscreenWasEntered.current) {
      fullscreenWasEntered.current = false;
      const fullscreenDocument = document as FullscreenDocument;
      try {
        if (document.fullscreenElement && document.exitFullscreen) {
          await document.exitFullscreen();
        } else if (fullscreenDocument.webkitExitFullscreen) {
          await fullscreenDocument.webkitExitFullscreen();
        }
      } catch (error) {
        console.error("No se pudo salir de pantalla completa.", error);
      }
    }

    if (orientationWasLocked.current) {
      orientationWasLocked.current = false;
      const previous = originalOrientation.current;
      originalOrientation.current = null;
      try {
        if (previous) {
          await ScreenOrientation.lock({ orientation: previous });
        } else {
          await ScreenOrientation.unlock();
        }
      } catch (error) {
        console.error("No se pudo restaurar la orientación anterior.", error);
      }
    }
  }, []);

  useEffect(() => {
    if (phase !== "playing" && immersiveModeRequested.current) {
      void leaveImmersiveMode();
    }
  }, [leaveImmersiveMode, phase]);

  useEffect(
    () => () => {
      if (immersiveModeRequested.current) void leaveImmersiveMode();
    },
    [leaveImmersiveMode],
  );

  async function enterImmersiveMode() {
    immersiveModeRequested.current = true;
    setOrientationMessage("");

    const isNative = Capacitor.isNativePlatform();
    let displayTask: Promise<void>;
    if (isNative) {
      displayTask = SystemBars.hide().then(() => {
        systemBarsWereHidden.current = true;
      }).catch((error: unknown) => {
        setOrientationMessage(
          "No se pudieron ocultar las barras del sistema; la partida continuará.",
        );
        console.error("No se pudieron ocultar las barras del sistema.", error);
      });
    } else {
      const fullscreenElement = document.documentElement as FullscreenElement;
      try {
        if (fullscreenElement.requestFullscreen) {
          const fullscreenRequest = fullscreenElement.requestFullscreen({
            navigationUI: "hide",
          });
          fullscreenWasEntered.current = true;
          displayTask = fullscreenRequest.catch((error: unknown) => {
            fullscreenWasEntered.current = false;
            setOrientationMessage(
              "Pantalla completa no disponible; la partida continuará en esta ventana.",
            );
            console.error("No se pudo activar pantalla completa.", error);
          });
        } else if (fullscreenElement.webkitRequestFullscreen) {
          const fullscreenRequest = fullscreenElement.webkitRequestFullscreen();
          fullscreenWasEntered.current = true;
          displayTask = Promise.resolve(fullscreenRequest).catch(
            (error: unknown) => {
              fullscreenWasEntered.current = false;
              setOrientationMessage(
                "Pantalla completa no disponible; la partida continuará en esta ventana.",
              );
              console.error("No se pudo activar pantalla completa.", error);
            },
          );
        } else {
          fullscreenWasEntered.current = false;
          displayTask = Promise.resolve();
          setOrientationMessage(
            "Pantalla completa no disponible en este navegador; coloca el móvil en horizontal.",
          );
        }
      } catch (error) {
        fullscreenWasEntered.current = false;
        displayTask = Promise.resolve();
        setOrientationMessage(
          "Pantalla completa no disponible; la partida continuará en esta ventana.",
        );
        console.error("No se pudo solicitar pantalla completa.", error);
      }
    }

    const orientationTask = (async () => {
      try {
        const current = await ScreenOrientation.orientation();
        originalOrientation.current = current.type as OrientationLockType;
        if (!isNative) await displayTask;
        await ScreenOrientation.lock({ orientation: "landscape" });
        orientationWasLocked.current = true;
      } catch (error) {
        setOrientationMessage(
          "No se pudo girar automáticamente. Coloca el móvil en horizontal para jugar.",
        );
        console.error("No se pudo activar la orientación horizontal.", error);
      }
    })();

    await Promise.all([orientationTask, displayTask]);
  }

  async function startTurn(nextPlayerIndex = playerIndex) {
    if (
      isStartingTurn ||
      !selectedSubcategory ||
      !players[nextPlayerIndex]
    ) {
      return;
    }

    setIsStartingTurn(true);
    try {
      const immersiveTask = enterImmersiveMode();
      const sensorTask = requestSensorAccess();
      await Promise.all([immersiveTask, sensorTask]);
      const deck = shuffle(selectedSubcategory.words);
      setPlayerIndex(nextPlayerIndex);
      setRemainingWords(deck.slice(1));
      setCurrentWord(deck[0] ?? "");
      setCorrectWords([]);
      setSkippedWords([]);
      setSecondsLeft(selectedTurnDuration);
      setTurnEndsAt(Date.now() + selectedTurnDuration * 1000);
      setFeedback(null);
      setPhase("playing");
    } finally {
      setIsStartingTurn(false);
    }
  }

  function startNextPlayerTurn() {
    if (players.length === 0) return;
    const nextPlayerIndex = (playerIndex + 1) % players.length;
    void startTurn(nextPlayerIndex);
  }

  const nextPlayerName =
    players.length > 0
      ? players[(playerIndex + 1) % players.length]
      : "el siguiente";

  const sensorStatusText: Record<typeof sensorStatus, string> = {
    idle: "Sensor pendiente",
    connecting: "Conectando sensor…",
    calibrating: "Calibrando: mantén el móvil neutro",
    ready: "Sensor listo",
    manual: "Modo táctil disponible",
  };

  return (
    <main
      className={`relative min-h-screen overflow-hidden bg-cream px-4 pb-8 pt-4 sm:px-7 sm:pt-6 ${
        phase === "playing" ? "charades-active" : ""
      }`}
    >
      {feedback && (
        <div
          aria-live="assertive"
          className={`pointer-events-none fixed inset-0 z-30 grid place-items-center font-display text-5xl font-bold text-ink/90 ${
            feedback === "correct" ? "bg-mint/80" : "bg-mustard/80"
          }`}
        >
          {feedback === "correct" ? "¡ACERTADA! +1" : "¡PASAMOS!"}
        </div>
      )}

      {phase !== "playing" && (
        <div className="mx-auto max-w-5xl">
        <header className="mb-5 flex items-center justify-between gap-3">
          <button
            className="rounded-full border-2 border-ink bg-white px-4 py-2 font-extrabold shadow-comic-sm disabled:cursor-wait disabled:opacity-50"
            disabled={isStartingTurn}
            onClick={onBack}
            type="button"
          >
            ← <span className="hidden sm:inline">Menú</span>
          </button>
          <h1 className="font-display text-2xl font-semibold sm:text-3xl">
            Charadas 🎭
          </h1>
          <button
            aria-label={`Gestionar jugadores, ${players.length} apuntados`}
            className="rounded-full border-2 border-ink bg-mustard px-4 py-2 font-extrabold shadow-comic-sm disabled:cursor-wait disabled:opacity-50"
            disabled={isStartingTurn}
            onClick={onManagePlayers}
            type="button"
          >
            👥 {players.length}
          </button>
        </header>

        {phase === "setup" && orientationMessage && (
          <p
            className="mb-4 rounded-2xl border-2 border-ink bg-sky px-4 py-3 text-center text-sm font-bold shadow-comic-sm"
            role="status"
          >
            {orientationMessage}
          </p>
        )}

        {phase === "setup" && (
          <section aria-labelledby="charades-setup-title">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-widest text-ink/55">
                  Mímica contrarreloj
                </p>
                <h2
                  className="font-display text-3xl font-semibold sm:text-4xl"
                  id="charades-setup-title"
                >
                  Prepara la ronda
                </h2>
              </div>
              <span className="rounded-full border-2 border-ink bg-white px-4 py-2 font-extrabold shadow-comic-sm">
                {selectedTurnDuration} SEGUNDOS
              </span>
            </div>

            <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="rounded-3xl border-2 border-ink bg-white p-5 shadow-comic sm:p-6">
                <p className="mb-3 text-sm font-extrabold uppercase tracking-wide text-ink/60">
                  1. Categoría
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {categories.map((category, index) => (
                    <button
                      aria-pressed={categoryId === category.id}
                      className={`min-h-16 rounded-2xl border-2 border-ink px-3 py-3 text-left font-display text-lg font-semibold shadow-comic-sm transition-transform active:translate-y-0.5 active:shadow-none ${
                        categoryColors[index % categoryColors.length]
                      } ${categoryId === category.id ? "ring-4 ring-ink/20" : ""}`}
                      key={category.id}
                      onClick={() => {
                        setCategoryId(category.id);
                        setSubcategoryId(null);
                        setSubcategorySearch("");
                      }}
                      type="button"
                    >
                      {category.name}
                    </button>
                  ))}
                </div>

                <fieldset className="mt-5">
                  <legend className="mb-2 text-sm font-extrabold uppercase tracking-wide text-ink/60">
                    2. Tiempo de ronda
                  </legend>
                  <div className="grid grid-cols-4 gap-2">
                    {turnDurationOptions.map((duration) => (
                      <button
                        aria-pressed={selectedTurnDuration === duration}
                        className={`rounded-xl border-2 border-ink px-1 py-2 text-sm font-extrabold shadow-comic-sm transition-transform active:translate-y-0.5 active:shadow-none ${
                          selectedTurnDuration === duration
                            ? "bg-mustard"
                            : "bg-white hover:bg-cream"
                        }`}
                        key={duration}
                        onClick={() => setSelectedTurnDuration(duration)}
                        type="button"
                      >
                        ⏱️ {duration}s
                      </button>
                    ))}
                  </div>
                </fieldset>

                {selectedCategory && (
                  <div className="mt-5">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <label
                        className="text-sm font-extrabold uppercase tracking-wide text-ink/60"
                        htmlFor="charades-subcategory-search"
                      >
                        3. Busca un mazo
                      </label>
                      <span
                        aria-live="polite"
                        className="shrink-0 text-xs font-bold text-ink/55"
                      >
                        {filteredSubcategories.length} disponibles
                      </span>
                    </div>
                    <input
                      autoComplete="off"
                      className="mb-3 w-full rounded-2xl border-2 border-ink bg-white px-4 py-3 font-semibold shadow-comic-sm placeholder:text-ink/40 focus:outline-none focus:ring-4 focus:ring-mustard/50"
                      id="charades-subcategory-search"
                      onChange={(event) =>
                        setSubcategorySearch(event.target.value)
                      }
                      placeholder="🔎 Buscar serie, película..."
                      type="search"
                      value={subcategorySearch}
                    />
                    <div
                      aria-label="Mazos disponibles"
                      className="grid max-h-56 grid-cols-2 gap-2 overflow-y-auto overscroll-contain p-1"
                    >
                      {filteredSubcategories.length > 0 ? (
                        filteredSubcategories.map((subcategory) => (
                          <button
                            aria-pressed={subcategoryId === subcategory.id}
                            className={`flex min-h-[6.25rem] min-w-0 flex-col items-center justify-center rounded-2xl border-2 border-ink px-2 py-2 text-center shadow-comic-sm transition-transform active:translate-y-0.5 active:shadow-none ${
                              subcategoryId === subcategory.id
                                ? "bg-mustard"
                                : "bg-white hover:bg-cream"
                            }`}
                            key={subcategory.id}
                            onClick={() => setSubcategoryId(subcategory.id)}
                            type="button"
                          >
                            <span aria-hidden="true" className="mb-1 select-none text-2xl leading-none">
                              {subcategory.icon ?? "🎭"}
                            </span>
                            <span className="w-full break-words text-xs font-extrabold leading-tight [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] overflow-hidden">
                              {subcategory.name}
                            </span>
                            <span className="mt-1 rounded-full border border-ink/30 bg-cream px-2 py-0.5 text-[0.625rem] font-extrabold">
                              {subcategory.words.length} ítems
                            </span>
                          </button>
                        ))
                      ) : (
                        <p className="col-span-full rounded-2xl border-2 border-ink bg-white px-4 py-5 text-center font-semibold text-ink/60">
                          No encontramos ese mazo. Prueba con otra búsqueda 😢
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="rounded-3xl border-2 border-ink bg-mint p-5 shadow-comic sm:p-6">
                <p className="mb-3 text-sm font-extrabold uppercase tracking-wide text-ink/60">
                  4. ¿Quién se pone la pantalla?
                </p>
                <div className="flex flex-wrap gap-2">
                  {players.map((player, index) => (
                    <button
                      aria-pressed={playerIndex === index}
                      className={`rounded-full border-2 border-ink px-4 py-2 font-extrabold shadow-comic-sm ${
                        playerIndex === index ? "bg-bubblegum" : "bg-white"
                      }`}
                      key={player}
                      onClick={() => setPlayerIndex(index)}
                      type="button"
                    >
                      {player}
                    </button>
                  ))}
                </div>

                {players.length < 3 && (
                  <p className="mt-4 font-bold text-ink">
                    Hace falta un mínimo de 3 jugadores.
                  </p>
                )}

                <button
                  className="mt-6 w-full rounded-full border-2 border-ink bg-mustard px-5 py-4 font-display text-2xl font-semibold shadow-comic transition-transform hover:-translate-y-0.5 active:translate-y-1 active:shadow-none disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={
                    isStartingTurn ||
                    players.length < 3 ||
                    !selectedSubcategory ||
                    !activePlayer
                  }
                  onClick={() => void startTurn()}
                  type="button"
                >
                  {isStartingTurn
                    ? "Preparando la ronda…"
                    : `¡Jugar (${selectedTurnDuration}s)! 🚀`}
                </button>
                <p className="mt-3 text-center text-sm font-semibold text-ink/70">
                  Inclina arriba para acertar y abajo para pasar. También hay
                  botones por si el sensor no coopera.
                </p>
              </div>
            </div>

            {Object.keys(scores).length > 0 && (
              <Scoreboard scores={sortedScores} />
            )}
          </section>
        )}

        {phase === "summary" && (
          <section aria-labelledby="charades-summary-title">
            <div className="mx-auto max-w-4xl rounded-3xl border-2 border-ink bg-white p-5 shadow-comic sm:p-8">
              <p className="text-sm font-extrabold uppercase tracking-widest text-ink/55">
                Se acabó el tiempo
              </p>
              <h2
                className="mt-1 font-display text-4xl font-semibold sm:text-5xl"
                id="charades-summary-title"
              >
                ¡Bien jugado, {activePlayer}!
              </h2>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <StatCard label="Aciertos" value={correctWords.length} color="bg-mint" />
                <StatCard label="Pasadas" value={skippedWords.length} color="bg-mustard" />
                <StatCard
                  label="Puntos totales"
                  value={scores[activePlayer] ?? 0}
                  color="bg-bubblegum"
                />
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <WordList title="✅ Adivinadas" words={correctWords} />
                <WordList title="⏭️ Pasadas" words={skippedWords} />
              </div>

              <Scoreboard scores={sortedScores} />
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <button
                  className="flex-1 rounded-full border-2 border-ink bg-mint px-5 py-4 font-extrabold shadow-comic-sm"
                  onClick={startNextPlayerTurn}
                  type="button"
                >
                  Turno de {nextPlayerName}
                </button>
                <button
                  className="flex-1 rounded-full border-2 border-ink bg-mustard px-5 py-4 font-extrabold shadow-comic-sm"
                  onClick={() => setPhase("setup")}
                  type="button"
                >
                  Cambiar mazo
                </button>
              </div>
            </div>
          </section>
        )}
        </div>
      )}

      {phase === "playing" && (
        <section
          aria-label={`Turno de ${activePlayer}`}
          aria-live="polite"
          className="fixed inset-0 z-40 flex h-[100dvh] w-full select-none flex-col overflow-hidden bg-cream p-3 sm:p-5"
        >
          <div className="flex min-h-0 flex-1 flex-col gap-3">
            <header className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-display text-lg font-semibold sm:text-2xl">
                  Turno de {activePlayer}
                </p>
                <p className="truncate text-xs font-bold uppercase tracking-wide text-ink/55 sm:text-sm">
                  {selectedSubcategory?.name}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2 sm:gap-4">
                <span className="rounded-full border-2 border-ink bg-bubblegum px-3 py-1.5 text-sm font-extrabold shadow-comic-sm sm:px-4 sm:py-2 sm:text-base">
                  ✨ {correctWords.length} pts
                </span>
                <div
                  aria-label={`${secondsLeft} segundos restantes`}
                  className={`rounded-full border-2 border-ink px-4 py-1.5 font-display text-2xl font-bold shadow-comic-sm sm:px-5 sm:py-2 sm:text-3xl ${
                    secondsLeft <= 10 ? "bg-coral" : "bg-mustard"
                  }`}
                  role="timer"
                >
                  {secondsLeft}s
                </div>
                <button
                  aria-label="Salir de la ronda"
                  className="grid h-10 w-10 place-items-center rounded-full border-2 border-ink bg-white text-xl font-black shadow-comic-sm sm:h-12 sm:w-12"
                  onClick={() => setPhase("setup")}
                  type="button"
                >
                  ×
                </button>
              </div>
            </header>

            {orientationMessage && (
              <p
                className="rounded-xl border-2 border-ink bg-sky px-3 py-2 text-center text-xs font-bold"
                role="status"
              >
                {orientationMessage}
              </p>
            )}

            <div className="grid min-h-0 flex-1 place-items-center rounded-3xl border-2 border-ink bg-white p-4 text-center shadow-comic sm:p-8">
              <p className="max-h-full max-w-full break-words font-display text-[clamp(2rem,10vh,6rem)] font-semibold leading-tight">
                {currentWord}
              </p>
            </div>

            <div className="flex min-h-8 items-center justify-center gap-3">
              {sensorStatus === "manual" ? (
                <div className="w-full">
                  <div className="flex items-center justify-center gap-3">
                    <button
                      className="min-h-12 flex-1 rounded-full border-2 border-ink bg-mint px-4 py-2 font-extrabold shadow-comic-sm"
                      onClick={() => handleAction("correct")}
                      type="button"
                    >
                      ✅ Acierto
                    </button>
                    <button
                      className="min-h-12 flex-1 rounded-full border-2 border-ink bg-mustard px-4 py-2 font-extrabold shadow-comic-sm"
                      onClick={() => handleAction("skip")}
                      type="button"
                    >
                      ⏭️ Pasar
                    </button>
                  </div>
                  {sensorMessage && (
                    <p className="mt-1 text-center text-[0.65rem] font-semibold text-ink/60">
                      {sensorMessage}
                    </p>
                  )}
                </div>
              ) : (
                <p
                  aria-live="polite"
                  className="text-center text-xs font-extrabold uppercase tracking-widest text-ink/55 sm:text-sm"
                  role="status"
                >
                  {sensorStatus === "ready"
                    ? "👆 Arriba: acierto · Abajo: pasar 👇"
                    : `${sensorStatusText[sensorStatus]} · Coloca el móvil neutro`}
                </p>
              )}
            </div>
          </div>
        </section>
      )}
    </main>
  );
}

function Scoreboard({
  scores,
}: {
  scores: { player: string; score: number }[];
}) {
  return (
    <section
      aria-label="Marcador de la partida"
      className="mt-5 rounded-3xl border-2 border-ink bg-sky p-4 shadow-comic-sm"
    >
      <h3 className="font-display text-xl font-semibold">Marcador de la partida</h3>
      <ol className="mt-2 flex flex-wrap gap-2">
        {scores.map(({ player, score }) => (
          <li
            className="rounded-full border-2 border-ink bg-white px-4 py-2 text-sm font-extrabold"
            key={player}
          >
            {player}: {score}
          </li>
        ))}
      </ol>
    </section>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div
      className={`rounded-2xl border-2 border-ink p-4 text-center shadow-comic-sm ${color}`}
    >
      <p className="text-xs font-extrabold uppercase tracking-widest">{label}</p>
      <p className="mt-1 font-display text-4xl font-bold">{value}</p>
    </div>
  );
}

function WordList({ title, words }: { title: string; words: string[] }) {
  return (
    <div className="rounded-2xl border-2 border-ink bg-cream p-4">
      <h3 className="font-display text-xl font-semibold">{title}</h3>
      {words.length > 0 ? (
        <ul className="mt-2 space-y-1 text-sm font-semibold">
          {words.map((word, index) => (
            <li className="break-words" key={`${word}-${index}`}>
              {word}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm font-semibold text-ink/55">Ninguna esta ronda.</p>
      )}
    </div>
  );
}
