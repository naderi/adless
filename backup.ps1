# Creates backup\AdLess-backup-<date>.7z (+ .sha256 and RESTORE.md) and removes older archives.
# Run after every release:  powershell -File backup.ps1
# Contents: the whole project without backup\ and without everything that can be recreated
# (node_modules, build output, the uBO Lite engine and its pinned git submodule vendor\uBlock).
# A browser extension has no signing key and no Scoop manifest; the stores sign the packages.
$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$backup = Join-Path $root 'backup'
$date = Get-Date -Format 'yyyy-MM-dd'
$name = "AdLess-backup-$date.7z"
$version = (Get-Content (Join-Path $root 'package.json') -Raw | ConvertFrom-Json).version

$sevenZip = (Get-Command 7z -ErrorAction SilentlyContinue).Source
if (-not $sevenZip) { $sevenZip = Join-Path $env:ProgramFiles '7-Zip\7z.exe' }
if (-not (Test-Path $sevenZip)) { throw '7z nicht gefunden.' }

$excluded = @('backup', 'node_modules', 'dist', '.output', '.wxt', 'engine', 'vendor\uBlock', '.git\modules') |
    ForEach-Object { Join-Path $root $_ }

$stage = Join-Path ([IO.Path]::GetTempPath()) ("adless-backup-" + [Guid]::NewGuid().ToString('N'))
try {
    New-Item -ItemType Directory -Force "$stage\AdLess" | Out-Null
    robocopy $root "$stage\AdLess" /E /XD @excluded /NFL /NDL /NJH /NJS /NP | Out-Null
    if ($LASTEXITCODE -ge 8) { throw "robocopy fehlgeschlagen ($LASTEXITCODE)" }

    New-Item -ItemType Directory -Force $backup | Out-Null
    $archive = Join-Path $backup $name
    if (Test-Path $archive) { Remove-Item $archive }
    & $sevenZip a -t7z -mx=9 $archive "$stage\*" | Out-Null
    if ($LASTEXITCODE) { throw '7z fehlgeschlagen.' }
    & $sevenZip t $archive | Out-Null
    if ($LASTEXITCODE) { throw 'Archivtest fehlgeschlagen.' }
}
finally {
    Remove-Item -Recurse -Force $stage -ErrorAction SilentlyContinue
}

$hash = (Get-FileHash $archive -Algorithm SHA256).Hash.ToLower()
[IO.File]::WriteAllText("$archive.sha256", "$hash *$name`n")

# Keep only the newest backup.
Get-ChildItem $backup -Filter 'AdLess-backup-*.7z*' |
    Where-Object { $_.Name -ne $name -and $_.Name -ne "$name.sha256" } |
    Remove-Item

$restore = @"
# AdLess – Backup vom $date (Version $version)

## Inhalt
- ``AdLess/`` – komplettes Projekt inkl. Quellcode, Icons, Doku und Git-Repo, ohne alles, was sich neu erzeugen lässt
  (``node_modules``, ``dist``, ``.output``, ``.wxt``, ``engine``, ``vendor/uBlock`` mit ``.git/modules``).
- Kein Signaturschlüssel und kein Scoop-Manifest: Browser-Erweiterungen werden von den Stores signiert und verteilt.

Erzeugt mit ``backup.ps1`` (nach jedem Release ausführen; ältere Archive werden dabei entfernt).

## Wiederherstellen
1. Archiv entpacken, ``AdLess\`` nach ``D:\Cloud\Rclone\pCloud\Work\Browsers\AdLess`` kopieren.
2. ``git submodule update --init --depth 1`` – holt uBlock Origin in der gepinnten Version nach ``vendor\uBlock``.
3. ``pnpm install`` (Node.js 24, pnpm, Git Bash und curl nötig; die Versionen stehen in ``pnpm-lock.yaml``).
4. ``pnpm engine`` – baut uBO Lite mit den aktuellen Filterlisten nach ``engine\``.
5. ``pnpm build`` – baut AdLess nach ``dist\chrome-mv3``; ``pnpm zip`` erzeugt das ZIP für Chrome Web Store und Edge Add-ons.
"@
[IO.File]::WriteAllText((Join-Path $backup 'RESTORE.md'), $restore, (New-Object Text.UTF8Encoding $false))

Write-Host "OK: $archive"
Write-Host "  sha256 $hash"
