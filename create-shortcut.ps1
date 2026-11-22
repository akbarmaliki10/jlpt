$ErrorActionPreference = "Stop"
$appDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$vbsPath = Join-Path $appDir "launch.vbs"
$iconPath = Join-Path $appDir "app.ico"
$desktop = [Environment]::GetFolderPath("Desktop")
$shortcutPath = Join-Path $desktop "JLPT N4 SRS.lnk"

$wsh = New-Object -ComObject WScript.Shell
$shortcut = $wsh.CreateShortcut($shortcutPath)
$shortcut.TargetPath = "$env:WINDIR\System32\wscript.exe"
$shortcut.Arguments = "`"$vbsPath`""
$shortcut.WorkingDirectory = $appDir
if (Test-Path $iconPath) {
  $shortcut.IconLocation = "$iconPath,0"
}
$shortcut.Description = "JLPT N4 Daily Kanji & Vocabulary SRS"
$shortcut.Save()

# Ask Windows Explorer to refresh Desktop icons right away
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class ShellNotify {
  [DllImport("shell32.dll")]
  public static extern void SHChangeNotify(int wEventId, int uFlags, IntPtr dwItem1, IntPtr dwItem2);
}
"@
[ShellNotify]::SHChangeNotify(0x08000000, 0x0000, [IntPtr]::Zero, [IntPtr]::Zero)

Write-Host "Desktop shortcut created at: $shortcutPath"
