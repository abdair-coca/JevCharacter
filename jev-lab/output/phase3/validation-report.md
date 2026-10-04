# Fase 3: teclado y recuperación listos para prueba personal

Estado técnico: **PASS**. Las fases 1 y 2 fueron aprobadas por el usuario; **la prueba personal y aprobación final de esta fase 3 siguen pendientes**. Preview: `http://127.0.0.1:4180/`; el servidor existente permanece abierto. Arranque desde la raíz: `python ./jev-lab/validators/preview.py`.

## Resultados automáticos

- Node: **20 tests, 0 fallos**, incluidos los 16 anteriores. Evidencia: `controller-action-tests.txt`.
- Python: **35 tests OK**, incluidos los 31 del contrato RML. Evidencia: `python-tests.txt`.
- Sintaxis `app.mjs` y `action.mjs`: exit 0.
- `build.py --check`: PASS, sin regenerar fuentes. Evidencia: `build-check.txt`.
- Rive CLI verify: success true, **0 errores, 0 advertencias**. Evidencia: `verify.json`.
- Validator de fuente y `inspect` real: PASS para ambos clips, **363/387 muestras**, neutral exacto. `happy_bounce`: 750 ms. `curious_look`: 800 ms, retraso 100 ms, stretch 7%, hold 200 ms y dirección derecha. Evidencia: `validation.json` e `inspect.json`.
- Revisión de los siete archivos de implementación/documentación: sin errores de whitespace. Evidencia: `diff-review.txt`.
- Servidor local: HTTP 200.

Los cuatro tests nuevos comprueban activación enfocada Enter/Espacio, prevención de scroll, rechazo de repetición y solicitudes ocupadas; suspensión con liberación de instancia y restauración de los 20 campos; limpieza del frame neutral pendiente; y hit test correcto tras resize estrecho/ancho. Los tests anteriores cubren límites y mapeo del cursor, respuesta independiente de fps y neutral sin deriva.

## Navegador real: QA independiente del agente principal

Enter/Espacio con JEV enfocado activan alegría; Espacio conserva exactamente el scroll. Tab pasa de JEV a Curiosidad y el foco es visible. Doble clic acepta una solicitud e ignora la segunda sin reiniciar ni encolar. Ventanas 1280×720 y 390×844 mantienen el personaje visible, mirada acotada, contain correcto, resolución DPR correcta y ausencia de overflow horizontal.

**Limitación comprobada:** el navegador integrado mantiene `document.hidden=false` incluso al abrir otra pestaña o cambiar su visibilidad mediante la herramienta. No se pudo verificar el evento real de ocultación en ese entorno. Los helpers de suspensión pasan los tests y el listener fue revisado; el usuario debe comprobar cambio de pestaña/minimización en un navegador convencional. No se usaron hooks de depuración ni eventos artificiales como prueba de ocultación real.

## Comportamiento entregado

JEV es un botón accesible y enfocable mediante Tab, con borde visible. Enter/Espacio activan alegría únicamente cuando está enfocado; otras teclas no activan nada. El botón Curiosidad conserva su activación nativa. Los clics/toques siguen limitados a la silueta corporal. No se inicia una state machine ni se añade autoplay.

Ocultar la página cancela el frame pendiente, libera la instancia activa, elimina cualquier transición pendiente y restaura los 20 campos neutrales. Al volver se dibuja neutral y no se reanuda el clip; el seguimiento espera una nueva interacción. `data-visibility` y `data-cancellation-count` complementan el diagnóstico existente. El cierre retira listeners, cancela frames y libera recursos, incluso si el runtime termina de cargar después del cierre.

No se modificaron RML, clips, specs, anatomía, catálogo ni selección de preview. Las evidencias de fases 1 y 2 se preservan. La comprobación independiente de navegador y hashes corresponde al agente principal. Esta entrega es local; no publica ni integra cambios en producción.
