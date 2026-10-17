# Interacción

En Home hay dos caminos distintos: respuesta pointer local, inmediata, y decisión conductual, activada por eventos explícitos. Mover el cursor no programa por sí mismo llamadas al modelo. Features usa un tercer camino independiente: demostraciones predefinidas.

## Home — interfaz y sesión

La producción actual usa el build ordinario con backend: se verificó un envío real desde Home a `/api/decide`, respuesta `source: "jev"` y HUD remoto. Si el servicio falla, permanece el fallback local. La alternativa `build:frontend` resuelve localmente sin requests API. Features, About, diagnóstico y la demo UATF conservan sus contratos; UATF no envía sus campos aunque el backend esté publicado.

Home muestra título breve, Jev, input y HUD compacto. El HUD presenta acción/confianza y origen de decisión; su botón monta/desmonta probabilidades, intensidad, atención y personalidad. Los nombres se traducen; los identificadores del contrato permanecen en el detalle. El texto del input tiene límite de 280 caracteres, ignora blanco y da feedback de envío.

Input/HUD tienen superficies discretas sin logos ni halo animado. El input ocupa una sola línea; su etiqueta permanece accesible. No se muestran textos promocionales ni rótulos de contexto de sesión; «Borrar conversación» sigue disponible cuando hay contexto. El envío tiene feedback y el HUD conserva acción/confianza, origen accesible y métricas reales desplegables. El título es secundario respecto a Jev.

La cabecera fija permite navegar a Features y a About, silenciar o activar la voz de Jev con un botón de altavoz, alternar claro/oscuro con un botón sol/luna y seleccionar ES/EN con indicador animado. El tema del sistema se detecta inicialmente, sin una tercera opción visible; el primer cambio manual queda persistido. Cambiar preferencias conserva el personaje, borrador y HUD desplegado. Atrás/adelante y navegación explícita transfieren el foco al título; la carga inicial no lo mueve. Una visita nueva empieza arriba; atrás/adelante y recarga devuelven la posición de scroll de esa entrada. El enlace de salto al contenido precede a los controles. Home ocupa la altura dinámica disponible sin scroll de página; Jev cede espacio en viewport bajo. Los detalles del HUD se superponen hacia arriba sin desplazar el input y se cierran al pulsar de nuevo o con Escape. Las otras rutas conservan scroll nativo.

El input está centrado debajo de Jev independientemente del HUD lateral. En ancho estrecho, el HUD compacto pasa arriba a la derecha. El personaje usa `prove2.riv`, un único canvas directo sin máscara CSS radial. Home aprovecha el alto libre y usa escala local `2.1`; Features/About mantienen `1.9`. La composición no procesa píxeles por frame; se conserva el halo propio del personaje.

El idioma elegido se envía al habla como `language: "es" | "en"` y se valida en ambos lados. Home permanece montada al navegar: conserva contexto, borrador, HUD e historial completo limitado; queda oculta e inerte y suspende sensores, scheduler, timers, solicitudes y Rive. Al volver reanuda sin solicitar IA por la navegación ni reproducir una respuesta vieja. Con movimiento reducido Rive queda pausado y los controles DOM siguen utilizables.

## Mouse, touch y actividad

### Inicio: demo de inscripción UATF

«Quiero inscribirme», «quiero registrarme», «quiero estudiar informática» o «me interesa la carrera» abren una experiencia local, con equivalentes en inglés. Mayúsculas, tildes y puntuación se normalizan; se excluyen negaciones y destinos explícitos ajenos a la carrera. Los otros mensajes continúan por el flujo conversacional existente.

Jev descubre el formulario «Ingeniería Informática · UATF» con una transición de layout y partículas transitorias. Nombre completo y celular están disponibles juntos. El nombre es obligatorio (máximo 120 caracteres); celular acepta ocho dígitos y `+591` opcional, tolerando espacios/guiones. Confirmar con errores conserva lo escrito, muestra mensajes asociados y enfoca el primer campo inválido. Confirmar correctamente elimina los valores, reproduce Flower cuando el personaje está listo y muestra «Datos completados» con la indicación de demo sin envío.

Cerrar, Escape, «Volver a Jev» o salir de Inicio descartan el formulario; reabrir comienza vacío. Tema/idioma y suspensión de pestaña conservan los campos mientras sigue abierto. Cerrar recupera el mismo Jev, composición y controles de Home, con foco en el input. La actividad de cerebro/sensores queda suspendida durante la inscripción para cancelar respuestas anteriores y evitar un retorno artificial que consulte IA.

