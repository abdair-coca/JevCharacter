# Arquitectura

La aplicación separa percepción local, decisión conductual y presentación. La decisión no es texto de chatbot: es un contrato pequeño que guía reacción, ambiente y atención.

## Runtime

`src/main.tsx` monta `App` dentro de React. `App` compone la cabecera fija, preferencias y rutas tipadas. `HomePage` conecta `Character`, `ContextWhisper`, `BrainHUD` y `DebugPanel` con el sensor pointer, `useCreatureBrain` y el controlador del personaje. El entorno visual usa tokens neutros/violetas en CSS; `AmbientStage` ya no se monta en Home.

### Shell, preferencias y sesión

- `/` es Home; `/features` y `/about` cargan `FeaturesPage` y `AboutPage` de forma diferida. `PendingPage` se conserva para rutas desconocidas. `vercel.json` incluye rewrites exactos para esas dos rutas, separados de `/api/*`; todavía no hay evidencia de despliegue remoto.
- `public/preferences-init.js` aplica tema, idioma y `theme-color` en el head antes de React. `preferencesStore` consume ese estado inicial y usa Zustand para cambios de UI. Se guardan solo `jevling.theme` y `jevling.language`; storage bloqueado conserva cambios en memoria. El modo sistema sigue `prefers-color-scheme`; la elección manual tiene prioridad.
- `src/i18n/messages.ts` comparte claves tipadas ES/EN. Se traducen interfaz, HUD y diagnóstico, sin traducir IDs Rive/API. Cambiar preferencias no remonta el personaje ni borra el input.
- `Character` y las funciones de animación DOM de Motion se cargan en chunks separados. El asset sigue siendo el existente. Rive pausa por movimiento reducido y visibilidad de pestaña; Motion usa los tokens mediante un adaptador que acepta `ms` y `s`, incluso tras minificación.
- Home monta controles compactos sin `OrganicLight` ni miniaturas del personaje. Motion conserva feedback de envío, acción/confianza y despliegue del HUD hacia arriba sin alterar el flujo. La escala local de Home es `--home-character-scale` y el escenario aprovecha el espacio disponible; las presentaciones conservan su escala independiente. `useReducedMotionPreference` suscribe cambios nativos en vivo. No hay procesamiento del canvas Rive.
- El shell monta Home al visitarla por primera vez y la conserva detrás de un contenedor `hidden`/`inert`. Sus hooks siguen siendo el único dueño de la sesión; no se replica el cerebro en Zustand. Una entrada directa a Features/About no inicializa Rive ni Home.
- `usePageVisibility` y la ruta seleccionada producen el estado efectivo `active`. Al ocultar Home se suspenden listeners de sensores, scheduler, personalidad, diagnósticos, red y render Rive. El controlador cancela y resuelve sus timers/RAF; Rive usa `pause`/`stopRendering`, y al volver redimensiona/reanuda en Base sin ejecutar colas anteriores.
- Navegar dentro de la web no cuenta como ausencia y no dispara IA al regresar. El sensor conserva por separado el regreso tras ausencia real de pestaña/ventana. El scheduler conserva límites/caché entre suspensiones y consume señales de retorno caducadas sin nuevas solicitudes.

| Área | Responsabilidad |
|---|---|
| `creature/sensors/pointerSensor.ts` | Mide pointer, actividad, proximidad, clicks y ausencia en cliente; actualiza variables CSS para seguimiento visual. |
| `hooks/useCreatureBrain.ts` | Reúne estado de mundo/persona, aplica acciones Jev, conserva el scheduler y coordina suspensión. |
| `hooks/useSpeechSession.ts` | Posee generación, idioma, caption, avisos y hasta dos intercambios completos en memoria; regenera por idioma, cancela al ocultar y descarta resultados obsoletos. |
| `creature/brain/decisionScheduler.ts` | Controla causas de solicitud, espera, deduplicación, caché, límites, validación y fallback. |
| `creature/brain/speechClient.ts` | Envía idioma validado, lee SSE, cancela el reader por `AbortSignal` y limita el texto a una frase breve. |
| `creature/brain/fallbackBrain.ts` | Produce decisión local cuando endpoint no está disponible o límite local impide consultar. |
| `api/decide.ts` | Implementa endpoint opcional: valida estado, limita solicitudes y, si hay configuración, llama al SDK TypeSafe. |
| `api/talk.ts` | Valida `{message, language, history}`, fija explícitamente español/inglés en el prompt y transmite una frase de hasta 120 caracteres; aborta upstream al desconectarse el cliente. |
| `creature/rive/riveReactionAdapter.ts` y `character/useCharacterController.ts` | Mapean reacción a enum y trigger del controlador; temporizan estados transitorios, incluida `QUESTION` → `question` en Rive. |
| `pages/HomePage.tsx`, `styles/tokens.css` y `components/BrainHUD.tsx` | Presentan a Jev, feedback de pointer/envío, acción, confianza, probabilidades, intensidad, atención y personalidad. |

