# Local preview server for the site folder (no node/python needed).
# Usage:  powershell -ExecutionPolicy Bypass -File serve.ps1   then open http://127.0.0.1:8796/
param([int]$Port = 8796, [string]$Root = "$PSScriptRoot\site")
$mime = @{ '.html'='text/html; charset=utf-8'; '.js'='text/javascript'; '.css'='text/css'; '.png'='image/png'; '.jpg'='image/jpeg'; '.jpeg'='image/jpeg'; '.svg'='image/svg+xml'; '.mp4'='video/mp4'; '.pdf'='application/pdf'; '.xml'='application/xml'; '.txt'='text/plain'; '.json'='application/json'; '.webp'='image/webp'; '.ico'='image/x-icon' }
$l = New-Object System.Net.HttpListener
$l.Prefixes.Add("http://127.0.0.1:$Port/"); $l.Prefixes.Add("http://localhost:$Port/")
$l.Start(); Write-Host "Serving $Root on http://127.0.0.1:$Port/  (Ctrl+C to stop)"
while ($l.IsListening) {
  $ctx = $l.GetContext(); $req = $ctx.Request; $res = $ctx.Response
  try {
    $path = [Uri]::UnescapeDataString($req.Url.AbsolutePath); if ($path -eq "/") { $path = "/index.html" }
    if ($req.HttpMethod -eq "PUT" -and $path.StartsWith("/__upload/")) { $up = Join-Path $env:TEMP ("alfath_" + [IO.Path]::GetFileName($path)); $fsU = [IO.File]::Create($up); $req.InputStream.CopyTo($fsU); $fsU.Close(); $res.StatusCode = 200; $bU = [Text.Encoding]::UTF8.GetBytes($up); $res.OutputStream.Write($bU, 0, $bU.Length); $res.Close(); continue }
    # a path ending in / (or naming a directory) serves its index.html, the way Netlify does
    if ($path.EndsWith('/')) { $path += 'index.html' }
    $file = Join-Path $Root ($path -replace '/', '\')
    if (Test-Path $file -PathType Container) { $file = Join-Path $file 'index.html' }
    if (-not (Test-Path $file -PathType Leaf)) { $res.StatusCode = 404; $b = [Text.Encoding]::UTF8.GetBytes("404 $path"); $res.OutputStream.Write($b, 0, $b.Length); $res.Close(); continue }
    $ext = [IO.Path]::GetExtension($file).ToLower(); $res.ContentType = if ($mime[$ext]) { $mime[$ext] } else { 'application/octet-stream' }
    $fs = [IO.File]::OpenRead($file); $len = $fs.Length; $start = 0; $end = $len - 1
    $res.Headers.Add('Accept-Ranges', 'bytes')
    $range = $req.Headers['Range']
    if ($range -and $range.StartsWith('bytes=')) {
      $parts = $range.Substring(6).Split('-'); if ($parts[0]) { $start = [long]$parts[0] }; if ($parts[1]) { $end = [long]$parts[1] }
      if ($end -ge $len) { $end = $len - 1 }
      $res.StatusCode = 206; $res.Headers.Add('Content-Range', "bytes $start-$end/$len")
    }
    $count = $end - $start + 1; $res.ContentLength64 = $count; $fs.Seek($start, 'Begin') | Out-Null
    $buf = New-Object byte[] 65536; $left = $count
    while ($left -gt 0) { $n = $fs.Read($buf, 0, [Math]::Min($buf.Length, $left)); if ($n -le 0) { break }; $res.OutputStream.Write($buf, 0, $n); $left -= $n }
    $fs.Close(); $res.Close()
  } catch { try { $res.Close() } catch {} }
}
