# JEVLING — contrato de diseño e interacción

La web debe entenderse viendo actuar a Jev: **claridad, impacto visual y muy poco texto**. Este documento gobierna diseño, tokens, animación e interacción del rediseño aprobado el 2026-10-06.

## Autoridad y estado

- [Spec](.dev/spec.md): requisitos de producto aprobados. [Plan](.dev/plan.md): secuencia y contratos por fase. [Task](.dev/task.md): progreso, evidencia, bloqueos y handoff actual.
- Este documento: reglas compartidas y contrato de diseño. Las decisiones de producto están aprobadas; las tablas de valores iniciales son propuestas para validar con Home en fase 1.
- `src/styles/tokens.css`: fuente ejecutable de valores de diseño, implementada en fase 1. Consultar CSS para los valores efectivos.
- [Arquitectura actual](docs/architecture.md) e [interacción actual](docs/interaction.md): comportamiento existente, no una afirmación de que el rediseño ya funciona.
- [Historia de JEV](docs/jev-story.md): relato aportado por el usuario, fuente editorial de About.

La Home revisada de fase 1 fue aceptada al autorizar el usuario continuar con la siguiente fase. Fase 2 conserva esa referencia visual y completa habla bilingüe, contexto y suspensión. El usuario definió la paleta exacta y aprobó el contraste del texto sobre controles destacados.

## Identidad y contenido

| Principio | Aplicación |
|---|---|
| Minimalista expresivo | Espacio libre, jerarquía clara, tipografía con carácter y una acción protagonista por escena. |
| Paleta de Jev | Acentos derivados de la apariencia visible del personaje actual; fondos neutros. Sin verde ni lima, tampoco para éxito, conexión o foco. |
| Jev actual | Conservar apariencia y animaciones; el rediseño no integra el personaje de `jev-lab`. |
| Poco texto | Un título y una frase de apoyo por capítulo; información adicional desplegable y disponible sin animación. |
| Audiencia mixta | Lenguaje cotidiano primero; detalles técnicos opcionales. |
| Impacto con propósito | La composición y las demostraciones crean el impacto. En input/HUD el usuario aprobó una respiración orgánica en reposo, vinculada al estado de Jev; pausarla fuera de vista y respetar movimiento reducido. |

No inventar métricas, capacidades, fechas, retratos ni hitos. En About, presentar experimentación y visión futura con su contexto. La memoria actual se describe como personalidad local, contexto de sesión y notas cortas que Jev guarda solo en el navegador; no como memoria conversacional completa ni sincronizada.

## Tokens

### Organización y consumo

Definir los primitivos y valores compartidos en `:root`; sobrescribir roles semánticos de color mediante `[data-theme="light"]` y `[data-theme="dark"]`. Usar tres niveles:

1. **Primitivos:** escala neutral, colores Jev, espaciado, tipografía, radios y movimiento.
2. **Semánticos:** fondo, superficie, texto, acento, foco y estados.
3. **Composición:** tamaño del personaje, cabecera, input, contenedor y separación de escenas, derivados de los anteriores.

Consumir tokens con `var()` o utilidades de Tailwind vinculadas a ellos. Mapear en Tailwind v4 con `@theme inline` y conectar los roles de shadcn/ui al mismo origen. No crear una segunda paleta en Tailwind o en componentes.

Colores, tamaños, espaciados, radios, sombras, capas y parámetros visuales de animación no se fijan en estilos inline. Se permiten estilos calculados de runtime para transformaciones, opacidad y variables de progreso/sensores: son datos, no valores de diseño independientes. Las constantes matemáticas de normalización no requieren tokens.

### Color: contrato semántico

| Token | Función |
|---|---|
| `--jev-color-primary` | Morado indicado por el usuario; `#8B5CF6` oscuro / `#7C3AED` claro. |
| `--jev-color-secondary` | Segundo acento solo si está justificado por la paleta visible de Jev. |
| `--color-background` | Fondo de la vista. |
| `--color-surface` / `--color-surface-raised` | Controles, HUD y contenido elevado. |
| `--color-foreground` / `--color-muted` | Texto principal y secundario. |
| `--color-border` | Delimitación de superficies y controles. |
| `--color-accent` / `--color-accent-foreground` | Acento Jev y texto contrastado sobre ese acento. |
| `--color-focus` | Foco visible, derivado de Jev y contrastado en ambos temas. |
| `--color-status-active` / `--color-status-local` / `--color-status-error` | Estados distinguibles mediante etiqueta/icono además de color. |

