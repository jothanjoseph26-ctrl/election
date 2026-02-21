param(
  [string]$AgentsDir = "agents",
  [string]$PdfOcrCsv = "agents\pdf_ocr_extract.csv",
  [string]$OutputCsv = "agents\agents_import_ready.csv",
  [string]$PhonesOnlyCsv = "agents\phones_only_needing_names.csv"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Normalize-Phone {
  param([string]$Phone)
  if ([string]::IsNullOrWhiteSpace($Phone)) { return $null }

  $digits = ($Phone -replace '\D', '')
  if ([string]::IsNullOrWhiteSpace($digits)) { return $null }

  if ($digits.Length -eq 10 -and $digits.StartsWith('8')) {
    $digits = '0' + $digits
  }

  if ($digits.Length -eq 13 -and $digits.StartsWith('234')) {
    $digits = '0' + $digits.Substring(3)
  }

  if ($digits.Length -eq 11 -and $digits.StartsWith('0')) {
    return $digits
  }

  return $null
}

function Clean-Name {
  param([string]$Name)
  if ([string]::IsNullOrWhiteSpace($Name)) { return $null }
  $value = $Name.ToUpperInvariant()
  $value = $value -replace '[^A-Z\s\-\'']', ' '
  $value = $value -replace '\s+', ' '
  $value = $value.Trim(' ', '-', "'")
  if ([string]::IsNullOrWhiteSpace($value)) { return $null }
  return $value
}

function Infer-WardFromFileName {
  param([string]$BaseName)
  $name = $BaseName.ToUpperInvariant()
  $name = $name -replace '\.DOCX$|\.PDF$', ''
  $name = $name -replace '\s+WARDS?\s*$', ''
  $name = $name -replace '\s+', ' '
  $name = $name.Trim()

  $wardMap = @{
    'WUSE' = @{ number = '01'; name = 'WUSE WARD' }
    'GWAGWA' = @{ number = '02'; name = 'GWAGWA WARD' }
    'CITY CENTRE' = @{ number = '03'; name = 'CITY CENTRE WARD' }
    'GARKI' = @{ number = '04'; name = 'GARKI WARD' }
    'KABUSA' = @{ number = '05'; name = 'KABUSA WARD' }
    'KARU' = @{ number = '06'; name = 'KARU WARD' }
    'KARSHI' = @{ number = '07'; name = 'KARSHI WARD' }
    'JIWA' = @{ number = '08'; name = 'JIWA WARD' }
    'OROZO' = @{ number = '09'; name = 'OROZO WARD' }
    'NYANYA' = @{ number = '10'; name = 'NYANYA WARD' }
    'GUI' = @{ number = '11'; name = 'GUI WARD' }
    'GWARINPA' = @{ number = '12'; name = 'GWARINPA WARD' }
    'GWARRIMPA' = @{ number = '12'; name = 'GWARINPA WARD' }
    'GWARIMPA' = @{ number = '12'; name = 'GWARINPA WARD' }
  }

  foreach ($key in $wardMap.Keys) {
    if ($name -like "*$key*") { return $wardMap[$key] }
  }

  return @{ number = ''; name = ($name + ' WARD') }
}

function Get-DocxText {
  param([string]$Path)

  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $zip = [System.IO.Compression.ZipFile]::OpenRead($Path)
  try {
    $entry = $zip.Entries | Where-Object { $_.FullName -eq 'word/document.xml' }
    if (-not $entry) { return '' }
    $sr = New-Object System.IO.StreamReader($entry.Open())
    try {
      $xml = $sr.ReadToEnd()
    }
    finally {
      $sr.Close()
    }
  }
  finally {
    $zip.Dispose()
  }

  $xml = $xml -replace '<w:tab\s*/>', ' '
  $xml = $xml -replace '<w:br\s*/>', "`n"
  $xml = $xml -replace '</w:p>', "`n"
  $text = [regex]::Replace($xml, '<[^>]+>', ' ')
  $text = [System.Net.WebUtility]::HtmlDecode($text)
  return $text
}

function Extract-PhonesFromText {
  param([string]$Text)
  $matches = [regex]::Matches($Text, '(?:\+?234\d{10}|0\d{10}|\b\d{11}\b)')
  $phones = New-Object System.Collections.Generic.List[string]
  foreach ($m in $matches) {
    $normalized = Normalize-Phone -Phone $m.Value
    if ($normalized) { $phones.Add($normalized) }
  }
  return $phones
}

