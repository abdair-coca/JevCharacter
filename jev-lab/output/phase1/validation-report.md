# Fase 1: seguimiento local listo para prueba personal

Estado técnico: **PASS**. Preview independiente en `http://127.0.0.1:4180/`, neutral al abrir, seguimiento suave del cursor y retorno exacto al salir. **Fases 2 y 3 no implementadas: esperan la prueba personal y confirmación del usuario.**

## Verificaciones ejecutadas

| Comprobación | Resultado | Evidencia |
|---|---|---|
| Controller | 8 tests Node, 0 fallos | `controller-tests.txt` |
| Suite Python | 35 tests OK: 31 existentes + 4 de contención HTTP | `python-tests.txt` |
| Sintaxis JS | `node --check web/app.mjs`: exit 0 | Comando ejecutado |
| Fuentes RML | `build.py --check`: PASS; sin regeneración | Comando ejecutado |
| CLI verify | success true, exit 0, 0 errores y advertencias | `verify.json` |
| CLI inspect | `problems: []`, escena y dos clips anteriores intactos | `inspect-summary.json` |
| Build para servir | `--once`: 2332 bytes, 0 errores y advertencias | Salida del servidor |
| Navegador real | Carga Rive sin firmar; neutral inicial; seguimiento en cuatro direcciones; ojos responden antes del cuerpo; salida neutral exacta y `framePending=false`; consola sin errores/advertencias | QA independiente del agente principal |

Los tests del controller comprueban coordenadas `contain` con letterboxing horizontal/vertical, neutral en diferentes tamaños, límites ±8/±5 px y ±2°, respuesta exponencial consistente a 30/60/144 fps, ojos antes del cuerpo, retorno exacto y rechazo de entradas no finitas. Los tests del servidor comprueban acceso local y rechazo de rutas que escapan del laboratorio.

## Implementación y alcance

`web/controller.mjs` calcula únicamente mirada x/y e inclinación. `web/app.mjs` captura los 20 campos neutrales x/y/rotation/scaleX/scaleY de Jev, BodyTransform, Eyes y Blink, preserva esos campos y aplica solo los tres controles del seguimiento. No crea StateMachineInstance ni instancia de animación; cargar un artboard no reproduce los clips. Posición, escalas, dimensiones y blink permanecen neutrales.

Tiempo independiente de fps: interpolación exponencial con tau de 70 ms para ojos y 140 ms para cuerpo. Al aproximarse a neutral se asignan sus valores exactos y se dejan de programar frames. Se usa exclusivamente el RAF/cancel del runtime Rive y su renderer con `contain`; DPR afecta el dibujo, no las coordenadas del cursor.

`validators/preview.py` comprueba fuentes, compila y copia el runtime instalado @rive-app/canvas 2.42.2 dentro de `output/tools/browser/`, ignorado por Git. Sirve solo `jev-lab`, en localhost; JS/WASM son locales, fallback CDN deshabilitado y carga de assets CDN desactivada. No instala dependencias. El cierre de página cancela frames, retira listeners/observer y libera artboard, file y renderer.

Se preservaron anatomía, clips/specs, preview.json y main.rml sin escrituras. Solo se añadieron player, controller, configuración acotada, servidor, tests y esta evidencia; README explica arranque y prueba. No hay controles de reproducción ni teclado. El agente principal realiza la comprobación independiente de hashes y alcance.

La CLI sigue siendo technical preview; el runtime del navegador está fijado al paquete local instalado. Esta prueba cubre navegador local, no publicación ni integración de producción. El servidor debe permanecer abierto mientras se prueba; `Ctrl+C` lo detiene.
