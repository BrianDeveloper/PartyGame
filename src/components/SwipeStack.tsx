import { useEffect, useMemo, useState } from "react";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useTransform,
  type PanInfo,
} from "framer-motion";
import CustomQuestionModal from "./CustomQuestionModal";
import { generateQuestions } from "../services/geminiService.js";
import type { GameQuestion, QuestionMode } from "../types/questions";
export type { GameQuestion } from "../types/questions";

type Category = {
  id: string;
  label: string;
  emoji: string;
};

type Intensity = {
  id: string;
  label: string;
};

type SwipeStackProps = {
  questions: GameQuestion[];
  categories: Category[];
  intensities: Intensity[];
  mode: QuestionMode;
  players: string[];
};

const categoryColors: Record<string, string> = {
  chill: "bg-mint",
  picante: "bg-bubblegum",
  escatologico: "bg-coral",
  turbio: "bg-mustard",
};

const exitThreshold = 110;

export default function SwipeStack({
  questions,
  categories,
  intensities,
  mode,
  players,
}: SwipeStackProps) {
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [intensityFilter, setIntensityFilter] = useState("todas");
  const [cardIndex, setCardIndex] = useState(0);
  const [exitDirection, setExitDirection] = useState(1);
  const [generatedQuestions, setGeneratedQuestions] = useState<GameQuestion[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationMessage, setGenerationMessage] = useState("");
  const [isCustomModalOpen, setIsCustomModalOpen] = useState(false);
  const deckQuestions = useMemo(
    () => [...questions, ...generatedQuestions],
    [generatedQuestions, questions],
  );
  const activeQuestions = useMemo(
    () =>
      deckQuestions.filter(
        (question) =>
          (categoryFilter === "todas" || question.category === categoryFilter) &&
          (intensityFilter === "todas" ||
            question.intensity === intensityFilter),
      ),
    [categoryFilter, deckQuestions, intensityFilter],
  );
  useEffect(() => {
    setCardIndex(0);
  }, [questions]);
  const currentQuestion = activeQuestions[cardIndex];

  async function generateMoreQuestions() {
    if (isGenerating) return;
    const category =
      categoryFilter === "todas" || categoryFilter === null
        ? categories[Math.floor(Math.random() * categories.length)]
        : categories.find((item) => item.id === categoryFilter);
    const intensity =
      intensityFilter === "todas"
        ? intensities[Math.floor(Math.random() * intensities.length)]
        : intensities.find((item) => item.id === intensityFilter);
    if (!category || !intensity) {
      setGenerationMessage("No hay categorías o intensidades disponibles.");
      return;
    }

    setIsGenerating(true);
    setGenerationMessage("");
    try {
      const generated = await generateQuestions({
        mode,
        category: category.id,
        intensity: intensity.id,
      });
      const cards = generated.map((text, index) => {
        const player = players[Math.floor(Math.random() * players.length)];
        return {
          id: `gemini-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 6)}`,
          mode,
          category: category.id,
          intensity: intensity.id,
          text:
            mode === "likely" && player
              ? text.replace(/\{player\}/g, player)
              : text,
        };
      });
      setGeneratedQuestions((current) => [...current, ...cards]);
      setGenerationMessage(
        "¡Cinco cartas nuevas al mazo! Las cartas locales siguen aquí.",
      );
    } catch (error) {
      setGenerationMessage(
        error instanceof Error
          ? error.message
          : "No se pudieron generar preguntas. El mazo local sigue disponible.",
      );
    } finally {
      setIsGenerating(false);
    }
  }

  function changeFilter(
    setter: (filter: string) => void,
    value: string,
  ) {
    setter(value);
    setCardIndex(0);
  }

  function changeCategory(value: string | null) {
    setCategoryFilter(value);
    setCardIndex(0);
  }

  function advance(direction: -1 | 1) {
    setExitDirection(direction);
    setCardIndex((currentIndex) => currentIndex + 1);
  }

  function handleDragEnd(
    _event: MouseEvent | TouchEvent | PointerEvent,
    info: PanInfo,
  ) {
    if (info.offset.x > exitThreshold || info.velocity.x > 500) {
      advance(1);
    } else if (info.offset.x < -exitThreshold || info.velocity.x < -500) {
      advance(-1);
    }
  }

  function restartDeck() {
    setCardIndex(0);
  }

  return (
    <div className="w-full">
      <div className="mb-5 space-y-3">
        <div>
          <p className="mb-2 text-xs font-extrabold uppercase tracking-wider text-ink/60">
            Categoría
          </p>
          {categoryFilter === null ? (
            <div className="grid grid-cols-2 gap-2">
              {categories.map((category) => (
                <FilterButton
                  active={false}
                  key={category.id}
                  onClick={() => changeCategory(category.id)}
                >
                  {category.emoji} {category.label}
                </FilterButton>
              ))}
              <FilterButton
                active={false}
                onClick={() => changeCategory("todas")}
              >
                🎲 TODAS
              </FilterButton>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border-2 border-ink bg-white px-4 py-2 text-sm font-extrabold shadow-comic-sm">
                {categoryFilter === "todas"
                  ? "🎲 TODAS"
                  : `${
                      categories.find((category) => category.id === categoryFilter)
                        ?.emoji ?? "🎲"
                    } ${
                      categories.find((category) => category.id === categoryFilter)
                        ?.label ?? categoryFilter
                    }`}
              </span>
              <button
                className="rounded-full px-3 py-2 text-sm font-extrabold underline decoration-2 underline-offset-2"
                onClick={() => changeCategory(null)}
                type="button"
              >
                Cambiar categoría
              </button>
            </div>
          )}
        </div>
        {categoryFilter !== null && <div>
          <p className="mb-2 text-xs font-extrabold uppercase tracking-wider text-ink/60">
            Intensidad
          </p>
          <div className="flex flex-wrap gap-2">
            <FilterButton
              active={intensityFilter === "todas"}
              onClick={() => changeFilter(setIntensityFilter, "todas")}
            >
              Todas
            </FilterButton>
            {intensities.map((intensity) => (
              <FilterButton
                active={intensityFilter === intensity.id}
                key={intensity.id}
                onClick={() =>
                  changeFilter(setIntensityFilter, intensity.id)
                }
              >
                {intensity.label}
              </FilterButton>
            ))}
          </div>
        </div>}
      </div>

      {categoryFilter !== null && <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <button
          className="flex-1 rounded-full border-2 border-ink bg-bubblegum px-5 py-3 font-extrabold shadow-comic-sm transition-transform hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-none disabled:cursor-wait disabled:opacity-60"
          disabled={isGenerating}
          onClick={generateMoreQuestions}
          type="button"
        >
          {isGenerating ? "✨ Gemini está pensando…" : "✨ Generar más con IA"}
        </button>
        <button
          className="flex-1 rounded-full border-2 border-ink bg-white px-5 py-3 font-extrabold shadow-comic-sm transition-transform hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-none"
          onClick={() => setIsCustomModalOpen(true)}
          type="button"
        >
          ✍️ Añadir pregunta propia
        </button>
      </div>}
      {categoryFilter !== null && <p aria-live="polite" className="mb-2 min-h-5 text-center text-sm font-bold text-ink/65">
        {generationMessage}
      </p>}

      <div className="relative mx-auto flex min-h-[25rem] max-w-lg items-center justify-center px-2">
        {categoryFilter === null ? (
          <div className="z-10 w-full rounded-3xl border-2 border-ink bg-white p-8 text-center shadow-comic">
            <span className="text-5xl" role="img" aria-label="Elige categoría">
              🎴
            </span>
            <h3 className="mt-4 font-display text-3xl font-semibold">
              Elegid el nivel de caos
            </h3>
            <p className="mt-2 font-semibold text-ink/65">
              Primero una categoría. Luego ya vienen los problemas.
            </p>
          </div>
        ) : currentQuestion ? (
          <>
            <div
              aria-hidden="true"
              className="absolute inset-3 rotate-3 rounded-3xl border-2 border-ink bg-mustard shadow-comic"
            />
            <div
              aria-hidden="true"
              className="absolute inset-3 -rotate-2 rounded-3xl border-2 border-ink bg-bubblegum shadow-comic"
            />
            <AnimatePresence custom={exitDirection} mode="sync">
              <SwipeCard
                category={categories.find(
                  (category) => category.id === currentQuestion.category,
                )}
                direction={exitDirection}
                key={currentQuestion.id}
                onDragEnd={handleDragEnd}
                question={currentQuestion}
              />
            </AnimatePresence>
          </>
        ) : (
          <div className="z-10 w-full rounded-3xl border-2 border-ink bg-white p-8 text-center shadow-comic">
            <span className="text-5xl" role="img" aria-label="Confeti">
              🎉
            </span>
            <h3 className="mt-4 font-display text-3xl font-semibold">
              {activeQuestions.length
                ? "¡Mazo terminado!"
                : "No hay cartas con esos filtros"}
            </h3>
            <p className="mt-2 font-semibold text-ink/65">
              {activeQuestions.length
                ? "Habéis llegado al final. Sorprendente."
                : "Prueba otra categoría o intensidad."}
            </p>
            {activeQuestions.length > 0 && (
              <button
                className="mt-6 rounded-full border-2 border-ink bg-mint px-6 py-3 font-extrabold shadow-comic-sm"
                onClick={restartDeck}
                type="button"
              >
                Barajar otra vez
              </button>
            )}
          </div>
        )}
      </div>

      {currentQuestion && (
        <div className="mx-auto mt-5 flex max-w-lg items-center justify-center gap-4">
          <button
            className="rounded-full border-2 border-ink bg-bubblegum px-6 py-3 font-extrabold shadow-comic-sm transition-transform hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-none"
            onClick={() => advance(-1)}
            type="button"
          >
            👈 Omitir
          </button>
          <button
            className="rounded-full border-2 border-ink bg-mint px-6 py-3 font-extrabold shadow-comic-sm transition-transform hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-none"
            onClick={() => advance(1)}
            type="button"
          >
            Siguiente 👉
          </button>
        </div>
      )}
      <p aria-live="polite" className="mt-4 text-center text-sm font-bold text-ink/55">
        {currentQuestion
          ? `Carta ${cardIndex + 1} de ${activeQuestions.length} · Desliza para pasar`
          : categoryFilter === null
            ? ""
            : ""}
      </p>
      {isCustomModalOpen && (
        <CustomQuestionModal
          categories={categories}
          intensities={intensities}
          mode={mode}
          onClose={() => setIsCustomModalOpen(false)}
        />
      )}
    </div>
  );
}