**Antecedente de bases neutras iniciales propuestas**, reemplazadas durante fase 1 por la paleta exacta indicada a continuación:

| Rol | Claro | Oscuro |
|---|---|---|
| Fondo | `oklch(0.985 0 0)` | `oklch(0.145 0 0)` |
| Superficie | `oklch(1 0 0)` | `oklch(0.19 0 0)` |
| Superficie elevada | `oklch(0.96 0 0)` | `oklch(0.23 0 0)` |
| Texto | `oklch(0.20 0 0)` | `oklch(0.96 0 0)` |
| Texto secundario | `oklch(0.50 0 0)` | `oklch(0.72 0 0)` |
| Borde | `oklch(0.88 0 0)` | `oklch(0.31 0 0)` |

Los roles de acento, foco y estado se asignan tras revisar a Jev en pantalla y medir contraste. No rellenar colores pendientes con verde/lima, defaults del kit de UI o un violeta arbitrario presentado como color oficial.

### Paleta indicada durante fase 1 — 2026-10-06

| Rol | Oscuro | Claro |
|---|---|---|
| Fondo | `#050608` | `#F7F7FB` |
| Fondo secundario | `#0B0D12` | `#FFFFFF` |
| Superficie | `#11131A` | `#F0F0F7` |
| Hover/elevación | `#191C26` | `#E8E8F2` |
| Borde | `#292C38` | `#D8D9E5` |
| Texto | `#F7F7FA` | `#111218` |
| Secundario | `#9295A3` | `#666979` |
| Tenue | `#555968` | `#9B9EAC` |
| Primary purple | `#8B5CF6` | `#7C3AED` |
| Purple brillante | `#A855F7` | `#9333EA` |
| Magenta | `#D946EF` | `#C026D3` |
| Pink accent | `#EC4899` | `#DB2777` |
| Glow violeta | `#7C3AED` | `#A78BFA` |

El usuario aprobó `#050608` sobre el botón morado en oscuro y `#FFFFFF` en claro para el contraste. Texto secundario cubre etiquetas legibles; el token tenue queda reservado para decoración. Foco/estado local usan primary; estado activo usa magenta; error usa pink, siempre acompañado de texto. La selección exacta procede del usuario, no de una extracción del asset. Encuadre, composición y sombras quedan sujetos a la revisión visual de la entrega.

### Escalas iniciales propuestas

Estos valores son el punto de partida de fase 1. Ajustarlos en la fuente de tokens durante la revisión visual, sin introducir excepciones dispersas.

| Familia | Tokens y valores de partida |
|---|---|
| Espaciado | `--space-0: 0`; `--space-1: 0.25rem`; `--space-2: 0.5rem`; `--space-3: 0.75rem`; `--space-4: 1rem`; `--space-6: 1.5rem`; `--space-8: 2rem`; `--space-12: 3rem`; `--space-16: 4rem`; `--space-24: 6rem`. |
| Familias tipográficas | `--font-display`: Avenir Next / Segoe UI Variable Display / Segoe UI / sans-serif; `--font-body`: la misma familia inicialmente; `--font-mono`: SFMono-Regular / Cascadia Code / Consolas / monospace. Validar personalidad visual antes de añadir fuentes y su coste. |
| Tamaños de texto | `--text-caption: 0.75rem`; `--text-small: 0.875rem`; `--text-body: 1rem`; `--text-lead: clamp(1.125rem, 2vw, 1.5rem)`; `--text-title: clamp(2rem, 5vw, 4.5rem)`. |
| Lectura | `--line-body: 1.5`; `--line-title: 1.05`; `--weight-body: 400`; `--weight-label: 600`; `--weight-title: 650`; `--tracking-title: -0.035em`; `--tracking-label: 0.08em`. |
| Radios | `--radius-sm: 0.75rem`; `--radius-md: 1.125rem`; `--radius-lg: 1.75rem`; `--radius-pill: 9999px`. |
| Tamaños | `--size-content: 72rem`; `--size-input: 35rem`; `--size-header: 4.5rem`; `--size-target: 3rem`; `--size-character: clamp(18rem, 44vw, 40rem)` sujeto al encuadre real y a la altura disponible. |
| Bordes y foco | `--border-thin: 1px`; `--focus-width: 2px`; `--focus-offset: 3px`. |
| Capas | `--layer-stage: 0`; `--layer-content: 10`; `--layer-nav: 20`; `--layer-popover: 30`; `--layer-dialog: 40`. |
| Sombras | Roles `--shadow-control`, `--shadow-elevated` y `--shadow-character`; definir su receta neutral por tema durante la revisión. No animar sombras o blur. |

