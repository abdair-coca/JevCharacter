# Evidencia técnica de identidad visual — fase 1 activa

La propuesta neutral y la referencia actual compilan en proyectos separados con Rive CLI 1.3.0. El comparador utiliza WebGL2 2.42.2 instalado para todas las versiones. La aprobación humana permanece pendiente.

## Comprobaciones ejecutadas

| Comando | Resultado |
|---|---|
| `python ./jev-lab/validators/visual_phase1.py --prepare` | Verify y compile `--once` de current-reference y proposal: PASS; original SHA-256 coincide; 134 referencias preservadas. |
| `python -m unittest discover -s ./jev-lab/tests -v` | 40 tests PASS, incluida preservación y allowlist HTTP con traversal/listados rechazados. |
| `node --test ./jev-lab/tests/test_controller.mjs ./jev-lab/tests/test_action.mjs ./jev-lab/tests/test_visual_geometry.mjs ./jev-lab/tests/test_visual_matte.mjs` | 25 tests PASS: 20 regresiones históricas, 2 de escala/calibración y 3 de preservación interior/reconstrucción del matte. |
| `python ./jev-lab/validators/build.py --check` | Anatomía, escena y selección históricas intactas: PASS. |
| CLI `--screenshot` de ambos proyectos separados | `proposal-neutral.png` y `current-neutral.png`, renders reales nuevos; fuentes y renders previos preservados. |
| `rive docs format` y `rive schema` de los 10 tipos utilizados | Consultados y guardados en `syntax-evidence.txt`. |
| `git diff --check -- .dev/tasks.md jev-lab` | PASS. |

Los reportes reales están en `build-report.json`, `current-reference-verify.json`, `current-reference-once.json`, `proposal-verify.json`, `proposal-once.json`, `python-tests.txt` y `node-tests.txt`.

## Verificación de navegador

El agente principal descargó mediante CUA `original-neutral-raw.png` de 1000×750 para el artboard 1600×1200 (escala 0.625). Medición con Pillow: bordes corporales horizontales 374/375 y 624/625 en y381; verticales 255/256 y 505/506 en x500. Cuerpo visible de 250×250 px: **400×400 unidades**, centro calibrado **800,610** con incertidumbre menor que un píxel raw. Esquina RGBA(0,0,0,255): confirma fondo negro opaco. Datos y método reproducibles en `calibration.json`; render raw intacto conservado. El tamaño mide el cuerpo opaco, no artboard ni halo.

Verificación final del agente principal mediante CUA, **2026-10-03 (Bolivia)**: original, referencia actual y propuesta cargan y son visibles con WebGL2. Tras recargar con centro original 800,610, el cuerpo original coincide con los 140 px CSS de las otras versiones. Cambiar a **Claro** aplica la misma superficie a los tres paneles y elimina el rectángulo negro exterior del original. El personaje permanece en neutral.

Se pulsó **Descargar comparación PNG** en el navegador. El archivo descargado real se conservó como [comparison.png](comparison.png), **1800×1370, 1.129.411 bytes**. Inspección de la imagen confirmó las **12 vistas pobladas**: tres versiones × dos tamaños × dos fondos. Los cuerpos usan 280 px normales y 96 px pequeños en la exportación a resolución doble, equivalentes a 140 y 48 px CSS. [Original raw](original-neutral-raw.png), 1000×750, preserva la prueba sin matte. La extracción del halo sigue siendo una reconstrucción sobre negro, no una afirmación de transparencia fuente recuperada. No se afirma aprobación visual.

El primer intento de Canvas2D no reprodujo correctamente el feathering del original. El cambio a WebGL2 necesitó corregir `clear()` y la resolución de frames del runtime instalado; la evidencia anterior de carga no se usa como validación final. Las observaciones y capturas descritas aquí corresponden a la última recarga estable.

## Preservación y alcance

Original SHA-256: `98aa68170540d448deaed0db6fa57c11b062cebf9036dc1cfada4376254a8daf`. Lectura exacta del archivo original; no hay copia de ese `.riv`. Snapshot de fuentes y manifest bajo `visual/phase1/`. Output histórico sin cambios. Propuesta sin clips, state machines, scripts Luau ni rig nuevo. Sin aplicación, installs, upgrades, commits, despliegue o fases posteriores.

CodeGraph se consultó antes de escribir: índice no inicializado. `skill_resolution: paths-injected`; `memory_resolution: unavailable`. Entrega ordinaria unmanaged; no se activó receipt-driven development.
