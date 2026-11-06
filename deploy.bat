@echo off
REM =============================================================
REM   SIGNAL CASPER WEB - ONE-CLICK DEPLOY LAUNCHER
REM =============================================================
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0deploy.ps1" %*

