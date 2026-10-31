# Datos y empaquetado Android

## Cómo guarda los datos la app

Actualmente no hay una base de datos. Cada tipo de dato vive en uno de estos
lugares:

| Dato | Ubicación | Persistencia |
| --- | --- | --- |
| Jugadores | `localStorage`, clave `la-ultima-ronda.players` | Se conserva en ese dispositivo entre usos |
| Preguntas personalizadas | `localStorage`, clave `la-ultima-ronda.custom-questions` | Se guarda inmediatamente en ese dispositivo, se inyecta en el mazo del modo correspondiente y aparece al terminar de añadirla; no modifica el JSON empaquetado |
| Frases, palabras y pistas personalizadas | `localStorage`, clave `la-ultima-ronda.custom-game-content` | Los formularios de cada juego guardan entradas con los campos que requiere su banco; solo se usan en ese dispositivo y no modifican el JSON empaquetado |
| Bancos de preguntas | Un JSON por juego en `src/data/` (`what-would-you-rather.json`, `most-likely.json`, `impostor.json`, `never-have-i-ever.json`, `pasapalabra.json`, `telephone-game.json` y `taboo.json`) | Se empaquetan con la app |
| Reglas y roles de juegos | `kings-cup.json` y `assassin.json` | Se empaquetan con la app |
| Mazo de Charadas y palabras de Palabras clave | `charades.json` y `keywords.json` | Se empaquetan con la app |
| Cartas generadas con Gemini | Estado React en memoria | No se guardan; desaparecen al salir o reiniciar |
| Turno, votos y partida actual | Estado React en memoria | No se guardan; una nueva sesión empieza de cero |
| Puntos de Charadas | Estado React de la partida | Temporales; se reinician al salir del modo |
| Frases y partida de Yo nunca nunca | JSON y estado React | El mazo viene con la app; el progreso es temporal |
| Reglas personalizadas de King's Cup | `localStorage`, clave `la-ultima-ronda.kings-cup-rules` | Los títulos y descripciones se guardan en el dispositivo; se pueden restaurar los originales |
| Baraja y partida de King's Cup | Baraja aleatoria de 52 cartas y estado React | Progreso temporal; se reinicia al salir |
| Roscos y marcador de Pasapalabra | JSON local y estado React | Dos roscos aleatorios por partida, con tiempo configurable por jugador (1, 1,5, 2 o 3 minutos); se recuerdan las últimas ocho pistas usadas por letra en `localStorage` para reducir repeticiones entre partidas |
| Frases y cadena de Teléfono descompuesto | JSON local y estado React | Las frases vienen con la app; la partida es temporal |
| Tarjetas y marcador de Tabú | JSON local y estado React | Tiempo configurable por turno (30, 45, 60, 90 o 120 segundos); las tarjetas vienen con la app y la partida es temporal |
| Temporizadores de Charadas e Impostor | Estado React | Charadas permite 30, 60, 90 o 120 segundos por turno; El Impostor permite 30, 45, 60, 90 o 120 segundos de debate |
| Salas de Palabras clave | Supabase Realtime y funciones SQL | Estado sincronizado entre dispositivos; la clave queda protegida en el servidor y cada turno tiene temporizador configurable |

## Editar los bancos locales

Cada juego mantiene sus datos en su propio archivo de `src/data/`. Las
preguntas de «¿Qué prefieres?» están en `what-would-you-rather.json` y las de
«¿Quién es más probable que...?» en `most-likely.json`; ambos conservan sus
categorías e intensidades. El Impostor, Yo nunca nunca, Teléfono descompuesto y
Tabú usan respectivamente `impostor.json`, `never-have-i-ever.json`,
`telephone-game.json` y `taboo.json`. Las reglas y los roles también viven en
los archivos específicos indicados arriba.