Grid/flex, safe areas y espacio disponible gobiernan el responsive. Nunca conservar una altura mínima que impida alcanzar el input con el teclado móvil abierto. Usar `dvh` donde sea necesario y validar zoom y reflow. Para consultas de ancho, documentar los breakpoints en el `@theme` de Tailwind: las custom properties ordinarias no se interpolan en media queries nativas.

### Movimiento: tokens iniciales propuestos

| Token | Valor / función |
|---|---|
| `--duration-fast` | `160ms`, feedback breve. |
| `--duration-ui` | `280ms`, entrada/salida de controles. |
| `--duration-reveal` | `480ms`, aparición de contenido. |
| `--duration-scene` | `720ms`, transición principal de escena. |
| `--duration-stagger` | `60ms`, intervalo de una secuencia breve. |
| `--ease-out` | `cubic-bezier(0.22, 1, 0.36, 1)`, entrada y feedback principal. |
| `--ease-in-out` | `cubic-bezier(0.65, 0, 0.35, 1)`, transiciones de escena simétricas. |
| `--motion-distance-sm` / `--motion-distance-md` | `0.375rem` / `1rem`, desplazamientos de interfaz. |
| `--motion-scale-press` | `0.98`, feedback de pulsación. |

Las duraciones específicas de demostración, holds y amplitudes de escena se definen como tokens semánticos adicionales al validar los clips. El catálogo referencia esos tokens; no guarda otra escala de diseño.

Leer y convertir tokens al formato del motor mediante un adaptador tipado: CSS usa milisegundos y curvas CSS; Motion/GSAP usan su formato de duración y easing. Cachear la resolución fuera del loop de animación y actualizar cuando corresponda. No pasar directamente una curva CSS a una API que no la soporte ni duplicar sus números en componentes.

## Vistas y contratos de interacción

**Delta visual solicitado el 2026-10-08 (prevalece sobre las composiciones anteriores):** Jev domina Home; controles planos compactos sin mini-Jev ni respiración decorativa y texto mínimo. Features/About dejan de mostrar UI de diapositivas, numeración y detalles desplegables redundantes. Scroll explícito suave y trayectoria con retardo; en móvil ilustración arriba/texto debajo. Partículas con deformación reversible al cursor y estelas expresivas, conservando pausa, 2D, densidad adaptable y alternativa estática. Las lecturas reales del HUD, semántica y nombres accesibles se conservan.

### Carga de Jev: ampliación aprobada 2026-10-11

Aplica a Home, Capacidades y Historia. Decisiones aprobadas por el usuario; los valores numéricos de pantalla son de partida y se ajustan en la verificación visual.

- **Condición de «Jev lista»:** Jev se muestra con el mismo método de retardo de CSS que antes, ahora de 1,8 s: `.character-rive[data-ready="true"]` tiene `transition: opacity 0.6s ease 1.8s`. La señal `onPainted` del componente se dispara a los mismos 1,8 s tras `ready` (constante `REVEAL_DELAY_MS` en `Character.tsx`), y el cargador y el freno de Capacidades usan ese aviso. Se descartó la detección por `Advance`: el runtime 4.34 no emite `Draw`, y el logo seguía visible con esa señal.
- **Pantalla de carga reutilizable (Home y Capacidades):** mientras Jev no está revelada, un componente `CreatureLoader` muestra tres puntos animados, sin texto. Es decorativo (`aria-hidden`), con animación solo de `transform` y `opacity` mediante CSS, y se pausa cuando la vista no está activa. Se desvanece al revelarse Jev, con el mismo fundido de 0,6 s.
- **Sin vuelo hacia About:** el cargador no envía elementos a la cabecera ni a otros enlaces.
- **Movimiento reducido:** los puntos quedan estáticos, sin animación, y el cargador se desvanece al revelarse Jev.
- **Capacidades (`/features`), freno rígido:** el límite es el inicio de la tarjeta «Percibe»: mientras Jev no esté revelada, la página no baja más allá de esa posición, y «Reacciona» queda bloqueada. El freno es una parada rígida, sin rebote ni animación: rueda, táctil, teclado, anclas y el botón «Reproducir» se detienen en el límite. Al revelarse Jev, el freno se libera desde la posición del usuario. Si la carga falla, se libera para que la historia siga disponible. El freno es el mismo con movimiento reducido o viewport bajo.
- **Historia (`/about`), inicio temprano:** la carga de Jev arranca cuando las partículas hacen su primer cambio, al entrar en «Todo empezó con cartón». Para cuando se llega a la escena de Jev, solo debe mostrarse. El texto «Preparando a Jev…» queda como respaldo si aún no está pintada. Cambiar la escena de partículas no debe reiniciar la carga.

