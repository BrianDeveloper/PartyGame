import { useCallback, useEffect, useMemo, useState } from "react";
import wordBank from "../data/keywords.json";
import CustomContentForm from "./CustomContentForm";
import { useCustomGameContent } from "../state/CustomGameContentContext";
import {
  ensureAnonymousSession,
  getSupabaseClient,
  isSupabaseConfigured,
} from "../lib/supabase";

type TeamIndex = 0 | 1;
type PublicCard = {
  word: string;
  revealed: boolean;
  owner?: number;
};
type PublicState = {
  board: PublicCard[];
  teams: [string[], string[]];
  scores: [number, number];
  startingTeam: TeamIndex;
  activeTeam: TeamIndex;
  phase: "waiting_guides" | "clue" | "guessing" | "finished";
  clue: { word: string; count: number } | null;
  guessesLeft: number;
  winner: TeamIndex | null;
  endReason: "assassin" | "all_words" | "closed" | null;
};
type Room = {
  id: string;
  code: string;
  status: "waiting" | "playing" | "finished";
  public_state: PublicState;
};
type Member = {
  role: "board" | "cluegiver";
  team: TeamIndex | null;
  display_name: string;
};
type DeviceRole = { type: "board" } | { type: "cluegiver"; team: TeamIndex; name: string };
type View = "home" | "setup" | "join" | "room";
type ConnectionNotice = { type: "reconnecting" | "reconnected"; message: string };

const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const typedWordBank = wordBank as string[];
const DEVICE_SESSION_KEY = "la-ultima-ronda.keywords-room";

function saveDeviceSession(roomId: string, role: DeviceRole) {
  try {
    window.localStorage.setItem(
      DEVICE_SESSION_KEY,
      JSON.stringify({ roomId, role }),
    );
    window.sessionStorage.removeItem(DEVICE_SESSION_KEY);
    return null;
  } catch (error) {
    return getErrorMessage(error);
  }
}

function readDeviceSession() {
  const saved = window.localStorage.getItem(DEVICE_SESSION_KEY);
  if (saved) return saved;

  const legacySaved = window.sessionStorage.getItem(DEVICE_SESSION_KEY);
  if (legacySaved) {
    window.localStorage.setItem(DEVICE_SESSION_KEY, legacySaved);
    window.sessionStorage.removeItem(DEVICE_SESSION_KEY);
  }
  return legacySaved;
}

function removeDeviceSession() {
  window.localStorage.removeItem(DEVICE_SESSION_KEY);
  window.sessionStorage.removeItem(DEVICE_SESSION_KEY);
}

function shuffle<T>(items: readonly T[]): T[] {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [
      shuffled[swapIndex]!,
      shuffled[index]!,
    ];
  }
  return shuffled;
}

