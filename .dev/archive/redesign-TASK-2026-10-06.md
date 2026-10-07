# Plan: rediseño de JEVLING — Home, Features y About

## Descripción general

Rediseñar la web para una audiencia mixta, combinando claridad e impacto visual con muy poco texto. Jev será el protagonista y explicará sus capacidades mediante acciones. Se conserva el personaje actual, su apariencia y sus animaciones. La experiencia tendrá tres vistas independientes con navegación fija, tema claro/oscuro y ES/EN de extremo a extremo.

**Aprobación del plan completo:** aprobada explícitamente por el usuario el 2026-10-06, después de aprobar los cinco resúmenes de fase. La aprobación de cada resumen no significa que su implementación o entrega esté terminada.

**Estado de ejecución:** planificación y preparación documental aprobadas/completadas. El usuario autorizó ejecutar la fase 1 el 2026-10-06: implementada y verificada en escritorio/emulación móvil; pendiente revisión visual y teclado en dispositivo físico. Fases 2–5 pendientes.

**Contrato visual y técnico:** [design.md](../../design.md). **Entrada para agentes:** [AGENTS.md](../../AGENTS.md). **Relato de About:** [historia de JEV](../../docs/jev-story.md).

## Decisiones aprobadas

| Área | Decisión |
|---|---|
| Resultado | Claridad y personalidad junto con impacto visual; contenido breve y demostraciones. |
| Audiencia | Mixta: público general, diseñadores, desarrolladores y personas que evalúan el proyecto. |
| Identidad | Minimalista expresiva, espacio libre y tipografía con carácter. |
| Paleta | Sin verde/lima. Durante fase 1 el usuario proporcionó la paleta exacta oscuro/claro registrada en `design.md` y aprobó texto `#050608` / `#FFFFFF` sobre primary en oscuro/claro. |
| Personaje | Conservar el Jev actual; el rediseño no incorpora el personaje de `jev-lab`. |
| Vistas | Home `/`, Features `/features`, About `/about`; navegación fija y enlaces directos. |
| Home | Jev, input, respuestas y HUD: decisión y confianza visibles, métricas desplegables. |
| Features | Scroll más controles para avanzar, retroceder y repetir; toda la presentación determinista. |
| About | Scrollytelling de cinco escenas basado en el relato del usuario, con Abdair Coca como creador. |
| Tema | Preferencia del sistema en primera visita; recordar cambios manuales. |
| ES/EN | Interfaz, presentaciones, contenido accesible, estados y nuevas respuestas de Jev. |
| Idioma inicial | Detectar ES/EN del navegador, español como alternativa; recordar la selección manual. |
| Móvil | Mismo contenido e impacto, con composición, encuadres y secuencias adaptadas. |
| Fallos de IA | Home conserva reacciones locales; indicación breve en el HUD. Features no depende de servicios remotos. |
| Revisión | Home será la referencia visual; construir una fase por vez y pedir revisión al terminarla. |

## Antecedente de JEV Lab

El usuario declaró terminado `jev-lab` y solicitó reemplazar su plan activo, aclarando que no había dado la aprobación formal. El [plan anterior](jev-lab-plan-2026-10-06.md) se conserva como antecedente con sus estados y evidencias históricas; no se convierten sus casillas en aprobaciones retroactivas. `.dev/tasks.md` era un registro histórico distinto; su eliminación presente se incluye porque el usuario pidió publicar todos los cambios de la copia de trabajo.

## Preparación documental

- [x] Archivar el contenido anterior de `.dev/TASK.md` sin alterar su evidencia.
- [x] Registrar el plan completo y los cinco resúmenes aprobados.
- [x] Crear `design.md` con reglas, contrato de tokens y criterios de interacción.
- [x] Crear la entrada raíz `AGENTS.md` y enlazar las fuentes de documentación.
- [x] Conservar el relato original de About y verificar documentos, enlaces y diff.

### Evidencia de preparación — 2026-10-06