Los formularios «Añadir contenido al banco» guardan entradas adicionales en
`localStorage`, sin sobrescribir los JSON de la aplicación. Hay formularios para
palabras del Impostor y Palabras clave; frases de Yo nunca nunca y Teléfono
descompuesto; tarjetas de Tabú con sus cinco palabras prohibidas; pistas de
Pasapalabra con letra, tipo, definición y respuesta; y palabras, categorías y
subcategorías de Charadas. Las preguntas personalizadas de los dos juegos de
tarjetas se guardan por separado en `la-ultima-ronda.custom-questions`.

### Añadir categorías y mazos de Charadas

Charadas construye la selección desde el array `categories` de
`src/data/charades.json`: cada elemento genera una categoría y cada elemento de
`subcategories` un mazo. También se pueden añadir palabras y crear categorías o
subcategorías desde el formulario del juego; esas entradas se almacenan en el
dispositivo y aparecen automáticamente en la selección. Para editar el banco
incluido en la app, usa esta estructura:

```json
{
  "id": "deportes",
  "name": "Deportes",
  "icon": "⚽",
  "subcategories": [
    {
      "id": "deportes-de-equipo",
      "name": "Deportes de equipo",
      "icon": "🏀",
      "words": ["encestar un tiro libre", "celebrar un gol"]
    }
  ]
}
```

Añade el objeto de categoría dentro de `categories` y cada mazo dentro de su
`subcategories`. Los `id` deben ser únicos, cada subcategoría debe incluir una
lista `words` con al menos una palabra, y `icon` es opcional (si se omite, el
mazo muestra 🎭). Las tarjetas heredan colores de la paleta de Charadas. Vite
actualiza la interfaz al guardar el JSON durante el desarrollo; para una app
instalada, hay que volver a compilarla y distribuir la nueva versión.

`pasapalabra.json` agrupa las pistas por letra. Cada elemento contiene un `id`
único, `letter`, `clueType` (`startsWith` o `contains`), `clue` y `answer`.
El banco incluye 540 pistas, 20 por cada letra del rosco.
La respuesta debe empezar por la letra indicada para `startsWith` o contenerla
para `contains`; la Ñ se valida como una letra distinta de la N. Al añadir
pistas, mantén al menos dos por letra para que una partida pueda generar los
dos roscos sin repetir una pista dentro de la misma partida. El historial local
conserva hasta ocho IDs recientes por letra para reducir repeticiones entre
partidas. El formulario del juego valida que la respuesta empiece por la letra
indicada o la contenga, según el tipo de pista; se requiere un banco de al
menos dos pistas por letra.

## Categorías e intensidades

Los mazos de preguntas ofrecen las categorías Chill, Picante, Escatológico y
Turbio. En «¿Qué prefieres?» y «¿Quién es más probable que...?» se elige una
categoría antes de ver las cartas; el filtro de intensidad (suave, intenso o
salvaje) se aplica de forma independiente. Las tarjetas de «¿Quién es más
probable que...?» no asignan nombres: el grupo decide a quién señalar.

En El Impostor se elige entre una ronda clásica y el modo de eliminación,
además de repartir entre uno y tres impostores. En eliminación, cada reunión
termina expulsando al jugador con más votos; un empate no elimina a nadie.
Gana la tripulación cuando expulsa a todos los impostores y ganan los
impostores cuando igualan o superan en número a la tripulación viva. Para que
la partida empiece equilibrada, debe haber más tripulantes que impostores.

En «Yo nunca nunca», cada persona empieza con cinco dedos levantados y baja uno
si la frase le aplica. Se puede elegir una de las tres intensidades o mezclar
todas. Las frases se barajan de nuevo cuando se agota el mazo, evitando repetir
la última frase justo al volver a empezar; el juego continúa hasta que alguien
se queda sin dedos o el grupo decide terminar. Al final, el grupo cuenta los
dedos restantes para decidir quién gana. Compartir anécdotas es opcional, y el
juego no asigna puntos por beber ni impone castigos.

