#Requires -Version 5.1
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^\d+\.\d+\.\d+$')]
    [string]$Version,

    [string]$Repo = "BrianDeveloper/PartyGame",
    [string]$JavaHome = "C:\Program Files\Java\jdk-21",
    [string]$NotesFile,
    [switch]$Draft
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $root

function Fail([string]$Message) {
    throw $Message
}

function Assert-LastExitCode([string]$Step) {
    if ($LASTEXITCODE -ne 0) {
        Fail "$Step falló con código $LASTEXITCODE."
    }
}

Write-Host "== Comprobando entorno =="

if (-not (Test-Path -LiteralPath (Join-Path $root ".env"))) {
    Fail "No existe .env en la raíz del proyecto. Créalo antes de compilar."
}

$javaExe = Join-Path $JavaHome "bin\java.exe"
if (-not (Test-Path -LiteralPath $javaExe)) {
    Fail "No se encontró JDK 21 en '$JavaHome'. Usa -JavaHome para indicar otra ruta."
}

gh auth status *> $null
if ($LASTEXITCODE -ne 0) {
    Fail "GitHub CLI no está autenticado. Ejecuta: gh auth login"
}

$branch = (git rev-parse --abbrev-ref HEAD).Trim()
Assert-LastExitCode "git rev-parse"
if ($branch -ne "main") {
    Fail "Debes estar en la rama main (rama actual: $branch)."
}

git fetch origin main
Assert-LastExitCode "git fetch"

$behind = [int](git rev-list --count "HEAD..origin/main")
if ($behind -gt 0) {
    Fail "main está $behind commit(s) por detrás de origin/main. Ejecuta git pull --ff-only y reintenta."
}

git rev-parse -q --verify "refs/tags/v$Version" *> $null
if ($LASTEXITCODE -eq 0) {
    Fail "El tag v$Version ya existe en local."
}

$remoteTag = git ls-remote --tags origin "refs/tags/v$Version"
Assert-LastExitCode "git ls-remote"
if ($remoteTag) {
    Fail "El tag v$Version ya existe en origin."
}

gh release view "v$Version" -R $Repo *> $null
if ($LASTEXITCODE -eq 0) {
    Fail "La release v$Version ya existe en GitHub."
}

Write-Host "== Actualizando versión =="

$gradlePath = Join-Path $root "android\app\build.gradle"
$gradle = Get-Content -LiteralPath $gradlePath -Raw

$codeMatch = [regex]::Match($gradle, 'versionCode\s+(\d+)')
if (-not $codeMatch.Success) {
    Fail "No se encontró versionCode en android/app/build.gradle."
}

$nameMatch = [regex]::Match($gradle, 'versionName\s+"([^"]+)"')
if (-not $nameMatch.Success) {
    Fail "No se encontró versionName en android/app/build.gradle."
}

$currentCode = [int]$codeMatch.Groups[1].Value
$currentName = $nameMatch.Groups[1].Value

if ($currentName -eq $Version) {
    $newCode = $currentCode
    Write-Host "versionName ya es $Version; se conserva versionCode $currentCode."
}
else {
    $newCode = $currentCode + 1
}

$updated = $gradle -replace 'versionCode\s+\d+', "versionCode $newCode"
$updated = $updated -replace 'versionName\s+"[^"]+"', "versionName `"$Version`""
[System.IO.File]::WriteAllText($gradlePath, $updated, (New-Object System.Text.UTF8Encoding($false)))

Write-Host "versionCode: $currentCode -> $newCode"
Write-Host "versionName: $Version"

Write-Host "== Compilando web y sincronizando Android =="

npm run cap:sync
Assert-LastExitCode "npm run cap:sync"

Write-Host "== Compilando APK =="

$env:JAVA_HOME = $JavaHome
Push-Location -LiteralPath (Join-Path $root "android")
try {
    & .\gradlew.bat assembleDebug --no-daemon
    Assert-LastExitCode "gradlew assembleDebug"
}
finally {
    Pop-Location
}

$metadataPath = Join-Path $root "android\app\build\outputs\apk\debug\output-metadata.json"
$metadata = Get-Content -LiteralPath $metadataPath -Raw | ConvertFrom-Json
$element = $metadata.elements[0]

if ([int]$element.versionCode -ne $newCode -or $element.versionName -ne $Version) {
    Fail "El APK generado no tiene la versión esperada (encontrado: $($element.versionName) / $($element.versionCode))."
}

$apkPath = Join-Path $root "android\app\build\outputs\apk\debug\app-debug.apk"
if (-not (Test-Path -LiteralPath $apkPath)) {
    Fail "No se generó el APK en $apkPath."
}

Write-Host "== Preparando notas del release =="

if ($NotesFile) {
    if (-not (Test-Path -LiteralPath $NotesFile)) {
        Fail "No existe el archivo de notas: $NotesFile"
    }
    $notesPath = (Resolve-Path -LiteralPath $NotesFile).Path
}
else {
    $notesPath = Join-Path $env:TEMP "partygame-v$Version-notes.md"
    $notes = @"
Actualización de La Última Ronda para Android.

- Actualización de la aplicación.

**Instalación:** descarga app-debug.apk en Android y ábrelo. Es un APK de depuración firmado para distribución directa, no una compilación de producción.
"@
    [System.IO.File]::WriteAllText($notesPath, $notes, (New-Object System.Text.UTF8Encoding($false)))
    Write-Host "Aviso: no se pasó -NotesFile; se usarán notas genéricas en $notesPath"
}

Write-Host "== Creando commit =="

git add -A
Assert-LastExitCode "git add"

git diff --cached --quiet
if ($LASTEXITCODE -eq 0) {
    Fail "No hay cambios para commitear."
}

git commit -m "Release v$Version"
Assert-LastExitCode "git commit"

Write-Host "== Subiendo a origin/main =="

git push origin main
Assert-LastExitCode "git push"

Write-Host "== Creando release en GitHub =="

$releaseArgs = @(
    "release", "create", "v$Version", $apkPath,
    "-R", $Repo,
    "--title", "La Última Ronda v$Version",
    "--notes-file", $notesPath
)

if ($Draft) {
    $releaseArgs += "--draft"
}

gh @releaseArgs
Assert-LastExitCode "gh release create"

Write-Host "== Verificando release =="

gh release view "v$Version" -R $Repo --json name,tagName,url,assets
Assert-LastExitCode "gh release view"

$hash = (Get-FileHash -LiteralPath $apkPath -Algorithm SHA256).Hash

Write-Host ""
Write-Host "Release v$Version publicada correctamente."
Write-Host "APK: $apkPath"
Write-Host "SHA256: $hash"
