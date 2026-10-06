# Plan: rediseño de JEVLING — Home, Features y About

## Descripción general

Rediseñar la web para una audiencia mixta, combinando claridad e impacto visual con muy poco texto. Jev será el protagonista y explicará sus capacidades mediante acciones. Se conserva el personaje actual, su apariencia y sus animaciones. La experiencia tendrá tres vistas independientes con navegación fija, tema claro/oscuro y ES/EN de extremo a extremo.

**Aprobación del plan completo:** aprobada explícitamente por el usuario el 2026-10-06, después de aprobar los cinco resúmenes de fase. La aprobación de cada resumen no significa que su implementación o entrega esté terminada.

**Estado de ejecución:** planificación aprobada; preparación documental completada y verificada; fases de implementación pendientes. La solicitud actual autoriza registrar este plan, crear el contrato de diseño y actualizar la documentación para agentes.

**Contrato visual y técnico:** [design.md](../design.md). **Entrada para agentes:** [AGENTS.md](../AGENTS.md). **Relato de About:** [historia de JEV](../docs/jev-story.md).

## Decisiones aprobadas

| Área | Decisión |
|---|---|
| Resultado | Claridad y personalidad junto con impacto visual; contenido breve y demostraciones. |
| Audiencia | Mixta: público general, diseñadores, desarrolladores y personas que evalúan el proyecto. |
| Identidad | Minimalista expresiva, espacio libre y tipografía con carácter. |
| Paleta | Colores de Jev con fondos neutros; sin verde ni lima, también en los indicadores de estado. Tonos exactos por validar en fase 1. |
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

El usuario declaró terminado `jev-lab` y solicitó reemplazar su plan activo, aclarando que no había dado la aprobación formal. El [plan anterior](archive/jev-lab-plan-2026-10-06.md) se conserva como antecedente con sus estados y evidencias históricas; no se convierten sus casillas en aprobaciones retroactivas. `.dev/tasks.md` era un registro histórico distinto; su eliminación presente se incluye porque el usuario pidió publicar todos los cambios de la copia de trabajo.

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
- [ ] Revisar el estado inicial y registrar la línea base de comprobaciones antes de modificar el runtime.
- [ ] Validar los colores exactos junto al Jev actual y crear tokens siguiendo `design.md`.
- [ ] Configurar Tailwind v4, componentes necesarios de shadcn/ui, Motion y Zustand, justificando su peso.
- [ ] Activar TypeScript strict, corregir los contratos afectados y configurar ESLint.
- [ ] Preparar navegación, enlaces directos, preferencias y traducciones ES/EN de la interfaz de Home.
- [ ] Implementar tema del sistema, elección manual persistida y prevención de destellos del tema incorrecto.
- [ ] Construir Home en móvil/escritorio y claro/oscuro conservando sus interacciones actuales.

**Verificación:**
- [ ] Ejecutar typecheck por proyecto, ESLint, Vitest y build.
- [ ] Con Playwright, capturar móvil/escritorio y ambos temas; probar navegación, teclado, foco, tema, idioma, input y HUD; revisar consola.
- [ ] Comprobar que el teclado móvil y los cambios de tamaño no ocultan controles.
- [ ] Obtener revisión visual de Home antes de extender este lenguaje a Features y About.

**Estado:** Pendiente.
**Aprobación del resumen de fase:** Aprobado por el usuario el 2026-10-06.
**Hallazgos/evidencia:** Pendiente de implementación.
**Aprobación de la entrega:** Pendiente.

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

**Descripción:** convertir el [relato aportado](../docs/jev-story.md) en escenas visuales con frases cortas: la pregunta, el experimento, de animación a personaje, su creador y la visión. Cierre con “Tiny creature. Big decisions.” y acceso a Home. Detalles de la historia en bloques desplegables.

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

Los comandos y la matriz de comprobación están en [design.md](../design.md#verificación-y-evidencia). Ejecutar `tsc --noEmit` por proyecto: el `tsconfig.json` raíz solo referencia proyectos y no verifica por sí mismo todas las fuentes. ESLint aún debe configurarse en fase 1; el lint actual es Oxlint. Comprobar `package.json` antes de asumir qué herramientas están disponibles.

Registrar evidencia al terminar cada tarea. Detenerse tras entregar cada fase y pedir revisión antes de comenzar la siguiente. Mantener este plan hasta completar todas las casillas y aprobaciones; vaciarlo únicamente después de la aprobación final del usuario.

## Hallazgos y sugerencias

- La aplicación actual es React/TypeScript/Vite con Rive 2D; `@rive-app/react-webgl2` renderiza el personaje 2D y no introduce una escena 3D.
- La pantalla actual bloquea el scroll global y concentra la experiencia en `App`; la navegación nueva necesita adaptar esa estructura.
- El controlador existente ofrece estados y secuencias, pero la presentación requiere validar readiness, cancelación y limpieza, sin asumir que basta con exponer sus métodos.
- Tailwind, shadcn/ui, Motion, Zustand, XState, GSAP, Lenis y ESLint forman parte del stack objetivo; todavía no se han instalado por este trabajo documental.
- La configuración inspeccionada no habilita strict explícitamente. Activarlo pertenece a fase 1.
- Los colores exactos y valores visuales iniciales requieren la revisión de Home; `design.md` distingue contrato aprobado de valores iniciales propuestos.
- El plan histórico de JEV Lab queda archivado sin alterar sus casillas ni afirmar una aceptación visual retroactiva.
