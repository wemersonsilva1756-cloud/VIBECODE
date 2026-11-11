@echo off
setlocal
cd /d "%~dp0"

echo ============================================
echo   PIXEL STRIKE STUDIO
echo ============================================
echo.

rem Usa o Node portatil da pasta .tools quando disponivel.
if exist "%CD%\.tools\node\node.exe" set "PATH=%CD%\.tools\node;%PATH%"

where node >nul 2>nul
if errorlevel 1 (
  echo [ERRO] Node.js nao encontrado.
  echo Instale o Node.js LTS em https://nodejs.org e execute este arquivo novamente.
  echo.
  pause
  exit /b 1
)

if not exist "node_modules\electron\dist\electron.exe" (
  echo Instalando dependencias pela primeira vez. Isso pode levar alguns minutos...
  call npm install --no-fund --no-audit
  if errorlevel 1 (
    echo.
    echo [ERRO] Nao foi possivel instalar as dependencias.
    pause
    exit /b 1
  )
)

if not exist "out\main\index.js" (
  echo Compilando o Studio...
  call npm run build
  if errorlevel 1 (
    echo.
    echo [ERRO] Nao foi possivel compilar o Studio.
    pause
    exit /b 1
  )
)

echo Abrindo o Pixel Strike Studio...
echo Feche esta janela apenas quando o Studio for fechado.
echo.
call "node_modules\electron\dist\electron.exe" .

endlocal
