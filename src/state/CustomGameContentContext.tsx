import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type CustomGameContentEntry =
  | { id: string; game: "impostor"; word: string }
  | { id: string; game: "keywords"; word: string }
  | {
      id: string;
      game: "never";
      prompt: string;
      intensity: "suave" | "intenso" | "salvaje";
    }
  | { id: string; game: "telephone"; prompt: string }
  | { id: string; game: "taboo"; word: string; forbidden: string[] }
  | {
      id: string;
      game: "passapalabra";
      letter: string;
      clue: string;
      answer: string;
      clueType: "startsWith" | "contains";
    }
  | {
      id: string;
      game: "charades";
      categoryId: string;
      categoryName: string;
      subcategoryId: string;
      subcategoryName: string;
      icon: string;
      word: string;
    };
type NewCustomGameContentEntry =
  CustomGameContentEntry extends infer Entry
    ? Entry extends CustomGameContentEntry
      ? Omit<Entry, "id">
      : never
    : never;

type CustomGameContentValue = {
  entries: CustomGameContentEntry[];
  addEntry: (entry: NewCustomGameContentEntry) => void;
  loadError: string;
};

const STORAGE_KEY = "la-ultima-ronda.custom-game-content";
const CustomGameContentContext =
  createContext<CustomGameContentValue | null>(null);

function isEntry(value: unknown): value is CustomGameContentEntry {
  if (typeof value !== "object" || value === null) return false;
  const entry = value as Record<string, unknown>;
  if (typeof entry.id !== "string" || typeof entry.game !== "string") {
    return false;
  }
  if (entry.game === "impostor" || entry.game === "keywords") {
    return typeof entry.word === "string";
  }
  if (entry.game === "never") {
    return (
      typeof entry.prompt === "string" &&
      (entry.intensity === "suave" ||
        entry.intensity === "intenso" ||
        entry.intensity === "salvaje")
    );
  }
  if (entry.game === "telephone") return typeof entry.prompt === "string";
  if (entry.game === "taboo") {
    return (
      typeof entry.word === "string" &&
      Array.isArray(entry.forbidden) &&
      entry.forbidden.every((word) => typeof word === "string")
    );
  }
  if (entry.game === "passapalabra") {
    return (
      typeof entry.letter === "string" &&
      typeof entry.clue === "string" &&
      typeof entry.answer === "string" &&
      (entry.clueType === "startsWith" || entry.clueType === "contains")
    );
  }
  return (
    entry.game === "charades" &&
    typeof entry.categoryId === "string" &&
    typeof entry.categoryName === "string" &&
    typeof entry.subcategoryId === "string" &&
    typeof entry.subcategoryName === "string" &&
    typeof entry.icon === "string" &&
    typeof entry.word === "string"
  );
}

function loadEntries(): {
  entries: CustomGameContentEntry[];
  error: string;
} {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return { entries: [], error: "" };
    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed) || !parsed.every(isEntry)) {
      throw new Error("El formato de contenido personalizado no es válido.");
    }
    return { entries: parsed, error: "" };
  } catch (error) {
    console.error("No se pudo cargar el contenido personalizado.", error);
    return {
      entries: [],
      error:
        error instanceof Error
          ? `No se pudo cargar el contenido guardado: ${error.message}`
          : "No se pudo cargar el contenido guardado.",
    };
  }
}

function trimEntry(entry: NewCustomGameContentEntry): NewCustomGameContentEntry {
  switch (entry.game) {
    case "impostor":
    case "keywords":
      return { ...entry, word: entry.word.trim() };
    case "never":
      return { ...entry, prompt: entry.prompt.trim() };
    case "telephone":
      return { ...entry, prompt: entry.prompt.trim() };
    case "taboo":
      return {
        ...entry,
        word: entry.word.trim(),
        forbidden: entry.forbidden.map((word) => word.trim()),
      };
    case "passapalabra":
      return {
        ...entry,
        clue: entry.clue.trim(),
        answer: entry.answer.trim(),
      };
    case "charades":
      return {
        ...entry,
        categoryName: entry.categoryName.trim(),
        subcategoryName: entry.subcategoryName.trim(),
        word: entry.word.trim(),
      };
  }
}

function addEntryId(
  entry: NewCustomGameContentEntry,
  id: string,
): CustomGameContentEntry {
  switch (entry.game) {
    case "impostor":
    case "keywords":
    case "never":
    case "telephone":
    case "taboo":
    case "passapalabra":
    case "charades":
      return { ...entry, id };
  }
}

export function CustomGameContentProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [initialContent] = useState(loadEntries);
  const [entries, setEntries] = useState(initialContent.entries);
  const [loadError, setLoadError] = useState(initialContent.error);

  const addEntry = useCallback(
    (entry: NewCustomGameContentEntry) => {
      const cleanEntry = trimEntry(entry);
      const duplicate = entries.some(
        (existing) =>
          existing.game === cleanEntry.game &&
          JSON.stringify(existing, (key, value) =>
            key === "id" ? undefined : value,
          ) === JSON.stringify(cleanEntry),
      );
      if (duplicate) throw new Error("Este contenido ya está guardado.");

      const nextEntries = [
        ...entries,
        addEntryId(
          cleanEntry,
          `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        ),
      ];
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextEntries));
      } catch (error) {
        console.error("No se pudo guardar el contenido personalizado.", error);
        throw new Error(
          "No se pudo guardar en este dispositivo. Comprueba el espacio disponible e inténtalo de nuevo.",
        );
      }
      setEntries(nextEntries);
      setLoadError("");
    },
    [entries],
  );

  const value = useMemo(
    () => ({ entries, addEntry, loadError }),
    [entries, addEntry, loadError],
  );
  return (
    <CustomGameContentContext.Provider value={value}>
      {children}
    </CustomGameContentContext.Provider>
  );
}

export function useCustomGameContent() {
  const context = useContext(CustomGameContentContext);
  if (!context) {
    throw new Error(
      "useCustomGameContent debe usarse dentro de CustomGameContentProvider.",
    );
  }
  return context;
}

export type { CustomGameContentEntry };