function createRoomCode() {
  return Array.from(
    { length: 8 },
    () => alphabet[Math.floor(Math.random() * alphabet.length)],
  ).join("");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isTeamIndex(value: unknown): value is TeamIndex {
  return value === 0 || value === 1;
}

function isDeviceRole(value: unknown): value is DeviceRole {
  if (!isRecord(value)) return false;
  return (
    value.type === "board" ||
    (value.type === "cluegiver" &&
      isTeamIndex(value.team) &&
      typeof value.name === "string")
  );
}

function isStoredDeviceSession(
  value: unknown,
): value is { roomId: string; role: DeviceRole } {
  return (
    isRecord(value) &&
    typeof value.roomId === "string" &&
    isDeviceRole(value.role)
  );
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isGamePhase(value: unknown): value is PublicState["phase"] {
  return (
    value === "waiting_guides" ||
    value === "clue" ||
    value === "guessing" ||
    value === "finished"
  );
}

function parsePublicState(value: unknown): PublicState {
  if (!isRecord(value) || !Array.isArray(value.board) || value.board.length !== 25) {
    throw new Error("Supabase devolvió un tablero con formato inválido.");
  }

  const board = value.board.map((item) => {
    if (
      !isRecord(item) ||
      typeof item.word !== "string" ||
      typeof item.revealed !== "boolean" ||
      (item.owner !== undefined &&
        (typeof item.owner !== "number" ||
          !Number.isInteger(item.owner) ||
          item.owner < 0 ||
          item.owner > 3)) ||
      (item.revealed && typeof item.owner !== "number")
    ) {
      throw new Error("Supabase devolvió una palabra con formato inválido.");
    }
    return {
      word: item.word,
      revealed: item.revealed,
      ...(typeof item.owner === "number" ? { owner: item.owner } : {}),
    };
  });
  if (
    !Array.isArray(value.teams) ||
    value.teams.length !== 2 ||
    !isStringArray(value.teams[0]) ||
    !isStringArray(value.teams[1]) ||
    !Array.isArray(value.scores) ||
    value.scores.length !== 2 ||
    typeof value.scores[0] !== "number" ||
    typeof value.scores[1] !== "number" ||
    !isTeamIndex(value.activeTeam) ||
    !isTeamIndex(value.startingTeam) ||
    (value.winner !== null && !isTeamIndex(value.winner)) ||
    (value.endReason !== null &&
      value.endReason !== "assassin" &&
      value.endReason !== "all_words" &&
      value.endReason !== "closed") ||
    !isGamePhase(value.phase) ||
    typeof value.guessesLeft !== "number" ||
    !Number.isInteger(value.guessesLeft) ||
    (value.clue !== null && !isRecord(value.clue))
  ) {
    throw new Error("Supabase devolvió un estado de partida inválido.");
  }

  let clue: PublicState["clue"] = null;
  if (isRecord(value.clue)) {
    if (typeof value.clue.word !== "string" || typeof value.clue.count !== "number") {
      throw new Error("La pista recibida tiene un formato inválido.");
    }
    clue = { word: value.clue.word, count: value.clue.count };
  }

  return {
    board,
    teams: [value.teams[0], value.teams[1]],
    scores: [value.scores[0], value.scores[1]],
    startingTeam: value.startingTeam,
    activeTeam: value.activeTeam,
    phase: value.phase,
    clue,
    guessesLeft: value.guessesLeft,
    winner: value.winner,
    endReason: value.endReason,
  };
}

function parseRoom(value: unknown): Room {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.code !== "string" ||
    !["waiting", "playing", "finished"].includes(String(value.status))
  ) {
    throw new Error("Supabase devolvió una sala con formato inválido.");
  }
  return {
    id: value.id,
    code: value.code,
    status: value.status as Room["status"],
    public_state: parsePublicState(value.public_state),
  };
}

function parseMembers(value: unknown): Member[] {
  if (!Array.isArray(value)) {
    throw new Error("Supabase devolvió una lista de participantes inválida.");
  }
  return value.map((item) => {
    if (
      !isRecord(item) ||
      (item.role !== "board" && item.role !== "cluegiver") ||
      typeof item.display_name !== "string" ||
      (item.team !== null && item.team !== 0 && item.team !== 1)
    ) {
      throw new Error("Supabase devolvió un participante con formato inválido.");
    }
    return {
      role: item.role,
      team: item.team,
      display_name: item.display_name,
    };
  });
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (isRecord(error) && typeof error.message === "string") {
    return error.message;
  }
  return "Ha ocurrido un error inesperado.";
}

export default function KeywordsGame({
  onBack,
  onManagePlayers,
  players,
}: {
  onBack: () => void;
  onManagePlayers: () => void;
  players: string[];
}) {
  const [view, setView] = useState<View>("home");
  const [teams, setTeams] = useState<[string[], string[]]>([[], []]);
  const [room, setRoom] = useState<Room | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [deviceRole, setDeviceRole] = useState<DeviceRole | null>(null);
  const [roomCodeInput, setRoomCodeInput] = useState("");
  const [joinTeam, setJoinTeam] = useState<TeamIndex>(0);
  const [joinName, setJoinName] = useState("");
  const [joinTeamMembers, setJoinTeamMembers] = useState<string[]>([]);
  const [clueInput, setClueInput] = useState("");
  const [clueCount, setClueCount] = useState(1);
  const [secretKey, setSecretKey] = useState<number[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [notice, setNotice] = useState("");
  const [connectionNotice, setConnectionNotice] =
    useState<ConnectionNotice | null>(null);
  const [confirmCloseRoom, setConfirmCloseRoom] = useState(false);
  const [confirmLeaveRoom, setConfirmLeaveRoom] = useState(false);
  const { entries: customContent } = useCustomGameContent();
  const customWords = customContent
    .filter((entry) => entry.game === "keywords")
    .map((entry) => entry.word);
  const availableWords = Array.from(new Set([...typedWordBank, ...customWords]));

  const supabase = useMemo(
    () => (isSupabaseConfigured() ? getSupabaseClient() : null),
    [],
  );
  const activeTeamRemaining =
    room && secretKey
      ? secretKey.filter(
          (owner, index) =>
            owner === room.public_state.activeTeam &&
            !room.public_state.board[index]?.revealed,
        ).length
      : room
        ? 9
        : 0;
  const guideMembers = members.filter((member) => member.role === "cluegiver");
  const isActiveGuide =
    deviceRole?.type === "cluegiver" &&
    room?.public_state.activeTeam === deviceRole.team &&
    room.public_state.phase === "clue";
  const visibleSecretKey =
    deviceRole?.type === "cluegiver" && room?.status === "playing"
      ? secretKey
      : null;
  const publicBoard = (
    <div
      aria-label="Tablero público de palabras"
      className="grid grid-cols-5 gap-2 sm:gap-3"
    >
      {room?.public_state.board.map((card, index) => (
        <button
          aria-label={
            card.revealed
              ? `${card.word}, revelada`
              : `Revelar ${card.word}`
          }
          className={`flex min-h-16 items-center justify-center rounded-xl border-2 border-ink px-1 py-2 text-center text-xs font-extrabold shadow-comic-sm transition-transform sm:min-h-20 sm:rounded-2xl sm:px-2 sm:text-sm ${
            card.revealed
              ? card.owner === 0
                ? "bg-bubblegum"
                : card.owner === 1
                  ? "bg-sky"
                  : card.owner === 2
                    ? "bg-stone-300"
                    : "bg-ink text-white"
              : room.public_state.phase === "guessing" &&
                  deviceRole?.type === "board"
                ? "bg-white active:translate-y-0.5 active:shadow-none"
                : "bg-white"
          }`}
          disabled={
            card.revealed ||
            busy ||
            room.public_state.phase !== "guessing" ||
            deviceRole?.type !== "board"
          }
          key={`${card.word}-${index}`}
          onClick={() => revealCard(index)}
          type="button"
        >
          {card.word}
        </button>
      ))}
    </div>
  );

  const loadRoom = useCallback(
    async (roomId: string) => {
      if (!supabase) throw new Error("Supabase no está configurado.");
      const { data: roomData, error: roomError } = await supabase
        .from("keyword_rooms")
        .select("id, code, status, public_state")
        .eq("id", roomId)
        .single();
      if (roomError) throw roomError;
      const loadedRoom = parseRoom(roomData);
      const { data: memberData, error: memberError } = await supabase
        .from("keyword_room_members")
        .select("role, team, display_name")
        .eq("room_id", roomId);
      if (memberError) throw memberError;
      setRoom(loadedRoom);
      setMembers(parseMembers(memberData));
    },
    [supabase],
  );

  useEffect(() => {
    if (!supabase) return;
    let saved: string | null;
    try {
      saved = readDeviceSession();
    } catch (error) {
      setErrorMessage(
        `No se pudo acceder al almacenamiento persistente de la sala: ${getErrorMessage(error)}`,
      );
      return;
    }
    if (!saved) return;

    let restored: unknown;
    try {
      restored = JSON.parse(saved);
    } catch (error) {
      setErrorMessage(
        `No se pudo restaurar esta sala guardada: ${getErrorMessage(error)}`,
      );
      return;
    }
    if (!isStoredDeviceSession(restored)) {
      setErrorMessage("La información de sala guardada en este dispositivo no es válida.");
      return;
    }

    void loadRoom(restored.roomId)
      .then(() => {
        const storageError = saveDeviceSession(restored.roomId, restored.role);
        if (storageError) {
          setErrorMessage(
            `La sala se restauró, pero no se pudo guardar para la próxima apertura: ${storageError}`,
          );
        }
        setDeviceRole(restored.role);
        setView("room");
      })
      .catch((error: unknown) =>
        setErrorMessage(`No se pudo recuperar la sala: ${getErrorMessage(error)}`),
      );
  }, [loadRoom, supabase]);

  useEffect(() => {
    if (!room || !supabase) return;

    let hadConnectionIssue = false;
    const channel = supabase
      .channel(`keyword-room-${room.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "keyword_rooms",
          filter: `id=eq.${room.id}`,
        },
        () => {
          void loadRoom(room.id).catch((error: unknown) =>
            setErrorMessage(getErrorMessage(error)),
          );
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "keyword_room_members",
          filter: `room_id=eq.${room.id}`,
        },
        () => {
          void loadRoom(room.id).catch((error: unknown) =>
            setErrorMessage(getErrorMessage(error)),
          );
        },
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          hadConnectionIssue = true;
          setConnectionNotice({
            type: "reconnecting",
            message: "Conexión interrumpida. Intentando reconectar…",
          });
        } else if (status === "SUBSCRIBED" && hadConnectionIssue) {
          hadConnectionIssue = false;
          setConnectionNotice({
            type: "reconnected",
            message: "Conexión recuperada.",
          });
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadRoom, room?.id, supabase]);

  useEffect(() => {
    if (
      !room ||
      !supabase ||
      deviceRole?.type !== "cluegiver" ||
      room.status !== "playing"
    ) {
      setSecretKey(null);
      return;
    }

    let active = true;
    void (async () => {
      try {
        const { data, error } = await supabase.rpc("get_keyword_key", {
          p_room_id: room.id,
        });
        if (error) throw error;
        if (!active) return;
        if (
          !Array.isArray(data) ||
          data.length !== 25 ||
          !data.every((owner) => typeof owner === "number")
        ) {
          throw new Error("El servidor devolvió una clave secreta inválida.");
        }
        setSecretKey(data);
      } catch (error) {
        if (active) setErrorMessage(getErrorMessage(error));
      }
    })();

    return () => {
      active = false;
      setSecretKey(null);
    };
  }, [
    deviceRole,
    room?.id,
    room?.status,
    supabase,
  ]);

  useEffect(() => {
    if (connectionNotice?.type !== "reconnected") return;
    const timeout = window.setTimeout(() => setConnectionNotice(null), 3000);
    return () => window.clearTimeout(timeout);
  }, [connectionNotice]);

  function runAction(action: () => Promise<void>) {
    setBusy(true);
    setErrorMessage("");
    setNotice("");
    void action()
      .catch((error: unknown) => setErrorMessage(getErrorMessage(error)))
      .finally(() => setBusy(false));
  }

  function movePlayer(name: string, from: TeamIndex) {
    setTeams((current) => {
      const next = [current[0].filter((player) => player !== name), current[1].filter((player) => player !== name)] as [
        string[],
        string[],
      ];
      next[1 - from].push(name);
      return next;
    });
  }

  function createRoom() {
    runAction(async () => {
      if (!supabase) throw new Error("Configura Supabase antes de crear una sala.");
      const assigned = [...teams[0], ...teams[1]];
      if (teams.some((team) => team.length < 2)) {
        throw new Error("Asigna al menos dos jugadores a cada equipo.");
      }
      if (assigned.length !== players.length) {
        throw new Error("Asigna a todos los jugadores a uno de los equipos.");
      }
      await ensureAnonymousSession();
      const board = shuffle(availableWords).slice(0, 25);
      if (new Set(board).size !== 25) {
        throw new Error("El banco local no contiene 25 palabras únicas.");
      }
      const startingTeam = Math.random() < 0.5 ? 0 : 1;
      const code = createRoomCode();
      const { data, error } = await supabase.rpc("create_keyword_room", {
        p_code: code,
        p_board: board,
        p_teams: teams,
        p_starting_team: startingTeam,
      });
      if (error) throw error;
      if (typeof data !== "string") {
        throw new Error("Supabase no devolvió el identificador de la sala.");
      }
      const role: DeviceRole = { type: "board" };
      const storageError = saveDeviceSession(data, role);
      if (storageError) {
        setErrorMessage(
          `La sala se creó, pero no se pudo guardar para la próxima apertura: ${storageError}`,
        );
      }
      setDeviceRole(role);
      await loadRoom(data);
      setView("room");
    });
  }

  function joinRoom() {
    runAction(async () => {
      if (!supabase) throw new Error("Configura Supabase antes de unirte a una sala.");
      if (!joinName) throw new Error("Selecciona tu nombre de la lista del equipo.");
      await ensureAnonymousSession();
      const { data, error } = await supabase.rpc("join_keyword_room", {
        p_code: roomCodeInput.trim().toUpperCase(),
        p_team: joinTeam,
        p_display_name: joinName,
      });
      if (error) throw error;
      if (typeof data !== "string") {
        throw new Error("Supabase no devolvió el identificador de la sala.");
      }
      const role: DeviceRole = {
        type: "cluegiver",
        team: joinTeam,
        name: joinName,
      };
      const storageError = saveDeviceSession(data, role);
      if (storageError) {
        setErrorMessage(
          `La sala se conectó, pero no se pudo guardar para la próxima apertura: ${storageError}`,
        );
      }
      setDeviceRole(role);
      await loadRoom(data);
      setView("room");
    });
  }

  function loadJoinTeamMembers() {
    runAction(async () => {
      if (!supabase) throw new Error("Configura Supabase antes de unirte a una sala.");
      if (roomCodeInput.trim().length !== 8) {
        throw new Error("Escribe primero el código de ocho caracteres.");
      }
      await ensureAnonymousSession();
      const { data, error } = await supabase.rpc("get_keyword_team_roster", {
        p_code: roomCodeInput.trim().toUpperCase(),
        p_team: joinTeam,
      });
      if (error) throw error;
      if (!isStringArray(data)) {
        throw new Error("La lista del equipo recibida no tiene un formato válido.");
      }
      setJoinTeamMembers(data);
      setJoinName("");
      if (data.length === 0) setNotice("Este equipo no tiene nombres asignados.");
    });
  }

  function startGame() {
    if (!room || !supabase) return;
    runAction(async () => {
      const { error } = await supabase.rpc("start_keyword_game", {
        p_room_id: room.id,
      });
      if (error) throw error;
      await loadRoom(room.id);
    });
  }

  function sendClue(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!room || !supabase) return;
    runAction(async () => {
      const { error } = await supabase.rpc("submit_keyword_clue", {
        p_room_id: room.id,
        p_clue: clueInput.trim(),
        p_count: clueCount,
      });
      if (error) throw error;
      setClueInput("");
      await loadRoom(room.id);
    });
  }

  function revealCard(index: number) {
    if (!room || !supabase) return;
    runAction(async () => {
      const { error } = await supabase.rpc("guess_keyword_card", {
        p_room_id: room.id,
        p_card_index: index,
      });
      if (error) throw error;
      await loadRoom(room.id);
    });
  }

  function endTurn() {
    if (!room || !supabase) return;
    runAction(async () => {
      const { error } = await supabase.rpc("end_keyword_turn", {
        p_room_id: room.id,
      });
      if (error) throw error;
      await loadRoom(room.id);
    });
  }

  async function copyRoomCode() {
    if (!room) return;
    try {
      await navigator.clipboard.writeText(room.code);
      setNotice("Código copiado.");
    } catch (error) {
      setErrorMessage(
        `No se pudo copiar el código. Compártelo manualmente: ${room.code}. ${getErrorMessage(error)}`,
      );
    }
  }

  function backToHome() {
    setRoom(null);
    setMembers([]);
    setDeviceRole(null);
    setSecretKey(null);
    setView("home");
    try {
      removeDeviceSession();
    } catch (error) {
      setErrorMessage(
        `No se pudo limpiar la sala de este dispositivo: ${getErrorMessage(error)}`,
      );
    }
  }

  function closeRoom() {
    if (!room || !supabase || deviceRole?.type !== "board") {
      backToHome();
      return;
    }
    runAction(async () => {
      const { error } = await supabase.rpc("close_keyword_room", {
        p_room_id: room.id,
      });
      if (error) throw error;
      setConfirmCloseRoom(false);
      removeDeviceSession();
      backToHome();
    });
  }

  function leaveRoom() {
    if (!room || !supabase || deviceRole?.type !== "cluegiver") return;
    runAction(async () => {
      const { error } = await supabase.rpc("leave_keyword_room", {
        p_room_id: room.id,
      });
      if (error) throw error;

      removeDeviceSession();
      setConfirmLeaveRoom(false);
      setRoom(null);
      setMembers([]);
      setDeviceRole(null);
      setSecretKey(null);
      setView("home");
    });
  }

  const pageHeader = (
    <header className="mb-7 flex items-center justify-between gap-3">
      <button
        className="rounded-full border-2 border-ink bg-white px-4 py-3 font-extrabold shadow-comic-sm disabled:cursor-not-allowed disabled:opacity-50"
        disabled={view === "room"}
        onClick={view === "home" ? onBack : backToHome}
        type="button"
      >
        ← <span className="hidden sm:inline">{view === "room" ? "Sala activa" : view === "home" ? "Menú" : "Atrás"}</span>
      </button>
      <h1 className="truncate text-right font-display text-xl font-semibold sm:text-2xl">
        Palabras clave 🗝️
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
  );

  return (
    <main className="min-h-screen bg-cream px-5 pb-10 pt-5 sm:px-8 sm:pt-8">
      <div className="mx-auto max-w-5xl">
        {pageHeader}

        {!isSupabaseConfigured() && (
          <p className="mb-5 rounded-2xl border-2 border-ink bg-coral p-4 font-bold">
            Falta configurar Supabase. Define VITE_SUPABASE_URL y
            VITE_SUPABASE_ANON_KEY en tu archivo .env local y aplica la
            migración incluida en supabase/migrations.
          </p>
        )}
        {connectionNotice && (
          <p
            aria-live="polite"
            className={`mb-5 rounded-2xl border-2 border-ink p-4 font-bold ${
              connectionNotice.type === "reconnected" ? "bg-mint" : "bg-coral"
            }`}
          >
            {connectionNotice.message}
          </p>
        )}
        {errorMessage && (
          <p
            aria-live="assertive"
            className="mb-5 rounded-2xl border-2 border-ink bg-coral p-4 font-bold"
          >
            {errorMessage}
          </p>
        )}
        {notice && (
          <p aria-live="polite" className="mb-5 rounded-2xl border-2 border-ink bg-mint p-4 font-bold">
            {notice}
          </p>
        )}

        <details className="mb-5 rounded-3xl border-2 border-ink bg-white p-4 shadow-comic-sm">
          <summary className="cursor-pointer font-extrabold">
            Cómo se juega · reglas rápidas
          </summary>
          <div className="mt-4 space-y-4 text-sm font-semibold text-ink/75">
            <section>
              <h2 className="font-display text-lg font-semibold text-ink">
                Objetivo y equipos
              </h2>
              <p>
                Dos equipos compiten por encontrar todas sus palabras antes que
                el rival. Cada tablero tiene 25 palabras: 9 del equipo que
                empieza, 8 del otro, 7 neutrales y 1 asesina.
              </p>
            </section>
            <section>
              <h2 className="font-display text-lg font-semibold text-ink">
                Pistas y turnos
              </h2>
              <p>
                La guía del equipo activo da una sola palabra y un número. El
                equipo puede elegir hasta ese número más una casilla. Si acierta
                una palabra propia, puede seguir mientras le queden intentos;
                una palabra neutral o rival termina el turno.
              </p>
            </section>
            <section>
              <h2 className="font-display text-lg font-semibold text-ink">
                Casillas especiales y victoria
              </h2>
              <p>
                La asesina termina la partida y gana el rival. Gana el primer
                equipo que encuentra todas sus palabras. El tablero muestra las
                elecciones y ambas guías ven su propia clave privada durante
                toda la partida; no la compartas con el otro equipo.
              </p>
            </section>
            <section>
              <h2 className="font-display text-lg font-semibold text-ink">
                Dispositivos
              </h2>
              <p>
                El teléfono del tablero es público y gestiona las casillas. Cada
                equipo mantiene una guía en su propio teléfono. Antes de empezar,
                asignen manualmente los equipos y conecten una guía por equipo.
                El tablero también puede terminar un turno o finalizar la
                partida para todos.
              </p>
            </section>
          </div>
        </details>

        {view === "home" && (
          <section className="rounded-3xl border-2 border-ink bg-white p-6 shadow-comic sm:p-10">
            <p className="text-sm font-extrabold uppercase tracking-widest text-ink/55">
              Multijugador · tres dispositivos
            </p>
            <h2 className="mt-2 font-display text-4xl font-semibold">
              Una clave, veinticinco palabras
            </h2>
            <p className="mt-3 max-w-2xl font-semibold text-ink/65">
              El tablero es público. La clave secreta solo se muestra en el
              teléfono privado de cada guía. Forma equipos
              manualmente y crea una sala o únete con un código.
            </p>
            <div className="mt-7 grid gap-3 sm:grid-cols-2">
              <button
                className="rounded-full border-2 border-ink bg-bubblegum px-5 py-4 font-extrabold shadow-comic-sm disabled:opacity-45"
                disabled={!isSupabaseConfigured() || players.length < 4}
                onClick={() => {
                  setTeams([
                    players.filter((_, index) => index % 2 === 0),
                    players.filter((_, index) => index % 2 === 1),
                  ]);
                  setView("setup");
                }}
                type="button"
              >
                Crear sala · tablero público
              </button>
              <button
                className="rounded-full border-2 border-ink bg-sky px-5 py-4 font-extrabold shadow-comic-sm disabled:opacity-45"
                disabled={!isSupabaseConfigured()}
                onClick={() => setView("join")}
                type="button"
              >
                Conectar / reconectar como guía
              </button>
            </div>
            <CustomContentForm game="keywords" />
            {players.length < 4 && (
              <p className="mt-4 text-sm font-bold text-ink/65">
                Guarda al menos cuatro nombres en Jugadores para crear una sala.
              </p>
            )}
          </section>
        )}

        {view === "setup" && (
          <section aria-labelledby="team-setup-title">
            <h2 className="mb-4 font-display text-3xl font-semibold" id="team-setup-title">
              Reparte los equipos
            </h2>
            <p className="mb-5 font-semibold text-ink/65">
              Toca un nombre para moverlo al otro equipo. El reparto debe tener
              al menos dos integrantes por equipo; cada equipo elige su guía
              desde su propio teléfono.
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              {teams.map((team, index) => (
                <article
                  className={`rounded-3xl border-2 border-ink p-5 shadow-comic ${
                    index === 0 ? "bg-bubblegum" : "bg-sky"
                  }`}
                  key={index}
                >
                  <h3 className="font-display text-2xl font-semibold">
                    Equipo {index + 1} · {team.length}
                  </h3>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {team.map((name) => (
                      <button
                        className="rounded-full border-2 border-ink bg-white px-4 py-2 text-sm font-extrabold shadow-comic-sm"
                        key={name}
                        onClick={() => movePlayer(name, index as TeamIndex)}
                        type="button"
                      >
                        {name} ↔
                      </button>
                    ))}
                    {!team.length && <span className="font-bold">Sin jugadores</span>}
                  </div>
                </article>
              ))}
            </div>
            <button
              className="mt-6 w-full rounded-full border-2 border-ink bg-mint px-6 py-4 font-display text-xl font-semibold shadow-comic-sm disabled:opacity-45"
              disabled={
                busy ||
                !isSupabaseConfigured() ||
                teams.some((team) => team.length < 2) ||
                teams[0].length + teams[1].length !== players.length
              }
              onClick={createRoom}
              type="button"
            >
              {busy ? "Creando sala…" : "Crear sala y mostrar código"}
            </button>
          </section>
        )}

        {view === "join" && (
          <section className="mx-auto max-w-xl rounded-3xl border-2 border-ink bg-white p-6 shadow-comic sm:p-8">
            <h2 className="font-display text-3xl font-semibold">
              Conectar teléfono de guía
            </h2>
            <p className="mt-2 font-semibold text-ink/65">
              Elige el equipo, carga sus nombres y selecciona el que tienes
              asignado. Para reconectarte a una partida iniciada, usa el mismo
              dispositivo o perfil donde te conectaste originalmente.
            </p>
            <form
              className="mt-5 space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                joinRoom();
              }}
            >
              <label className="block text-sm font-extrabold" htmlFor="keyword-room-code">
                Código de sala
                <input
                  autoCapitalize="characters"
                  className="mt-1 w-full rounded-2xl border-2 border-ink bg-cream px-4 py-3 text-lg font-bold uppercase"
                  id="keyword-room-code"
                  maxLength={8}
                  onChange={(event) => {
                    setRoomCodeInput(event.target.value);
                    setJoinTeamMembers([]);
                    setJoinName("");
                  }}
                  required
                  value={roomCodeInput}
                />
              </label>
              <fieldset>
                <legend className="mb-2 text-sm font-extrabold">Tu equipo</legend>
                <div className="grid grid-cols-2 gap-3">
                  {[0, 1].map((team) => (
                    <button
                      aria-pressed={joinTeam === team}
                      className={`rounded-xl border-2 border-ink py-3 font-extrabold shadow-comic-sm ${
                        joinTeam === team
                          ? team === 0
                            ? "bg-bubblegum"
                            : "bg-sky"
                          : "bg-white"
                      }`}
                      key={team}
                      onClick={() => {
                        setJoinTeam(team as TeamIndex);
                        setJoinTeamMembers([]);
                        setJoinName("");
                      }}
                      type="button"
                    >
                      Equipo {team + 1}
                    </button>
                  ))}
                </div>
              </fieldset>
              <button
                className="w-full rounded-full border-2 border-ink bg-mustard px-5 py-3 font-extrabold shadow-comic-sm disabled:opacity-45"
                disabled={busy || roomCodeInput.trim().length !== 8}
                onClick={loadJoinTeamMembers}
                type="button"
              >
                {busy ? "Cargando nombres…" : "Mostrar nombres del equipo"}
              </button>
              {joinTeamMembers.length > 0 && (
                <fieldset>
                  <legend className="mb-2 text-sm font-extrabold">
                    Elige tu nombre · Equipo {joinTeam + 1}
                  </legend>
                  <div className="grid grid-cols-2 gap-2">
                    {joinTeamMembers.map((name, index) => (
                      <button
                        aria-pressed={joinName === name}
                        className={`rounded-xl border-2 border-ink px-3 py-3 font-extrabold shadow-comic-sm ${
                          joinName === name
                            ? joinTeam === 0
                              ? "bg-bubblegum"
                              : "bg-sky"
                            : "bg-white"
                        }`}
                        key={`${name}-${index}`}
                        onClick={() => setJoinName(name)}
                        type="button"
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                </fieldset>
              )}
              <button
                className="w-full rounded-full border-2 border-ink bg-mint px-5 py-4 font-extrabold shadow-comic-sm disabled:opacity-45"
                disabled={busy || !joinName}
                type="submit"
              >
                {busy ? "Conectando…" : "Unirme como guía 🔐"}
              </button>
            </form>
          </section>
        )}

        {view === "room" && room && deviceRole && (
          <section>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-3xl border-2 border-ink bg-white p-4 shadow-comic-sm">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-widest text-ink/55">
                  Código de sala
                </p>
                <p className="font-display text-3xl font-semibold tracking-widest">
                  {room.code}
                </p>
              </div>
              <button
                className="rounded-full border-2 border-ink bg-mustard px-4 py-3 font-extrabold shadow-comic-sm"
                onClick={() => void copyRoomCode()}
                type="button"
              >
                Copiar código
              </button>
            </div>

            {room.status === "waiting" && deviceRole.type === "board" && (
              <div className="rounded-3xl border-2 border-ink bg-white p-5 shadow-comic sm:p-8">
                <h2 className="font-display text-3xl font-semibold">
                  Esperando a las dos guías
                </h2>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {[0, 1].map((team) => {
                    const guide = guideMembers.find(
                      (member) => member.team === team,
                    );
                    return (
                      <div
                        className={`rounded-2xl border-2 border-ink p-4 ${
                          team === 0 ? "bg-bubblegum" : "bg-sky"
                        }`}
                        key={team}
                      >
                        <p className="font-display text-xl font-semibold">
                          Equipo {team + 1} · Guía
                        </p>
                        <p className="mt-1 font-bold">
                          {guide?.display_name ?? "Sin conectar"}
                        </p>
                      </div>
                    );
                  })}
                </div>
                <button
                  className="mt-6 w-full rounded-full border-2 border-ink bg-mint px-5 py-4 font-extrabold shadow-comic-sm disabled:opacity-45"
                  disabled={busy || guideMembers.length !== 2}
                  onClick={startGame}
                  type="button"
                >
                  Iniciar partida
                </button>
                <button
                  className="mt-3 w-full rounded-full px-5 py-3 text-sm font-bold text-ink/55 underline underline-offset-2"
                  disabled={busy}
                  onClick={closeRoom}
                  type="button"
                >
                  Cancelar sala
                </button>
              </div>
            )}

            {room.status === "waiting" && deviceRole.type === "cluegiver" && (
              <section className="rounded-3xl border-2 border-ink bg-white p-6 text-center shadow-comic">
                <span aria-hidden="true" className="text-6xl">🔐</span>
                <h2 className="mt-3 font-display text-3xl font-semibold">
                  Guía del Equipo {deviceRole.team + 1}
                </h2>
                <p className="mt-3 font-semibold text-ink/65">
                  La clave aparecerá aquí cuando el anfitrión inicie la partida.
                  No compartas esta pantalla con el otro equipo.
                </p>
                <button
                  className="mt-6 rounded-full border-2 border-ink bg-coral px-5 py-3 font-extrabold shadow-comic-sm"
                  disabled={busy}
                  onClick={() => setConfirmLeaveRoom(true)}
                  type="button"
                >
                  Salir de la sala
                </button>
                {confirmLeaveRoom && (
                  <div className="mt-4 rounded-2xl border-2 border-ink bg-cream p-4">
                    <p className="font-bold">
                      ¿Quieres desconectar esta guía y liberar su puesto?
                    </p>
                    <div className="mt-3 flex justify-center gap-2">
                      <button
                        className="rounded-full border-2 border-ink bg-white px-4 py-2 font-bold"
                        disabled={busy}
                        onClick={() => setConfirmLeaveRoom(false)}
                        type="button"
                      >
                        Cancelar
                      </button>
                      <button
                        className="rounded-full border-2 border-ink bg-coral px-4 py-2 font-extrabold"
                        disabled={busy}
                        onClick={leaveRoom}
                        type="button"
                      >
                        {busy ? "Saliendo…" : "Salir"}
                      </button>
                    </div>
                  </div>
                )}
              </section>
            )}

            {room.status === "playing" && (
              <div className="grid gap-5 lg:grid-cols-[1fr_19rem]">
                <div>
                  <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex gap-2">
                      {[0, 1].map((team) => (
                        <span
                          className={`rounded-full border-2 border-ink px-4 py-2 font-extrabold shadow-comic-sm ${
                            team === 0 ? "bg-bubblegum" : "bg-sky"
                          }`}
                          key={team}
                        >
                          Equipo {team + 1}: {room.public_state.scores[team]}
                        </span>
                      ))}
                    </div>
                    <span className="rounded-full border-2 border-ink bg-mustard px-4 py-2 font-extrabold shadow-comic-sm">
                      Turno: Equipo {room.public_state.activeTeam + 1}
                    </span>
                  </header>

                  {room.public_state.phase === "guessing" &&
                    room.public_state.clue && (
                      <div
                        aria-live="polite"
                        className="mb-4 rounded-3xl border-2 border-ink bg-white p-4 text-center shadow-comic-sm"
                      >
                        <p className="text-xs font-extrabold uppercase tracking-widest text-ink/55">
                          Pista · Equipo {room.public_state.activeTeam + 1}
                        </p>
                        <p className="font-display text-3xl font-semibold">
                          {room.public_state.clue.word} ·{" "}
                          {room.public_state.clue.count}
                        </p>
                        <p className="text-sm font-bold text-ink/60">
                          Intentos restantes: {room.public_state.guessesLeft}
                        </p>
                      </div>
                    )}

                  {room.public_state.phase === "clue" && (
                    <p className="mb-4 rounded-2xl border-2 border-ink bg-white p-4 text-center font-bold shadow-comic-sm">
                      Esperando pista de la guía del Equipo{" "}
                      {room.public_state.activeTeam + 1}…
                    </p>
                  )}

                  {deviceRole.type === "board" ? (
                    publicBoard
                  ) : (
                    <details className="rounded-3xl border-2 border-ink bg-white p-4 shadow-comic-sm">
                      <summary className="cursor-pointer font-extrabold">
                        Consultar tablero público
                      </summary>
                      <p className="mb-3 mt-2 text-xs font-bold text-ink/60">
                        Este tablero es visible para todos y no muestra la clave.
                      </p>
                      {publicBoard}
                    </details>
                  )}
                  {deviceRole.type === "board" &&
                    room.public_state.phase === "guessing" && (
                      <button
                        className="mt-4 w-full rounded-full border-2 border-ink bg-mustard px-5 py-3 font-extrabold shadow-comic-sm"
                        disabled={busy}
                        onClick={endTurn}
                        type="button"
                      >
                        Terminar turno
                      </button>
                    )}
                  {deviceRole.type === "board" && (
                    <div className="mt-4">
                      {confirmCloseRoom ? (
                        <div
                          aria-labelledby="confirm-end-game-title"
                          className="rounded-2xl border-2 border-ink bg-coral p-4 shadow-comic-sm"
                          role="alert"
                        >
                          <p
                            className="font-extrabold"
                            id="confirm-end-game-title"
                          >
                            ¿Terminar la partida para todos los dispositivos?
                          </p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <button
                              className="rounded-full border-2 border-ink bg-white px-4 py-2 font-extrabold"
                              disabled={busy}
                              onClick={() => setConfirmCloseRoom(false)}
                              type="button"
                            >
                              Seguir jugando
                            </button>
                            <button
                              className="rounded-full border-2 border-ink bg-ink px-4 py-2 font-extrabold text-white"
                              disabled={busy}
                              onClick={closeRoom}
                              type="button"
                            >
                              {busy ? "Terminando…" : "Sí, terminar partida"}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          className="w-full rounded-full border-2 border-ink bg-coral px-5 py-3 font-extrabold shadow-comic-sm"
                          disabled={busy}
                          onClick={() => setConfirmCloseRoom(true)}
                          type="button"
                        >
                          Terminar partida para todos
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <aside>
                  {deviceRole.type === "cluegiver" && (
                    <div className="space-y-3">
                      <div className="rounded-3xl border-2 border-ink bg-white p-4 shadow-comic-sm">
                        {visibleSecretKey ? (
                          <>
                          <h2 className="font-display text-2xl font-semibold">
                            Clave secreta · Equipo {deviceRole.team + 1}
                          </h2>
                          <p className="mt-1 text-xs font-bold text-ink/60">
                            No muestres este móvil al equipo rival.
                          </p>
                          <div className="mt-3 grid grid-cols-5 gap-1">
                            {room.public_state.board.map((card, index) => {
                              const owner = visibleSecretKey[index];
                              return (
                                <span
                                  className={`grid aspect-square place-items-center rounded-lg border border-ink text-[9px] font-extrabold ${
                                    owner === 0
                                      ? "bg-bubblegum"
                                      : owner === 1
                                        ? "bg-sky"
                                        : owner === 2
                                          ? "bg-stone-300"
                                          : "bg-ink text-white"
                                  }`}
                                  key={`${card.word}-key`}
                                  title={card.word}
                                >
                                  {card.word.slice(0, 3)}
                                </span>
                              );
                            })}
                          </div>
                          {isActiveGuide ? (
                            <form className="mt-4 space-y-3" onSubmit={sendClue}>
                              <label className="block text-sm font-extrabold" htmlFor="keyword-clue">
                                Pista de una palabra
                                <input
                                  autoComplete="off"
                                  className="mt-1 w-full rounded-xl border-2 border-ink bg-cream px-3 py-2 font-bold"
                                  id="keyword-clue"
                                  maxLength={40}
                                  onChange={(event) => setClueInput(event.target.value)}
                                  required
                                  value={clueInput}
                                />
                              </label>
                              <label className="block text-sm font-extrabold" htmlFor="keyword-clue-count">
                                Número de palabras
                                <input
                                  className="mt-1 w-full rounded-xl border-2 border-ink bg-cream px-3 py-2 font-bold"
                                  id="keyword-clue-count"
                                  max={Math.max(activeTeamRemaining, 1)}
                                  min={1}
                                  onChange={(event) =>
                                    setClueCount(Number(event.target.value))
                                  }
                                  type="number"
                                  value={clueCount}
                                />
                              </label>
                              <button
                                className="w-full rounded-full border-2 border-ink bg-mint px-4 py-3 font-extrabold shadow-comic-sm disabled:opacity-45"
                                disabled={busy || !isActiveGuide}
                                type="submit"
                              >
                                Enviar pista al tablero
                              </button>
                            </form>
                          ) : (
                            <p className="mt-4 rounded-2xl bg-cream p-3 text-center text-sm font-bold">
                              Espera el turno de tu equipo para enviar una pista.
                            </p>
                          )}
                          </>
                        ) : (
                          <p className="text-center font-bold">
                            {room.public_state.phase === "guessing"
                              ? "El equipo está debatiendo la pista."
                              : "Espera el turno de tu equipo."}
                          </p>
                        )}
                      </div>
                      {confirmLeaveRoom ? (
                        <div
                          aria-labelledby="confirm-leave-room-title"
                          className="rounded-2xl border-2 border-ink bg-coral p-4 shadow-comic-sm"
                          role="alert"
                        >
                          <p
                            className="font-extrabold"
                            id="confirm-leave-room-title"
                          >
                            Salir desconecta esta guía. Durante una partida no
                            podrás volver a ocupar este puesto.
                          </p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <button
                              className="rounded-full border-2 border-ink bg-white px-4 py-2 font-extrabold"
                              disabled={busy}
                              onClick={() => setConfirmLeaveRoom(false)}
                              type="button"
                            >
                              Seguir en la sala
                            </button>
                            <button
                              className="rounded-full border-2 border-ink bg-ink px-4 py-2 font-extrabold text-white"
                              disabled={busy}
                              onClick={leaveRoom}
                              type="button"
                            >
                              {busy ? "Saliendo…" : "Salir de la sala"}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          className="w-full rounded-full border-2 border-ink bg-coral px-5 py-3 font-extrabold shadow-comic-sm"
                          disabled={busy}
                          onClick={() => setConfirmLeaveRoom(true)}
                          type="button"
                        >
                          Salir de la sala
                        </button>
                      )}
                    </div>
                  )}
                  {deviceRole.type === "board" && (
                    <div className="rounded-3xl border-2 border-ink bg-white p-4 shadow-comic-sm">
                      <h2 className="font-display text-xl font-semibold">
                        Equipos
                      </h2>
                      {room.public_state.teams.map((team, index) => (
                        <p className="mt-2 text-sm font-bold" key={index}>
                          <span className={index === 0 ? "text-pink-700" : "text-sky-700"}>
                            Equipo {index + 1}:
                          </span>{" "}
                          {team.join(", ")}
                        </p>
                      ))}
                    </div>
                  )}
                </aside>
              </div>
            )}

            {room.status === "finished" && (
              <section className="rounded-3xl border-2 border-ink bg-white p-6 text-center shadow-comic sm:p-10">
                <span className="text-7xl">
                  {room.public_state.endReason === "assassin" ? "💥" : "🏆"}
                </span>
                <p className="mt-3 text-sm font-extrabold uppercase tracking-widest text-ink/55">
                  Partida terminada
                </p>
                <h2 className="mt-1 font-display text-4xl font-semibold">
                  {room.public_state.endReason === "closed"
                    ? "El anfitrión cerró la sala"
                    : room.public_state.endReason === "assassin"
                      ? `Equipo ${(room.public_state.winner ?? 0) + 1} gana: encontraron la asesina`
                      : room.public_state.winner === null
                        ? "Sala finalizada"
                        : `¡Gana el Equipo ${room.public_state.winner + 1}!`}
                </h2>
                <p className="mt-3 font-semibold text-ink/65">
                  Equipo 1: {room.public_state.scores[0]} · Equipo 2:{" "}
                  {room.public_state.scores[1]}
                </p>
                <button
                  className="mt-6 rounded-full border-2 border-ink bg-mint px-6 py-4 font-extrabold shadow-comic-sm"
                  onClick={deviceRole.type === "board" ? closeRoom : leaveRoom}
                  type="button"
                >
                  {deviceRole.type === "board" ? "Cerrar sala" : "Salir"}
                </button>
              </section>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