| Comprobación | Resultado |
|---|---|
| Validación documental con script temporal explícito | PASS: siete documentos, 39 enlaces/anclas locales, cinco resúmenes aprobados y cinco entregas pendientes; ninguna tarea de implementación marcada como terminada. |
| Hash del archivo histórico | Al archivarlo se registró `310ee1272f56ebea39fca62c543d2ddf3bdb9111`. La revisión previa al push encontró que el hash de la copia actual es `7d94bfd7c887dd93c1f3ad70e9931294d608fd68`; la igualdad byte por byte no está verificada. |
| `git diff --check -- "README.md" "docs/README.md"` | PASS. Revisión del diff y whitespace de documentos nuevos incluida en la validación documental. |
| `npm exec -- tsc --noEmit -p tsconfig.app.json` | PASS, línea base del runtime actual. |
| `npm exec -- tsc --noEmit -p tsconfig.node.json` | PASS, línea base del runtime actual. |
| `npm exec -- tsc --noEmit -p tsconfig.api.json` | PASS, línea base del runtime actual. |
| `npm exec -- tsc --noEmit -p tsconfig.tests.json` | PASS, línea base del runtime actual. |
| `npm exec -- vitest run` | PASS: seis archivos y 28 tests. |
| `npm run lint` | Oxlint termina con cinco advertencias en fuentes previas: dos `no-unused-vars` del laboratorio, una dependencia de hook y dos accesos a refs durante render. No equivale a ESLint. |
| `npm ls eslint --depth=0` | ESLint no instalado; su configuración y ejecución siguen pendientes en fase 1. |
| Build, Playwright y mediciones LCP/FPS | No ejecutados en esta entrega exclusivamente documental; pendientes en las fases de implementación correspondientes. |

El validador temporal se ejecutó con `node "C:\Users\abdai\AppData\Local\Temp\opencode\validate-jev-redesign-docs.mjs"`, fuera del repositorio. Al comenzar esta solicitud, se observó un hash igual tras archivar. Antes del commit, el hash dejó de coincidir y el archivo archivado tuvo que reconstruirse desde el contenido que seguía disponible en la sesión; por ello se verifican enlaces y contenido registrado, pero no se afirma preservación binaria. La primera comprobación de whitespace se ajustó para respetar los saltos Markdown del antecedente. Los resultados de aplicación anteriores no verifican una web rediseñada ni strict habilitado.

## Fases

### Fase 1 — Identidad visual y Home de referencia

**Descripción:** definir y validar el lenguaje visual en escritorio y móvil, con ambos temas, antes de extenderlo a las presentaciones. Jev ocupa el centro de atención; entrada evidente, textos breves y HUD compacto. Las nuevas dependencias de UI se limitan a las necesarias para esta entrega.

**Archivos previstos:**
- `src/App.tsx`, `src/index.css` y `src/App.css` — estructura y transición desde la pantalla actual.
- `src/styles/tokens.css` — fuente ejecutable de valores de diseño; se creará durante esta fase.
- `src/pages/HomePage.tsx` y componentes de navegación — referencia visual y estructura de vistas.
- `src/stores/preferencesStore.ts` y `src/i18n/` — preferencias y traducciones tipadas.
- `package.json`, lockfile, configuración Vite/Tailwind/ESLint y `tsconfig*.json` — herramientas y strict.

**Tareas:**
- [x] Revisar el estado inicial y registrar la línea base de comprobaciones antes de modificar el runtime.
- [x] Validar los colores exactos junto al Jev actual y crear tokens siguiendo `design.md`.
- [x] Configurar Tailwind v4, componentes necesarios de shadcn/ui, Motion y Zustand, justificando su peso.
- [x] Activar TypeScript strict, corregir los contratos afectados y configurar ESLint.
- [x] Preparar navegación, enlaces directos, preferencias y traducciones ES/EN de la interfaz de Home.
- [x] Implementar tema del sistema, elección manual persistida y prevención de destellos del tema incorrecto.
- [x] Construir Home en móvil/escritorio y claro/oscuro conservando sus interacciones actuales.

**Verificación:**
- [x] Ejecutar typecheck por proyecto, ESLint, Vitest y build.
- [x] Con Playwright, capturar móvil/escritorio y ambos temas; probar navegación, teclado, foco, tema, idioma, input y HUD; revisar consola.
- [ ] Comprobar que el teclado móvil y los cambios de tamaño no ocultan controles. Emulación a 390×420 y reflow a 320px: PASS; teclado físico pendiente.
- [ ] Obtener revisión visual de Home antes de extender este lenguaje a Features y About.

**Estado:** Implementada y verificada en emulación; pendiente revisión visual y teclado físico.
**Aprobación del resumen de fase:** Aprobado por el usuario el 2026-10-06.
**Hallazgos/evidencia:** Registro siguiente y [capturas/resultados](../evidence/phase-1/README.md).
**Aprobación de la entrega:** Pendiente.

#### Evidencia de fase 1 — 2026-10-06