## Camino de datos

### Features: presentación separada

`features/showcase/catalog.ts` fija ocho capítulos, texto ES/EN, acciones y tokens de duración. `player.ts` usa XState para loading → prepare → playing → complete, con interrupted, static y error. Tiene un solo reloj; reemplazar/repetir cancela los delays anteriores y reinicia desde Base. El port usa únicamente el controlador del `Character` existente, sin cerebro, scheduler, red, sensores ni personalidad de Home.

GSAP/ScrollTrigger gobiernan pinning y trayectoria horizontal del wrapper libre; Motion solo el caption/controles y Rive el dibujo. `features/presentation/scrollRuntime.ts` comparte una única instancia global de Lenis por leases, conducida por el ticker GSAP sin RAF extra. Fuera del escenario retira el driver suave y libera scroll nativo; al ocultar el documento deshabilita el workaround RAF de ScrollTrigger sin deshacer pinning. `enable()` se protege contra duplicación de loops/intervalos; el teardown respeta otros propietarios.

El pulido elimina las barras de diapositivas. «Ver escena» usa scroll con duración y easing suave; restaurar geometría/idioma sigue siendo inmediato. La trayectoria usa scrub de 1 s con deriva vertical e inclinación, sin alterar las acciones deterministas. Móvil sitúa el personaje encima del texto. Viewports bajos, reduced motion y ausencia de observer usan composición estática.

`Character` admite `presentation` (listeners Rive deshabilitados), `staticPose`, readiness y error de carga; sus defaults conservan Home. Features suspende por viewport/pestaña y reanuda desde paso cero del capítulo actual; salir de la ruta destruye la presentación y una visita nueva empieza desde su contexto inicial/selección por scroll. Cambiar idioma/tema mantiene paso y canvas, corrigiendo anchors bajo un bloqueo temporal de selección.

Las presentaciones estáticas preparan Base de forma invisible durante un periodo acotado de 3 s antes de congelar render/anunciarlas listas. Los nuevos comandos quedan bloqueados mientras esa pose está congelada; los timer/RAF de preparación se cancelan al suspender. Al volver a una pose ya preparada se conserva sin repetir reproducción ni preparación. El layout Rive es estable por instancia. No se aplica ese warmup a Home ni se procesan píxeles para generar una imagen alternativa.

Con reduced motion o sin IntersectionObserver, no hay pinning/smooth scroll ni reproducción temporal: una pose estable y listas de pasos describen las ocho escenas. Error conserva lectura/navegación; retry remonta solo la instancia de presentación con un nuevo intento. Los eventos de readiness/error obsoletos se descartan. Todas las métricas son ejemplos explícitos, nunca lecturas actuales de Home. [Evidencia](../.dev/evidence/phase-3/README.md).

### About: relato editorial

`features/story/catalog.ts` adapta los hechos aportados por Abdair en cinco escenas ES/EN: presentación, Bob, TitiEdu, machine learning y JEV/visión. `AboutPage` monta una sola instancia de `Character` en modo presentación y entra en Base desde su controlador existente. No monta cerebro ni servicios remotos. Tras prepararlo, pausa Rive durante los proyectos y lo reanuda en el cierre. La instancia se mantiene al cambiar preferencias; readiness/error se asocian al intento vigente, con timeout acotado y retry explícito que remonta solo el personaje.

