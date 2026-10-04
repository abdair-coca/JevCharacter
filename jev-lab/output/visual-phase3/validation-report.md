# Fase 3: autoría y controlador verificados

La autoría semántica descubre tres definiciones y genera siete variantes, 28 clips y ocho máquinas reales de Rive. `play`, `sequence`, `lookAt`, `setAmbient`, `stop` y `dispose` funcionan sobre el rig v2 preservado. Preview local: `http://127.0.0.1:4183/`.

## Verificación local

| Comando | Resultado |
|---|---|
| `python -m unittest discover -s jev-lab/tests` | PASS: 59 tests, 164.668 s. |
| `python -m unittest discover -s jev-lab/tests -p test_author_phase3.py` | PASS: 8 tests tras mejora final de JSON pointers, 64.841 s. Incluye dos builds reales CLI, error de sintaxis, conservación de catalog/RIV y recuperación. |
| `node --test jev-lab/tests/*.mjs` | PASS: 37 tests. Ocho ejercitan interfaz pública del controlador. |
| `python jev-lab/validators/author_phase3.py --prepare` y arranque del servidor | PASS: CLI 1.3.0 verify/once/inspect-summary, sin errores, warnings ni problemas; RIV de 747995 bytes. |
| `python jev-lab/validators/author_phase3.py --check` | PASS: RML y catálogo deterministas, tres acciones descubiertas. |
| `python jev-lab/validators/author_phase3.py --render` | PASS: 25 renders Rive reales; siete variantes e interrupción; ocho retornos con RGBA exactamente igual al neutral inicial. |
| `python jev-lab/validators/rig_phase2.py --check` | PASS: 861 muestras/21 pares; margen ocular mínimo 6.290042 px; fuente RML v2 intacta. |
| `python jev-lab/validators/build.py --check` | PASS: fuentes históricas intactas. |
| `python jev-lab/validators/visual_phase1.py --check-preservation` | PASS: 134 referencias históricas intactas. |
| SHA-256 contra `phase2-preservation.json` | PASS: 12 fuentes de fase 2 intactas. |
| `git diff --check` | PASS; avisos de CRLF en cambios preexistentes de la aplicación. |

La prueba de definición nueva añade solamente un JSON temporal, genera su máquina y conserva otras fuentes. Pruebas del controlador incluyen reemplazo, handles antiguos, interrupción, secuencia con overshoot, composición por canales, intensidad cero, variantes, velocidades límite, comando inválido sin mutación, neutral persistente después de stop y liberación idempotente.

La prueba de watcher conserva bytes del catálogo, RIV y fuentes generadas después de JSON inválido; corrige el parámetro y obtiene una nueva generación, manteniendo disponibles recursos de la anterior. Un error transitorio de lectura no termina el watcher; vuelve a intentar. Un error de contenido sin cambios no produce revisiones repetidas.

El agente principal repitió los 37 tests Node y las verificaciones de generación, rig, build y preservación. En navegador WebGL2 real confirmó flor completa con canales no poseídos conservados, intensidad cero, secuencia 3/3, reemplazo que cancela secuencia y neutral de stop con captura de canvas idéntica a su referencia. Añadió un único JSON temporal: cuarta acción, clip y máquina descubiertos, reproducción completada 1/1. JSON inválido conserva reproducción/catálogo; abrir con error también carga la generación válida. Este último caso motivó una corrección mínima en el preview. Las consultas de estado usan URL fresca para evitar resultados cacheados. La retirada del JSON temporal recuperó automáticamente tres acciones y generación `08aecb8f160cb11f2c0f`, sin recargar la página; consola limpia. Evidencia detallada: `browser-validation.json`. Preview final comprobado: `http://localhost:4183/`.

## Evidencia inspeccionable

- `compile-validation.json`: CLI verify, build e inspect-summary con conteos reales.
- `render-validation.json`, `render-log.json`, `renders/`: capturas de clips y máquinas reales.
- `contact-sheet.png`: siete variantes, interrupción y neutral, inspeccionados visualmente.
- `phase2-preservation.json`: baseline del agente principal; su validación final y `browser-validation.json` se registran por el agente principal.

## Límites de esta fase

El salto histórico de 52 px se adapta a 10 px para respetar cuerpo v2; conserva 750 ms e intención. Curiosidad conserva 800 ms, ojos 100 ms antes del cuerpo, 4° de giro, stretch 1.07 y hold 300–500 ms. El controlador usa un puente neutral inmediato al reemplazar; continuidad refinada y repertorio completo corresponden a fase 4. El ambiente es estático y excluye formas para evitar mezclas geométricas triples.

El harness de interrupción CLI usa transición inmediata de máquina a 200 ms y comprueba neutral final; los comandos y el puente del controlador se verifican por sus propias pruebas y navegador. El servidor publica parejas catalog/RIV inmutables por generación y prepara reemplazo válido antes de liberar el preview anterior. Duración del build depende de carga local; el polling de 500/700 ms no promete recompilación instantánea.

Fuentes y aplicación anteriores preservadas. Sin integración, commit, instalación, despliegue ni trabajo en fases 4/5. Entrega ordinaria `disabled/unmanaged`; sin activación de receipt-driven development.