**Decisiones consultadas:** el usuario pidió pantallas provisionales extremadamente sencillas para las otras rutas; proporcionó los trece pares de colores exactos; aprobó el texto oscuro sobre primary en oscuro y blanco en claro para contraste AA. Solicitó consultar cualquier decisión no resuelta, sin asumirla. La composición sigue pendiente de su revisión visual.

| Comprobación | Línea base | Entrega |
|---|---|---|
| `git status --short` inicial | Copia limpia | Cambios de fase 1; sin commit/push. |
| `npm run typecheck` / `npm run typecheck:tests` | PASS | Strict en app, node, API y tests. |
| `npm exec -- tsc --noEmit -p tsconfig.app.json` | Cubierto por línea base root | PASS final explícito. |
| `npm exec -- tsc --noEmit -p tsconfig.node.json` | Cubierto por línea base root | PASS final explícito en serie. |
| `npm exec -- tsc --noEmit -p tsconfig.api.json` | Cubierto por línea base root | PASS final explícito en serie. |
| `npm exec -- tsc --noEmit -p tsconfig.tests.json` | PASS | PASS final explícito. |
| `npm run lint` | Oxlint: cinco advertencias previas | ESLint: PASS, cero advertencias. Oxlint se conserva como `lint:ox`. |
| `npm test` | Seis archivos / 28 tests PASS | Nueve archivos / 44 tests PASS. |
| `npm run build` | PASS: JS 465,76 kB / gzip 138,27; CSS 17,74 / gzip 5,26 | PASS: shell JS 338,13 / gzip 108,04; Character 211,49 / gzip 59,85; Motion DOM 37,79 / gzip 14,50; CSS 27,12 / gzip 6,41. |
| `npm audit --omit=dev` | No ejecutado antes de instalar | PASS: cero vulnerabilidades después de actualizar `source-map-js`; instalación de Playwright también reportó cero. |
| `node ".dev/evidence/phase-1/run-browser.mjs"` | Captura anterior conservada | PASS: 70 comprobaciones, ocho capturas de matriz más viewport bajo/movimiento reducido; Chromium 153.0.8010.12. |
| Contraste de roles usados | Sin medición | Texto principal ≥17,49:1; secundario ≥4,79:1; texto de botón ≥4,79:1; foco ≥4,79:1. [Resultado](../evidence/phase-1/contrast.json). |
| Revisión Standards / Spec | No aplicable | Dos revisores: sin bloqueos de fase 1 tras corregir hallazgos; restauración de scroll histórico se mantiene en fase 5. |
| Validación documental y `git diff --check` | Preparación documental registrada arriba | PASS: siete documentos, 50 enlaces/anclas locales, evidencia de 70 checks y fases 2–5 pendientes. Whitespace PASS. |

**Cobertura del navegador:** 1440×900 y 390×844, ES/EN, sistema/claro/oscuro, persistencia tras recarga, cambios del sistema sin sustituir overrides, personaje/borrador sin remontaje al cambiar preferencias, HUD, enlace de salto, foco de navegación, atrás/adelante y recargas. Se ejercitaron sensores pointer/touch sin IA, decisiones reaction/answer/morph/talk con fixtures y una respuesta SSE simulada; la indisponibilidad de decisión conserva fallback local. Tres ciclos de navegación con Rive cargado no produjeron errores de aplicación. Todas las rutas de proveedor estuvieron interceptadas.

**Consola y límites:** cero errores de aplicación y cero fallos del harness; cuatro advertencias de Chromium/WebGL `GPU stall due to ReadPixels` en la primera captura, guardadas sin ocultarlas. No se afirma rendimiento físico, LCP/FPS, disponibilidad del proveedor ni despliegue remoto. Teclado móvil real pendiente; viewport reducido y scroll nativo pasaron en emulación. El idioma del habla, su estado de error localizado y la sesión conservada entre vistas siguen siendo fase 2; esta navegación desmonta Home.

La validación documental se ejecutó con `node "C:\Users\abdai\AppData\Local\Temp\opencode\validate-phase1-docs.mjs"`; el script temporal permanece fuera del repositorio. Los avisos de Git sobre normalización LF/CRLF no fueron errores de whitespace.