`useStoryScroll` controla selección, pinning, trayectoria y progreso continuo 0–5 mediante ScrollTrigger. Un ref comunica progreso al renderer sin actualizar React por frame; GSAP controla el wrapper y la variable de revelación de Rive. Hay holds, transiciones reversibles y un botón equivalente a abrir la estrella por scroll. Reutiliza el manager global Lenis y el hook común de visibilidad. Fuera de vista pausa el renderer y el trigger de progreso; conserva el pin actualizable por scroll para evitar que una posición congelada impida regresar desde el outro. La pestaña oculta suspende también pin y motor global. Cleanup revierte el contexto GSAP y libera su lease.

`ParticleVortex` prepara los tres recursos locales mediante un canvas de muestreo y `getImageData` solo al cargar. Recorta el gráfico del banner SVG, descarta fondos oscuros/transparentes y produce geometría normalizada. `particleGeometry` genera estrella y dispersión deterministas; no muestrea ni transforma el asset Rive. El canvas visible 2D usa el ticker GSAP existente, semillas/glow precalculados y 24 grupos de dibujo. Comienza con 11.000 puntos desktop / 5.500 móvil; si el coste medio de 60 dibujos supera 10 ms, reduce densidad hasta un mínimo de 3.500. DPR máximo 2. Un pointer de mouse aporta parallax decorativo acotado, sin servicios remotos ni estado de Home. Resize, aborts, listeners, ticker y buffers se liberan al desmontar.

Motion controla la carga; Canvas, partículas; GSAP, trayectoria/progreso/revelación; Rive, personaje. No hay navegación de diapositivas ni detalles desplegables. El progreso visual sigue al scroll con 900 ms de asentamiento; «Revelar a Jev» recorre el tramo final en 1,8 s. El tween se pausa fuera de vista y se elimina al desmontar. El cursor de mouse/pen deforma localmente las partículas mediante desplazamientos y velocidades en buffers tipados, con retorno elástico y amortiguación; no añade un ticker. Las corrientes, estelas y brillo se intensifican durante el morph. Reduced motion, ausencia de IntersectionObserver, viewport bajo o fallo de imagen ofrecen lectura lineal sin pinning/scroll suave, originales estáticos y Jev al final. Móvil coloca la ilustración sobre el texto. [Evidencia de partículas anterior](../.dev/evidence/phase-4/particles-README.md); el pulido se registra en [task](../.dev/task.md).

### Home: conducta real

La ampliación visual UATF intercepta las intenciones de inscripción en `HomePage` antes de `brain.submitContext`. `features/enrollment/enrollmentIntent.ts` y `validation.ts` son funciones puras; `useEnrollment` posee los estados closed/editing/confirmed/closing y los campos efímeros. Confirmar borra los valores; cerrar conserva solo el estado visual de aceptación durante el fade, no los datos. Salir de Inicio también limpia la inscripción aunque Home permanezca montada.

El cerebro y el sensor se suspenden usando sus opciones existentes; Character sigue activo y mantiene su instancia. La coreografía comienza en un RAF cancelable después de la suspensión del cerebro, con Hello/Flower temporales; readiness tardío usa la fase vigente. El cierre vuelve a Base y restaura foco al input si Home está visible. `EnrollmentExperience` presenta campos, errores y confirmación ES/EN; no espera a Rive. Motion gobierna layout y un burst SVG finito de 48 puntos, sin importar la maquinaria de Story ni añadir canvas. `useEnrollmentViewport` ajusta la altura disponible con `visualViewport` y retira sus listeners/variable al cerrar. Los valores del formulario no forman parte del contexto conversacional, requests, URL o persistencia. [Evidencia UATF](../.dev/evidence/enrollment/README.md).

