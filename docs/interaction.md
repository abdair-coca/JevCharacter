# Interacción

Hay dos caminos distintos: respuesta pointer local, inmediata, y decisión conductual, activada por eventos explícitos. Mover el cursor no programa por sí mismo llamadas al modelo.

## Mouse, touch y actividad

El sensor escucha Pointer Events para mouse, touch y pen. En cliente calcula posición normalizada, velocidad, distancia a la criatura, cercanía, clicks recientes, ráfaga, tiempo inactivo, pointer sostenido, actividad de sesión y retorno tras ausencia. Atenúa velocidad con el tiempo y pinta `--pointer-x` / `--pointer-y` en el escenario.

Estas medidas no forman parte del `CreatureWorldState` enviado a `/api/decide`: no se envían posición, velocidad, distancia, clicks ni tipo de pointer. Actividad sí puede influir indirectamente en la personalidad local y en el tiempo inactivo agregado que aparezca en una decisión futura.

Pointer-down sobre escenario invoca `bump()` para dar respuesta inmediata, excepto sobre controles/interactivos y dentro del canvas de la criatura. `bump` reutiliza el estado actual y aplica cooldown; no equivale a pedir una decisión a Jev. Contexto, HUD y panel de diagnóstico tienen acciones propias.

## Qué dispara decisión

| Evento | Efecto |
|---|---|
| Enviar texto no vacío | Recorta a 280 caracteres, guarda contexto local y solicita decisión contextual. |
| Borrar contexto | Guarda contexto vacío y solicita nueva decisión contextual. |
| Volver tras ausencia | Si la pestaña vuelve visible tras al menos 1,5 s, registra retorno. Scheduler lo consulta al estar visible y tras cooldown de decisión. |
| Movimiento, proximidad o clicks | Actualiza sensores y puede evolucionar personalidad local; no dispara solicitud por sí solo. |

Scheduler usa cooldown, caché por huella de estado, máximo local de solicitudes, timeout y fallback. Contexto puede reemplazar una solicitud activa si el estado cambió. Límites son comportamiento del código, no garantía de disponibilidad remota.

## Estados Rive

El adaptador traduce reacciones estructuradas a estados ordinarios: `BASE` a `Base`, `HELLO` a `Hello`, `GHOST` a `Ghost` y `FLOWER` a `Flower`. Controlador cambia enum y dispara trigger; reacciones transitorias vuelven a `Base` según temporización del código.

- `Base`: reposo/observación; `Hello`, `Ghost` y `Flower`: reacciones conductuales ordinarias.
- `Cloud`: señal visual de pensamiento, activada si decisión sigue pendiente tras un retraso breve; se programa como estado temporal.
- `Talk`: caso contextual limitado. Solo si llegó mensaje enviado, fuente de decisión es `jev`, reacción elegida es `BASE` e intención de atención alcanza el umbral configurado. No es salida de texto ni ruta genérica para todo mensaje.
- El arranque, al quedar Rive listo, reproduce `Hello` una vez. Panel de diagnóstico puede forzar estados manualmente.

La documentación describe contrato y disparadores observables; no infiere cómo están construidas las animaciones internas. El personaje depende de un asset Rive propiedad del usuario, configurado desde fuente; no copiar, extraer, incrustar ni describir su contenido en docs o exports. Ver [arquitectura](architecture.md) y [entrada para agentes](README.md).
