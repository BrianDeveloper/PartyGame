import { useState, type FormEvent } from "react";
import { useCustomGameContent } from "../state/CustomGameContentContext";

type GameContentType =
  | "impostor"
  | "keywords"
  | "never"
  | "telephone"
  | "taboo"
  | "passapalabra"
  | "charades";
type CharadesCategory = {
  id: string;
  name: string;
  subcategories: { id: string; name: string; icon?: string }[];
};

const letters = "ABCDEFGHIJKLMNÑOPQRSTUVWXYZ".split("");

function makeId(value: string) {
  const slug = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return (
    slug ||
    `custom-${Array.from(value)
      .map((character) => character.codePointAt(0)?.toString(16) ?? "")
      .join("-")}`
  );
}

export default function CustomContentForm({
  game,
  categories = [],
}: {
  game: GameContentType;
  categories?: CharadesCategory[];
}) {
  const { addEntry, loadError } = useCustomGameContent();
  const [text, setText] = useState("");
  const [intensity, setIntensity] = useState<"suave" | "intenso" | "salvaje">(
    "suave",
  );
  const [forbiddenText, setForbiddenText] = useState("");
  const [letter, setLetter] = useState("A");
  const [clueType, setClueType] = useState<"startsWith" | "contains">(
    "startsWith",
  );
  const [answer, setAnswer] = useState("");
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "new");
  const [subcategoryId, setSubcategoryId] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newSubcategoryName, setNewSubcategoryName] = useState("");
  const [icon, setIcon] = useState("🎭");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const selectedCategory = categories.find(
    (category) => category.id === categoryId,
  );

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSaved(false);
    try {
      if (!text.trim()) {
        throw new Error("Completa el contenido antes de guardarlo.");
      }
      if (game === "passapalabra" && !answer.trim()) {
        throw new Error("Escribe la respuesta de la pista.");
      }
      if (game === "passapalabra") {
        const normalize = (value: string) =>
          value
            .replace(/ñ/gi, "\u0000")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/\u0000/g, "ñ")
            .toLocaleLowerCase();
        const normalizedAnswer = normalize(answer.trim());
        const normalizedLetter = normalize(letter);
        const matches =
          clueType === "startsWith"
            ? normalizedAnswer.startsWith(normalizedLetter)
            : normalizedAnswer.includes(normalizedLetter);
        if (!matches) {
          throw new Error(
            clueType === "startsWith"
              ? `La respuesta debe empezar por ${letter}.`
              : `La respuesta debe contener la letra ${letter}.`,
          );
        }
      }
      if (game === "impostor" || game === "keywords") {
        addEntry({ game, word: text });
      } else if (game === "never") {
        addEntry({ game, prompt: text, intensity });
      } else if (game === "telephone") {
        addEntry({ game, prompt: text });
      } else if (game === "taboo") {
        const forbidden = forbiddenText
          .split(/[\n,;]+/)
          .map((word) => word.trim())
          .filter(Boolean);
        if (forbidden.length !== 5) {
          throw new Error("Escribe exactamente cinco palabras prohibidas.");
        }
        addEntry({ game, word: text, forbidden });
      } else if (game === "passapalabra") {
        addEntry({ game, letter, clue: text, answer, clueType });
      } else {
        const cleanCategoryName =
          categoryId === "new"
            ? newCategoryName.trim()
            : selectedCategory?.name ?? "";
        const cleanSubcategoryName =
          subcategoryId === "new"
            ? newSubcategoryName.trim()
            : selectedCategory?.subcategories.find(
                (subcategory) => subcategory.id === subcategoryId,
              )?.name ?? "";
        if (!cleanCategoryName || !cleanSubcategoryName) {
          throw new Error("Indica la categoría y la subcategoría.");
        }
        addEntry({
          game,
          categoryId:
            categoryId === "new" ? makeId(cleanCategoryName) : categoryId,
          categoryName: cleanCategoryName,
          subcategoryId:
            subcategoryId === "new"
              ? makeId(cleanSubcategoryName)
              : subcategoryId,
          subcategoryName: cleanSubcategoryName,
          icon,
          word: text,
        });
      }

      setText("");
      setAnswer("");
      setForbiddenText("");
      setSaved(true);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "No se pudo guardar el contenido.",
      );
    }
  }

  const contentLabel =
    game === "impostor" || game === "keywords"
      ? "Palabra"
      : game === "never" || game === "telephone"
        ? "Frase o situación"
        : game === "taboo"
          ? "Palabra a adivinar"
          : game === "passapalabra"
            ? "Definición o pista"
            : "Frase, personaje o situación";

  return (
    <details className="mt-4 rounded-2xl border-2 border-ink bg-cream p-4">
      <summary className="cursor-pointer font-display text-xl font-semibold">
        ✍️ Añadir contenido al banco
      </summary>
      <p className="mt-2 text-sm font-semibold text-ink/70">
        El contenido se guarda en este dispositivo y se incorpora a las
        próximas partidas de este juego.
      </p>
      {loadError && (
        <p
          aria-live="polite"
          className="mt-3 rounded-xl border-2 border-ink bg-coral p-3 text-sm font-bold"
        >
          {loadError}
        </p>
      )}
      <form className="mt-4 space-y-3" onSubmit={submit}>
        {game === "charades" && (
          <>
            <label className="block text-sm font-bold">
              Categoría
              <select
                className="mt-1 w-full rounded-xl border-2 border-ink bg-white px-3 py-3"
                onChange={(event) => {
                  setCategoryId(event.target.value);
                  setSubcategoryId("");
                }}
                value={categoryId}
              >
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
                <option value="new">+ Crear categoría</option>
              </select>
            </label>
            {categoryId === "new" ? (
              <label className="block text-sm font-bold">
                Nombre de la categoría
                <input
                  className="mt-1 w-full rounded-xl border-2 border-ink bg-white px-3 py-3"
                  onChange={(event) => setNewCategoryName(event.target.value)}
                  required
                  value={newCategoryName}
                />
              </label>
            ) : (
              <label className="block text-sm font-bold">
                Subcategoría
                <select
                  className="mt-1 w-full rounded-xl border-2 border-ink bg-white px-3 py-3"
                  onChange={(event) => setSubcategoryId(event.target.value)}
                  value={subcategoryId}
                >
                  <option value="">Selecciona un mazo</option>
                  {selectedCategory?.subcategories.map((subcategory) => (
                    <option key={subcategory.id} value={subcategory.id}>
                      {subcategory.name}
                    </option>
                  ))}
                  <option value="new">+ Crear subcategoría</option>
                </select>
              </label>
            )}
            {(categoryId === "new" || subcategoryId === "new") && (
              <label className="block text-sm font-bold">
                Nombre de la subcategoría
                <input
                  className="mt-1 w-full rounded-xl border-2 border-ink bg-white px-3 py-3"
                  onChange={(event) =>
                    setNewSubcategoryName(event.target.value)
                  }
                  required
                  value={newSubcategoryName}
                />
              </label>
            )}
            <label className="block text-sm font-bold">
              Emoji de la subcategoría
              <input
                className="mt-1 w-full rounded-xl border-2 border-ink bg-white px-3 py-3"
                maxLength={8}
                onChange={(event) => setIcon(event.target.value)}
                value={icon}
              />
            </label>
          </>
        )}

        {game === "passapalabra" && (
          <>
            <label className="block text-sm font-bold">
              Letra del rosco
              <select
                className="mt-1 w-full rounded-xl border-2 border-ink bg-white px-3 py-3"
                onChange={(event) => setLetter(event.target.value)}
                value={letter}
              >
                {letters.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-bold">
              La respuesta
              <input
                className="mt-1 w-full rounded-xl border-2 border-ink bg-white px-3 py-3"
                onChange={(event) => setAnswer(event.target.value)}
                required
                value={answer}
              />
            </label>
            <label className="block text-sm font-bold">
              Tipo de pista
              <select
                className="mt-1 w-full rounded-xl border-2 border-ink bg-white px-3 py-3"
                onChange={(event) =>
                    setClueType(
                      event.target.value === "contains" ? "contains" : "startsWith",
                    )
                }
                value={clueType}
              >
                <option value="startsWith">Empieza por</option>
                <option value="contains">Contiene</option>
              </select>
            </label>
          </>
        )}

        <label className="block text-sm font-bold">
          {contentLabel}
          <textarea
            className="mt-1 min-h-20 w-full rounded-xl border-2 border-ink bg-white px-3 py-3"
            maxLength={300}
            onChange={(event) => setText(event.target.value)}
            required
            value={text}
          />
        </label>

        {game === "never" && (
          <label className="block text-sm font-bold">
            Intensidad
            <select
              className="mt-1 w-full rounded-xl border-2 border-ink bg-white px-3 py-3"
              onChange={(event) =>
                setIntensity(
                  event.target.value === "intenso" ||
                    event.target.value === "salvaje"
                    ? event.target.value
                    : "suave",
                )
              }
              value={intensity}
            >
              <option value="suave">Suave</option>
              <option value="intenso">Intenso</option>
              <option value="salvaje">Salvaje</option>
            </select>
          </label>
        )}

        {game === "taboo" && (
          <label className="block text-sm font-bold">
            Cinco palabras prohibidas (separadas por comas o líneas)
            <textarea
              className="mt-1 min-h-24 w-full rounded-xl border-2 border-ink bg-white px-3 py-3"
              onChange={(event) => setForbiddenText(event.target.value)}
              placeholder={"Palabra 1, Palabra 2, Palabra 3, Palabra 4, Palabra 5"}
              required
              value={forbiddenText}
            />
          </label>
        )}

        <p aria-live="polite" className="text-sm font-bold text-coral">
          {error}
        </p>
        {saved && (
          <p aria-live="polite" className="text-sm font-bold text-ink">
            Añadido al banco de este dispositivo.
          </p>
        )}
        <button
          className="w-full rounded-full border-2 border-ink bg-mint px-5 py-3 font-extrabold shadow-comic-sm"
          type="submit"
        >
          Guardar contenido 💾
        </button>
      </form>
    </details>
  );
}
