# JEVLING — contrato de diseño e interacción

La web debe entenderse viendo actuar a Jev: **claridad, impacto visual y muy poco texto**. Este documento gobierna diseño, tokens, animación e interacción del rediseño aprobado el 2026-10-06.

## Autoridad y estado

- [Plan activo](.dev/TASK.md): fases, tareas, autorizaciones y evidencias de entrega.
- Este documento: reglas compartidas y contrato de diseño. Las decisiones de producto están aprobadas; las tablas de valores iniciales son propuestas para validar con Home en fase 1.
- `src/styles/tokens.css`: futura fuente ejecutable de valores de diseño, por crear en fase 1. Después de implementarla, actualizar este documento cuando cambie el contrato; consultar CSS para los valores efectivos.
- [Arquitectura actual](docs/architecture.md) e [interacción actual](docs/interaction.md): comportamiento existente, no una afirmación de que el rediseño ya funciona.
- [Historia de JEV](docs/jev-story.md): relato aportado por el usuario, fuente editorial de About.

La preparación documental no instala dependencias ni cambia el runtime. La revisión visual de Home validará colores, escala, espaciados y ritmo antes de extenderlos al resto del sitio.

## Identidad y contenido

| Principio | Aplicación |
|---|---|
| Minimalista expresivo | Espacio libre, jerarquía clara, tipografía con carácter y una acción protagonista por escena. |
| Paleta de Jev | Acentos derivados de la apariencia visible del personaje actual; fondos neutros. Sin verde ni lima, tampoco para éxito, conexión o foco. |
| Jev actual | Conservar apariencia y animaciones; el rediseño no integra el personaje de `jev-lab`. |
| Poco texto | Un título y una frase de apoyo por capítulo; información adicional desplegable y disponible sin animación. |
| Audiencia mixta | Lenguaje cotidiano primero; detalles técnicos opcionales. |
| Impacto con propósito | La composición y las demostraciones crean el impacto. Evitar efectos continuos sin función de orientación o feedback. |

No inventar métricas, capacidades, fechas, retratos ni hitos. En About, presentar experimentación y visión futura con su contexto. La memoria actual se describe como personalidad local y contexto de sesión, no como memoria conversacional permanente o sincronizada.

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
| `--jev-color-primary` | Color principal derivado de Jev; selección exacta pendiente de fase 1. |
| `--jev-color-secondary` | Segundo acento solo si está justificado por la paleta visible de Jev. |
| `--color-background` | Fondo de la vista. |
| `--color-surface` / `--color-surface-raised` | Controles, HUD y contenido elevado. |
| `--color-foreground` / `--color-muted` | Texto principal y secundario. |
| `--color-border` | Delimitación de superficies y controles. |
| `--color-accent` / `--color-accent-foreground` | Acento Jev y texto contrastado sobre ese acento. |
| `--color-focus` | Foco visible, derivado de Jev y contrastado en ambos temas. |
| `--color-status-active` / `--color-status-local` / `--color-status-error` | Estados distinguibles mediante etiqueta/icono además de color. |

**Bases neutras iniciales propuestas**, en OKLCH acromático; se revisan en Home, no constituyen una paleta exacta ya aprobada:

| Rol | Claro | Oscuro |
|---|---|---|
| Fondo | `oklch(0.985 0 0)` | `oklch(0.145 0 0)` |
| Superficie | `oklch(1 0 0)` | `oklch(0.19 0 0)` |
| Superficie elevada | `oklch(0.96 0 0)` | `oklch(0.23 0 0)` |
| Texto | `oklch(0.20 0 0)` | `oklch(0.96 0 0)` |
| Texto secundario | `oklch(0.50 0 0)` | `oklch(0.72 0 0)` |
| Borde | `oklch(0.88 0 0)` | `oklch(0.31 0 0)` |

Los roles de acento, foco y estado se asignan tras revisar a Jev en pantalla y medir contraste. No rellenar colores pendientes con verde/lima, defaults del kit de UI o un violeta arbitrario presentado como color oficial.

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

### Navegación y preferencias

