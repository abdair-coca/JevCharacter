# Evidencia técnica de identidad visual — fase 1 activa

## Revisión 04 — sombra central continua, 2026-10-04, Bolivia

El feedback pide corregir únicamente las deformidades de la parte oscura central; el resto de la apariencia está aprobado para conservarse. Se retiró `UpperLeftShade`, cuyo lóbulo se superponía a la sombra frontal. `FrontShadow` ahora usa una sola radial negra centrada en (-8,10), radio 68, con opacidad que cae progresivamente hacia el borde. Así se conserva el frente casi negro con un contorno continuo y redondeado, sin la muesca de la superposición.

**Alcance exacto comprobado:** `body`, `eyes`, `artboard`, `schema`, `scope`, el generador y las capas completas `VioletRim`, `PurpleVolume`, `PinkBacklight` y `VioletBacklight` son idénticos a revisión 03. No se cambiaron sus colores, posiciones, stops ni orden relativo. La configuración del comparador conserva tamaños, centros y referencias; sólo cambia la descripción de la propuesta. [Evidencia JSON](revision-04-scope-evidence.json) registra las comprobaciones. La revisión 03 está archivada con sus nueve archivos y manifest SHA-256 en `revisions/revision-03/`; hashes PASS.

**Verificaciones ejecutadas:** `visual_phase1.py --prepare`: verify/compile de referencia y propuesta PASS, cero errores y warnings; renders CLI normal 360×340 y pequeño 142×134 inspeccionados, sombra redondeada continua y ojos legibles. Las pruebas focales dieron **7 Python y 5 Node PASS**; salidas en `revision-04-python-tests.txt` y `revision-04-node-tests.txt`. `build.py --check` y preservación de 134 fuentes/renders históricos PASS; hash original intacto. No se añadieron tests ni propiedades RML para este ajuste visual.

**Verificación final CUA del agente principal, 2026-10-04:** las tres versiones cargan y se ven. La propuesta presenta sombra negra central redondeada y continua, sin lóbulo superior izquierdo ni muesca. Se descargó el archivo real `C:/Users/abdai/Downloads/jev-fase1-comparacion (3).png` y se conservó como [comparison.png](comparison.png): **1800×1370, 1.350.148 bytes**. Inspección de la imagen confirmó las 12 vistas sobre ambos fondos y tamaños, sombra suave y ojos legibles a 48 px CSS. El agente principal también comprobó de forma independiente los nueve hashes archivados y la igualdad de cuerpo, ojos, artboard y las cuatro luces. `git diff --check -- .dev/tasks.md jev-lab`: PASS.

Aceptación humana de esta entrega pendiente; fases 2–5 sin iniciar. La reconstrucción del matte original conserva la limitación descrita más abajo.


## Revisión 03 — colores del original, 2026-10-04

Se conservaron **exactamente** cuerpo 122×122, ojos 9×11 separados 18, altura central, posiciones y artboard de revisión 02. Sólo se reconstruyeron las capas de iluminación: magenta neón saturado arriba/derecha, borde violeta eléctrico, frente casi negro y halo violeta amplio. Se retiraron tonos lavanda pastel y reflejo claro. El borde usa `screen`, propiedad confirmada en schema de CLI 1.3.0, para emitir violeta sin apagar el magenta superior. La sombra frontal cae de forma gradual para ensanchar la luz diagonal, y una sombra superior izquierda conserva la asimetría del original. Todo permanece en RML; el `.riv` original sigue en lectura.

La revisión 02, incluyendo fuentes, generador, comparación y renders, está preservada por manifest de checksum en `revisions/revision-02/`. Comparación JSON de `body`, `eyes` y `artboard` contra ese archivo: igualdad exacta PASS. Muestras del original y del render nuevo en coordenadas corporales equivalentes están en `revision-03-color-evidence.json`: luz superior derecha original RGB(240,2,252), propuesta CLI RGB(238,2,253); luz diagonal interior (124,0,165)/(116,0,147); frente (4,0,5)/(1,0,1). Son muestras representativas de una reconstrucción de luz propia, no igualdad de cada píxel.