En King's Cup, la app mezcla una baraja estándar de 52 cartas y asigna los
turnos entre los jugadores. Cada valor propone una dinámica grupal; al salir
cada Rey, se puede proponer una regla colectiva y el cuarto Rey cierra la
partida con un reto final acordado. No hay copa compartida ni penalizaciones
por beber: todas las dinámicas se pueden hacer sin alcohol y cualquier persona
puede pasar o proponer una alternativa. Desde la configuración se pueden editar
los títulos y descripciones de las trece cartas; los cambios se guardan en
`localStorage` y se mantienen entre partidas en ese dispositivo. También se
pueden restaurar los textos originales del banco `kings-cup.json`.

En Pasapalabra se enfrentan dos jugadores, cada uno con su rosco circular local
de 27 letras y un tiempo activo configurable de uno, uno y medio, dos o tres
minutos. Un narrador externo lee las
pistas y juzga las respuestas; la app muestra el rosco, revela la respuesta
solo cuando se solicita y registra aciertos, fallos y letras pasadas. Al decir
«Pasapalabra», el reloj del jugador se pausa y empieza el turno del rival; al
volver a jugar, retoma con el tiempo restante y puede continuar el rosco. El
turno termina cuando se agota el tiempo o se completa el rosco. Al acabar los
dos jugadores, gana quien tenga más aciertos; si empatan, la partida termina
en empate. El modo necesita solo dos jugadores.

En Teléfono descompuesto, la app muestra una frase a la primera persona, que
la memoriza y la pasa de boca en boca con las reglas tradicionales. Cuando la
frase completa la vuelta, el grupo revela la frase original en la app y compara
el resultado. La app no registra respuestas ni dirige la cadena. El inicio
rota entre jugadores en cada ronda. El mazo usa todas las frases y se vuelve a
barajar al agotarse, sin repetir inmediatamente la última frase; el grupo puede
terminar la partida cuando quiera y no hay puntuación.

En Tabú se forman dos equipos con al menos cuatro jugadores. En cada turno, una
persona tiene un tiempo configurable (30, 45, 60, 90 o 120 segundos) para
conseguir que su equipo adivine palabras sin
decir ninguna de las cinco prohibidas. Un acierto suma un punto, pasar no suma
y una infracción resta uno. Los equipos alternan turnos; se puede jugar uno,
dos o tres turnos por equipo.

Palabras clave requiere conexión a internet y un proyecto Supabase. Se juega
desde tres dispositivos: un tablero público y un teléfono privado por equipo
para la persona guía fija. Los equipos se asignan manualmente; se necesitan al
menos dos integrantes por equipo. La partida usa 25 palabras, una clave con
nueve objetivos para el equipo inicial, ocho para el rival, siete neutrales y
una asesina. La guía da una pista de una palabra y un número; el equipo puede
hacer hasta ese número más una conjetura. Las claves no se incluyen en el estado
público ni se leen directamente desde las tablas: una función SQL solo entrega
la clave en privado a las guías registradas mientras la partida está activa.
Cada guía conserva su clave fuera de turno, como en el juego de mesa; el tablero
público de referencia en los teléfonos guía se muestra plegado. Configura
`VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` en `.env`, activa el acceso
anónimo en Supabase y aplica las migraciones de `supabase/migrations/` antes de
crear una sala. Si ya aplicaste la migración inicial, ejecuta también
`supabase/migrations/20261030155000_keep_keyword_key_available_to_guides.sql`
para mantener visible la clave privada de ambas guías durante la partida.
El estado de sala del dispositivo se guarda en `localStorage` para sobrevivir
al cierre de la app. Si hace falta conectarse manualmente a una partida en
curso, usa el mismo dispositivo/perfil y la misma sesión anónima de la guía;
aplica también
`supabase/migrations/20261030160300_reconnect_keyword_guides_during_game.sql`.
Las guías pueden salir de una sala desde su dispositivo; esto elimina su
registro de miembro y libera el puesto. En una partida iniciada, salir es
definitivo para esa guía. Aplica
`supabase/migrations/20261030162400_leave_keyword_room.sql` para habilitarlo.
La pantalla de guía carga los integrantes del equipo seleccionado desde la
sala. Aplica
`supabase/migrations/20261030184300_keyword_team_roster_for_guides.sql` para
habilitar la consulta del roster antes de conectarse.
El tablero incluye **Terminar partida para todos**, que finaliza la sala y
sincroniza ese resultado con las otras pantallas. También puede **pasar el turno
sin pista** durante la fase de pista, con confirmación, para desbloquear la
partida si una guía no responde.
La clave privada se vuelve a solicitar automáticamente cuando cambia el equipo
activo, de modo que la guía entrante recibe su tablero aunque la consulta
anterior haya fallado. Aplica
`supabase/migrations/20261030200000_keyword_turn_recovery.sql` para permitir
que el tablero termine el turno tanto en la fase de pista como en la de
conjeturas; esta migración también vuelve a dejar la clave disponible para las
dos guías mientras la partida está activa.
Al crear la sala se elige la duración de cada turno: 1:00, 1:30, 2:00 o 3:00,
con 90 segundos por defecto. El temporizador se sincroniza con el servidor, se
reinicia al empezar el turno y al enviar una pista, y cualquier dispositivo de
la sala puede cerrar el turno cuando vence. Las salas creadas antes de esta
migración siguen funcionando sin temporizador. Aplica
`supabase/migrations/20261030210000_keyword_turn_timer.sql` para habilitarlo.

