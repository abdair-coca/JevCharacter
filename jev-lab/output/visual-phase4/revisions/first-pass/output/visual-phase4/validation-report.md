# Fase 4 — validación de implementación

**PASS técnico — iteración de cinco acciones modelo:** `happy_bounce`, `curious_look`, `hello`, `think` y `speech`; idle continuo con respiración, deriva ocular y parpadeos; bump Rive al entrar y volver de acciones. El catálogo conserva sus 13 acciones y 18 variantes. CLI 1.3.0 y runtime/WASM 2.42.2 permanecen locales y fijados. Generación `9afee4d9fe0cfef668f8`, binario 1.217.577 bytes. La aceptación visual humana de esta fase aún está pendiente.

## Comandos y resultados

| Comando desde raíz | Resultado | Evidencia |
|---|---|---|
| `python jev-lab/validators/personality_phase4.py --prepare` | verify/once/inspect-summary PASS, 0 errores/avisos | `compile-validation.json`, logs CLI |
| `python jev-lab/validators/personality_phase4.py --check` | PASS, 13 acciones; igualdad determinista scene/catalog | Verificación terminal |
| `python jev-lab/validators/personality_phase4.py --render` | 50 capturas CLI Rive, 18 variantes y 19 neutrales RGBA exactos; incluye bump y sus retornos | `render-validation.json`, `render-log.json`, `contact-sheet.png`, `renders/` |
| `python -m unittest discover -s jev-lab/tests -v` | **69 PASS**, 0 errores/fallos | Verificación terminal |
| `node --test ./jev-lab/tests/*.mjs` | **64 PASS**, 0 fallos/cancelled/skipped | Verificación terminal |
| `test_personality_native_phase4.mjs` dentro de la suite | **17 grupos PASS**, WASM Rive real | `native-validation.json` |
| `git diff --check` | PASS | Verificación terminal |

La muestra activa de speech usa `beat_one` para mostrar realmente sus cuatro variantes. La escena de interrupción CLI usa blend nativo de máquina de 150 ms hacia neutral a 425 ms; no se presenta como implementación de la recuperación congelada del controlador.

## Comportamiento comprobado

- Los seis comandos validan toda orden antes de mutar. Una acción nueva sustituye a la anterior; se conserva como máximo una orden entrante y no se encolan reacciones adicionales.
- Think/speech tienen entrada/ciclo/salida semánticos; cada variante coincide en endpoints de todos sus canales. Duración explícita de 715 ms termina a 865 ms, incluyendo recuperación 150 ms, para speed 0.1/1/4. Default finito; secuencias rechazan bucles indefinidos.
- Reemplazos al mismo timestamp: diferencia máxima nativa medida **0**. Cancelación mid-entry y mid-cycle: diferencia **0**. 1000 órdenes conservan máximo un outgoing y un pending; sólo entra la última. Instancias creadas se eliminan una vez, incluso ante fallo parcial o de suscripción.
- Envelope Rive no visible x=1→0, curva cúbica y extremos planos; no existe solver cúbico paralelo en JavaScript. Native loop seams de think/speech coinciden en muestras y variantes; se guardan velocidades direccionales finitas.
- Idle inicia activo y el clip de respiración de 2.8 s no deja huecos: cobertura muestreada 100%. Pico nativo: BodyDeform scaleX1.035, scaleY1.045, apertura ocular1.06 y miradaX−1; el seed731 produjo seis parpadeos en el primer minuto.
- El scheduler procesa eventos en orden cronológico global. Prueba 600000 ms con ticks de 100 ms frente a un único tick: schedule, ocupación, layers y pose final **exactamente iguales**.
- El bump usa un `BumpTransform` contenedor propio de la escena de fase 4, sin modificar el contrato/rig v2. El runtime real midió escala pico1.03489 al entrar y volver. Reemplazo al mismo timestamp tiene salto nativo máximo0; liberación cancelada muestreada por1ms: máximo0.08977 en propiedades de unidades mixtas, no una distancia geométrica universal.
- La composición del bump se limita dinámicamente por el máximo de escala del rig. Pruebas WASM de los cinco prototipos a speed4 confirman que los productos de escala X/Y no superan1.12; dispose también restaura el transformador a escala1.
- Stop cancela recovery/pending/actividad, aplica neutral completo y deja ticks posteriores neutrales, sin programación nueva. Dispose libera recursos y suscripción de forma idempotente.

La captura integrada `preview-validation-full.png` muestra el idle a 140/48 px y conserva el original en comparación. La aceptación visual de las cinco acciones todavía requiere revisión del desarrollador en el preview de fase 4; el ciclo de vida al ocultar la pestaña corresponde a la Fase 2 de este plan.

## Preservación y límites

Original SHA-256: `98aa68170540d448deaed0db6fa57c11b062cebf9036dc1cfada4376254a8daf`. No se modificaron las fuentes de fases 1–3, la aplicación principal, paquetes ni el original. El módulo adapta `author_phase3.generate(tempSource)` y usa su scene/catalog de fase 4; no llama `compile_rig` ni el store de fase 3 con defaults.

El original se descubre mediante RuntimeLoader con WASM binario local: ViewModel1/Instance enlazado tanto al artboard como a State Machine1; followBoo=false, escritura enum, frame de preparación, trigger y avance real. CLI inspect no soporta ese binario. `MorphState` activa `MorphTest`; igualdad con estrella no se afirma sin evidencia visual. Flower y Ghost activan exactamente `Flower`/`Ghost`.

Comparador raw sobre negro, cuerpos neutrales140/48pxCSS, cámara fija; conserva Bump y timing originales. Preparación original introduce desfase inicial aproximado de un frame (unos17ms observados) respecto de propuesta. Ambos usan reloj de pared; no se afirma sincronía exacta de fase. Ese refinamiento queda para fase5.

Muestras finitas de nodos/frames no prueban continuidad analítica completa ni C1 perfecta, y no prueban superioridad subjetiva. La liberación hacia base numérica usa envelope nativo; Stop es excepción explícita de neutral inmediato. Editor temporal, integración, despliegue y validación de input/resize/DPR de fase5 permanecen fuera de alcance.

## Uso y entrega

Preview: `http://127.0.0.1:4184/`; [guía de autoría/interface](../../visual/phase4/README.md). Cambios JSON válidos recompilan y publican pareja inmutable; errores mantienen último preview válido. No se añaden dependencias, despliegue ni integración en la app principal.
