import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { GameQuestion, QuestionMode } from "../types/questions";

const STORAGE_KEY = "la-ultima-ronda.custom-questions";

type NewCustomQuestion = Omit<GameQuestion, "id">;

type CustomQuestionsContextValue = {
  customQuestions: GameQuestion[];
  addCustomQuestion: (question: NewCustomQuestion) => boolean;
};

const CustomQuestionsContext =
  createContext<CustomQuestionsContextValue | null>(null);

function isGameQuestion(value: unknown): value is GameQuestion {
  if (!value || typeof value !== "object") return false;
  const question = value as Record<string, unknown>;
  return (
    typeof question.id === "string" &&
    (question.mode === "prefer" || question.mode === "likely") &&
    typeof question.category === "string" &&
    typeof question.intensity === "string" &&
    typeof question.text === "string"
  );
}

function readCustomQuestions(): GameQuestion[] {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];

    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed) || !parsed.every(isGameQuestion)) {
      throw new Error("El formato guardado de preguntas no es válido.");
    }

    return parsed.map((question) =>
      question.category === "moral"
        ? { ...question, category: "turbio" }
        : question,
    );
  } catch (error) {
    console.error("No se pudieron cargar las preguntas personalizadas.", error);
    return [];
  }
}

export function CustomQuestionsProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [customQuestions, setCustomQuestions] =
    useState<GameQuestion[]>(readCustomQuestions);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(customQuestions),
      );
    } catch (error) {
      console.error("No se pudieron guardar las preguntas personalizadas.", error);
    }
  }, [customQuestions]);

  const addCustomQuestion = useCallback(
    (question: NewCustomQuestion) => {
      const cleanText = question.text.trim();
      if (!cleanText) return false;
      if (
        customQuestions.some(
          (existing) =>
            existing.mode === question.mode &&
            existing.text.toLocaleLowerCase() === cleanText.toLocaleLowerCase(),
        )
      ) {
        return false;
      }

      const newQuestion: GameQuestion = {
        ...question,
        text: cleanText,
        id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      };
      setCustomQuestions((current) => [...current, newQuestion]);
      return true;
    },
    [customQuestions],
  );

  const value = useMemo(
    () => ({ customQuestions, addCustomQuestion }),
    [customQuestions, addCustomQuestion],
  );

  return (
    <CustomQuestionsContext.Provider value={value}>
      {children}
    </CustomQuestionsContext.Provider>
  );
}

export function useCustomQuestions() {
  const context = useContext(CustomQuestionsContext);
  if (!context) {
    throw new Error(
      "useCustomQuestions debe usarse dentro de CustomQuestionsProvider.",
    );
  }
  return context;
}

export type { NewCustomQuestion, QuestionMode };