### Navegación y preferencias

- Vistas independientes: `/`, `/features`, `/about`. Navegación fija; enlaces directos, recargas y atrás/adelante correctos.
- Tema inicial del sistema; elección manual persistida y aplicada antes del primer render visible para evitar destellos. Escuchar cambios del sistema cuando no existe override manual.
- Revisión de Home: mostrar solo un botón claro/oscuro (sol/luna); sistema permanece como comportamiento inicial implícito. ES/EN usa dos botones visibles con indicador animado. Mantener nombres accesibles, `aria-pressed`, teclado y movimiento reducido.
- Idioma inicial ES/EN del navegador, español como alternativa; recordar cambios manuales. Actualizar `html[lang]`, etiquetas, títulos y mensajes accesibles.
- Persistir preferencias de presentación, la personalidad existente y las notas de memoria de Jev (`jevling.memory`); contexto e intercambios de Home siguen en memoria de sesión. Si storage no está disponible, mantener la experiencia en memoria.
- Cambiar tema/idioma conserva vista y progreso. No remontar el personaje por usar esas preferencias como `key`.
- Transferir foco al destino de una navegación explícita y conservar restauración de scroll adecuada al historial. No mover el foco en cada capítulo activado por scroll.
- Reservar el espacio de la cabecera y aplicar su offset a anclas y elementos que reciben foco.
- Implementado en fase 5: una visita nueva empieza arriba; atrás/adelante y recarga restauran la posición guardada en la entrada del historial (`scrollRestoration` manual).

### Voz de Jev: aprobada 2026-10-16

- Sonido sintetizado con Web Audio, carismático y fluido, acorde con la cara redonda de Jev. Nunca palabras ni voz humana.
- **Habla (segunda revisión del 2026-10-17, juguetona y seca):** una curva por palabra que rebota por sus sílabas escritas: cada sílaba entra con un pequeño salto ascendente, sobre una melodía pentatónica con la tónica acentuada, ritmo alterno largo-corto y color de vocal. Sin eco ni sala. Pausas en comas y fin de frase; subida en preguntas, realce y risita en exclamaciones, caída al cerrar. **Acciones:** un motivo corto y distinto por acción, con el mismo rebote y sin ondas cuadradas. El regreso a `Base` no suena.
- **Banda sonora de Historia (épica cinematográfica):** arco Am(add9) → F(add9) → C(add9) → G6 → Fmaj9, Gsus4 mientras se abre la estrella y un Do mayor amplio en la revelación. Cada escena suma energía: arpegio a 104 bpm, bombo, bajo pulsante, tema heroico de metales desde machine learning y palmas en el clímax. Al deslizar hacia la siguiente escena sube un barrido; al llegar, un golpe grave cae en el tiempo fuerte con el acorde nuevo. Los golpes muy seguidos se funden, salvo que el nuevo sea más fuerte, así que el clímax nunca se pierde. Jev no habla en Historia.
- Encendido por defecto; empieza con el primer gesto. Un solo botón de altavoz en la cabecera para voz y música, con `aria-pressed`, nombre accesible y elección persistida (`jevling.sound`).
- Voz en Inicio y Capacidades; música solo en Historia. Todo se detiene con la pestaña oculta y al silenciar; la voz, además, al cancelar el habla o cambiar de ruta. Un contexto compartido con compresor; solo la música pasa por la sala de reverberación. Sin archivos de audio ni dependencias.

### Home

**Ampliación UATF aprobada:** una intención local de inscripción abre, dentro de Inicio, un formulario con nombre y celular y una confirmación de demostración. Durante este modo, los controles conversacionales quedan ocultos/inertes y el mismo Jev comparte escena con el formulario; al cerrar se recupera la composición normal. Motion posee el layout del escenario y las partículas SVG transitorias; Rive conserva sus reacciones. En móvil, Jev arriba y compacto al enfocar campos; el contenedor del formulario se desplaza cuando hace falta y respeta `visualViewport` con teclado. Los datos son efímeros y se eliminan al confirmar, cerrar o abandonar Inicio. La especificación completa está en `.dev/spec.md` y la evidencia de esta ampliación en `.dev/evidence/enrollment/`.

