@echo off
title Navegador do Robo - Login Shopee e Afiliados
echo ===================================================
echo   Abrindo navegador com perfil do robo...
echo   Faca login na Shopee nessa janela.
echo ===================================================

set CHROME_EXE=C:\Program Files\Google\Chrome\Application\chrome.exe
if not exist "%CHROME_EXE%" set CHROME_EXE=C:\Program Files (x86)\Google\Chrome\Application\chrome.exe
if not exist "%CHROME_EXE%" set CHROME_EXE=C:\Users\%USERNAME%\AppData\Local\Google\Chrome\Application\chrome.exe
if not exist "%CHROME_EXE%" set CHROME_EXE=C:\Users\%USERNAME%\AppData\Local\ms-playwright\chromium-1243\chrome-win64\chrome.exe

set PROFILE_DIR=%~dp0data\chrome-profile
set EXTENSION_DIR=%~dp0..\robo-afiliados-autonomo

start "" "%CHROME_EXE%" --user-data-dir="%PROFILE_DIR%" --disable-blink-features=AutomationControlled --lang=pt-BR --load-extension="%EXTENSION_DIR%" "https://affiliate.shopee.com.br/offer/product_offer" "https://shopee.com.br/buyer/login"
