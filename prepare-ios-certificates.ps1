# iOS Certificate Preparation Helper Script for Windows
# This script converts your Apple-issued .cer, your private key, and your profile into formats needed for GitHub Actions.

$openssl = "C:\Program Files\Git\usr\bin\openssl.exe"
$keyFile = "ios_distribution.key"
$cerFile = "distribution.cer" # Change this if your downloaded file has a different name
$pemFile = "distribution_certificate.pem"
$p12File = "ios_distribution.p12"
$profileFile = "*.mobileprovision" # It will look for any mobileprovision file

Write-Host "--- iOS Certificate Preparation Tool ---" -ForegroundColor Cyan

# Check if required files exist
if (-not (Test-Path $keyFile)) {
    Write-Error "Error: $keyFile not found. Please ensure you generated it previously."
    exit
}

if (-not (Test-Path $cerFile)) {
    Write-Host "Waiting for: $cerFile" -ForegroundColor Yellow
    Write-Host "Please download your Apple Distribution Certificate (.cer) from Apple Developer Portal,"
    Write-Host "rename it to '$cerFile', and place it in this folder."
    exit
}

# 1. Convert .cer to .pem
Write-Host "1. Converting .cer to .pem..."
& $openssl x509 -in $cerFile -inform DER -out $pemFile -outform PEM

# 2. Convert to .p12
Write-Host "2. Creating .p12 file..."
Write-Host "You will be prompted for a password. Use a strong one and REMEMBER IT!" -ForegroundColor Magenta
& $openssl pkcs12 -export -inkey $keyFile -in $pemFile -out $p12File

Write-Host "`n--- GitHub Secrets Data ---" -ForegroundColor Green
Write-Host "Follow these steps to set up your GitHub repository secrets:"

# P12 Base64
Write-Host "`n[BUILD_CERTIFICATE_BASE64]" -ForegroundColor Yellow
$p12base64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes((Resolve-Path $p12File)))
Write-Output $p12base64

# Profile Base64
Write-Host "`n[BUILD_PROVISION_PROFILE_BASE64]" -ForegroundColor Yellow
$foundProfiles = Get-ChildItem -Filter *.mobileprovision
if ($foundProfiles.Count -gt 0) {
    $profilePath = $foundProfiles[0].FullName
    $profileBase64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes($profilePath))
    Write-Output $profileBase64
} else {
    Write-Host "(Provisioning Profile not found yet. Please place the .mobileprovision file here and run again.)" -ForegroundColor Gray
}

Write-Host "`n[P12_PASSWORD]" -ForegroundColor Yellow
Write-Host "(The password you entered during .p12 creation)"

Write-Host "`n[KEYCHAIN_PASSWORD]" -ForegroundColor Yellow
Write-Host "(Any random string, e.g., 'kotodama-secret')"

Write-Host "`nDone!" -ForegroundColor Cyan
