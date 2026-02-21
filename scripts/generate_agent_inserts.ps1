$csv = Import-Csv 'agents/agents_import_ready.csv'
$lines = @()
$lines += 'DELETE FROM agents;'
foreach ($row in $csv) {
    $name = $row.full_name -replace "'", "''"
    $phone = $row.phone_number
    $wardNum = $row.ward_number
    $wardName = $row.ward_name -replace "'", "''"
    $lines += "INSERT INTO agents (full_name, phone_number, ward_number, ward_name, pin, payment_status, verification_status, is_active) VALUES ('$name', '$phone', '$wardNum', '$wardName', '0000', 'pending', 'pending', true);"
}
[System.IO.File]::WriteAllText('agents/insert_agents.sql', ($lines -join "`n"), [System.Text.Encoding]::UTF8)
Write-Host "Generated SQL with $($csv.Count) inserts"
