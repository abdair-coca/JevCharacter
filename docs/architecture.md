# Arquitectura

La aplicación separa percepción local, decisión conductual y presentación. La decisión no es texto de chatbot: es un contrato pequeño que guía reacción, ambiente y atención.

## Runtime

`src/main.tsx` monta `App` dentro de React. `App` compone la cabecera fija, preferencias y rutas tipadas. `HomePage` conecta `Character`, `ContextWhisper`, `BrainHUD` y `DebugPanel` con el sensor pointer, `useCreatureBrain` y el controlador del personaje. El entorno visual usa tokens neutros/violetas en CSS; `AmbientStage` ya no se monta en Home.

### Shell, preferencias y sesión

- `/` es Home; `/features` carga `FeaturesPage` de forma diferida; solo `/about` conserva `PendingPage` hasta su fase. `vercel.json` incluye rewrites exactos para esas dos rutas, separados de `/api/*`; todavía no hay evidencia de despliegue remoto.
- `public/preferences-init.js` aplica tema, idioma y `theme-color` en el head antes de React. `preferencesStore` consume ese estado inicial y usa Zustand para cambios de UI. Se guardan solo `jevling.theme` y `jevling.language`; storage bloqueado conserva cambios en memoria. El modo sistema sigue `prefers-color-scheme`; la elección manual tiene prioridad.
- `src/i18n/messages.ts` comparte claves tipadas ES/EN. Se traducen interfaz, HUD y diagnóstico, sin traducir IDs Rive/API. Cambiar preferencias no remonta el personaje ni borra el input.
- `Character` y las funciones de animación DOM de Motion se cargan en chunks separados. El asset sigue siendo el existente. Rive pausa por movimiento reducido y visibilidad de pestaña; Motion usa los tokens mediante un adaptador que acepta `ms` y `s`, incluso tras minificación.
- Los controles orgánicos comparten `OrganicLight`: duración según `BrainStatus`, opacidad según atención y feedback local del input. `useAmbientMotion` pausa por viewport/pestaña; `useReducedMotionPreference` suscribe cambios nativos en vivo porque el hook de Motion 14 conserva solo el valor inicial. `domMax` se carga de forma diferida para la proyección de layout de controles/métricas; el panel HUD se superpone hacia arriba sin alterar el flujo de Home. Valores/duraciones salen de los tokens, sin loops de procesamiento de canvas.
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
| `creature/rive/riveReactionAdapter.ts` y `character/useCharacterController.ts` | Mapean reacción a enum y trigger del controlador; temporizan estados transitorios. |
| `pages/HomePage.tsx`, `styles/tokens.css` y `components/BrainHUD.tsx` | Presentan a Jev, feedback de pointer/envío, acción, confianza, probabilidades, intensidad, atención y personalidad. |

## Camino de datos

### Features: presentación separada

`features/showcase/catalog.ts` fija ocho capítulos, texto ES/EN, acciones y tokens de duración. `player.ts` usa XState para loading → prepare → playing → complete, con interrupted, static y error. Tiene un solo reloj; reemplazar/repetir cancela los delays anteriores y reinicia desde Base. El port usa únicamente el controlador del `Character` existente, sin cerebro, scheduler, red, sensores ni personalidad de Home.

GSAP/ScrollTrigger gobiernan pinning y trayectoria horizontal del wrapper libre; Motion solo el caption/controles y Rive el dibujo. `features/presentation/scrollRuntime.ts` comparte una única instancia global de Lenis por leases, conducida por el ticker GSAP sin RAF extra. Fuera del escenario retira el driver suave y libera scroll nativo; al ocultar el documento deshabilita el workaround RAF de ScrollTrigger sin deshacer pinning. `enable()` se protege contra duplicación de loops/intervalos; el teardown respeta otros propietarios.

`Character` admite `presentation` (listeners Rive deshabilitados), `staticPose`, readiness y error de carga; sus defaults conservan Home. Features suspende por viewport/pestaña y reanuda desde paso cero del capítulo actual; salir de la ruta destruye la presentación y una visita nueva empieza desde su contexto inicial/selección por scroll. Cambiar idioma/tema mantiene paso y canvas, corrigiendo anchors bajo un bloqueo temporal de selección.