**Respuestas largas con UI generada, aprobada el 2026-10-20:** cada respuesta trae una frase hablada (máximo 120 caracteres; voz, boca y burbuja breve) y, si explica, compara o enumera, hasta 6 bloques de un catálogo cerrado: `paragraph`, `list`, `steps`, `compare`, `highlight`, `callout` y `chips`. El modelo solo rellena el catálogo: el texto se dibuja como texto, nunca como HTML. Una respuesta con bloques no caduca: se cierra con ✕, con `Esc`, con un mensaje nuevo, al borrar la conversación o al suspender Home.
- **Escritorio (más de 64rem):** Jev se aparta a la izquierda con `layout` de Motion y una tarjeta ocupa la derecha. Al cerrar, vuelve cuando la tarjeta ya salió, en un solo movimiento. La lectura empieza arriba, y «Más ↓» indica contenido oculto.
- **Móvil:** la respuesta se abre directamente en un panel modal inferior con dos alturas, arrastrable desde su barra; no hay vista previa. Cerrarlo (✕, arrastrar hacia abajo, tocar fuera o `Esc`) cierra la respuesta y devuelve el foco al input. Cambio pedido por el usuario el 2026-10-21, que reemplaza la vista previa con «Leer todo».
- **Identidad:** borde degradado y luz estática de `--jev-color-primary`/`--jev-color-secondary`. `compare` va en columnas en la tarjeta y apilado en el panel; `callout` lleva una etiqueta de texto («Consejo:», «Atención:») además del color; los chips envían su pregunta como contexto escrito.
- **Entrada:** cada bloque asciende en cascada y sus palabras pasan de desenfocadas a nítidas (ver excepción en *Animación y herramientas*). La frase se anuncia una sola vez en una región `status`.
- Especificación completa en `.dev/spec.md`; evidencia en `.dev/evidence/long-reply/`.

**Jev compañero, aprobado el 2026-10-21:** Jev recuerda entre visitas y conversa guiando.
- **Memoria:** cada respuesta lleva, tras la frase hablada, una nota oculta (`memory`, ≤160 caracteres; vacía si no hay nada nuevo) que se guarda solo en el navegador, hasta 40 notas. Nunca se guardan números largos, salud, documentos, contraseñas ni datos del formulario. Cada mensaje envía las 2 notas más recientes y las relacionadas (hasta 8 y 1000 caracteres), que el servidor entrega al modelo como datos, nunca como instrucciones. «Borrar conversación» no borra la memoria.
- **Preguntas con opciones:** `choices` (pregunta y 2 a 5 opciones) cierra la respuesta. Ante orientación, Jev pregunta hasta 2 veces antes de recomendar. La respuesta a su pregunta, tocada o escrita, va directo al habla sin `/api/decide`. En móvil, las opciones van en el panel que se abre solo.
- **«Lo que Jev recuerda»:** botón «Memoria» en el pie de Home; diálogo modal (centrado en escritorio, abajo en móvil) con la superficie de las respuestas, notas de la más reciente a la más antigua con fecha relativa, olvidar una y «Olvidar todo» con confirmación propia. Foco al título, trampa de Tab, Escape cierra (o cancela la confirmación primero) y el foco vuelve al botón.
- Evidencia en `.dev/evidence/companion/`.

Jev, input evidente, burbuja breve para respuestas sin bloques y HUD compacto. El HUD muestra acción elegida y confianza; sus detalles incluyen probabilidades, intensidad, atención y personalidad con nombres traducidos. Los IDs del contrato de decisión/Rive no se traducen.

Revisión visual solicitada: centrar el input debajo de Jev de forma independiente del HUD, que queda a la derecha. Al no caber ambos en la misma fila, HUD compacto arriba y a la derecha del input. La exportación actual es `prove2.riv`, aportada por el usuario para corregir el fondo; confirmó que funciona bien y pidió un aumento ligero, aplicado con escala `1.9` frente a `1.72`. Se mantiene un único canvas directo y contenedor cuadrado, sin óvalo decorativo. Revisión del 2026-10-07: retirar la máscara radial CSS porque el asset ya es transparente y su desvanecimiento ovalado recortaba acciones amplias. Conservar escala, encuadre y composición; no procesar píxeles por frame. Revisión del 2026-10-12: el contenedor de Jev no recorta su halo (sin `overflow` de recorte en `.creature-zone`, `.showcase-creature` ni `.story-creature`); la página conserva su recorte horizontal. El canvas de partículas de About sangra un 30 % del cuadrado por lado (`--particle-bleed`), así la nube no se corta en sus bordes; la geometría y el cursor siguen midiéndose contra el cuadrado.

