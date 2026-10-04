# Fase 2: reacciones locales listas para prueba personal

Estado técnico: **PASS**. El preview local inicia neutral, mantiene el seguimiento aprobado y reproduce los dos clips existentes mediante controles explícitos. Clic o toque sobre el cuerpo activa `happy_bounce` (750 ms); **Curiosidad** activa `curious_look` (800 ms). **La fase 3 no está implementada: espera la prueba personal y confirmación del usuario.**

El servidor de la fase anterior sigue disponible en `http://127.0.0.1:4180/`. Para arrancar otra sesión desde la raíz: `python ./jev-lab/validators/preview.py`; `Ctrl+C` detiene el servidor.

## Verificaciones ejecutadas

| Comprobación | Resultado | Evidencia |
|---|---|---|
| Controller y ciclo de acciones | 16 tests Node, 0 fallos: 8 existentes y 8 nuevos | `controller-action-tests.txt` |
| Suite Python | 35 tests OK, incluidos los 31 tests del contrato RML | `python-tests.txt` |
| Sintaxis JS | `node --check` de app.mjs y action.mjs: exit 0 | Comandos ejecutados |
| Fuentes RML | `build.py --check`: PASS; body.rml y main.rml sin cambios pendientes | `build-check.txt` |
| CLI verify | success true; exit 0; 0 errores y advertencias | `verify.json` |
| CLI inspect | `problems: []`; MiniJev conserva sus dos LinearAnimation | `inspect-summary.json` |
| Navegador real | Neutral inicial; clic sobre cuerpo activa happy; fondo no activa; botón activa curious; seguimiento se retoma; consola limpia | QA independiente del agente principal |
| Neutral después de dibujar | Ambos clips completan sus duraciones .75/.8; `lastNeutralPose` contiene los 20 campos neutrales exactos y el contador aumenta | QA independiente del agente principal, tras recarga final |
| Captura del navegador | Player y control de curiosidad visibles | `curiosity-browser.jpg`, capturada por el agente principal |

Los tests nuevos verifican el hit test del cuerpo sin halo ni esquinas exteriores, inversión de rotación/escalas y márgenes `contain`, exclusión mutua, rechazo de solicitudes durante una reacción sin cola ni reinicio, mezcla inicial de 80 ms incluida en la duración original, pose capturada independiente y mezcla sin acumulación, frame neutral antes de retomar seguimiento, cancelación e inputs inválidos. Los tests anteriores mantienen límites, mapeo, respuesta consistente a 30/60/144 fps y retorno neutral.

## Implementación y alcance

`web/action.mjs` controla la propiedad de los canales: seguimiento en reposo, `LinearAnimationInstance` durante la reacción y un frame neutral antes de volver a seguir el último cursor. Cada frame mezclado restaura la pose completa capturada al solicitar la reacción antes de aplicar el mix. Después de los primeros 80 ms restaura la base neutral y aplica el timeline completo. El tiempo de mezcla pertenece a los 750/800 ms del clip; no se añaden pausas ni se reescriben sus claves.

Al terminar se libera la instancia, se restauran exactamente los 20 campos x/y/rotation/scaleX/scaleY de Jev, BodyTransform, Eyes y Blink, se dibuja esa pose y solo después se guarda la evidencia DOM. El siguiente frame retoma suavemente el seguimiento. Las solicitudes durante la reacción o ese frame neutral se ignoran; el botón permanece deshabilitado. Al ocultar la página se cancela la reacción y se neutraliza; al cerrar se liberan los recursos.

El click usa la transformación actual de Jev y BodyTransform, las coordenadas CSS del canvas y el cuerpo redondeado 122×114 con radio 57 del contrato existente. DPR solo afecta el dibujo. No se instancia Preview StateMachine, no hay autoplay ni atajos personalizados. La state machine authored permanece dentro del archivo Rive previo, pero este player nunca la crea.

Se añadieron action.mjs y sus tests, y se actualizaron player, HTML/CSS, textos del servidor y README. Anatomía, body.rml, ambos clips/specs, catálogo, preview.json y main.rml no recibieron escrituras. No se instalaron dependencias ni se modificó la aplicación principal. El agente principal comprueba independientemente hashes y alcance.

La verificación de navegador corresponde al entorno local actual; no implica integración o publicación. La CLI sigue siendo technical preview y el runtime está fijado al paquete local @rive-app/canvas 2.42.2. El usuario debe probar esta fase antes de autorizar la siguiente.