En móvil Jev está encima y se compacta al enfocar un campo; el formulario permite scroll interno en altura reducida y respeta el viewport visual del teclado. Con movimiento reducido no hay desplazamiento coreografiado ni partículas. Un fallo de Rive no bloquea el formulario ni su confirmación. Es una demostración visual: no registra una inscripción institucional, no envía los datos y no usa persistencia. [Capturas y checks](../.dev/evidence/enrollment/README.md).

### Features: scroll y guion fijo

Ocho capítulos: Percibe, Reacciona, Decide, Responde, Habla, Se transforma, Se adapta y Sigue contigo. El texto alterna izquierda/derecha y Jev atraviesa el espacio contrario con inercia, deriva vertical e inclinación suave. En móvil, el personaje está en la zona superior y el texto debajo. No hay marco, HUD persistente, numeración ni barra de presentación.

El scroll nativo, teclado y touch recorren el contenido. «Ver escena» desplaza suavemente hacia el capítulo; pulsarlo en el capítulo actual vuelve a ejecutar su demostración. El scroll selecciona capítulo sin mover el foco y cada cambio cancela la secuencia anterior. Las preferencias conservan capítulo/paso/canvas. Fuera de viewport/pestaña se suspenden reproducción/Rive. Salir de la ruta destruye la presentación, conservando Home.

Decide explica acción, confianza, intensidad y atención con un ejemplo fijo. La puntuación de confianza no garantiza corrección ni es la confianza de personalidad. Habla usa una frase escrita predefinida, entonada con la voz de pitidos de Jev; Percibe representa atención mediante una escena fija, sin cursor decorativo ni sensor real. Las reacciones locales, ausencia y personalidad también son datos de ejemplo. Nada consulta `/api/*` ni modifica contexto/persona de Home.

Con movimiento reducido, sin observer o viewport muy bajo, el contenido sigue lineal y sin pinning; el modo estático añade una lista de pasos por capítulo. Si Rive no carga, el texto/controles siguen disponibles y hay reintento. [Matriz de evidencia](../.dev/evidence/phase-3/README.md). Carga de Jev: Home y Capacidades muestran el mismo cargador de tres puntos animados mientras Jev no está revelada; se desvanece al revelarse, 1,8 s después de estar lista; Capacidades no avanza más allá del inicio de «Percibe» hasta que Jev está revelada, con una parada rígida; About empieza a cargar a Jev al entrar en «Todo empezó con cartón».

### About: historia y visión

Cinco escenas ES/EN presentan el recorrido de Abdair Coca: presentación, Bob (primer gran proyecto), TitiEdu, machine-learning-App y JEV. Las imágenes aportadas se forman con partículas, con tramos estables para reconocerlas y transiciones espirales reversibles. El escenario es oscuro cinematográfico en ambos temas, con parallax suave de mouse y profundidad aparente 2D. La memoria persistente corresponde a Bob; en JEV se distinguen capacidades actuales y visión futura. El cierre conserva “Tiny creature. Big decisions.” en su idioma original.

El scroll recorre la historia sin numeración, botones anterior/siguiente ni desplegables de texto adicional. En la última escena se forma una estrella de cinco puntas de partículas; al continuar se abre y revela a Jev. «Revelar a Jev» recorre suavemente ese mismo scroll con teclado/touch. Volver al inicio reforma la estrella. El cursor de mouse/pen aparta y retuerce partículas cercanas; al retirarlo recuperan su forma. Cambiar idioma/tema conserva escena y canvases. En móvil, ilustración arriba y relato debajo.

Pestaña oculta y escenario fuera de vista pausan las partículas; Rive también se pausa entre proyectos una vez preparado. Salir de About libera canvas/ticker/pinning/Lenis y conserva Home. Con reduced motion, sin observer, viewport bajo o preparación fallida de imágenes: lectura lineal, recursos estáticos y Jev al final, sin parallax ni ticker de partículas. Fallo de imagen tiene aviso localizado; fallo de Rive conserva lectura y reintento independiente. About no consulta `/api/*`. [Evidencia de esta revisión](../.dev/evidence/phase-4/particles-README.md).

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