function SwipeCard({
  question,
  category,
  direction,
  onDragEnd,
}: {
  question: GameQuestion;
  category?: Category;
  direction: number;
  onDragEnd: (
    event: MouseEvent | TouchEvent | PointerEvent,
    info: PanInfo,
  ) => void;
}) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-220, 220], [-12, 12]);
  const badgeColor =
    categoryColors[question.category] ?? "bg-sky";

  return (
    <motion.article
      animate={{ opacity: 1, scale: 1, x: 0, rotate: 0 }}
      className="absolute z-10 flex min-h-[21rem] w-full cursor-grab flex-col rounded-3xl border-2 border-gray-900 bg-white p-6 shadow-comic active:cursor-grabbing sm:p-8"
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.75}
      exit={{
        opacity: 0,
        x: direction * 360,
        rotate: direction * 14,
        transition: { duration: 0.22, ease: "easeOut" },
      }}
      initial={{ opacity: 0, scale: 0.92, y: 30 }}
      onDragEnd={onDragEnd}
      style={{ rotate, x, touchAction: "pan-y" }}
      transition={{ type: "spring", stiffness: 280, damping: 24 }}
    >
      <div className="flex items-start justify-between gap-3">
        <span
          className={`inline-flex -rotate-2 items-center gap-2 rounded-full border-2 border-ink px-4 py-2 text-xs font-extrabold tracking-wider shadow-comic-sm ${badgeColor}`}
        >
          <span>{category?.emoji ?? "🎲"}</span>
          {category?.label ?? question.category.toUpperCase()}
        </span>
        <span className="rounded-full border-2 border-ink/15 bg-cream px-3 py-1 text-xs font-extrabold uppercase tracking-wider text-ink/60">
          {question.intensity}
        </span>
      </div>

      <div className="flex flex-1 items-center justify-center py-8">
        <p className="font-display text-center text-3xl font-semibold leading-snug sm:text-4xl">
          {question.text}
        </p>
      </div>

      <div className="flex items-center justify-center gap-2 text-xs font-extrabold uppercase tracking-widest text-ink/40">
        <span>Desliza</span>
        <span aria-hidden="true">↔</span>
        <span>y que sea lo que dios quiera</span>
      </div>
    </motion.article>
  );
}

function FilterButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      aria-pressed={active}
      className={`rounded-full border-2 border-ink px-3 py-2 text-xs font-extrabold transition-transform hover:-translate-y-0.5 ${
        active
          ? "bg-ink text-white shadow-comic-sm"
          : "bg-white text-ink"
      }`}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}
