# Interacción

Hay dos caminos distintos: respuesta pointer local, inmediata, y decisión conductual, activada por eventos explícitos. Mover el cursor no programa por sí mismo llamadas al modelo.

## Mouse, touch y actividad

El sensor escucha Pointer Events para mouse, touch y pen. En cliente calcula posición normalizada, velocidad, distancia a la criatura, cercanía, clicks recientes, ráfaga, tiempo inactivo, pointer sostenido, actividad de sesión y retorno tras ausencia. Atenúa velocidad con el tiempo y pinta `--pointer-x` / `--pointer-y` en el escenario.

Estas medidas no forman parte del `CreatureWorldState` enviado a `/api/decide`: no se envían posición, velocidad, distancia, clicks ni tipo de pointer. Actividad sí puede influir indirectamente en la personalidad local y en el tiempo inactivo agregado que aparezca en una decisión futura.

Pointer-down sobre escenario invoca `bump()` para dar respuesta inmediata, excepto sobre controles/interactivos y dentro del canvas de la criatura. `bump` reutiliza el estado actual y aplica cooldown; no equivale a pedir una decisión a Jev. Contexto, HUD y panel de diagnóstico tienen acciones propias.

## Qué dispara decisión

| Evento | Efecto |
|---|---|
| Enviar texto no vacío | Recorta a 280 caracteres, conserva el contexto solo durante la sesión y solicita decisión contextual. |
| Borrar contexto | Borra el contexto actual y cualquier respuesta en curso; solicita nueva decisión contextual. |
| Volver tras ausencia | Si la pestaña vuelve visible tras al menos 1,5 s, registra retorno. Scheduler lo consulta al estar visible y tras cooldown de decisión. |
| Movimiento, proximidad o clicks | Actualiza sensores y puede evolucionar personalidad local; no dispara solicitud por sí solo. |

Scheduler usa cooldown, caché por huella de estado, máximo local de solicitudes, timeout y fallback. Contexto puede reemplazar una solicitud activa si el estado cambió. Servidor y cliente validan la decisión estructurada; el servidor rechaza claves extra en el estado, incluidos datos de pointer. Límites son comportamiento del código, no garantía de disponibilidad remota.

Cada decisión contextual ejecuta una sola acción tipada. Las decisiones de retorno se limitan a una reacción, aunque exista contexto anterior.

| Acción | Regla | Efecto |
|---|---|---|
| `reaction` | Respuesta visual ordinaria. Un intento explícito de asustar puede elegir `GHOST`. | Ejecuta una sola reacción. Fallback solo produce esta acción. |
| `answer` | `yes` o `no` solo ante una pregunta binaria clara y contestable. | Animación visual; no contiene una respuesta de texto. |
| `talk` | Para explicar o aclarar; estado exacto `Talk`, `talkb`, `talkc` o `talkbc`. | Llama a Groq solo después de esta decisión contextual; `think` permanece hasta el primer texto. |
| `morph` | Solo petición explícita; si no se nombra forma, Jev elige estrella, cuadrado o triángulo. Una forma nombrada en español o inglés se respeta exactamente. Tiene prioridad sobre hablar. | Selecciona el estado enum asociado a la forma; tras duración temporal restaura `Base`. |

## Estados Rive

El adaptador traduce reacciones estructuradas a estados ordinarios: `BASE` a `Base`, `HELLO` a `Hello`, `GHOST` a `Ghost` y `FLOWER` a `Flower`. Controlador cambia enum y dispara trigger; reacciones transitorias vuelven a `Base` según temporización del código.

- `Base`: reposo/observación; `Hello`, `Ghost` y `Flower`: reacciones conductuales ordinarias.
- `think`: se activa al enviar contexto y permanece durante Jev y la espera de Groq; el primer texto recibido puede reemplazarlo por la animación hablada. Otra acción seleccionada lo reemplaza.
- `Cloud`: disponible en el panel de diagnóstico para pruebas manuales; no se usa como espera normal.
- `yes`/`no`: animaciones visuales para respuestas binarias claras.
- `Talk`, `talkb`, `talkc`, `talkbc`: opciones de animación hablada; solo se disparan al recibir texto de una acción contextual `talk`.
- El morph usa los estados enum `MorphState`, `square` o `triangle`; el panel de diagnóstico no ofrece control manual de formas.
- El arranque, al quedar Rive listo, reproduce `Hello` una vez. Panel de diagnóstico puede forzar reacciones, respuestas visuales y estados hablados.

La documentación describe contrato y disparadores observables; no infiere cómo están construidas las animaciones internas. El personaje depende de un asset Rive propiedad del usuario, configurado desde fuente; no copiar, extraer, incrustar ni describir su contenido en docs o exports. Ver [arquitectura](architecture.md) y [entrada para agentes](README.md).

## Respuesta hablada

- Solo una acción contextual `talk` de Jev llama a `POST /api/talk`; reacciones, `yes/no`, morph, fallback y controles de diagnóstico no generan texto.
- El servidor transmite la primera frase en el idioma del usuario (español si no se identifica), con máximo 120 caracteres. Se muestra en un único rótulo, que se desvanece unos 5 s después de terminar.
- Un mensaje nuevo cancela la petición anterior. Si el flujo falla, se elimina cualquier fragmento y no se inventa una respuesta.
- Los últimos cuatro intercambios completos viven solo en memoria de la página; no hay historial visual ni persistencia de mensajes. Al recargar, se reinicia el contexto.
- Vite lee `TYPESAFE_API_KEY`, `JEV_MODEL`, `GROQ_API_KEY` y `GROQ_MODEL` desde `.env`, únicamente server-side. En desarrollo, `/api/decide` y `/api/talk` ejecutan handlers reales; Groq se consulta solo cuando Jev elige `talk`.
