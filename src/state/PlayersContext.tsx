import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const STORAGE_KEY = "la-ultima-ronda.players";

type PlayersContextValue = {
  players: string[];
  addPlayer: (name: string) => boolean;
  removePlayer: (name: string) => void;
};

const PlayersContext = createContext<PlayersContextValue | null>(null);

function readPlayers(): string[] {
  try {
    const storedPlayers = window.localStorage.getItem(STORAGE_KEY);
    if (!storedPlayers) return [];

    const parsed: unknown = JSON.parse(storedPlayers);
    if (
      !Array.isArray(parsed) ||
      !parsed.every((player): player is string => typeof player === "string")
    ) {
      throw new Error("El formato guardado de jugadores no es válido.");
    }

    return parsed.map((player) => player.trim()).filter(Boolean);
  } catch (error) {
    console.error("No se pudieron cargar los jugadores guardados.", error);
    return [];
  }
}

export function PlayersProvider({ children }: { children: ReactNode }) {
  const [players, setPlayers] = useState<string[]>(readPlayers);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(players));
    } catch (error) {
      console.error("No se pudieron guardar los jugadores.", error);
    }
  }, [players]);

  const addPlayer = useCallback(
    (name: string) => {
      const cleanName = name.trim();
      if (!cleanName || players.some((player) => player.toLowerCase() === cleanName.toLowerCase())) {
        return false;
      }

      setPlayers((currentPlayers) => [...currentPlayers, cleanName]);
      return true;
    },
    [players],
  );

  const removePlayer = useCallback((name: string) => {
    setPlayers((currentPlayers) =>
      currentPlayers.filter((player) => player !== name),
    );
  }, []);

  const value = useMemo(
    () => ({ players, addPlayer, removePlayer }),
    [players, addPlayer, removePlayer],
  );

  return (
    <PlayersContext.Provider value={value}>{children}</PlayersContext.Provider>
  );
}

export function usePlayers() {
  const context = useContext(PlayersContext);
  if (!context) {
    throw new Error("usePlayers debe usarse dentro de PlayersProvider.");
  }
  return context;
}
