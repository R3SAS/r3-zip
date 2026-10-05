# Validación legal — R3 Zip 1.0.1 (Colombia)

**Fecha:** 2026-10-05 · **Política aplicada:** `_legal-r3/VALIDACION-LEGAL-APPS-R3.md`
**Modelo de distribución:** gratuita, regalada por R3 a sus clientes; código abierto (MIT). No se vende.

> Revisión técnica de cumplimiento, no opinión jurídica. Ver aviso en la política general.

## Resultado: APTA para regalar a clientes

No requiere registro ni permiso de ninguna entidad colombiana para distribuirse. No copia código, gráficos ni textos de 7-Zip, WinRAR, WinZip u otro programa: la interfaz, el ícono y los textos son propios de R3.

## Detalle de la revisión

| Punto | Estado | Evidencia |
|---|---|---|
| Nombre «R3 Zip» | ⚠️ Pendiente de búsqueda en SIC | «ZIP» es el nombre genérico del formato (uso descriptivo); el distintivo es «R3». Antes de distribuir masivamente: buscar «R3 ZIP» en https://sipi.sic.gov.co (clases 9 y 42). Si hubiera conflicto, alternativa: «R3 Compresor». |
| Ícono y logo | ✅ Propios | `tools/make-icon.js` (caja negra, cremallera dorada, «R3»). Logo oficial R3 del kit de marca. |
| Interfaz y textos | ✅ Propios | `renderer/` escrito desde cero; no usa recursos de 7-Zip File Manager ni de otros programas. |
| Motor 7-Zip 26.03 | ✅ Uso conforme a licencia | Binarios oficiales sin modificar, ejecutados como proceso aparte. Se incluyen `License.txt` (LGPL + BSD) y el **código fuente** (`engine-source/7z2603-src.7z`); el motor es reemplazable (carpeta `engine`). Cumple LGPL 2.1 §6. |
| RAR | ✅ Solo descompresión | Licencia unRAR permite descomprimir; prohíbe crear un compresor RAR. R3 Zip **no crea** RAR. Restricción documentada en `THIRD-PARTY-NOTICES.md`. |
| ZIP / 7Z / TAR / GZ / XZ / BZ2 | ✅ Libres | Formatos y algoritmos de uso libre; patentes antiguas vencidas. Cifrado AES-256 (estándar público). |
| Electron / Chromium | ✅ MIT / BSD | electron-builder incluye `LICENSE.electron.txt` y `LICENSES.chromium.html`. |
| Marcas de terceros | ✅ Solo uso informativo | «Compatible con ZIP, 7Z, RAR…» + aviso de independencia en Acerca de y en el instalador (Decisión 486, art. 157). |
| Datos personales | ✅ No recolecta | Funciona sin Internet; no envía telemetría ni datos. No aplica Ley 1581. |
| Funciones ilícitas | ✅ Ninguna | No rompe contraseñas; solo usa la que el usuario conoce. |
| Leyenda «código abierto desarrollado por R3» | ✅ Incluida | Propiedades del .exe (*Detalles*: descripción y copyright), Info.plist en Mac, página de licencia del instalador, ventana Acerca de, `LICENSE`. |
| Garantía y responsabilidad | ✅ | MIT «tal cual» + salvedad de dolo/culpa grave (Código Civil art. 1522). |
| Exportación del cifrado | ✅ Sin restricciones en Colombia | Si el código se publica en GitHub (EE. UU.), el cifrado estándar de código abierto publicado está exento de licencia de exportación (EAR 734.3(b)(3)). |

## Pendientes (no bloquean regalarla a clientes conocidos)
1. Buscar el nombre en la SIC (5 minutos, gratis).
2. Confirmar la razón social exacta de R3 para el aviso de copyright (hoy dice «R3»).
3. ✅ Código fuente publicado (2026-10-05): https://github.com/R3SAS/r3-zip
4. Opcional: registro del software en la DNDA a nombre de R3.
5. Opcional: firma de código (Windows) y notarización Apple (macOS) para evitar advertencias de seguridad.
