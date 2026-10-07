# Interacción

En Home hay dos caminos distintos: respuesta pointer local, inmediata, y decisión conductual, activada por eventos explícitos. Mover el cursor no programa por sí mismo llamadas al modelo. Features usa un tercer camino independiente: demostraciones predefinidas.

## Home — interfaz y sesión

Home muestra título breve, Jev, input y HUD compacto. El HUD presenta acción/confianza y origen de decisión; su botón monta/desmonta probabilidades, intensidad, atención y personalidad. Los nombres se traducen; los identificadores del contrato permanecen en el detalle. El texto del input tiene límite de 280 caracteres, ignora blanco y da feedback de envío.

Input/HUD tienen superficies orgánicas y un halo con respiración tenue: 4,8 s en reposo y 1,6 s durante una decisión real, modulado por atención. El foco realza la señal del input sin mover su campo ni el botón; el envío tiene feedback y el HUD despliega sus métricas con layout/secuencia de Motion. La decoración se pausa fuera de viewport/pestaña y con movimiento reducido; los cambios de esa preferencia se aplican en vivo. Sin IntersectionObserver queda estática. Ninguna animación representa progreso ni confianza simulados.

La cabecera fija permite navegar a Features y a About (todavía provisional), alternar claro/oscuro con un botón sol/luna y seleccionar ES/EN con indicador animado. El tema del sistema se detecta inicialmente, sin una tercera opción visible; el primer cambio manual queda persistido. Cambiar preferencias conserva el personaje, borrador y HUD desplegado. Atrás/adelante y navegación explícita transfieren el foco al título; la carga inicial no lo mueve. El enlace de salto al contenido precede a los controles. Home ocupa la altura dinámica disponible sin scroll de página; Jev cede espacio en viewport bajo. Los detalles del HUD se superponen hacia arriba sin desplazar el input y se cierran al pulsar de nuevo o con Escape. Las otras rutas conservan scroll nativo.

El input está centrado debajo de Jev independientemente del HUD lateral. En ancho estrecho, el HUD compacto pasa arriba a la derecha. El personaje usa la nueva exportación `prove2.riv` aportada por el usuario, un único canvas directo, máscara CSS radial y escala `1.9`. La composición no procesa píxeles por frame; la última captura en claro confirma que desaparece el disco oscuro de la versión anterior, conservando el halo del personaje.

El idioma elegido se envía al habla como `language: "es" | "en"` y se valida en ambos lados. Home permanece montada al navegar: conserva contexto, borrador, HUD e historial completo limitado; queda oculta e inerte y suspende sensores, scheduler, timers, solicitudes y Rive. Al volver reanuda sin solicitar IA por la navegación ni reproducir una respuesta vieja. Con movimiento reducido Rive queda pausado y los controles DOM siguen utilizables.

## Mouse, touch y actividad

### Features: scroll y guion fijo

Ocho capítulos: Percibe, Reacciona, Decide, Responde, Habla, Se transforma, Se adapta y Sigue contigo. El texto alterna izquierda/derecha y Jev atraviesa el espacio contrario; no hay marco ni HUD persistente. En móvil, el relato se separa verticalmente del personaje y el selector numérico se despliega desde el contador del capítulo.

Anterior/siguiente/repetir y selección directa funcionan con teclado y touch. Cada cambio o repetición cancela la secuencia anterior y parte de Base. El scroll selecciona capítulo sin mover el foco. Las preferencias conservan capítulo/paso/canvas. Fuera de viewport/pestaña se suspenden reproducción/Rive; se vuelve desde paso cero del capítulo actual. Salir de la ruta destruye la presentación, conservando Home.

Decide explica acción, confianza, intensidad y atención con un ejemplo fijo. La puntuación de confianza no garantiza corrección ni es la confianza de personalidad. Habla usa una frase escrita predefinida sin audio; el cursor de Percibe es una ilustración, no un sensor real. Las reacciones locales, ausencia y personalidad también son datos de ejemplo. Nada consulta `/api/*` ni modifica contexto/persona de Home.

Con movimiento reducido, sin observer o viewport muy bajo, el contenido sigue lineal y sin pinning; el modo estático añade una lista de pasos por capítulo. Si Rive no carga, el texto/controles siguen disponibles y hay reintento. [Matriz de evidencia](../.dev/evidence/phase-3/README.md).

### Home: percepción real

El sensor escucha Pointer Events para mouse, touch y pen. En cliente calcula posición normalizada, velocidad, distancia a la criatura, cercanía, clicks recientes, ráfaga, tiempo inactivo, pointer sostenido, actividad de sesión y retorno tras ausencia. Atenúa velocidad con el tiempo y pinta `--pointer-x` / `--pointer-y` en el escenario.

Estas medidas no forman parte del `CreatureWorldState` enviado a `/api/decide`: no se envían posición, velocidad, distancia, clicks ni tipo de pointer. Actividad sí puede influir indirectamente en la personalidad local y en el tiempo inactivo agregado que aparezca en una decisión futura.

Pointer-down sobre escenario invoca `bump()` para dar respuesta inmediata, excepto sobre controles/interactivos y el canvas de la criatura. `bump` reutiliza el estado actual y aplica cooldown; no equivale a pedir una decisión a Jev. Contexto, HUD y panel de diagnóstico tienen acciones propias. El fondo de Home consume `--pointer-x/y` para feedback local tenue, sin un loop decorativo.

## Qué dispara decisión

