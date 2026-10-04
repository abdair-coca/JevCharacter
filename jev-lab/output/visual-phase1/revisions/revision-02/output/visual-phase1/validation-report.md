# Evidencia técnica de identidad visual — fase 1 activa

## Revisión 02 — feedback del 2026-10-04, Bolivia

La propuesta ahora es una esfera `Ellipse` 122×122. Los ojos son elipses cortas 9×11, separados 18 unidades y centrados verticalmente. El morado tiene contraluz violeta/rosa detrás, borde iluminado, reflejo superior derecho y sombra frontal púrpura; todo son capas/gradientes RML reales. La propuesta anterior, su fuente, generador y captura quedan archivados con SHA-256 en `revisions/revision-01/`.

Validación técnica de esta revisión: `visual_phase1.py --prepare` verifica y compila los dos proyectos con CLI 1.3.0; **42 tests Python y 25 Node PASS**, incluyendo esfera circular, ojos centrales y redondos, correspondencia de medidas del comparador y archivo de revisión anterior intacto. `build.py --check`, preservación de 134 referencias y `git diff --check` PASS. Renders CLI nuevos: `proposal-neutral.png` y `proposal-small.png`; inspección visual confirma esfera, iluminación suave y dos ojos legibles a aproximadamente 48 px de cuerpo. Sintaxis consultada guardada en `revision-02-syntax-evidence.txt`.

**Verificación final CUA del 2026-10-04:** las tres versiones son visibles al recargar el comparador. La propuesta muestra círculo real, ojos blancos centrales y redondos, morado luminoso, contraluz superior derecho y sombra frontal. El tamaño pequeño de 48 px mantiene los dos ojos legibles sobre ambos fondos; los cuerpos normales usan 140 px CSS y el ancho coincide con el original.

Se descargó la captura nativa real `jev-fase1-comparacion (1).png` y se conservó como [comparison.png](comparison.png), **1800×1370, 1.369.263 bytes**. La inspección visual confirmó los 12 renders: tres versiones × dos tamaños × dos fondos. [Captura anterior](revisions/revision-01/output/visual-phase1/comparison.png) preservada con su manifest. Las observaciones de navegador más abajo describen la primera entrega como evidencia histórica. La aceptación humana de la revisión 02 sigue pendiente.

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