$recordsByPhone = @{}
$nameWardSeen = New-Object 'System.Collections.Generic.HashSet[string]'

# 1) DOCX: phones only
$docxFiles = Get-ChildItem -Path $AgentsDir -Filter *.docx -File
foreach ($file in $docxFiles) {
  $ward = Infer-WardFromFileName -BaseName $file.BaseName
  $text = Get-DocxText -Path $file.FullName
  $phones = Extract-PhonesFromText -Text $text

  foreach ($phone in $phones) {
    if (-not $recordsByPhone.ContainsKey($phone)) {
      $recordsByPhone[$phone] = [PSCustomObject]@{
        full_name = ''
        phone_number = $phone
        ward_number = $ward.number
        ward_name = $ward.name
        source = "DOCX:$($file.Name)"
      }
    }
  }
}

# 2) Optional PDF OCR CSV merge (expected columns: full_name,phone_number,ward_number,ward_name)
if (Test-Path $PdfOcrCsv) {
  $ocrRows = Import-Csv -Path $PdfOcrCsv
  foreach ($row in $ocrRows) {
    $phone = Normalize-Phone -Phone $row.phone_number
    if (-not $phone) { continue }

    $name = Clean-Name -Name $row.full_name
    $wardNumber = if ($row.ward_number) { "$($row.ward_number)".Trim() } else { '' }
    $wardName = if ($row.ward_name) { "$($row.ward_name)".Trim().ToUpperInvariant() } else { '' }

    if ($recordsByPhone.ContainsKey($phone)) {
      $existing = $recordsByPhone[$phone]
      if (-not $existing.full_name -and $name) { $existing.full_name = $name }
      if (-not $existing.ward_number -and $wardNumber) { $existing.ward_number = $wardNumber }
      if (-not $existing.ward_name -and $wardName) { $existing.ward_name = $wardName }
      $existing.source = $existing.source + ';OCR'
    }
    else {
      $recordsByPhone[$phone] = [PSCustomObject]@{
        full_name = $(if ($name) { $name } else { '' })
        phone_number = $phone
        ward_number = $wardNumber
        ward_name = $wardName
        source = 'OCR_ONLY'
      }
    }
  }
}

# 3) Fallback dedupe by name+ward for rows without phone
if (Test-Path $PdfOcrCsv) {
  $ocrRows = Import-Csv -Path $PdfOcrCsv
  foreach ($row in $ocrRows) {
    $phone = Normalize-Phone -Phone $row.phone_number
    if ($phone) { continue }

    $name = Clean-Name -Name $row.full_name
    $wardNumber = if ($row.ward_number) { "$($row.ward_number)".Trim() } else { '' }
    $wardName = if ($row.ward_name) { "$($row.ward_name)".Trim().ToUpperInvariant() } else { '' }
    if (-not $name) { continue }

    $key = "$name|$wardNumber|$wardName"
    if ($nameWardSeen.Add($key)) {
      $generatedPhone = ""
      $recordsByPhone["NO_PHONE::$key"] = [PSCustomObject]@{
        full_name = $name
        phone_number = $generatedPhone
        ward_number = $wardNumber
        ward_name = $wardName
        source = 'OCR_NO_PHONE'
      }
    }
  }
}

$allRows = @($recordsByPhone.Values)

# keep deterministic order: ward then name then phone
$allRows = $allRows | Sort-Object ward_number, ward_name, full_name, phone_number

$allRows | Select-Object full_name, phone_number, ward_number, ward_name, source |
  Export-Csv -Path $OutputCsv -NoTypeInformation -Encoding UTF8

$phonesOnly = $allRows | Where-Object { [string]::IsNullOrWhiteSpace($_.full_name) }
$phonesOnly | Select-Object phone_number, ward_number, ward_name, source |
  Export-Csv -Path $PhonesOnlyCsv -NoTypeInformation -Encoding UTF8

Write-Host "Created: $OutputCsv"
Write-Host "Created: $PhonesOnlyCsv"
Write-Host "Total unique rows: $($allRows.Count)"
Write-Host "Rows missing names: $($phonesOnly.Count)"

if (-not (Test-Path $PdfOcrCsv)) {
  Write-Warning "No OCR CSV found at $PdfOcrCsv. Added only DOCX phone-derived rows."
  Write-Host "To merge scanned PDF data, create $PdfOcrCsv with columns: full_name,phone_number,ward_number,ward_name"
}