**Incidencias resueltas:** el minificador convirtió `280ms` en `.28s` y rompió el primer render de producción; el adaptador ahora acepta ambas unidades, con cinco regresiones de test. La navegación lazy podía buscar el título anterior oculto; ahora enfoca el título identificado por ruta y pasó la repetición. Se restituyeron feedback de pointer y pulso de envío con transform/opacity. Las capturas iniciales del harness esperaban solo el canvas: se reemplazaron tras esperar a Rive cargado. Se observó un error WASM durante HMR de desarrollo; no se reprodujo en las tres navegaciones del build limpio. Una ejecución paralela agotó memoria en dos typechecks y desconectó el MCP de navegador; ambos typechecks pasaron en serie y Playwright se reprodujo con su runner local. Una comprobación agrupada alcanzó el timeout al entrar en build; el build separado pasó.

#### Dependencias y coste

| Dependencia | Uso necesario en esta fase / alternativa / coste |
|---|---|
| Tailwind v4 y plugin Vite | Utilidades y mapeo único de tokens para UI; CSS puro era la alternativa previa. Transformación en build, sin motor Tailwind en el navegador; CSS completo crece 1,15 kB gzip frente a la línea base. |
| shadcn/ui Button: Radix Slot, CVA, clsx, tailwind-merge | Un solo componente para controles/enlaces con variantes tipadas; botón nativo a mano era la alternativa. No se añadió un kit completo ni icon library. Su coste no se aisló del shell. |
| Motion | Feedback y entrada/salida de UI mediante `m`, `LazyMotion` y `AnimatePresence`, sustituyendo keyframes/transiciones previas; funciones DOM en chunk diferido de 14,50 kB gzip y core en shell, no medido por separado. |
| Zustand | Preferencias compartidas y acciones tipadas; Context/useState era la alternativa. No duplica sesión ni máquina de Features. Coste individual no aislado. |
| ESLint + plugins y Playwright | Herramientas dev de verificación; cero carga de navegador de producción. Playwright local permitió recuperar la comprobación tras desconexión del MCP. |

La Home completa descarga aproximadamente **188,80 kB gzip de JS+CSS**, frente a **143,53 kB** anteriores: incremento agregado **45,27 kB**. El shell es menor gracias a diferir Character/Motion, pero la carga total de Home aumenta; no se presenta la división de chunks como reducción total. Estas cifras excluyen HTML, WASM externo y el asset existente. No se han instalado dependencias de presentación de las fases 3–4.

### Fase 2 — Home funcional y bilingüismo completo

**Descripción:** conectar el nuevo diseño con el comportamiento real y completar ES/EN de extremo a extremo. Se conservan seguimiento del cursor, touch, reacciones, sí/no, habla y transformaciones. Cambiar preferencias no reinicia la interacción.

**Archivos previstos:**
- `src/pages/HomePage.tsx`, `src/components/` y traducciones — UI, HUD y mensajes accesibles.
- `src/hooks/useCreatureBrain.ts` — sesión, idioma, cancelación y suspensión.
- `src/character/useCharacterController.ts` y `src/creature/sensors/pointerSensor.ts` — control y ciclo de vida.
- `src/creature/brain/speechClient.ts`, `speechProtocol.ts` y `api/talk.ts` — idioma validado en cliente/servidor.
- Pruebas de Home, cliente de habla y API — contratos e integración.

**Tareas:**
- [ ] Integrar personaje, sensores, entrada, respuestas y HUD desplegable.
- [ ] Traducir etiquetas, estados, ayudas, errores y contenido accesible.
- [ ] Enviar el idioma seleccionado a `/api/talk`, validarlo y usarlo para nuevas respuestas.
- [ ] Resolver cambios de idioma durante una respuesta: cancelar generación obsoleta y evitar fragmentos mezclados.
- [ ] Mantener el contexto de Home en memoria al visitar otras vistas; suspender solicitudes y actividad mientras esté oculta.
- [ ] Conservar fallback local con indicación breve y traducida; un fallo del habla no inventa una respuesta.

**Verificación:**
- [ ] Texto, teclado, mouse y touch; entrada vacía y límites del texto.
- [ ] Contrato ES/EN, cancelación y cambios rápidos; comprobar respuestas reales cuando el servicio esté disponible.
- [ ] Salir y volver a Home sin perder contexto ni dejar actividad de fondo.
- [ ] Fallos de conexión y disponibilidad; conservar comportamiento local.
- [ ] Typecheck, ESLint, Vitest, build y Playwright en ambas pantallas, temas e idiomas.

**Estado:** Pendiente.
**Aprobación del resumen de fase:** Aprobado por el usuario el 2026-10-06.
**Hallazgos/evidencia:** Pendiente de implementación.
**Aprobación de la entrega:** Pendiente.