- Vistas independientes: `/`, `/features`, `/about`. Navegación fija; enlaces directos, recargas y atrás/adelante correctos.
- Tema inicial del sistema; elección manual persistida y aplicada antes del primer render visible para evitar destellos. Escuchar cambios del sistema cuando no existe override manual.
- Idioma inicial ES/EN del navegador, español como alternativa; recordar cambios manuales. Actualizar `html[lang]`, etiquetas, títulos y mensajes accesibles.
- Persistir preferencias de presentación y la personalidad existente; contexto e intercambios de Home siguen en memoria de sesión. Si storage no está disponible, mantener la experiencia en memoria.
- Cambiar tema/idioma conserva vista y progreso. No remontar el personaje por usar esas preferencias como `key`.
- Transferir foco al destino de una navegación explícita y conservar restauración de scroll adecuada al historial. No mover el foco en cada capítulo activado por scroll.
- Reservar el espacio de la cabecera y aplicar su offset a anclas y elementos que reciben foco.

### Home

Jev, input evidente, respuesta breve y HUD compacto. El HUD muestra acción elegida y confianza; sus detalles incluyen probabilidades, intensidad, atención y personalidad con nombres traducidos. Los IDs del contrato de decisión/Rive no se traducen.

Conservar sensores locales, touch, reacciones y acciones actuales. Cambiar preferencias no pierde contexto. Al navegar fuera de Home, guardar su estado en memoria y suspender sensores, scheduler, solicitudes y animación; al volver, reanudar sin ejecutar respuestas obsoletas.

Enviar el idioma seleccionado a `/api/talk` como valor validado ES/EN. Aplicarlo a nuevas respuestas sin reescribir el texto original del usuario ni traducir retroactivamente el historial. Un cambio durante streaming cancela la generación obsoleta: no mezclar idiomas ni aceptar fragmentos de una petición cancelada. Definir y probar el estado de continuación antes de cerrar fase 2.

Si falla el servicio de decisión, mantener reacciones locales y una etiqueta breve en el HUD. Si falla el habla, ofrecer un mensaje de estado localizado, no una frase simulada presentada como respuesta real de Jev.

### Features: determinismo

Capítulos: Percibe, Reacciona, Decide, Responde, Habla, Se transforma, Se adapta y Sigue contigo. Escenario protagonista durante el scroll, con controles equivalentes por teclado para avanzar, retroceder y repetir.

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

Animar solo `transform` y `opacity` en la web. Para cambios de tamaño usar `layout` de Motion. No animar `width`, `height`, `top`, `left`, `margin`, colores, sombras o filtros. Las animaciones existentes internas de Rive se conservan; esta regla gobierna los elementos de la web que se rediseñan.

Cada elemento tiene un único dueño de animación. GSAP puede gobernar el wrapper de una escena; Motion, sus controles independientes; Rive, el dibujo del personaje. Registrar esta separación junto a la composición cuando no resulte obvia.

Usar `AnimatePresence` al montar/desmontar elementos y `variants` con `staggerChildren` para secuencias de UI. Las animaciones guían atención, refuerzan jerarquía o dan feedback. Evitar loops decorativos.

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

Antes de cerrar una fase, ejecutar las comprobaciones aplicables y registrar sus resultados en el plan. Para el cambio exclusivamente documental, comprobar enlaces, alcance del diff y preservación del archivo histórico; las comprobaciones de aplicación que se ejecuten son evidencia de línea base, no de un rediseño implementado.

```powershell
npm exec -- tsc --noEmit -p tsconfig.app.json
npm exec -- tsc --noEmit -p tsconfig.node.json
npm exec -- tsc --noEmit -p tsconfig.api.json
npm exec -- tsc --noEmit -p tsconfig.tests.json
npm exec -- eslint .
npm exec -- vitest run
npm run build
```

ESLint debe configurarse en fase 1. El script `lint` actual ejecuta Oxlint y no equivale a ESLint. No instalar herramientas implícitamente para simular una comprobación disponible; informar lo que falta y resolverlo en la fase que corresponda.

Playwright debe abrir la aplicación, capturar móvil/escritorio, revisar errores de consola y probar las interacciones de la entrega. Matriz final: tres vistas, dos temas, dos idiomas, teclado y movimiento reducido. Medir rendimiento en condiciones registradas; diferenciar móvil físico de emulación y llamadas reales de pruebas simuladas. No afirmar cumplimiento de LCP/FPS ni disponibilidad del proveedor sin evidencia.

**Cierre de fase:** tareas realizadas, comprobaciones registradas, limitaciones explícitas y entrega presentada al usuario. La fase siguiente comienza tras su revisión y autorización.