La función `cleanup_expired_keyword_rooms()` elimina salas y sus datos asociados
cuando tienen más de 12 horas. Para automatizarlo, aplica también
`supabase/migrations/20261030150900_cleanup_expired_keyword_rooms.sql`. Después,
en **Integrations → Cron**, crea un trabajo llamado `cleanup-keyword-rooms`,
con programación `17 * * * *` y este comando:

```sql
select public.cleanup_expired_keyword_rooms();
```

Así se revisan las salas cada hora; los datos de las salas y sus claves secretas
se eliminan en cascada. El rol `anon` y los usuarios autenticados de la app no
pueden ejecutar esta función.

### Preparar el proyecto de Supabase

1. Crea un proyecto en el Dashboard de Supabase. Elige una región cercana a
   quienes jugarán y guarda la contraseña de la base de datos en un gestor de
   contraseñas; la app no la necesita.
2. En la configuración del proyecto, copia el **Project URL** y la clave
   pública **anon** (o **publishable**, si el Dashboard ofrece esa opción).
   No uses ni compartas la clave `service_role`/secreta.
3. En Authentication, abre los proveedores o métodos de inicio de sesión y
   activa **Anonymous Sign-Ins**. La app usa una sesión anónima independiente
   por dispositivo.
4. Abre **SQL Editor**, crea una consulta nueva, pega el contenido completo de
   `supabase/migrations/20261030000000_create_keywords_rooms.sql` y ejecútala.
   La migración crea las tablas y funciones, protege la clave con RLS y añade
   las tablas de sala a la publicación de Realtime.
5. En la raíz del proyecto, crea `.env` a partir de `.env.example` si todavía
   no existe y completa las variables:

   ```dotenv
   VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
   VITE_SUPABASE_ANON_KEY=tu-clave-publica
   ```

   `.env` está excluido de Git. No pegues aquí la contraseña de la base de
   datos ni una clave `service_role`/secreta. Reinicia `npm run dev` si ya
   estaba ejecutándose para que Vite cargue las variables.
6. Para una primera prueba, abre la app en tres sesiones/dispositivos con
   internet: crea la sala en el tablero y conecta una guía por equipo. Cada
   equipo necesita al menos dos nombres asignados. En escritorio, usa perfiles
   de navegador distintos; dos pestañas del mismo perfil comparten la sesión
   anónima.
7. Para probar en Android, configura las variables antes de ejecutar
   `npm run cap:sync` y abrir el proyecto con `npm run cap:open`. Las variables
   Vite quedan incorporadas en el bundle al compilar; cualquier cambio requiere
   volver a compilar y sincronizar.

