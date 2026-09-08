# Points every hard-coded address in the site at a new domain.
# Run it once when your custom domain goes live, then redeploy.
#
#   powershell -ExecutionPolicy Bypass -File set-domain.ps1 -Domain alfathresidence.com
#
# Updates: canonical link, og:url, og:image, twitter:image, the JSON-LD block,
#          sitemap.xml, robots.txt and the brochure's contact page.
param([Parameter(Mandatory = $true)][string]$Domain)

$Domain = $Domain -replace '^https?://', '' -replace '/$', ''
if ($Domain -notmatch '^[a-z0-9.-]+\.[a-z]{2,}$') { Write-Error "That does not look like a domain: $Domain"; exit 1 }

$root = $PSScriptRoot
$files = @("$root\site\index.html", "$root\site\sitemap.xml", "$root\site\robots.txt", "$root\brochure\brochure.html")
$old = 'stately-dusk-d14acd\.netlify\.app|alfathresidence\.netlify\.app|[a-z0-9-]+\.netlify\.app'
$changed = 0

foreach ($f in $files) {
  if (-not (Test-Path $f)) { Write-Warning "missing: $f"; continue }
  $text = [IO.File]::ReadAllText($f)
  $new = [regex]::Replace($text, $old, $Domain)
  if ($new -ne $text) {
    [IO.File]::WriteAllText($f, $new)
    $n = ([regex]::Matches($text, $old)).Count
    Write-Host ("{0,-24} {1} address(es) updated" -f (Split-Path $f -Leaf), $n)
    $changed += $n
  }
}

# sitemap should also carry today's date
$sm = "$root\site\sitemap.xml"
if (Test-Path $sm) {
  $t = [IO.File]::ReadAllText($sm)
  $t = [regex]::Replace($t, '<lastmod>[^<]*</lastmod>', "<lastmod>$(Get-Date -Format 'yyyy-MM-dd')</lastmod>")
  [IO.File]::WriteAllText($sm, $t)
}

Write-Host ""
Write-Host "Done - $changed address(es) now point at https://$Domain"
Write-Host "Next: re-render the brochure (see LAUNCH.md), then deploy."