### Fase 3 — Features determinista: Jev se explica en vivo

**Descripción:** escenario protagonista fijado durante un recorrido de ocho capítulos. El scroll selecciona la feature; botones y teclado permiten avanzar, retroceder y repetir. El catálogo distingue capacidades verificadas hoy de la visión futura.

| Capítulo | Demostración |
|---|---|
| Percibe | Seguimiento de un cursor de ejemplo y respuesta a la interacción simulada. |
| Reacciona | Saludo, sorpresa y otras reacciones disponibles. |
| Decide | Una situación predefinida produce una acción y una lectura compacta del HUD. |
| Responde | Respuestas visuales sí/no. |
| Habla | Pensamiento, animación hablada y frase localizada predefinida. |
| Se transforma | Estrella, cuadrado y triángulo, validados en el runtime actual. |
| Se adapta | Personalidad, contexto de sesión y retorno tras ausencia, mediante ejemplos aislados. |
| Sigue contigo | Demostración de continuidad mediante el fallback local. |

**Archivos previstos:**
- `src/pages/FeaturesPage.tsx` y `src/features/showcase/` — vista, catálogo y máquina XState.
- Catálogo ES/EN y controlador compartido — secuencias y textos predefinidos.
- Gestión global del scroll y carga diferida — GSAP/ScrollTrigger, `useGSAP` y Lenis.
- Pruebas de secuencias y navegación — determinismo, reemplazo y ciclo de vida.

**Tareas:**
- [ ] Validar cada demostración con Rive y crear un catálogo tipado de acciones, tiempos y datos de ejemplo.
- [ ] Implementar carga, preparación, reproducción, interrupción y error con XState.
- [ ] Garantizar resultados reproducibles sin IA, aleatoriedad ni sensores reales que alteren las secuencias.
- [ ] Identificar ejemplos como demostraciones y aislarlos del contexto/personalidad de Home.
- [ ] Coordinar recorrido con GSAP y controles de UI con Motion en elementos distintos.
- [ ] Incorporar una sola instancia global de Lenis y cargar las dependencias de presentación de forma diferida.
- [ ] Mantener capítulo y progreso al cambiar tema/idioma; cancelar acciones sustituidas.
- [ ] Adaptar composición móvil y lectura con movimiento reducido, sin fijación prolongada.

**Verificación:**
- [ ] Repetir cada capítulo produce los mismos eventos, acciones y datos de ejemplo.
- [ ] Scroll, botones, teclado, retroceso y cambios rápidos no superponen secuencias.
- [ ] Features funciona sin llamadas a `/api/decide` ni `/api/talk`.
- [ ] Ocultar vista/pestaña suspende actividad; desmontar elimina timelines, timers y listeners.
- [ ] Typecheck, ESLint, Vitest, build y Playwright; comprobar alternativa textual y movimiento reducido.

**Estado:** Pendiente.
**Aprobación del resumen de fase:** Aprobado el 2026-10-06; el usuario reiteró que toda Features debe ser determinista.
**Hallazgos/evidencia:** Pendiente de implementación.
**Aprobación de la entrega:** Pendiente.

### Fase 4 — About: la historia de una interfaz viva

**Descripción:** convertir el [relato aportado](../../docs/jev-story.md) en escenas visuales con frases cortas: la pregunta, el experimento, de animación a personaje, su creador y la visión. Cierre con “Tiny creature. Big decisions.” y acceso a Home. Detalles de la historia en bloques desplegables.

**Archivos previstos:**
- `src/pages/AboutPage.tsx` y `src/features/story/` — composición y escenas.
- Contenido ES/EN y estilos por tokens — narrativa, créditos y detalles.
- Pruebas de recorrido y ciclo de vida — navegación y preferencias.

**Tareas:**
- [ ] Preparar guion breve ES/EN sin inventar fechas, hitos, retratos ni capacidades actuales.
- [ ] Representar en 2D la caja de chat y la salida de Jev, el experimento y las capas de percepción/comportamiento/cuerpo.
- [ ] Presentar a Abdair Coca como estudiante de Ingeniería Informática y creador del proyecto.
- [ ] Coordinar scrollytelling con GSAP y usar Motion para controles independientes.
- [ ] Distinguir evolución, experimentación y visión futura; añadir detalles desplegables.
- [ ] Mantener escena al cambiar idioma; adaptar móvil y lectura continua con movimiento reducido.
- [ ] Cargar de forma diferida y limpiar animaciones al abandonar la vista.

