$stations = @(
    @{ name="東京"; pref="13" },
    @{ name="品川"; pref="13" },
    @{ name="渋谷"; pref="13" },
    @{ name="新宿"; pref="13" },
    @{ name="池袋"; pref="13" },
    @{ name="上野"; pref="13" },
    @{ name="秋葉原"; pref="13" },
    @{ name="有楽町"; pref="13" },
    @{ name="浜松町"; pref="13" },
    @{ name="田町"; pref="13" },
    @{ name="目黒"; pref="13" },
    @{ name="恵比寿"; pref="13" },
    @{ name="代々木"; pref="13" },
    @{ name="原宿"; pref="13" },
    @{ name="吉祥寺"; pref="13" },
    @{ name="中野"; pref="13" },
    @{ name="高円寺"; pref="13" },
    @{ name="荻窪"; pref="13" },
    @{ name="三鷹"; pref="13" },
    @{ name="立川"; pref="13" },
    @{ name="八王子"; pref="13" },
    @{ name="赤羽"; pref="13" },
    @{ name="王子"; pref="13" },
    @{ name="北千住"; pref="13" },
    @{ name="錦糸町"; pref="13" },
    @{ name="亀戸"; pref="13" },
    @{ name="大崎"; pref="13" },
    @{ name="五反田"; pref="13" },
    @{ name="蒲田"; pref="13" },
    @{ name="大森"; pref="13" },
    @{ name="横浜"; pref="14" },
    @{ name="川崎"; pref="14" },
    @{ name="武蔵小杉"; pref="14" },
    @{ name="桜木町"; pref="14" },
    @{ name="関内"; pref="14" },
    @{ name="藤沢"; pref="14" },
    @{ name="小田原"; pref="14" },
    @{ name="相模大野"; pref="14" },
    @{ name="海老名"; pref="14" },
    @{ name="本厚木"; pref="14" },
    @{ name="大宮"; pref="11" },
    @{ name="浦和"; pref="11" },
    @{ name="川口"; pref="11" },
    @{ name="川越"; pref="11" },
    @{ name="所沢"; pref="11" },
    @{ name="越谷"; pref="11" },
    @{ name="春日部"; pref="11" },
    @{ name="千葉"; pref="12" },
    @{ name="船橋"; pref="12" },
    @{ name="松戸"; pref="12" },
    @{ name="市川"; pref="12" },
    @{ name="柏"; pref="12" },
    @{ name="津田沼"; pref="12" },
    @{ name="大阪"; pref="27" },
    @{ name="難波"; pref="27" },
    @{ name="天王寺"; pref="27" },
    @{ name="京橋"; pref="27" },
    @{ name="心斎橋"; pref="27" },
    @{ name="新大阪"; pref="27" },
    @{ name="北浜"; pref="27" },
    @{ name="本町"; pref="27" },
    @{ name="名古屋"; pref="23" },
    @{ name="栄"; pref="23" },
    @{ name="金山"; pref="23" },
    @{ name="千種"; pref="23" },
    @{ name="鶴舞"; pref="23" },
    @{ name="伏見"; pref="23" },
    @{ name="博多"; pref="40" },
    @{ name="天神"; pref="40" },
    @{ name="小倉"; pref="40" },
    @{ name="西新"; pref="40" },
    @{ name="薬院"; pref="40" },
    @{ name="大橋"; pref="40" },
    @{ name="札幌"; pref="01" },
    @{ name="大通"; pref="01" },
    @{ name="すすきの"; pref="01" },
    @{ name="琴似"; pref="01" },
    @{ name="仙台"; pref="04" },
    @{ name="長町"; pref="04" },
    @{ name="広島"; pref="34" },
    @{ name="横川"; pref="34" },
    @{ name="京都"; pref="26" },
    @{ name="四条"; pref="26" },
    @{ name="烏丸御池"; pref="26" },
    @{ name="西院"; pref="26" },
    @{ name="三ノ宮"; pref="28" },
    @{ name="神戸"; pref="28" },
    @{ name="尼崎"; pref="28" },
    @{ name="西宮北口"; pref="28" },
    @{ name="静岡"; pref="22" },
    @{ name="浜松"; pref="22" },
    @{ name="岡山"; pref="33" },
    @{ name="熊本"; pref="43" },
    @{ name="おもろまち"; pref="47" }
)

$results = @()
$baseUrl = "http://localhost:3000"
$total = $stations.Count

Write-Host "=== AUDIT START: $total stations ===" -ForegroundColor Cyan