El adaptador traduce reacciones estructuradas a estados ordinarios: `BASE` a `Base`, `HELLO` a `Hello`, `GHOST` a `Ghost`, `FLOWER` a `Flower` y `QUESTION` a `question`. Controlador cambia enum y dispara trigger; reacciones transitorias vuelven a `Base` según temporización del código. `QUESTION` expresa duda divertida y escéptica, con la ceja levantada; la decisión remota la reserva para comentarios raros/juzgables o preguntas personales incómodas. Preguntas neutras siguen el camino normal y el servicio local no activa este estado.

- `Base`: reposo/observación; `Hello`, `Ghost`, `Flower` y `question`: reacciones conductuales ordinarias.
- `think`: se activa al enviar contexto y permanece durante Jev y la espera de Groq; el primer texto recibido puede reemplazarlo por la animación hablada. Otra acción seleccionada lo reemplaza.
- `Cloud`: disponible en el panel de diagnóstico para pruebas manuales; no se usa como espera normal.
- `yes`/`no`: animaciones visuales para respuestas binarias claras.
- `Talk`, `talkb`, `talkc`, `talkbc`: opciones de animación hablada; solo se disparan al recibir texto de una acción contextual `talk`.
- El morph usa los estados enum `MorphState`, `square` o `triangle`; el panel de diagnóstico no ofrece control manual de formas.
- El arranque, al quedar Rive listo, reproduce `Hello` una vez. Panel de diagnóstico puede forzar reacciones, respuestas visuales y estados hablados.

La documentación describe contrato y disparadores observables; no infiere cómo están construidas las animaciones internas. El personaje depende de un asset Rive propiedad del usuario, configurado desde fuente; no copiar, extraer, incrustar ni describir su contenido en docs o exports. Ver [arquitectura](architecture.md) y [entrada para agentes](README.md).

## Voz de Jev

Jev suena como una pequeña criatura (al estilo de R2-D2, WALL-E o EVA), nunca con palabras. Al hablar, sus pitidos siguen el texto real: una sílaba sonora por sílaba escrita, pausas en comas y fin de frase, tono que sube en preguntas, más brillante en exclamaciones y que cae al cerrar una afirmación. Sin hablar, cada acción tiene su motivo: saludo, flor, fantasma, duda, nube, sí, no, pensar, estrella, cuadrado, triángulo y toque. El regreso a reposo no suena.

La voz está activada por defecto y empieza con el primer clic, toque o tecla, porque los navegadores no permiten audio antes. El botón de altavoz de la cabecera la silencia y la elección se recuerda. Suena en Inicio y en Capacidades; Historia permanece en silencio. Se detiene al ocultar la ruta o la pestaña, al cancelar una respuesta y al silenciar.

## Habla real de Home

- Solo una acción contextual `talk` de Jev llama a `POST /api/talk`; reacciones, `yes/no`, morph, fallback y controles de diagnóstico no generan texto.
- El servidor transmite la primera frase en el idioma ES/EN seleccionado, con máximo 120 caracteres. El idioma del texto introducido o de los turnos anteriores no reemplaza esa preferencia. Se muestra en un único rótulo con su `lang`, que desaparece unos 5 s después de terminar.
- Un mensaje nuevo cancela la petición anterior. Cambiar ES/EN durante generación cancela y regenera el mismo mensaje en el nuevo idioma, descarta sus fragmentos y solo registra el intercambio que termine. Una respuesta ya completada no se traduce retroactivamente.
- Al ocultar Home o la pestaña se cancela la generación, se retira el caption y se conserva únicamente el historial completado. Volver no reinicia esa respuesta. Cambiar idioma en otra ruta tampoco genera red.
- Si el flujo falla, se descarta cualquier fragmento y se muestra un estado localizado en el HUD; no se inventa una respuesta de Jev. La cancelación de una decisión todavía pendiente tiene su propio aviso, distinto del aviso de habla.
- Los últimos dos intercambios completos viven solo en memoria de Home (`SPEECH_HISTORY_LIMIT=2`); no hay historial visual ni persistencia de mensajes. Al recargar o borrar la conversación se vacía el contexto.
- Vite lee `TYPESAFE_API_KEY`, `JEV_MODEL`, `GROQ_API_KEY` y `GROQ_MODEL` desde `.env`, únicamente server-side. En desarrollo, `/api/decide` y `/api/talk` ejecutan handlers reales; Groq se consulta solo cuando Jev elige `talk`.