En los mazos de «¿Qué prefieres?» y «¿Quién es más probable que...?», se avanza
solo deslizando la tarjeta horizontalmente; no hay botones inferiores de
omitir/siguiente. El área de la carta mantiene una altura fija para que el
contenido no empuje la página al cambiar de pregunta, y el texto largo se puede
desplazar dentro de la propia tarjeta.

Charadas incluye categorías y subcategorías locales. Cada turno dura 60
segundos por defecto; antes de cada ronda se puede elegir 30, 60, 90 o 120
segundos. Los aciertos suman un punto al jugador activo, mientras que las
palabras pasadas no suman. El marcador y los resúmenes duran únicamente hasta
salir del modo. La configuración permanece en vertical; al iniciar cada turno,
la app solicita orientación horizontal y pantalla completa. En Android oculta
las barras de estado y navegación con el plugin de barras del sistema incluido
en Capacitor 8. Al acabar o salir de la ronda, restaura la orientación y vuelve
a mostrar las barras. En navegador usa las APIs de pantalla completa y
orientación disponibles, y muestra un aviso si no están soportadas. Antes de
empezar se puede elegir entre **Modo Sensores** y **Modo Táctil**. En Sensores,
coloca el móvil neutro en la frente durante la calibración; inclínalo hacia
atrás más de 70° para acertar o hacia delante más de 30° para pasar. Estos
ángulos se miden desde la posición calibrada y el gesto debe mantenerse durante
250 ms; volver antes a la posición neutral cancela la acción. Se usa el ángulo
beta del evento de orientación cuando está disponible, con el acelerómetro de
Capacitor como alternativa. Si el sensor no está disponible o no tiene
permiso, se muestran botones táctiles de respaldo. En Modo Táctil, ya en
horizontal, toca la mitad izquierda de la pantalla para acertar y la derecha
para pasar. Al comenzar cada turno, una cuenta regresiva de cinco segundos da
tiempo para colocar el teléfono y prepararse; la duración elegida empieza al
terminar la cuenta. Ambos controles muestran una señal grande con icono y fondo
verde para acierto o coral para pasar, vibran cuando el dispositivo lo admite
y avanzan de palabra después de 800 ms. La selección de mazo incluye búsqueda
por nombre, sin distinguir acentos ni mayúsculas, y una cuadrícula de dos
columnas desplazable con tarjetas compactas, iconos y número de palabras.

## El Asesino

El modo de El Asesino funciona como repartidor local de roles para 4 a 8
participantes seleccionados de la lista de jugadores. Los roles se asignan al
azar y se revelan uno por uno manteniendo pulsado el teléfono: un Asesino, un
Detective y el resto Civiles. El Médico es opcional, requiere al menos 5
participantes y puede proteger a alguien cada noche, pero no a la misma persona
en noches consecutivas.

La app no narra ni gestiona la partida. El grupo necesita un narrador externo
que dirija las noches y el debate; idealmente, alguien que no juegue. El botón
«Ver resumen de reglas» muestra voluntariamente las funciones de cada rol y las
condiciones de victoria. La información de la partida no se guarda al salir del
modo.

En Android, `localStorage` pertenece al WebView de la aplicación y permanece
local al teléfono. No se sincroniza entre dispositivos ni se comparte con otros
jugadores. Al borrar los datos de la app o desinstalarla, esos datos locales
pueden perderse.

Gemini no es una base de datos: la app manda al proxy el modo, la categoría y la
intensidad; el proxy solicita preguntas a Google y devuelve el resultado. La
clave de Gemini se mantiene en el entorno del servidor. Las cartas generadas no
se guardan en el servidor ni en el teléfono.

## Preparación

1. Instala Node.js 20.6 o posterior, Android Studio y el Android SDK desde
   Android Studio.
2. Desde la raíz del proyecto, instala las dependencias:

   ```powershell
   npm install
   ```