foreach ($s in $stations) {
    $n = $s.name
    $p = $s.pref
    $idx = $results.Count + 1
    Write-Host "[$idx/$total] $n (pref=$p) ..." -NoNewline

    $bodyObj = @{ stationName = $n; prefCode = $p; year = $null }
    $bodyJson = $bodyObj | ConvertTo-Json -Compress
    $bodyBytes = [System.Text.Encoding]::UTF8.GetBytes($bodyJson)

    try {
        $resp = Invoke-RestMethod `
            -Uri "$baseUrl/api/diagnose" `
            -Method POST `
            -ContentType "application/json; charset=utf-8" `
            -Body $bodyBytes `
            -TimeoutSec 300

        if ($null -eq $resp.ok -or $resp.ok -eq $false) {
            Write-Host " NG: $($resp.error)" -ForegroundColor Red
            $results += [PSCustomObject]@{
                Station="$n"; Pref="$p"; Status="ERROR"
                TxCount=$null; MarketPrice=$null; DataYear=$null; Note="$($resp.error)"
            }
        } else {
            $tx = if ($null -ne $resp.debug.tx5y) { [int]$resp.debug.tx5y } else { 0 }
            $mp = if ($null -ne $resp.marketPrice) { [double]$resp.marketPrice } else { 0 }
            $dy = if ($null -ne $resp.debug.dataYear) { [int]$resp.debug.dataYear } else { 0 }
            $mpMan = [math]::Round($mp / 10000, 0)

            $flags = @()
            if ($tx -eq 0)          { $flags += "件数=0" }
            if ($tx -gt 30000)      { $flags += "件数過多($tx)" }
            if ($mp -gt 0 -and $mp -lt 500000) { $flags += "価格低すぎ(${mpMan}万)" }
            if ($mp -gt 200000000)  { $flags += "価格高すぎ(${mpMan}万)" }
            if ($dy -gt 0 -and $dy -lt 2022)   { $flags += "古データ($dy)" }

            $note = $flags -join " / "
            $status = if ($note) { "ANOMALY" } else { "OK" }
            $color  = if ($note) { "Yellow"  } else { "Green"  }

            Write-Host " $status  tx=$tx  ${mpMan}万円  y=$dy  $note" -ForegroundColor $color

            $results += [PSCustomObject]@{
                Station="$n"; Pref="$p"; Status="$status"
                TxCount=$tx; MarketPrice=$mpMan; DataYear=$dy; Note="$note"
            }
        }
    } catch {
        Write-Host " FAIL: $($_.Exception.Message)" -ForegroundColor Red
        $results += [PSCustomObject]@{
            Station="$n"; Pref="$p"; Status="FAIL"
            TxCount=$null; MarketPrice=$null; DataYear=$null; Note="$($_.Exception.Message)"
        }
    }

    Start-Sleep -Milliseconds 300
}

Write-Host ""
Write-Host "=== AUDIT COMPLETE ===" -ForegroundColor Cyan

$ok  = ($results | Where-Object Status -eq "OK").Count
$ano = ($results | Where-Object Status -eq "ANOMALY").Count
$err = ($results | Where-Object { $_.Status -eq "ERROR" -or $_.Status -eq "FAIL" }).Count
Write-Host "OK=$ok  ANOMALY=$ano  ERROR/FAIL=$err"

Write-Host ""
Write-Host "--- ANOMALY / ERROR list ---" -ForegroundColor Yellow
$results | Where-Object { $_.Status -ne "OK" } |
    Format-Table Station, Pref, TxCount, MarketPrice, DataYear, Note -AutoSize

$csvPath = "scripts\audit_results.csv"
$results | Export-Csv -Path $csvPath -NoTypeInformation -Encoding UTF8
Write-Host "CSV saved: $csvPath" -ForegroundColor Cyan

$valid = $results | Where-Object { $null -ne $_.TxCount }
if ($valid.Count -gt 0) {
    $txs = $valid | Measure-Object TxCount -Min -Max -Average
    $mps = $valid | Where-Object { $_.MarketPrice -gt 0 } | Measure-Object MarketPrice -Min -Max -Average
    Write-Host ""
    Write-Host "--- STATS ---"
    Write-Host ("TxCount : min={0}  max={1}  avg={2}" -f $txs.Minimum, $txs.Maximum, [math]::Round($txs.Average,0))
    if ($mps) {
        Write-Host ("Price   : min={0}万  max={1}万  avg={2}万" -f $mps.Minimum, $mps.Maximum, [math]::Round($mps.Average,0))
    }
}