Verificación ejecutada: `visual_phase1.py --prepare` verify/compile PASS; **7 tests Python focales y 5 Node PASS** en `revision-03-python-tests.txt` y `revision-03-node-tests.txt`; `build.py --check`, checksum de 134 referencias y revisión 02 archivada PASS. Renders CLI normal/pequeño inspeccionados en `proposal-neutral.png` y `proposal-small.png`; ojos conservados y neón visible. Consulta RML guardada en `revision-03-syntax-evidence.txt`.

**Verificación final CUA, 2026-10-04:** las tres versiones de la revisión 03 son visibles. La inspección confirmó highlight diagonal más amplio, magenta neón, contorno violeta y frente negro, con forma y ojos conservados. El agente principal descargó la captura nativa `jev-fase1-comparacion (2).png` y la guardó como [comparación de revisión 03](revisions/revision-03/output/visual-phase1/comparison.png): **1800×1370, 1.343.705 bytes**. Inspección de la imagen confirmó los **12 renders** y ojos legibles a 48 px CSS sobre ambos fondos.

Aceptación humana pendiente. Las capturas de revisiones previas están archivadas; las observaciones inferiores son evidencia histórica. La reconstrucción de iluminación aproxima visualmente el original y no copia su asset ni afirma igualdad de todos los píxeles.

## Revisión 02 — feedback del 2026-10-04, Bolivia

La propuesta ahora es una esfera `Ellipse` 122×122. Los ojos son elipses cortas 9×11, separados 18 unidades y centrados verticalmente. El morado tiene contraluz violeta/rosa detrás, borde iluminado, reflejo superior derecho y sombra frontal púrpura; todo son capas/gradientes RML reales. La propuesta anterior, su fuente, generador y captura quedan archivados con SHA-256 en `revisions/revision-01/`.

Validación técnica de esta revisión: `visual_phase1.py --prepare` verifica y compila los dos proyectos con CLI 1.3.0; **42 tests Python y 25 Node PASS**, incluyendo esfera circular, ojos centrales y redondos, correspondencia de medidas del comparador y archivo de revisión anterior intacto. `build.py --check`, preservación de 134 referencias y `git diff --check` PASS. Renders CLI nuevos: `proposal-neutral.png` y `proposal-small.png`; inspección visual confirma esfera, iluminación suave y dos ojos legibles a aproximadamente 48 px de cuerpo. Sintaxis consultada guardada en `revision-02-syntax-evidence.txt`.

**Verificación final CUA del 2026-10-04:** las tres versiones son visibles al recargar el comparador. La propuesta muestra círculo real, ojos blancos centrales y redondos, morado luminoso, contraluz superior derecho y sombra frontal. El tamaño pequeño de 48 px mantiene los dos ojos legibles sobre ambos fondos; los cuerpos normales usan 140 px CSS y el ancho coincide con el original.

Se descargó la captura nativa real `jev-fase1-comparacion (1).png` y se conservó como [comparación de revisión 02](revisions/revision-02/output/visual-phase1/comparison.png), **1800×1370, 1.369.263 bytes**. La inspección visual confirmó los 12 renders: tres versiones × dos tamaños × dos fondos. [Captura anterior](revisions/revision-01/output/visual-phase1/comparison.png) preservada con su manifest. Las observaciones de navegador más abajo describen la primera entrega como evidencia histórica. La aceptación humana de la revisión 02 sigue pendiente.

La propuesta neutral y la referencia actual compilan en proyectos separados con Rive CLI 1.3.0. El comparador utiliza WebGL2 2.42.2 instalado para todas las versiones. La aprobación humana permanece pendiente.

## Comprobaciones ejecutadas

