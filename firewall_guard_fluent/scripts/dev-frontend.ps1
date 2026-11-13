$ErrorActionPreference="Stop"
Set-Location "$PSScriptRoot\..\frontend"
if (!(Test-Path ".env") -and (Test-Path ".env.example")) { Copy-Item ".env.example" ".env" }
if (!(Test-Path "node_modules")) { npm install }
npm run dev
