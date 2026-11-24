# Copia la base de datos local (esquema + datos + historial _prisma_migrations) a Neon.
#
# Uso (PowerShell, desde backend/):
#   $env:SOURCE_URL = "postgresql://user:pass@localhost:5432/maurizone_local"
#   $env:NEON_DIRECT_URL = "postgresql://USER:PASS@ep-xxxx.REGION.aws.neon.tech/neondb?sslmode=require"
#   .\scripts\migrate-to-neon.ps1
#
# IMPORTANTE: NEON_DIRECT_URL debe ser la conexión DIRECTA (host SIN "-pooler").
# La base de datos de Neon debe estar vacía.

$ErrorActionPreference = "Stop"

$pgBin = "C:\Program Files\PostgreSQL\17\bin"
$pgDump = Join-Path $pgBin "pg_dump.exe"
$psql = Join-Path $pgBin "psql.exe"

if (-not $env:SOURCE_URL) { throw "Define `$env:SOURCE_URL (BD origen)" }
if (-not $env:NEON_DIRECT_URL) { throw "Define `$env:NEON_DIRECT_URL (Neon, conexión directa)" }
if ($env:NEON_DIRECT_URL -match "-pooler") { throw "Usa la conexión directa de Neon (sin -pooler) para la migración" }

# pg_dump no entiende el parámetro ?schema=public de Prisma
$source = $env:SOURCE_URL -replace "[?&]schema=[^&]*", ""

$dumpFile = Join-Path $env:TEMP "maurizone_dump.sql"

Write-Host "1/3 Volcando BD origen..."
& $pgDump --no-owner --no-acl --schema=public --format=plain --file=$dumpFile $source
if ($LASTEXITCODE -ne 0) { throw "pg_dump falló" }

# El esquema public ya existe en Neon; transaction_timeout solo existe en PG17+
$lines = Get-Content $dumpFile -Encoding UTF8 | Where-Object {
  $_ -ne "CREATE SCHEMA public;" -and $_ -notmatch "^SET transaction_timeout"
}
[System.IO.File]::WriteAllLines($dumpFile, $lines, (New-Object System.Text.UTF8Encoding $false))

Write-Host "2/3 Restaurando en Neon..."
& $psql $env:NEON_DIRECT_URL --set ON_ERROR_STOP=1 --single-transaction --quiet --file=$dumpFile
if ($LASTEXITCODE -ne 0) { throw "psql falló (no se aplicó nada: transacción única)" }

Write-Host "3/3 Comprobando..."
# Por stdin: PowerShell 5.1 elimina las comillas dobles de los argumentos a ejecutables nativos
'select (select count(*) from "User") as users, (select count(*) from "Product") as products, (select count(*) from "_prisma_migrations") as migrations;' | & $psql $env:NEON_DIRECT_URL

Remove-Item $dumpFile
Write-Host "Listo. Ejecuta 'npx prisma migrate status' con las URLs de Neon para verificar."