1. Sensor mantiene `SensorSnapshot` solo en cliente. Escribe posición normalizada en propiedades CSS; permite movimiento visual inmediato sin esperar a una decisión.
2. Para una decisión, `useCreatureBrain` arma `CreatureWorldState`: contexto, inactividad/retorno/ausencia, reacción previa, tiempo desde reacción, personalidad y duración de sesión. No incluye posición, distancia ni velocidad del cursor.
3. Contexto enviado explícitamente solicita una decisión contextual. El scheduler también puede solicitarla al volver tras una ausencia suficiente, una vez cumplido el cooldown.
4. Scheduler puede reutilizar caché; limita ritmo, aborta reemplazos/tiempos agotados y valida respuesta. Si falla o endpoint informa `unavailable`, recurre a `fallbackBrain`.
5. La decisión coherida actualiza estado e interfaz. Adaptador traduce reacción a estado Rive; intensidad y atención alimentan el escenario.
6. Si la acción contextual es `talk`, Jev termina primero. `think` sigue hasta que llegue el primer texto de Groq; un único rótulo recibe los fragmentos y desaparece al cabo de unos 5 s.
7. Cambiar idioma durante habla invalida la generación y aborta su reader, luego repite el mismo mensaje con el idioma nuevo y solo el historial previamente completado. Si todavía se espera a `/api/decide`, esa decisión no se repite: el habla usará el idioma vigente al comenzar. Los captions completos conservan su `lang` original.
8. Fallar el habla elimina texto parcial y muestra un aviso localizado en el HUD, sin fabricar una frase de Jev. Interrumpir una decisión tiene un aviso distinto. «Borrar conversación» cancela ambas vías y borra contexto, intercambios y caché de decisiones que contenía texto, sin reiniciar cuotas ni personalidad.

## Servicio y persistencia

`npm run build:frontend` usa el modo Vite `frontend`: el scheduler resuelve directamente con `fallbackBrain`, sin sondear la API ni solicitar habla generada. `scripts/prepare-vercel-frontend.mjs` empaqueta solo el build estático y las rutas directas en `.vercel/output`; `vercel deploy --prebuilt --prod` publica ese artefacto sin funciones. Los builds ordinarios conservan el backend opcional descrito a continuación.

El middleware de Vite carga `TYPESAFE_API_KEY`, `JEV_MODEL`, `GROQ_API_KEY` y `GROQ_MODEL` desde `.env` al entorno server-side y delega `POST /api/decide` y `POST /api/talk` a sus handlers reales. La segunda ruta transmite SSE y solo consulta Groq tras una acción contextual `talk`. Las claves no se incluyen en el bundle del navegador. Vercel limita la ruta de habla a 10 s. El build local no prueba despliegue ni disponibilidad del proveedor.

Los mensajes y respuestas no se guardan en `localStorage`: el contexto actual y los últimos dos intercambios completos viven en memoria de Home y se pierden al recargar o borrar la conversación. Al iniciar se elimina el antiguo valor `jevling.context`. La personalidad sigue en `jevling.personality`, con validación local. No hay base de datos indicada por este flujo.

El habla tiene un límite de espera de 12 s en cliente, mientras upstream conserva su timeout de 8 s. Las peticiones nuevas/reemplazadas y el desmontaje cancelan timers/readers. El límite existente de `/api/talk` vuelve a habilitar su bucket después de la ventana de 60 s; las solicitudes inválidas también cuentan hacia la cuota del endpoint.

## Stack y comandos

React 19, TypeScript 6 strict, Vite 8, Rive React, Tailwind v4, Button de shadcn/ui (Radix Slot/CVA), Motion, Zustand y `@typesafe-ai/sdk`; Features añade XState/@xstate-react. Features/About comparten GSAP/@gsap-react y Lenis desde un chunk diferido, sin dependencias nuevas en fase 4. ESLint verifica la aplicación raíz, API, tests y configuración; `jev-lab` y sus evidencias tienen su propio alcance. Scripts y verificación por proyecto en [diseño](../design.md#verificación-y-evidencia); ver [entrada para agentes](README.md) e [interacción](interaction.md).

## Límite del asset

`Character` consume un asset Rive propiedad del usuario desde la ruta que configura la fuente. Documentar solo esa dependencia: no copiar, extraer, incrustar ni describir el contenido propietario del asset o de medios exclusivos. Ruta local no constituye contrato estable.