Revisión de fase 2 (2026-10-07): Home es un escenario de una pantalla, sin scroll de página en escritorio/móvil. La zona de Jev cede altura al espacio disponible; abrir el HUD no cambia el flujo ni desplaza el input. El panel se superpone hacia arriba con origen inferior derecho. En móvil el resumen es una fila pequeña con acción, confianza, señal y chevron; las etiquetas completas se conservan accesibles. En viewport bajo, métricas en dos columnas, sin scroll interno del HUD. Este contrato es de Home; Features/About mantienen sus recorridos de scroll aprobados.

Conservar sensores locales, touch, reacciones y acciones actuales. Cambiar preferencias no pierde contexto. Al navegar fuera de Home, guardar su estado en memoria y suspender sensores, scheduler, solicitudes y animación; al volver, reanudar sin ejecutar respuestas obsoletas.

Enviar el idioma seleccionado a `/api/talk` como valor validado ES/EN. Aplicarlo a nuevas respuestas sin reescribir el texto original del usuario ni traducir retroactivamente el historial. Un cambio durante streaming cancela la generación obsoleta: no mezclar idiomas ni aceptar fragmentos de una petición cancelada. Definir y probar el estado de continuación antes de cerrar fase 2.

Continuación confirmada en fase 2: al cambiar idioma durante habla, regenerar automáticamente para el mismo mensaje; ocultar Home cancela sin replay al volver. Home permanece montada en memoria pero inerte/suspendida en otras rutas. Volver desde Features/About no solicita una reacción de IA. «Borrar conversación» elimina también los intercambios completos y la caché que contenía contexto, conservando personalidad/preferencias/cuotas.

Si falla el servicio de decisión, mantener reacciones locales y una etiqueta breve en el HUD. Si falla el habla, ofrecer un mensaje de estado localizado, no una frase simulada presentada como respuesta real de Jev.

### Features: determinismo

Capítulos: Percibe, Reacciona, Decide, Responde, Habla, Se transforma, Se adapta y Sigue contigo. Escenario protagonista durante el scroll, con controles equivalentes por teclado para avanzar, retroceder y repetir.

Dirección visual de fase 3 confirmada por el usuario: escenario libre, sin contenedor visible, tarjetas ni marco de demo. Explicaciones alternadas izquierda/derecha y Jev desplazándose por los espacios vacíos mediante scroll. GSAP gobierna la trayectoria del wrapper; Rive conserva la animación del personaje y Motion solo el texto/controles independientes. En móvil, espacio vertical entre relato y personaje más trayectoria horizontal acotada. Explicar decisión/confianza dentro del capítulo Decide; no mantener HUD ni rótulos de ejemplo superpuestos todo el tiempo. La transparencia editorial se conserva en la introducción y junto a los datos ilustrativos.

**Invariante:** a igual capítulo, idioma y progreso lógico, corresponde la misma secuencia de eventos, acciones, texto y datos de ejemplo. No se exige igualdad de píxeles entre dispositivos o tasas de refresco.

- Usar catálogo tipado, datos fijos y tiempos definidos por tokens. Captions de habla preescritos en ES/EN.
- Sin solicitudes a IA, fechas variables, aleatoriedad ni sensores/pointer reales que alteren la demostración. Desactivar listeners interactivos del asset en la instancia de presentación cuando puedan interferir.
- XState es dueño del flujo de demostración; Zustand mantiene preferencias/estado compartido, sin replicar la máquina en otro store.
- Esperar readiness del personaje; ante error ofrecer texto y control de recuperación. Cambiar capítulo cancela timers/acciones anteriores y comienza desde una base definida.
- Mostrar datos como ejemplos de demostración, no probabilidades reales inventadas.
- Aislar contexto y personalidad simulados del estado real de Home.
- Ocultar vista/pestaña suspende la secuencia. Reanudar desde un estado definido, sin vaciar una cola de acciones antiguas.
- Cambiar idioma conserva capítulo/progreso y sustituye el texto de la demostración sin reiniciar todo el recorrido.

### About: narrativa

Usar el [relato original](docs/jev-story.md) como fuente. Escenas: pregunta y salida de la caja de chat; experimento; capas de percepción/comportamiento/cuerpo; Abdair Coca y las iteraciones; visión futura y cierre.

