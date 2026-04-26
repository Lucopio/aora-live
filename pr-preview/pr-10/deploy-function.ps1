# Script de deploy de la Edge Function generate-insights
# Requiere: Supabase CLI en C:\Users\adomi\AppData\Local\Programs\supabase\supabase.exe
# Instrucciones:
#   1. Abre PowerShell en esta carpeta
#   2. Ejecuta: .\deploy-function.ps1 -AccessToken "tu_personal_access_token"
#   O alternativamente: set SUPABASE_ACCESS_TOKEN en environment y ejecutar sin parámetros

param(
    [string]$AccessToken    = $env:SUPABASE_ACCESS_TOKEN,
    [string]$AnthropicKey   = $env:ANTHROPIC_API_KEY
)

$SB = "C:\Users\adomi\AppData\Local\Programs\supabase\supabase.exe"
$PROJECT_REF = "edythbvezafpnkslavcv"

if (-not $AccessToken) {
    Write-Error "Falta el Access Token de Supabase. Obtelo en: https://supabase.com/dashboard/account/tokens"
    Write-Host "Uso: .\deploy-function.ps1 -AccessToken 'sbp_xxx' -AnthropicKey 'sk-ant-xxx'"
    exit 1
}
if (-not $AnthropicKey) {
    Write-Error "Falta la clave de Anthropic. Pasala con -AnthropicKey o como env ANTHROPIC_API_KEY"
    exit 1
}

$env:SUPABASE_ACCESS_TOKEN = $AccessToken

Write-Host "Vinculando proyecto..." -ForegroundColor Cyan
& $SB link --project-ref $PROJECT_REF

Write-Host "Configurando secret ANTHROPIC_API_KEY..." -ForegroundColor Cyan
& $SB secrets set ANTHROPIC_API_KEY=$AnthropicKey --project-ref $PROJECT_REF

Write-Host "Desplegando Edge Function generate-insights..." -ForegroundColor Cyan
& $SB functions deploy generate-insights --project-ref $PROJECT_REF --no-verify-jwt

Write-Host "Deploy completado." -ForegroundColor Green
Write-Host "URL de la función: https://$PROJECT_REF.supabase.co/functions/v1/generate-insights"
