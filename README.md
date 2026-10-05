# R3 Zip

Compresor y descompresor de archivos para Windows y macOS. **Software libre de código abierto desarrollado por R3** (licencia MIT). Gratuito: R3 lo regala a sus clientes; no se vende.

- Abre y extrae: ZIP, 7Z, RAR (solo extraer), TAR, GZ, BZ2, XZ, ZST, CAB, ISO, partes .001 y más.
- Crea: ZIP, 7Z, TAR, TAR.GZ, TAR.XZ, TAR.BZ2; niveles de compresión; contraseña AES-256; ocultar nombres (7Z); dividir en partes.
- Probar integridad, extraer selección, abrir un archivo interno con doble clic, arrastrar y soltar.
- Windows: submenú **R3 Zip ›** en el clic derecho (ver contenido, extraer aquí, extraer en carpeta propia, comprimir…). En Windows 11 está en «Mostrar más opciones» o directo con Shift + clic derecho: el menú principal de Windows 11 solo admite apps con firma de código.
- Sin Internet, sin telemetría, sin datos personales.

Motor: **7-Zip 26.03** © Igor Pavlov (GNU LGPL + BSD; restricción unRAR), binarios oficiales sin modificar en `vendor/`, con su código fuente en `vendor/src`. Ver `THIRD-PARTY-NOTICES.md` y la validación legal en `LEGAL-COLOMBIA.md`.

## Descargas
Instaladores de Windows y macOS (Intel y Apple Silicon) en la pestaña **Releases** del repositorio.

## Desarrollo
```
npm install
npm start
npm test                 # 13 pruebas del motor
npm run test:ui          # 7 pruebas de interfaz + capturas en test/shots
npm run icon             # regenera íconos (tools/make-icon.js)
npm run dist:win         # instalador Windows → ..\..\..\R3 Zip - instalador
```
macOS: electron-builder no compila Mac desde Windows. Use `.github/workflows/build.yml` (GitHub Actions) o `npm run dist:mac` en un Mac. Sin firma de Apple: clic derecho › Abrir la primera vez (o `xattr -cr "/Applications/R3 Zip.app"`).

## Instalación para TI
`R3-Zip-Setup-1.0.1.exe /S` (silenciosa, por usuario) · `/S /allusers` (todos los usuarios).

## Actualizar el motor
Descargar la versión nueva de https://github.com/ip7z/7zip/releases, reemplazar `vendor/win-x64` (7z.exe, 7z.dll, License.txt del instalador x64), `vendor/mac/7zz` (del `-mac.tar.xz`) y `vendor/src`, correr `npm test` y actualizar `THIRD-PARTY-NOTICES.md` y `LEGAL-COLOMBIA.md`.
