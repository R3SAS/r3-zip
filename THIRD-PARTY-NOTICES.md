# Avisos de software de terceros — R3 Zip

R3 Zip (licencia MIT, © 2026 R3) incluye o utiliza los siguientes componentes. Cada uno conserva su propia licencia.

## 7-Zip 26.03 — motor de compresión
- **Autor:** © 1999-2026 Igor Pavlov — https://www.7-zip.org
- **Archivos:** `engine/7z.exe` y `engine/7z.dll` (Windows), `engine/7zz` (macOS). Binarios oficiales **sin modificar**, descargados de https://github.com/ip7z/7zip/releases/tag/26.03.
- **Licencia:** GNU LGPL 2.1 o posterior como licencia principal; partes bajo BSD de 3 cláusulas (descompresión LZFSE © Apple Inc., descompresión ZSTD © Facebook Inc.) y BSD de 2 cláusulas (XXH64 © Yann Collet). Texto completo en `engine/License.txt`.
- **Código fuente:** se entrega junto con la aplicación en `engine-source/7z2603-src.7z` (también en https://www.7-zip.org). Usted puede reemplazar el motor por otra versión compatible de 7-Zip copiando sus archivos en la carpeta `engine`.
- **Cómo se usa:** R3 Zip ejecuta el motor como un programa aparte (no enlaza su código ni lo modifica).

## Restricción de la licencia de unRAR
La descompresión de archivos RAR del motor se desarrolló usando el código de unRAR. Todos los derechos del código original de unRAR pertenecen a Alexander Roshal. Su licencia indica que **ese código no puede usarse para recrear el algoritmo de compresión RAR, que es propietario**. R3 Zip solo descomprime RAR; no crea archivos RAR.

## Electron 33 y Chromium
- Electron © GitHub Inc. y colaboradores — licencia MIT (`LICENSE.electron.txt` en la carpeta de instalación).
- Chromium y sus dependencias — licencias BSD y otras de código abierto (`LICENSES.chromium.html` en la carpeta de instalación).

## Marcas
7-Zip, RAR/WinRAR, WinZip, Windows y macOS son marcas de sus respectivos titulares. R3 Zip no está afiliado ni respaldado por ellos; los nombres se mencionan solo para indicar compatibilidad de formatos.