**Verificación:**
- [ ] Historia fiel al relato, créditos claros, scroll y teclado utilizables.
- [ ] Ambos idiomas/temas, móvil/escritorio y movimiento reducido.
- [ ] Typecheck, ESLint, Vitest, build y Playwright con revisión visual de las cinco escenas.

**Estado:** Pendiente.
**Aprobación del resumen de fase:** Aprobado por el usuario el 2026-10-06.
**Hallazgos/evidencia:** Pendiente de implementación.
**Aprobación de la entrega:** Pendiente.

### Fase 5 — Integración, accesibilidad y rendimiento

**Descripción:** verificar que las tres vistas funcionan como una sola experiencia, con navegación correcta, limpieza de recursos y rendimiento medido.

**Archivos previstos:**
- Estructura global, navegación y scroll — integración entre vistas.
- `vercel.json` — enlaces directos y recargas sin interferir con `/api/*`.
- Pruebas de integración y ajustes en las vistas — regresiones y accesibilidad.
- `README.md`, `docs/architecture.md`, `docs/interaction.md` y `design.md` — documentación de lo implementado.

**Tareas:**
- [ ] Completar atrás/adelante, enlaces directos y recargas de `/features` y `/about`.
- [ ] Coordinar restauración de scroll, navegación fija y foco tras cambio de vista.
- [ ] Verificar contexto/progreso al cambiar preferencias y navegar.
- [ ] Revisar contraste, nombres accesibles, tabulación, estados ocultos y alternativas de texto.
- [ ] Verificar suspensión/limpieza de Rive, solicitudes, timers, timelines, listeners y loops.
- [ ] Revisar carga diferida, comparar bundle inicial y justificar cada dependencia incorporada.
- [ ] Medir LCP y fluidez en condiciones registradas; actualizar documentación y presentar evidencias.

**Verificación:**
- [ ] Home operativa, Features determinista y About fiel al relato.
- [ ] Playwright: tres vistas, móvil/escritorio, claro/oscuro, ES/EN, teclado, movimiento reducido, navegación, recargas y consola.
- [ ] Objetivos: LCP < 2,5 s y 60 fps en móvil de gama media, indicando dispositivo y condiciones.
- [ ] Diferenciar emulación de escritorio de móvil físico y pruebas simuladas de respuestas reales; registrar pendientes explícitamente.
- [ ] Typecheck, ESLint, Vitest y build; obtener revisión final del usuario.

**Estado:** Pendiente.
**Aprobación del resumen de fase:** Aprobado por el usuario el 2026-10-06.
**Hallazgos/evidencia:** Pendiente de implementación.
**Aprobación de la entrega:** Pendiente.

## Verificación transversal y avance

Los comandos y la matriz de comprobación están en [design.md](../../design.md#verificación-y-evidencia). Ejecutar `tsc --noEmit` por proyecto: el `tsconfig.json` raíz solo referencia proyectos y no verifica por sí mismo todas las fuentes. ESLint está configurado desde fase 1; Oxlint se conserva como comando separado. Comprobar `package.json` antes de asumir qué herramientas están disponibles.

Registrar evidencia al terminar cada tarea. Detenerse tras entregar cada fase y pedir revisión antes de comenzar la siguiente. Mantener este plan hasta completar todas las casillas y aprobaciones; vaciarlo únicamente después de la aprobación final del usuario.

## Hallazgos y sugerencias

- La aplicación actual es React/TypeScript/Vite con Rive 2D; `@rive-app/react-webgl2` renderiza el personaje 2D y no introduce una escena 3D.
- La pantalla anterior bloqueaba el scroll global y concentraba la experiencia en `App`; fase 1 separó shell/Home y habilitó scroll nativo.
- El controlador existente ofrece estados y secuencias, pero la presentación requiere validar readiness, cancelación y limpieza, sin asumir que basta con exponer sus métodos.
- Tailwind, Button de shadcn/ui, Motion, Zustand y ESLint están incorporados desde fase 1; XState, GSAP y Lenis siguen pendientes de sus fases.
- Strict está habilitado en los cuatro proyectos desde fase 1.
- La paleta exacta fue indicada por el usuario durante fase 1; encuadre, composición y ritmo de Home todavía requieren su revisión visual.
- El plan histórico de JEV Lab queda archivado sin alterar sus casillas ni afirmar una aceptación visual retroactiva.
