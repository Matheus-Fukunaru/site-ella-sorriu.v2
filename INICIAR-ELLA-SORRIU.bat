@echo off
setlocal EnableExtensions
chcp 65001 >nul
cd /d "%~dp0"
title Ella Sorriu
set "ELLA_BUILD_ID=ella-sorriu-v38"
cls

echo ==============================================
echo                ELLA SORRIU
echo ==============================================
echo.

where node.exe >nul 2>&1
if errorlevel 1 (
  echo Para executar a Ella Sorriu neste computador,
  echo é necessário instalar o Node.js.
  echo.
  echo A página oficial será aberta no navegador.
  echo Depois de instalar, dê dois cliques neste arquivo novamente.
  start "" "https://nodejs.org/pt/download"
  echo.
  pause
  exit /b 1
)

node.exe -e "const [a,b]=process.versions.node.split('.').map(Number);process.exit(a>22||(a===22&&b>=5)?0:1)" >nul 2>&1
if errorlevel 1 (
  echo A versão do Node.js neste computador precisa ser atualizada.
  echo.
  echo A página oficial será aberta no navegador.
  echo Depois de atualizar, dê dois cliques neste arquivo novamente.
  start "" "https://nodejs.org/pt/download"
  echo.
  pause
  exit /b 1
)

where npm.cmd >nul 2>&1
if errorlevel 1 (
  echo O Node.js está incompleto neste computador.
  echo Reinstale-o pela página oficial: https://nodejs.org/pt/download
  echo.
  pause
  exit /b 1
)

if not exist "node_modules\express\package.json" (
  echo Preparando a Ella Sorriu pela primeira vez...
  echo Isso pode levar alguns minutos.
  echo.
  call npm.cmd install --no-audit --no-fund
  if errorlevel 1 (
    echo.
    echo Não foi possível concluir a preparação.
    echo Verifique a internet e dê dois cliques neste arquivo novamente.
    echo.
    pause
    exit /b 1
  )
  cls
  echo ==============================================
  echo                ELLA SORRIU
  echo ==============================================
  echo.
)

echo Iniciando a Ella Sorriu...
echo Preparando a Ella Sorriu...
echo.

where curl.exe >nul 2>&1
if errorlevel 1 (
  echo Este Windows precisa do curl para verificar o servidor local.
  echo Instale as atualizações do Windows e tente novamente.
  echo.
  pause
  exit /b 1
)

if exist ".ella-server-failed" del /q ".ella-server-failed" >nul 2>&1
if exist ".ella-health-check" del /q ".ella-health-check" >nul 2>&1
set "NODE_ENV=development"
set "PORT=3000"

curl.exe -fsS "http://127.0.0.1:3000/health" > ".ella-health-check" 2>nul
if errorlevel 1 goto INICIAR_SERVIDOR

findstr /C:"%ELLA_BUILD_ID%" ".ella-health-check" >nul 2>&1
if not errorlevel 1 goto SERVIDOR_PRONTO

findstr /C:"ella-sorriu" ".ella-health-check" >nul 2>&1
if errorlevel 1 goto PORTA_OCUPADA

echo Uma versão anterior da Ella Sorriu está aberta.
echo Atualizando para esta nova versão...
for /f "tokens=5" %%P in ('netstat -ano -p tcp ^| findstr "127.0.0.1:3000" ^| findstr "LISTENING"') do taskkill /PID %%P /F >nul 2>&1
timeout /t 2 /nobreak >nul

curl.exe -fsS "http://127.0.0.1:3000/health" >nul 2>&1
if not errorlevel 1 goto SERVIDOR_ANTIGO_ATIVO

:INICIAR_SERVIDOR
start "" /b node.exe "back-end\scripts\localLauncher.js"

set /a tentativas=0

:AGUARDAR_SERVIDOR
if exist ".ella-server-failed" goto SERVIDOR_ENCERROU

curl.exe -fsS "http://127.0.0.1:3000/health" > ".ella-health-check" 2>nul
if not errorlevel 1 (
  findstr /C:"%ELLA_BUILD_ID%" ".ella-health-check" >nul 2>&1
  if not errorlevel 1 goto SERVIDOR_PRONTO
)

set /a tentativas+=1
if %tentativas% geq 60 goto SERVIDOR_FALHOU
timeout /t 1 /nobreak >nul
goto AGUARDAR_SERVIDOR

:SERVIDOR_PRONTO
if exist ".ella-health-check" del /q ".ella-health-check" >nul 2>&1
echo Servidor Ella Sorriu pronto.

start "" "http://127.0.0.1:3000/admin/local-start"
if errorlevel 1 (
  echo.
  echo Não foi possível abrir o navegador padrão.
  echo Feche esta janela e tente novamente.
  echo.
  pause
  exit /b 1
)

echo.
echo Ella Sorriu aberta no navegador.
echo Mantenha esta janela aberta enquanto estiver usando o site.
echo Para encerrar, basta fechar esta janela.

:manter_aberto
timeout /t 3600 /nobreak >nul
goto manter_aberto

:SERVIDOR_ENCERROU
echo.
echo A Ella Sorriu foi encerrada antes de ficar pronta.
echo O erro real do servidor aparece acima.
echo Feche esta janela e tente novamente.
echo.
pause
exit /b 1

:SERVIDOR_FALHOU
echo.
echo A Ella Sorriu não respondeu dentro do tempo esperado.
echo Confira acima se o servidor informou algum erro.
echo.
pause
exit /b 1

:SERVIDOR_ANTIGO_ATIVO
echo.
echo A versão anterior ainda está aberta e não pôde ser encerrada.
echo Feche a janela antiga da Ella Sorriu e dê dois cliques novamente.
echo.
pause
exit /b 1

:PORTA_OCUPADA
echo.
echo Outro programa está usando a porta 3000 neste computador.
echo Feche esse programa e dê dois cliques novamente.
echo.
pause
exit /b 1

endlocal