Con reduced motion o sin IntersectionObserver, no hay pinning/smooth scroll ni reproducción temporal: una pose estable y listas de pasos describen las ocho escenas. Error conserva lectura/navegación; retry remonta solo la instancia de presentación con un nuevo intento. Los eventos de readiness/error obsoletos se descartan. Todas las métricas son ejemplos explícitos, nunca lecturas actuales de Home. [Evidencia](../.dev/evidence/phase-3/README.md).

### Home: conducta real

1. Sensor mantiene `SensorSnapshot` solo en cliente. Escribe posición normalizada en propiedades CSS; permite movimiento visual inmediato sin esperar a una decisión.
2. Para una decisión, `useCreatureBrain` arma `CreatureWorldState`: contexto, inactividad/retorno/ausencia, reacción previa, tiempo desde reacción, personalidad y duración de sesión. No incluye posición, distancia ni velocidad del cursor.
3. Contexto enviado explícitamente solicita una decisión contextual. El scheduler también puede solicitarla al volver tras una ausencia suficiente, una vez cumplido el cooldown.
4. Scheduler puede reutilizar caché; limita ritmo, aborta reemplazos/tiempos agotados y valida respuesta. Si falla o endpoint informa `unavailable`, recurre a `fallbackBrain`.
5. La decisión coherida actualiza estado e interfaz. Adaptador traduce reacción a estado Rive; intensidad y atención alimentan el escenario.
6. Si la acción contextual es `talk`, Jev termina primero. `think` sigue hasta que llegue el primer texto de Groq; un único rótulo recibe los fragmentos y desaparece al cabo de unos 5 s.
7. Cambiar idioma durante habla invalida la generación y aborta su reader, luego repite el mismo mensaje con el idioma nuevo y solo el historial previamente completado. Si todavía se espera a `/api/decide`, esa decisión no se repite: el habla usará el idioma vigente al comenzar. Los captions completos conservan su `lang` original.
8. Fallar el habla elimina texto parcial y muestra un aviso localizado en el HUD, sin fabricar una frase de Jev. Interrumpir una decisión tiene un aviso distinto. «Borrar conversación» cancela ambas vías y borra contexto, intercambios y caché de decisiones que contenía texto, sin reiniciar cuotas ni personalidad.

## Servicio y persistencia

El middleware de Vite carga `TYPESAFE_API_KEY`, `JEV_MODEL`, `GROQ_API_KEY` y `GROQ_MODEL` desde `.env` al entorno server-side y delega `POST /api/decide` y `POST /api/talk` a sus handlers reales. La segunda ruta transmite SSE y solo consulta Groq tras una acción contextual `talk`. Las claves no se incluyen en el bundle del navegador. Vercel limita la ruta de habla a 10 s. El build local no prueba despliegue ni disponibilidad del proveedor.

Los mensajes y respuestas no se guardan en `localStorage`: el contexto actual y los últimos dos intercambios completos viven en memoria de Home y se pierden al recargar o borrar la conversación. Al iniciar se elimina el antiguo valor `jevling.context`. La personalidad sigue en `jevling.personality`, con validación local. No hay base de datos indicada por este flujo.

El habla tiene un límite de espera de 12 s en cliente, mientras upstream conserva su timeout de 8 s. Las peticiones nuevas/reemplazadas y el desmontaje cancelan timers/readers. El límite existente de `/api/talk` vuelve a habilitar su bucket después de la ventana de 60 s; las solicitudes inválidas también cuentan hacia la cuota del endpoint.

## Stack y comandos

React 19, TypeScript 6 strict, Vite 8, Rive React, Tailwind v4, Button de shadcn/ui (Radix Slot/CVA), Motion, Zustand y `@typesafe-ai/sdk`; Features añade XState/@xstate-react, GSAP/@gsap-react y Lenis desde su chunk diferido. ESLint verifica la aplicación raíz, API, tests y configuración; `jev-lab` y sus evidencias tienen su propio alcance. Scripts y verificación por proyecto en [diseño](../design.md#verificación-y-evidencia); ver [entrada para agentes](README.md) e [interacción](interaction.md).

## Límite del asset

`Character` consume un asset Rive propiedad del usuario desde la ruta que configura la fuente. Documentar solo esa dependencia: no copiar, extraer, incrustar ni describir el contenido propietario del asset o de medios exclusivos. Ruta local no constituye contrato estable.