| Comando | Resultado |
|---|---|
| `python ./jev-lab/validators/visual_phase1.py --prepare` | Verify y compile `--once` de current-reference y proposal: PASS; original SHA-256 coincide; 134 referencias preservadas. |
| `python -m unittest discover -s ./jev-lab/tests -v` | 42 tests PASS, incluida preservación, allowlist HTTP con traversal/listados rechazados y requisitos esféricos de revisión 02. |
| `node --test ./jev-lab/tests/test_controller.mjs ./jev-lab/tests/test_action.mjs ./jev-lab/tests/test_visual_geometry.mjs ./jev-lab/tests/test_visual_matte.mjs` | 25 tests PASS: 20 regresiones históricas, 2 de escala/calibración y 3 de preservación interior/reconstrucción del matte. |
| `python ./jev-lab/validators/build.py --check` | Anatomía, escena y selección históricas intactas: PASS. |
| CLI `--screenshot` de ambos proyectos separados | `proposal-neutral.png` y `current-neutral.png`, renders reales nuevos; fuentes y renders previos preservados. |
| `rive docs format` y `rive schema` de los 10 tipos utilizados | Consultados y guardados en `syntax-evidence.txt`. |
| `git diff --check -- .dev/tasks.md jev-lab` | PASS. |

Los reportes reales están en `build-report.json`, `current-reference-verify.json`, `current-reference-once.json`, `proposal-verify.json`, `proposal-once.json`, `python-tests.txt` y `node-tests.txt`.

## Verificación de navegador

El agente principal descargó mediante CUA `original-neutral-raw.png` de 1000×750 para el artboard 1600×1200 (escala 0.625). Medición con Pillow: bordes corporales horizontales 374/375 y 624/625 en y381; verticales 255/256 y 505/506 en x500. Cuerpo visible de 250×250 px: **400×400 unidades**, centro calibrado **800,610** con incertidumbre menor que un píxel raw. Esquina RGBA(0,0,0,255): confirma fondo negro opaco. Datos y método reproducibles en `calibration.json`; render raw intacto conservado. El tamaño mide el cuerpo opaco, no artboard ni halo.

Verificación final del agente principal mediante CUA, **2026-10-03 (Bolivia)**: original, referencia actual y propuesta cargan y son visibles con WebGL2. Tras recargar con centro original 800,610, el cuerpo original coincide con los 140 px CSS de las otras versiones. Cambiar a **Claro** aplica la misma superficie a los tres paneles y elimina el rectángulo negro exterior del original. El personaje permanece en neutral.

Se pulsó **Descargar comparación PNG** en el navegador. El archivo descargado real se conservó como [comparación de revisión 01](revisions/revision-01/output/visual-phase1/comparison.png), **1800×1370, 1.129.411 bytes**. Inspección de la imagen confirmó las **12 vistas pobladas**: tres versiones × dos tamaños × dos fondos. Los cuerpos usan 280 px normales y 96 px pequeños en la exportación a resolución doble, equivalentes a 140 y 48 px CSS. [Original raw](original-neutral-raw.png), 1000×750, preserva la prueba sin matte. La extracción del halo sigue siendo una reconstrucción sobre negro, no una afirmación de transparencia fuente recuperada. No se afirma aprobación visual.

El primer intento de Canvas2D no reprodujo correctamente el feathering del original. El cambio a WebGL2 necesitó corregir `clear()` y la resolución de frames del runtime instalado; la evidencia anterior de carga no se usa como validación final. Las observaciones y capturas descritas aquí corresponden a la última recarga estable.

## Preservación y alcance

Original SHA-256: `98aa68170540d448deaed0db6fa57c11b062cebf9036dc1cfada4376254a8daf`. Lectura exacta del archivo original; no hay copia de ese `.riv`. Snapshot de fuentes y manifest bajo `visual/phase1/`. Output histórico sin cambios. Propuesta sin clips, state machines, scripts Luau ni rig nuevo. Sin aplicación, installs, upgrades, commits, despliegue o fases posteriores.

CodeGraph se consultó antes de escribir: índice no inicializado. `skill_resolution: paths-injected`; `memory_resolution: unavailable`. Entrega ordinaria unmanaged; no se activó receipt-driven development.
