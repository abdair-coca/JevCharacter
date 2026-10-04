# Fase 4 — validación de implementación

**PASS técnico:** 13 acciones, 18 variantes, seis transformaciones y reposo discreto con curvas Rive reales. CLI 1.3.0 y runtime/WASM 2.42.2 permanecen locales y fijados. Generación `9158312fca163a88ecf5`, binario 1.213.891 bytes. Aceptación visual y superioridad subjetiva quedan a cargo del desarrollador; fase 5 sigue pendiente.

## Comandos y resultados

| Comando desde raíz | Resultado | Evidencia |
|---|---|---|
| `python jev-lab/validators/personality_phase4.py --prepare` | verify/once/inspect-summary PASS, sin problems/errors/warnings | `compile-validation.json`, `cli-verify.log`, `cli-once.log`, `cli-inspect.log` |
| `python jev-lab/validators/personality_phase4.py --check` | PASS, 13 acciones; igualdad determinista scene/catalog | `generated-check.log` |
| `python jev-lab/validators/personality_phase4.py --render` | 44 PNG reales, 18 variantes, seis formas; 19 neutrales RGBA exactos | `render-validation.json`, `render-log.json`, `contact-sheet.png`, `renders/` |
| `python -m unittest discover -s jev-lab/tests` | **67 PASS**, 0 errores/fallos | `python-tests.log` |
| `node --test jev-lab/tests/*.mjs` | **56 PASS**, 0 fallos/cancelled/skipped | `node-tests.log` |
| `node --test jev-lab/tests/test_personality_native_phase4.mjs` | **12 PASS**, WASM real | `native-tests.log`, `native-validation.json` |
| `node --test jev-lab/tests/test_original_phase4.mjs` | PASS; original real, 22 clips, 16 enums, 0 inputs, 15 activaciones | `original-runtime-validation.json` |
| `python jev-lab/output/visual-phase4/preservation-check.py` | 58 archivos previos + 12 app/original + 134 históricos intactos | `writer-preservation-check.json` |
| `node --check jev-lab/visual/phase4/web/controller.mjs` y `node --check jev-lab/visual/phase4/web/app.mjs` | PASS | Verificación terminal |
| `git diff --check` | PASS; sólo avisos de normalización LF/CRLF sobre cambios previos de app | Verificación terminal |

La muestra activa de speech usa `beat_one` para mostrar realmente sus cuatro variantes. El log registra los comandos de captura finales. La escena de interrupción CLI usa blend nativo de máquina de 150 ms hacia neutral a 425 ms; no se presenta como implementación del recovery congelado del controlador.

## Comportamiento comprobado

- Los seis comandos validan toda orden antes de mutar. Handles conservan resultado, cancelación antigua no afecta al sucesor y secuencias procesan excedente entre duración/recuperación/siguiente ítem.
- Think/speech tienen entrada/ciclo/salida semánticos; cada variante coincide en endpoints de todos sus canales. Duración explícita de 715 ms termina a 865 ms, incluyendo recuperación 150 ms, para speed 0.1/1/4. Default finito; secuencias rechazan bucles indefinidos.
- Reemplazos al mismo timestamp: diferencia máxima nativa medida **0**. Cancelación mid-entry y mid-cycle: diferencia **0**. 1000 órdenes conservan máximo un outgoing y un pending; sólo entra la última. Instancias creadas se eliminan una vez, incluso ante fallo parcial o de suscripción.
- Envelope Rive no visible x=1→0, curva cúbica y extremos planos; no existe solver cúbico paralelo en JavaScript. Native loop seams de think/speech coinciden en muestras y variantes; se guardan velocidades direccionales finitas.
- Breath: 2.8 s, scaleX máximo1.004, scaleY máximo1.008, desplazamiento máximo0.35 px. Blink:150 ms. Seed731, primer minuto: seis breath/six blink; 70.77% de muestras cada50ms están exactamente quietas/neutrales. La ocupación reportada corresponde a clips programados; schedule contiene sus tiempos reales.
- El scheduler procesa eventos en orden cronológico global. Prueba600000ms con ticks100ms frente a un único tick: schedule, occupancy, layers y pose final **exactamente iguales**. Esta regresión corrige el defecto detectado por validación independiente.
- Base bodyY4/scaleY1.03 y gaze(-5,3) permanecen guardados al habilitar/cambiar seed. En apex breath real: BodyRoot.y173.65 y BodyDeform.scaleY1.038. Takeover/cancelación no producen salto de comando; máximo de liberación muestreada por1ms:0.06399 en propiedades de unidades mixtas. No se interpreta como distancia geométrica universal.
- Stop cancela recovery/pending/actividad, aplica neutral completo y deja ticks posteriores neutrales, sin programación nueva. Dispose libera recursos y suscripción de forma idempotente.

La validación independiente del agente principal registra **13 PASS** en `independent/native-independent-validation.json`, incluyendo reemplazos de todas las acciones, continuidad contra fase3,10 minutos de reposo y lifetime. La evidencia de navegador y comparación original es administrada por el agente principal en `browser-validation.json`.

## Preservación y límites

Original SHA-256: `98aa68170540d448deaed0db6fa57c11b062cebf9036dc1cfada4376254a8daf`. No se modificaron fase1/2/3, aplicación dirty, paquetes ni original. El módulo adapta `author_phase3.generate(tempSource)` y usa source/output propios; no llama `compile_rig` ni el store de fase3 con defaults.

El original se descubre mediante RuntimeLoader con WASM binario local: ViewModel1/Instance enlazado tanto al artboard como a State Machine1; followBoo=false, escritura enum, frame de preparación, trigger y avance real. CLI inspect no soporta ese binario. `MorphState` activa `MorphTest`; igualdad con estrella no se afirma sin evidencia visual. Flower y Ghost activan exactamente `Flower`/`Ghost`.

Comparador raw sobre negro, cuerpos neutrales140/48pxCSS, cámara fija; conserva Bump y timing originales. Preparación original introduce desfase inicial aproximado de un frame (unos17ms observados) respecto de propuesta. Ambos usan reloj de pared; no se afirma sincronía exacta de fase. Ese refinamiento queda para fase5.

Muestras finitas de nodos/frames no prueban continuidad analítica completa ni C1 perfecta, y no prueban superioridad subjetiva. La liberación hacia base numérica usa envelope nativo; Stop es excepción explícita de neutral inmediato. Editor temporal, integración, despliegue y validación de input/resize/DPR de fase5 permanecen fuera de alcance.

## Uso y entrega

Preview: `http://127.0.0.1:4184/`; [guía de autoría/interface](../../visual/phase4/README.md). Cambios JSON válidos recompilan y publican pareja inmutable; errores mantienen último preview válido. Comunicación, módulo y documentación siguieron skills caveman/codebase-design/cognitive-doc-design cargados por ruta. Memoria no disponible: autoridad en fuentes locales. Entrega ordinaria unmanaged; sin receipt-driven development, commits, despliegue ni nuevas dependencias.
