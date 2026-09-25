param([Parameter(Mandatory=$true)][string]$ReleaseDirectory)
$ErrorActionPreference = 'Stop'

$root = [IO.Path]::GetFullPath($ReleaseDirectory)
$source = Join-Path $root 'source'
$assets = Join-Path $root 'releases'
if (-not (Test-Path -LiteralPath $source -PathType Container)) { throw "Release source folder missing: $source" }
if (-not (Test-Path -LiteralPath $assets -PathType Container)) { throw "Release assets folder missing: $assets" }

$integrity = Get-Content -LiteralPath (Join-Path $source 'beta-data/release-7.1.06-integrity.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$package = Get-Content -LiteralPath (Join-Path $source 'package.json') -Raw -Encoding UTF8 | ConvertFrom-Json
if ($package.displayVersion -ne $integrity.release) { throw 'Package and release manifest versions differ.' }
if ($integrity.extensionWasmSha256 -notmatch '^[a-fA-F0-9]{64}$') {
    throw 'Final extension WASM SHA-256 is not pinned in beta-data/release-7.1.06-integrity.json.'
}

$characters = Get-Content -LiteralPath (Join-Path $source 'beta-data/characters-release-71.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$signatures = Get-Content -LiteralPath (Join-Path $source 'beta-data/weapons-signature-release-71.json') -Raw -Encoding UTF8 | ConvertFrom-Json
if ($characters.revision -ne $integrity.characterRevision -or $signatures.revision -ne $integrity.characterRevision) {
    throw 'Character or signature weapon data revision differs from the release manifest.'
}
foreach ($name in @('weapons-release-71.json','weapons-expanded-release-71.json')) {
    $actual = (Get-Content -LiteralPath (Join-Path $source "beta-data/$name") -Raw -Encoding UTF8 | ConvertFrom-Json).revision
    $expected = $integrity.weaponRevision
    if ($actual.branch -ne $expected.branch -or $actual.version -ne $expected.version -or
        $actual.designRevision -ne $expected.designRevision -or $actual.resourceRevision -ne $expected.resourceRevision) {
        throw "Weapon data revision differs from the release manifest: $name"
    }
}

$published = Join-Path $source 'mona_wasm/pkg/mona_wasm_bg.wasm'
$extension = Join-Path $source 'mona_wasm/extension/mona_extension_bg.wasm'
$publishedHash = (Get-FileHash -LiteralPath $published -Algorithm SHA256).Hash.ToLowerInvariant()
$extensionHash = (Get-FileHash -LiteralPath $extension -Algorithm SHA256).Hash.ToLowerInvariant()
if ($publishedHash -ne $integrity.publishedWasmSha256.ToLowerInvariant()) { throw 'Published WASM SHA-256 differs from the pinned hash.' }
if ($extensionHash -ne $integrity.extensionWasmSha256.ToLowerInvariant()) { throw 'Extension WASM SHA-256 differs from the pinned hash.' }

$releaseFiles = @(Get-ChildItem -LiteralPath $assets -Recurse -File |
    Where-Object { $_.Name -ne 'SHA256SUMS.txt' } | Select-Object -ExpandProperty FullName)
if (-not $releaseFiles.Count) { throw 'No release assets found.' }
$criticalFiles = @($published, $extension)
foreach ($name in @('characters-release-71.json','weapons-release-71.json',
    'weapons-signature-release-71.json','weapons-expanded-release-71.json')) {
    $criticalFiles += Join-Path $source "beta-data/$name"
}
$allFiles = @($criticalFiles) + $releaseFiles
$lines = foreach ($file in ($allFiles | Sort-Object)) {
    $digest = (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant()
    $prefix = $root.TrimEnd('\') + '\'
    $absolute = [IO.Path]::GetFullPath($file)
    if (-not $absolute.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase)) { throw "Release file outside output directory: $absolute" }
    $relative = $absolute.Substring($prefix.Length).Replace('\','/')
    "$digest  $relative"
}
$sums = Join-Path $root 'SHA256SUMS.txt'
[IO.File]::WriteAllText($sums, (($lines -join "`n") + "`n"), [Text.UTF8Encoding]::new($false))
Write-Output "Validated data revisions, both WASM hashes, and $($releaseFiles.Count) release assets."
Write-Output $sums
