
# Weekly Audit Scheduler
# Runs every Monday at 9:00 AM

$action = New-ScheduledTaskAction -Execute "npx" -Argument "tsx scripts/batch_audit.ts" -WorkingDirectory "C:\Users\kozaw\Downloads\realestate-station-app"
$trigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Monday -At 9:00AM
$principal = New-ScheduledTaskPrincipal -UserId "NT AUTHORITY\SYSTEM" -LogonType ServiceAccount
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries

Register-ScheduledTask -Action $action -Trigger $trigger -Principal $principal -Settings $settings -TaskName "RealEstateStationAudit" -Description "Weekly Audit of Real Estate Data Integrity"

Write-Host "Audit Task Scheduled Successfully. Check Task Scheduler."
