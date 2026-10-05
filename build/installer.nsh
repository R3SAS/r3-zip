; R3 Zip — submenú «R3 Zip ›» en el clic derecho del Explorador de Windows.
; En Windows 11 aparece en «Mostrar más opciones» (o directo con Shift + clic derecho):
; el menú principal de Windows 11 solo admite apps con firma de código.
!define R3Z_EXE '"$INSTDIR\${APP_EXECUTABLE_FILENAME}"'
!define R3Z_ICON "$INSTDIR\${APP_EXECUTABLE_FILENAME},0"

; Crea el submenú bajo la clave de clase dada (sin «shell»)
!macro R3ZIP_MENU root withExtract
  WriteRegStr SHCTX "${root}\shell\R3Zip" "MUIVerb" "R3 Zip"
  WriteRegStr SHCTX "${root}\shell\R3Zip" "Icon" "${R3Z_ICON}"
  WriteRegStr SHCTX "${root}\shell\R3Zip" "SubCommands" ""
  !if "${withExtract}" == "1"
    WriteRegStr SHCTX "${root}\shell\R3Zip\shell\1Open" "MUIVerb" "Ver contenido"
    WriteRegStr SHCTX "${root}\shell\R3Zip\shell\1Open" "Icon" "${R3Z_ICON}"
    WriteRegStr SHCTX "${root}\shell\R3Zip\shell\1Open\command" "" '${R3Z_EXE} "%1"'
    WriteRegStr SHCTX "${root}\shell\R3Zip\shell\2ExtractHere" "MUIVerb" "Extraer aquí"
    WriteRegStr SHCTX "${root}\shell\R3Zip\shell\2ExtractHere\command" "" '${R3Z_EXE} --extract-here "%1"'
    WriteRegStr SHCTX "${root}\shell\R3Zip\shell\3ExtractTo" "MUIVerb" "Extraer en carpeta propia"
    WriteRegStr SHCTX "${root}\shell\R3Zip\shell\3ExtractTo\command" "" '${R3Z_EXE} --extract-to "%1"'
    WriteRegDWORD SHCTX "${root}\shell\R3Zip\shell\4Compress" "CommandFlags" 0x20
  !endif
  WriteRegStr SHCTX "${root}\shell\R3Zip\shell\4Compress" "MUIVerb" "Comprimir…"
  WriteRegStr SHCTX "${root}\shell\R3Zip\shell\4Compress\command" "" '${R3Z_EXE} --compress "%1"'
!macroend

!macro R3ZIP_ARCHIVES m
  !insertmacro ${m} "Software\Classes\SystemFileAssociations\.zip"
  !insertmacro ${m} "Software\Classes\SystemFileAssociations\.7z"
  !insertmacro ${m} "Software\Classes\SystemFileAssociations\.rar"
  !insertmacro ${m} "Software\Classes\SystemFileAssociations\.tar"
  !insertmacro ${m} "Software\Classes\SystemFileAssociations\.gz"
  !insertmacro ${m} "Software\Classes\SystemFileAssociations\.tgz"
  !insertmacro ${m} "Software\Classes\SystemFileAssociations\.bz2"
  !insertmacro ${m} "Software\Classes\SystemFileAssociations\.xz"
  !insertmacro ${m} "Software\Classes\SystemFileAssociations\.txz"
  !insertmacro ${m} "Software\Classes\SystemFileAssociations\.zst"
  !insertmacro ${m} "Software\Classes\SystemFileAssociations\.001"
!macroend

!macro R3ZIP_ARCHIVE_ADD root
  !insertmacro R3ZIP_MENU "${root}" 1
!macroend
!macro R3ZIP_DEL root
  DeleteRegKey SHCTX "${root}\shell\R3Zip"
  ; claves de la versión 1.0.0 (opciones sueltas)
  DeleteRegKey SHCTX "${root}\shell\R3Zip.Extract"
  DeleteRegKey SHCTX "${root}\shell\R3Zip.ExtractHere"
  DeleteRegKey SHCTX "${root}\shell\R3Zip.Open"
  DeleteRegKey SHCTX "${root}\shell\R3Zip.Compress"
!macroend

!macro R3ZIP_CLEAN
  !insertmacro R3ZIP_ARCHIVES R3ZIP_DEL
  !insertmacro R3ZIP_DEL "Software\Classes\*"
  !insertmacro R3ZIP_DEL "Software\Classes\Directory"
!macroend

!macro customInstall
  !insertmacro R3ZIP_CLEAN
  !insertmacro R3ZIP_ARCHIVES R3ZIP_ARCHIVE_ADD
  !insertmacro R3ZIP_MENU "Software\Classes\*" 0
  !insertmacro R3ZIP_MENU "Software\Classes\Directory" 0
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, p 0, p 0)'
!macroend

!macro customUnInstall
  !insertmacro R3ZIP_CLEAN
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, p 0, p 0)'
!macroend
