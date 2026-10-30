import { useState, type FormEvent } from "react";
import { useCustomQuestions } from "../state/CustomQuestionsContext";
import type { QuestionMode } from "../types/questions";

type CustomQuestionModalProps = {
  mode: QuestionMode;
  categories: { id: string; label: string }[];
  intensities: { id: string; label: string }[];
  onQuestionAdded: (question: {
    id: string;
    category: string;
    intensity: string;
  }) => void;
  onClose: () => void;
};

export default function CustomQuestionModal({
  mode,
  categories,
  intensities,
  onQuestionAdded,
  onClose,
}: CustomQuestionModalProps) {
  const { addCustomQuestion } = useCustomQuestions();
  const [text, setText] = useState("");
  const [category, setCategory] = useState("chill");
  const [intensity, setIntensity] = useState(intensities[0]?.id ?? "suave");
  const [error, setError] = useState("");
  const isPrefer = mode === "prefer";

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanText = text.trim();
    if (!cleanText) {
      setError("Escribe una pregunta antes de guardarla.");
      return;
    }

    const startsWithWhoQuestion = cleanText
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase()
      .startsWith("¿quien");
    const normalizedText =
      mode === "likely" && !startsWithWhoQuestion
        ? `¿Quién es más probable que ${cleanText}`
        : cleanText.replace(/\{player\}\s*/gi, "");
    let added: ReturnType<typeof addCustomQuestion>;
    try {
      added = addCustomQuestion({
        mode,
        category,
        intensity,
        text: normalizedText,
      });
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "No se pudo guardar la pregunta en este dispositivo.",
      );
      return;
    }

    if (!added) {
      setError("Esa pregunta ya está guardada en este modo.");
      return;
    }
    onQuestionAdded(added);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 p-0 sm:items-center sm:p-5"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        aria-labelledby="custom-question-title"
        aria-modal="true"
        className="w-full max-w-lg rounded-t-[2rem] border-2 border-ink bg-white p-6 shadow-comic sm:rounded-[2rem] sm:p-8"
        role="dialog"
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-extrabold uppercase tracking-wider text-ink/60">
              Vuestro humor interno
            </p>
            <h2
              className="font-display text-3xl font-semibold"
              id="custom-question-title"
            >
              Añadir una carta
            </h2>
          </div>
          <button
            aria-label="Cerrar formulario"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full border-2 border-ink bg-cream text-xl font-bold shadow-comic-sm"
            onClick={onClose}
            type="button"
          >
            ×
          </button>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="block text-sm font-extrabold" htmlFor="custom-question-text">
            {isPrefer ? "¿Qué prefieres?" : "¿Quién es más probable que…?"}
            <textarea
              autoFocus
              className="mt-2 min-h-28 w-full resize-y rounded-2xl border-2 border-ink bg-cream px-4 py-3 font-semibold outline-none placeholder:text-ink/45 focus:ring-2 focus:ring-bubblegum"
              id="custom-question-text"
              maxLength={300}
              onChange={(event) => setText(event.target.value)}
              placeholder={
                isPrefer
                  ? "¿Qué prefieres: vivir sin música o sin postre?"
                  : "termine en un calabozo por una apuesta absurda"
              }
              required
              value={text}
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm font-extrabold">
              Categoría
              <select
                className="mt-2 w-full rounded-full border-2 border-ink bg-white px-3 py-3 font-bold"
                onChange={(event) => setCategory(event.target.value)}
                value={category}
              >
                {categories.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-extrabold">
              Intensidad
              <select
                className="mt-2 w-full rounded-full border-2 border-ink bg-white px-3 py-3 font-bold"
                onChange={(event) => setIntensity(event.target.value)}
                value={intensity}
              >
                {intensities.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <p aria-live="polite" className="min-h-5 text-sm font-bold text-coral">
            {error}
          </p>
          <p className="-mt-3 text-xs font-semibold text-ink/55">
            Se guarda en este dispositivo y se añade al mazo de este juego.
          </p>
          <button
            className="w-full rounded-full border-2 border-ink bg-mustard px-6 py-4 font-extrabold shadow-comic-sm transition-transform hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-none"
            type="submit"
          >
            Guardar en el mazo ✨
          </button>
        </form>
      </section>
    </div>
  );
}