3. Si vas a probar la generación con Gemini, despliega primero el proxy Node.js
   por HTTPS. Configura `GEMINI_API_KEY` como secreto en el proveedor del
   servidor, no en el frontend ni en Android.
4. Configura CORS en el proxy: `APP_ORIGIN` acepta orígenes separados por coma.
   Incluye el origen web de producción si lo usas y `https://localhost` para
   Capacitor Android.

La integración de Gemini es opcional; sin servidor disponible, los mazos
incluidos y las preguntas personalizadas guardadas siguen funcionando.

## Crear o actualizar el proyecto Android

El proyecto nativo ya está creado en `android/`. Si se parte de una copia donde
no existe esa carpeta, créala una sola vez:

```powershell
npx cap add android
```

Para configurar la URL pública del proxy en el frontend antes de empaquetar,
copia `.env.example` a `.env` y establece `VITE_API_BASE_URL`:

```dotenv
VITE_API_BASE_URL=https://tu-proxy.example
```

Si no usas Gemini, deja la variable vacía. No pongas la clave de Gemini en
`.env`, en ninguna variable `VITE_`, ni en el código de React: las variables
`VITE_` se incluyen en el frontend compilado y pueden extraerse del APK.

El plugin oficial de orientación de pantalla se registra en Android. El plugin
de movimiento utiliza los eventos del sensor disponibles en el WebView; por
eso puede no aparecer como módulo Android independiente. Después de instalar o
actualizar estas dependencias, sincroniza el proyecto nativo:

Compila la web y sincroniza los archivos con Capacitor:

```powershell
npm run cap:sync
```

Este comando equivale a compilar `dist` y luego ejecutar `cap sync`. Cada vez
que cambies el frontend o la URL del proxy, vuelve a ejecutarlo antes de crear
otro APK.

## Compilar un APK de depuración

### Opción A: Android Studio

1. Abre Android Studio.
2. Selecciona **Open** y elige la carpeta `android/` del proyecto.
3. Espera a que termine **Gradle Sync**. Si Android Studio pide instalar una
   versión del SDK o herramientas de compilación, acepta e instala los
   componentes que solicite.
4. Selecciona **Build > Build Bundle(s) / APK(s) > Build APK(s)**.
5. Al terminar, usa el enlace **Locate** de la notificación de compilación. La
   ruta habitual del APK es:

   ```text
   android/app/build/outputs/apk/debug/app-debug.apk
   ```

### Opción B: PowerShell

Después de ejecutar `npm run cap:sync`, compila desde el directorio Android:

```powershell
Set-Location android
.\gradlew.bat assembleDebug
Set-Location ..
```

El APK de depuración queda en
`android/app/build/outputs/apk/debug/app-debug.apk`.

## Instalar en un teléfono

Activa las opciones de desarrollador y la depuración USB del teléfono, conéctalo
al ordenador y acepta la autorización que aparezca. Con Android Platform Tools
instalado, ejecuta desde la raíz:

```powershell
adb devices
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

También puedes copiar el APK al teléfono y abrirlo allí. Android puede pedir que
permitas instalar aplicaciones desde esa fuente.

## Generar una versión firmada para distribuir

Un APK de depuración sirve para probar, no para una publicación de producción.
En Android Studio:

1. Selecciona **Build > Generate Signed Bundle / APK**.
2. Elige **APK** y continúa.
3. Crea o selecciona un keystore y completa la firma.
4. Selecciona la variante `release` y genera el paquete.

Guarda el keystore, sus contraseñas y copias de seguridad en un lugar seguro
fuera del repositorio. Perder el keystore puede impedir actualizar una app ya
distribuida con la misma identidad.

## Actualizar cambios web

El ciclo habitual es:

```powershell
npm run cap:sync
npm run cap:open
```

Después, genera el APK desde Android Studio o ejecuta `.\gradlew.bat
assembleDebug` en la carpeta `android/`. La configuración nativa de Capacitor
está en `capacitor.config.ts`.
