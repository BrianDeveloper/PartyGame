import { useMemo } from "react";
import questionData from "../data/questions.json";
import { useCustomQuestions } from "../state/CustomQuestionsContext";
import { usePlayers } from "../state/PlayersContext";
import SwipeStack, { type GameQuestion } from "./SwipeStack";

type GameScreenProps = {
  mode: string;
  onBack: () => void;
  onManagePlayers: () => void;
};

type QuestionData = {
  categories: { id: string; label: string; emoji: string }[];
  intensities: { id: string; label: string }[];
  questions: GameQuestion[];
};

const data = questionData as QuestionData;

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

function makeDeck(
  questions: GameQuestion[],
  players: string[],
  mode: GameQuestion["mode"],
) {
  const matchingQuestions = shuffle(
    questions.filter((question) => question.mode === mode),
  );
  if (mode !== "likely" || players.length === 0) return matchingQuestions;

  let playerQueue: string[] = [];
  let previousPlayer = "";

  return matchingQuestions.map((question) => {
    if (playerQueue.length === 0) {
      playerQueue = shuffle(players);
      const lastIndex = playerQueue.length - 1;
      if (lastIndex > 0 && playerQueue[lastIndex] === previousPlayer) {
        [playerQueue[lastIndex], playerQueue[lastIndex - 1]] = [
          playerQueue[lastIndex - 1],
          playerQueue[lastIndex],
        ];
      }
    }
    const player = playerQueue.pop() ?? players[0];
    previousPlayer = player;
    return {
      ...question,
      text: question.text.replace(/\{player\}/g, player),
    };
  });
}

export default function GameScreen({
  mode,
  onBack,
  onManagePlayers,
}: GameScreenProps) {
  const { players } = usePlayers();
  const { customQuestions } = useCustomQuestions();
  const isLikelyMode = mode === "¿Quién es más probable que...?";
  const questions = useMemo(
    () => {
      const questionMode = isLikelyMode ? "likely" : "prefer";
      const questionsForMode = [
        ...data.questions,
        ...customQuestions.filter((question) => question.mode === questionMode),
      ];
      return makeDeck(questionsForMode, players, questionMode);
    },
    [customQuestions, isLikelyMode, players],
  );

  return (
    <main className="min-h-screen bg-cream px-5 pb-10 pt-5 sm:px-8 sm:pt-8">
      <div className="mx-auto max-w-3xl">
        <header className="mb-7 flex items-center justify-between gap-3">
          <button
            className="rounded-full border-2 border-ink bg-white px-4 py-3 font-extrabold shadow-comic-sm transition-transform hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-none"
            onClick={onBack}
            type="button"
          >
            ← <span className="hidden sm:inline">Menú</span>
          </button>
          <p className="truncate text-right font-display text-xl font-semibold sm:text-2xl">
            La Última Ronda 🍻
          </p>
          <button
            aria-label={`Gestionar jugadores, ${players.length} apuntados`}
            className="shrink-0 rounded-full border-2 border-ink bg-mustard px-4 py-3 font-extrabold shadow-comic-sm transition-transform hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-none"
            onClick={onManagePlayers}
            type="button"
          >
            👥 {players.length}
          </button>
        </header>

        <section aria-labelledby="game-title">
          <p className="mb-1 text-xs font-extrabold uppercase tracking-widest text-ink/55">
            {isLikelyMode ? "Apunta con el dedo" : "Decisiones de mierda"}
          </p>
          <h1
            className="mb-5 font-display text-4xl font-semibold leading-tight sm:text-5xl"
            id="game-title"
          >
            {mode}
          </h1>
          <SwipeStack
            categories={data.categories}
            intensities={data.intensities}
            mode={isLikelyMode ? "likely" : "prefer"}
            players={players}
            questions={questions}
          />
        </section>
      </div>
    </main>
  );
}