El recorrido principal mantiene frases cortas. Los detalles desplegables conservan el contexto completo. Presentar al creador con tipografía y composición; no crear un retrato o datos biográficos adicionales. La visión no se convierte en una lista de capacidades ya implementadas.

Revisión aprobada 2026-10-08: About presenta el recorrido de Abdair (Bob, TitiEdu, machine-learning-App, JEV). Escenario oscuro cinematográfico local en ambos temas, con reconstrucciones de los tres recursos aportados y estrella de partículas que se abre para revelar al Jev actual. Canvas 2D es dueño del render, GSAP del progreso/wrapper/revelación y Rive del personaje. Se autoriza movimiento ambiental tenue de partículas durante los holds, estelas y bloom precalculado, sin filtros CSS animados. Las imágenes se reinterpretan con violeta/magenta/blanco, sin acentos verdes. Sampling fuera del loop; DPR ≤2, densidad responsive, pausa fuera de vista y reduced motion estático. Las imágenes/partículas no sustituyen el texto DOM. La memoria persistente completa corresponde a Bob; JEV solo guarda notas cortas en el navegador.

## Stack base y contratos tipados

React + TypeScript strict + Vite, con Tailwind CSS v4 y shadcn/ui para componentes accesibles. Tipar props, eventos, estado, traducciones y acciones de presentación sin `any`. Usar uniones discriminadas para estados/acciones y validar datos externos desde `unknown`. Toda supresión excepcional de TypeScript necesita un comentario con causa y alcance; no utilizar `// @ts-ignore` sin justificación.

Los IDs de ruta, capítulo e idioma son estables y tipados. Las traducciones ES/EN comparten claves verificadas por tipos; los valores localizados no gobiernan la lógica ni los nombres del contrato Rive/API. Zustand comparte preferencias y sesión; XState gobierna el flujo complejo de Features.

## Animación y herramientas

| Responsabilidad | Herramienta |
|---|---|
| UI, hover/tap, entradas/salidas, layout y cambios de vista | Motion desde `motion/react`. |
| Scroll sencillo, reveals y progreso | Motion: `useScroll`, `useTransform`, `whileInView`. |
| Pinning, timelines y scrollytelling complejo | GSAP + ScrollTrigger con `@gsap/react` y `useGSAP`. |
| Scroll suave | Una instancia global de Lenis. |
| Personaje existente | Rive 2D; no convertirlo en una escena 3D. |
| Gráficos simples | DOM, SVG o canvas 2D nativo. |
| Física o render masivo, solo si surge necesidad | Matter.js para física; PixiJS v8 para render 2D. Verificar primero si el stack existente resuelve el caso. |

Animar solo `transform` y `opacity` en la web. Para cambios de tamaño usar `layout` de Motion; si el contenedor cambia de proporción, el hijo que debe conservar su forma (Jev) lleva su propio `layout` para corregir la escala. No animar `width`, `height`, `top`, `left`, `margin`, colores, sombras o filtros. Las animaciones existentes internas de Rive se conservan; esta regla gobierna los elementos de la web que se rediseñan.

**Excepción aprobada el 2026-10-20 — entrada de respuestas:** las palabras de una respuesta con bloques pasan de `filter: blur(var(--reply-blur))` a nítidas, con opacidad y un leve ascenso. La animación ocurre una vez por bloque, con keyframes CSS (dueño único) y tokens `--reply-block-stagger`/`--reply-word-stagger`, con la cascada limitada a 40 palabras por texto. Movimiento reducido entrega el texto estático. Medido con GPU real: en móvil con CPU 4×, el 23–25 % de los frames supera 33 ms durante 1–2 s, frente al 9–11 % sin bloques. El usuario eligió conservar el efecto palabra por palabra frente a la alternativa por bloque, que rinde como la base.

Cada elemento tiene un único dueño de animación. GSAP puede gobernar el wrapper de una escena; Motion, sus controles independientes; Rive, el dibujo del personaje. Registrar esta separación junto a la composición cuando no resulte obvia.

Usar `AnimatePresence` al montar/desmontar elementos y `variants` con `staggerChildren` para secuencias de UI. Las animaciones guían atención, refuerzan jerarquía o dan feedback. Evitar loops decorativos.

