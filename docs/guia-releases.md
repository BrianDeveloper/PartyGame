# Guía para publicar una release

Esta guía resume el proceso completo para compilar el APK y publicarlo en
GitHub Releases. Está pensada para hacerlo desde PowerShell en este equipo.

## Requisitos

- Node.js 20.6 o posterior.
- JDK 21. El proyecto no compila con JDK 17: Capacitor usa Java 21 y falla con
  `invalid source release: 21`.
- Android SDK instalado y `android/local.properties` apuntando a él.
- GitHub CLI (`gh`) autenticado con una cuenta que tenga permisos sobre el repo.
- Archivo `.env` en la raíz con las variables de Vite configuradas. No se sube
  a Git, pero se necesita para compilar el APK.

Comprobaciones rápidas:

```powershell
node --version
& "C:\Program Files\Java\jdk-21\bin\java.exe" -version
gh auth status
Test-Path .env
```

## 1. Elegir la versión

Cada release debe tener un `versionCode` mayor que el anterior y un
`versionName` nuevo. Por ejemplo, si la última fue `1.0.7` con `versionCode 8`,
la siguiente será `1.0.8` con `versionCode 9`.

Edita `android/app/build.gradle`:

```gradle
versionCode 9
versionName "1.0.8"
```

No hace falta cambiar la versión de `package.json`; el release se controla con
la versión de Android.

## 2. Compilar la web y sincronizar Android

Desde la raíz del proyecto:

```powershell
npm run cap:sync
```

Este comando ejecuta TypeScript, compila `dist` y copia los archivos web a
`android/app/src/main/assets/public`. Si falla TypeScript, corrige el error
antes de continuar.

## 3. Compilar el APK

Usa JDK 21 de forma explícita:

```powershell
$env:JAVA_HOME = "C:\Program Files\Java\jdk-21"
Set-Location android
.\gradlew.bat assembleDebug --no-daemon
Set-Location ..
```

El APK queda en:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

Verifica que la versión sea la correcta:

```powershell
Get-Content android/app/build/outputs/apk/debug/output-metadata.json
```

Debe mostrar el `versionCode` y `versionName` que elegiste.

## 4. Commit y push

Revisa los cambios antes de confirmar:

```powershell
git status
git diff --stat
```

Añade todo, confirma y sube:

```powershell
git add -A
git commit -m "Release v1.0.8"
git push origin main
```

El APK y `dist/` están ignorados por Git; solo se sube el código y la
documentación.

## 5. Crear la release en GitHub

Prepara las notas en un archivo temporal, por ejemplo
`$env:TEMP\release-notes.md`, con este formato:

```markdown
Actualización de La Última Ronda para Android.

- Cambio 1.
- Cambio 2.

**Antes de jugar Palabras clave:** ejecuta en Supabase SQL Editor la migración
supabase/migrations/NOMBRE_DE_LA_MIGRACION.sql.

**Instalación:** descarga app-debug.apk en Android y ábrelo. Es un APK de
depuración firmado para distribución directa, no una compilación de producción.
```

Crea la release adjuntando el APK:

```powershell
gh release create v1.0.8 "android/app/build/outputs/apk/debug/app-debug.apk" `
  -R BrianDeveloper/PartyGame `
  --title "La Última Ronda v1.0.8" `
  --notes-file "$env:TEMP\release-notes.md"
```

`gh release create` crea el tag `v1.0.8` apuntando al último commit de `main`.

## 6. Verificar

Comprueba que la release existe y que el APK está adjunto:

```powershell
gh release view v1.0.8 -R BrianDeveloper/PartyGame --json name,tagName,url,assets
```

Opcionalmente, descarga el APK y compara su hash con el local:

```powershell
$url = "https://github.com/BrianDeveloper/PartyGame/releases/download/v1.0.8/app-debug.apk"
$out = "$env:TEMP\party-game-v1.0.8.apk"
Invoke-WebRequest -Uri $url -OutFile $out

Get-FileHash $out -Algorithm SHA256
Get-FileHash "android/app/build/outputs/apk/debug/app-debug.apk" -Algorithm SHA256
```

Los dos hashes deben coincidir.

## Script automatizado

El script `scripts/release.ps1` hace los pasos 1 a 6 de esta guía: sube la
versión, compila, crea el commit, hace push y publica la release con el APK.

```powershell
.\scripts\release.ps1 -Version 1.0.8 -NotesFile "$env:TEMP\release-notes.md"
```

Opciones:

- `-Draft`: crea la release como borrador.
- `-JavaHome`: ruta alternativa a JDK 21.
- `-Repo`: otro repositorio de GitHub.
- `-NotesFile`: archivo con las notas. Si se omite, usa notas genéricas.

El script se detiene si la rama no es `main`, si `main` está por detrás de
`origin/main`, si el tag o la release ya existen, o si el APK generado no tiene
la versión esperada. No hace `git pull`: actualiza la rama antes de ejecutarlo.

## Errores habituales

| Error | Solución |
| --- | --- |
| `invalid source release: 21` | Define `JAVA_HOME` con JDK 21 antes de ejecutar Gradle. |
| `npm run cap:sync` falla en TypeScript | Corrige el error de tipos y vuelve a ejecutar. |
| `versionCode ... has already been used` | Sube el `versionCode` en `android/app/build.gradle`. |
| El tag ya existe | Usa una versión nueva o elimina la release/tag anterior con cuidado. |
| `gh: not logged in` | Ejecuta `gh auth login`. |
| `App not installed` o error de firma | Desinstala la versión anterior o compila en el mismo equipo para conservar la clave debug. |
| Play Protect avisa al instalar | Elige `Instalar de todos modos`; es normal en APK fuera de Play Store. |

## Checklist rápido

- [ ] Versión actualizada en `android/app/build.gradle`.
- [ ] `npm run cap:sync` terminó sin errores.
- [ ] APK generado con JDK 21.
- [ ] `output-metadata.json` muestra la versión nueva.
- [ ] Commit `Release vX.Y.Z` subido a `main`.
- [ ] Release creada con el APK adjunto.
- [ ] Hash del APK descargado coincide con el local.
