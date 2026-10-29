# Datos y empaquetado Android

## Cómo guarda los datos la app

Actualmente no hay una base de datos. Cada tipo de dato vive en uno de estos
lugares:

| Dato | Ubicación | Persistencia |
| --- | --- | --- |
| Jugadores | `localStorage`, clave `la-ultima-ronda.players` | Se conserva en ese dispositivo entre usos |
| Preguntas personalizadas | `localStorage`, clave `la-ultima-ronda.custom-questions` | Se conserva en ese dispositivo entre usos |
| Preguntas y cartas incluidas | JSON en `src/data/questions.json` y `src/data/minigames.json` | Se empaquetan con la app |
| Mazo de Charadas | JSON en `src/data/charades.json` | Se empaqueta con la app |
| Cartas generadas con Gemini | Estado React en memoria | No se guardan; desaparecen al salir o reiniciar |
| Turno, votos y partida actual | Estado React en memoria | No se guardan; una nueva sesión empieza de cero |
| Verdades consecutivas por jugador | Estado React durante la partida | No se guardan; elegir reto reinicia el contador |
| Puntos de Charadas | Estado React de la partida | Temporales; se reinician al salir del modo |

## Categorías y regla de Verdad o Reto

Los mazos de preguntas ofrecen las categorías Chill, Picante, Escatológico y
Turbio. En «¿Qué prefieres?» y «¿Quién es más probable que...?» se elige una
categoría antes de ver las cartas; el filtro de intensidad (suave, intenso o
salvaje) se aplica de forma independiente.

En Verdad o Reto, cada jugador puede elegir Verdad dos veces seguidas. En su
turno siguiente, Verdad queda bloqueada y debe elegir Reto. El contador es
temporal y se reinicia al elegir Reto; no se guarda en `localStorage`.

Charadas incluye categorías y subcategorías locales. Cada turno dura 60
segundos por defecto; antes de cada ronda se puede elegir 30, 60, 90 o 120
segundos. Los aciertos suman un punto al jugador activo, mientras que las
palabras pasadas no suman. El marcador y los resúmenes duran únicamente hasta
salir del modo. La configuración permanece en vertical; al iniciar cada turno,
la app solicita orientación horizontal y pantalla completa. En Android oculta
las barras de estado y navegación con el plugin de barras del sistema incluido
en Capacitor 8. Al acabar o salir de la ronda, restaura la orientación y vuelve
a mostrar las barras. En navegador usa las APIs de pantalla completa y
orientación disponibles, y muestra un aviso si no están soportadas. Los
sensores requieren permiso cuando la plataforma lo solicita; mientras el
sensor funciona, la ronda se controla inclinando el teléfono. Si el sensor no
está disponible, se puede jugar con los botones táctiles **Acierto** y
**Pasar**. La selección de mazo incluye búsqueda por nombre, sin distinguir
acentos ni mayúsculas, y una cuadrícula de dos columnas desplazable con
tarjetas compactas, iconos y número de palabras.

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