Excepción visual aprobada para los controles de Home: presencia orgánica continua y suave en reposo, acentuada mientras el estado real es `deciding` y modulada por atención. Se limita a luz/señales secundarias mediante transform/opacity; el texto y los objetivos de interacción permanecen estables. Suspender fuera de viewport/pestaña y ofrecer una alternativa estática con movimiento reducido. Input y HUD mantienen los datos reales; las animaciones no simulan progreso ni confianza.

Lenis conserva scroll nativo funcional, excluye zonas internas como diálogos y no añade un loop duplicado al ticker usado por GSAP. Destruir su instancia y retirar suscripciones al desmontar el gestor global.

### Movimiento reducido y limpieza

Usar `useReducedMotion()` y `gsap.matchMedia()`. Con movimiento reducido: fades breves o cambio inmediato, sin parallax, pinning prolongado ni scroll suave forzado; ofrecer pose estable de Jev y texto equivalente cuando la demostración dependa del movimiento.

`useGSAP` revierte sus animaciones; limpiar además listeners, observers, timers y loops externos. Suspender render/animación cuando la escena no esté visible o la pestaña esté en segundo plano. Verificar montaje/desmontaje repetido, incluido React Strict Mode.

### Canvas y física condicional

Si se añade una escena canvas/física, documentar su necesidad y coste antes de instalar dependencias. Mantener un único loop por escena; separar cálculo físico y render. Usar `IntersectionObserver` y Page Visibility para pausar. Limitar `devicePixelRatio` a 2 y manejar resize; respetar el lifecycle del runtime Rive en sus instancias.

Los parámetros de física viven en una configuración de escena. Desmontar implica retirar listeners, limpiar `Matter.World`, ejecutar `Engine.clear` y destruir Pixi con `app.destroy(true)` cuando se utilicen. No introducir three.js, R3F, drei o WebGL 3D.

## Accesibilidad y rendimiento

- Elementos interactivos semánticos, teclado completo, foco visible, nombres accesibles y ARIA acorde al comportamiento. Contenido colapsado/inactivo fuera del orden de tabulación.
- Contraste objetivo WCAG AA: 4.5:1 en texto normal, 3:1 en texto grande y componentes visuales relevantes. Estado comunicado con texto/icono además de color.
- Canvas y animaciones no son la única fuente de información. Mantener descripciones y controles en DOM; anunciar respuestas/decisiones sin leer cada frame ni cada fragmento de streaming.
- Validar zoom, reflow, scroll nativo, touch, safe areas y teclado móvil. Móvil conserva los capítulos con puesta en escena adaptada.
- Cargar vistas y partes pesadas mediante `lazy`/`dynamic import`; una visita a Home no debe descargar la maquinaria de presentaciones sin necesidad.
- Presupuesto: LCP < 2,5 s y 60 fps en móvil de gama media. Medir condiciones y peso inicial; justificar cada dependencia por responsabilidad, alternativa existente y coste de bundle.

## Verificación y evidencia

Antes de cerrar una fase, ejecutar las comprobaciones aplicables y registrar sus resultados en `.dev/task.md`. Para el cambio exclusivamente documental, comprobar enlaces, alcance del diff y preservación del archivo histórico; las comprobaciones de aplicación que se ejecuten son evidencia de línea base, no de un rediseño implementado.

```powershell
npm exec -- tsc --noEmit -p tsconfig.app.json
npm exec -- tsc --noEmit -p tsconfig.node.json
npm exec -- tsc --noEmit -p tsconfig.api.json
npm exec -- tsc --noEmit -p tsconfig.tests.json
npm exec -- eslint .
npm exec -- vitest run
npm run build
```

ESLint está configurado en fase 1: `npm run lint` ejecuta `eslint . --max-warnings=0`. `lint:ox` conserva Oxlint. Los cuatro tsconfig habilitan strict explícitamente; el lint raíz excluye el laboratorio terminado y los artefactos de evidencia. No instalar herramientas implícitamente para simular una comprobación disponible; informar lo que falta y resolverlo en la fase que corresponda.

Playwright debe abrir la aplicación, capturar móvil/escritorio, revisar errores de consola y probar las interacciones de la entrega. Matriz final: tres vistas, dos temas, dos idiomas, teclado y movimiento reducido. Medir rendimiento en condiciones registradas; diferenciar móvil físico de emulación y llamadas reales de pruebas simuladas. No afirmar cumplimiento de LCP/FPS ni disponibilidad del proveedor sin evidencia.

**Cierre de fase:** tareas realizadas, comprobaciones registradas en `.dev/task.md`, limitaciones explícitas y entrega presentada al usuario. La fase siguiente comienza tras su revisión y autorización.