| Evento | Efecto |
|---|---|
| Enviar texto no vacío | Recorta a 280 caracteres, conserva el contexto solo durante la sesión y solicita decisión contextual. |
| Borrar conversación | Vacía contexto, intercambios completos y caché de contexto; cancela pendientes y solicita una decisión contextual vacía. Conserva personalidad, preferencias y límites de peticiones. |
| Volver tras ausencia real de pestaña/ventana | Tras al menos 1,5 s, registra retorno. Scheduler lo consulta al estar visible y tras cooldown de decisión. |
| Volver desde Features/About | Reanuda Home conservada sin generar una nueva petición por la navegación. |
| Movimiento, proximidad o clicks | Actualiza sensores y puede evolucionar personalidad local; no dispara solicitud por sí solo. |

Scheduler usa cooldown, caché por huella de estado, máximo local de solicitudes, timeout y fallback. Contexto puede reemplazar una solicitud activa si el estado cambió. Servidor y cliente validan la decisión estructurada; el servidor rechaza claves extra en el estado, incluidos datos de pointer. Límites son comportamiento del código, no garantía de disponibilidad remota.

Cada decisión contextual ejecuta una sola acción tipada. Las decisiones de retorno se limitan a una reacción, aunque exista contexto anterior.

| Acción | Regla | Efecto |
|---|---|---|
| `reaction` | Respuesta visual ordinaria. Un intento explícito de asustar puede elegir `GHOST`. | Ejecuta una sola reacción. Fallback solo produce esta acción. |
| `answer` | `yes` o `no` solo ante una pregunta binaria clara y contestable. | Animación visual; no contiene una respuesta de texto. |
| `talk` | Para explicar o aclarar; estado exacto `Talk`, `talkb`, `talkc` o `talkbc`. | Llama a Groq solo después de esta decisión contextual; `think` permanece hasta el primer texto. |
| `morph` | Solo petición explícita; si no se nombra forma, Jev elige estrella, cuadrado o triángulo. Una forma nombrada en español o inglés se respeta exactamente. Tiene prioridad sobre hablar. | Selecciona el estado enum asociado a la forma; tras duración temporal restaura `Base`. |

## Estados Rive de Home

El adaptador traduce reacciones estructuradas a estados ordinarios: `BASE` a `Base`, `HELLO` a `Hello`, `GHOST` a `Ghost` y `FLOWER` a `Flower`. Controlador cambia enum y dispara trigger; reacciones transitorias vuelven a `Base` según temporización del código.

- `Base`: reposo/observación; `Hello`, `Ghost` y `Flower`: reacciones conductuales ordinarias.
- `think`: se activa al enviar contexto y permanece durante Jev y la espera de Groq; el primer texto recibido puede reemplazarlo por la animación hablada. Otra acción seleccionada lo reemplaza.
- `Cloud`: disponible en el panel de diagnóstico para pruebas manuales; no se usa como espera normal.
- `yes`/`no`: animaciones visuales para respuestas binarias claras.
- `Talk`, `talkb`, `talkc`, `talkbc`: opciones de animación hablada; solo se disparan al recibir texto de una acción contextual `talk`.
- El morph usa los estados enum `MorphState`, `square` o `triangle`; el panel de diagnóstico no ofrece control manual de formas.
- El arranque, al quedar Rive listo, reproduce `Hello` una vez. Panel de diagnóstico puede forzar reacciones, respuestas visuales y estados hablados.

La documentación describe contrato y disparadores observables; no infiere cómo están construidas las animaciones internas. El personaje depende de un asset Rive propiedad del usuario, configurado desde fuente; no copiar, extraer, incrustar ni describir su contenido en docs o exports. Ver [arquitectura](architecture.md) y [entrada para agentes](README.md).

## Habla real de Home

- Solo una acción contextual `talk` de Jev llama a `POST /api/talk`; reacciones, `yes/no`, morph, fallback y controles de diagnóstico no generan texto.
- El servidor transmite la primera frase en el idioma ES/EN seleccionado, con máximo 120 caracteres. El idioma del texto introducido o de los turnos anteriores no reemplaza esa preferencia. Se muestra en un único rótulo con su `lang`, que desaparece unos 5 s después de terminar.
- Un mensaje nuevo cancela la petición anterior. Cambiar ES/EN durante generación cancela y regenera el mismo mensaje en el nuevo idioma, descarta sus fragmentos y solo registra el intercambio que termine. Una respuesta ya completada no se traduce retroactivamente.
- Al ocultar Home o la pestaña se cancela la generación, se retira el caption y se conserva únicamente el historial completado. Volver no reinicia esa respuesta. Cambiar idioma en otra ruta tampoco genera red.
- Si el flujo falla, se descarta cualquier fragmento y se muestra un estado localizado en el HUD; no se inventa una respuesta de Jev. La cancelación de una decisión todavía pendiente tiene su propio aviso, distinto del aviso de habla.
- Los últimos dos intercambios completos viven solo en memoria de Home (`SPEECH_HISTORY_LIMIT=2`); no hay historial visual ni persistencia de mensajes. Al recargar o borrar la conversación se vacía el contexto.
- Vite lee `TYPESAFE_API_KEY`, `JEV_MODEL`, `GROQ_API_KEY` y `GROQ_MODEL` desde `.env`, únicamente server-side. En desarrollo, `/api/decide` y `/api/talk` ejecutan handlers reales; Groq se consulta solo cuando Jev elige `talk`.
