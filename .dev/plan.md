# Plan: JEVLING — rediseño en cinco fases

- **Base:** [spec.md](spec.md).
- **Contratos de UI/animación:** [design.md](../design.md).
- **Estado:** plan de cinco fases aprobado el 2026-10-06. Fases 1 y 2 aceptadas al autorizar continuar; fase 3 activa desde 2026-10-07.

## Resultado de entrega

Una web con tres rutas (`/`, `/features`, `/about`), lenguaje visual aprobado por el usuario, temas claro/oscuro, ES/EN y Home interactiva. Features presenta capacidades reales en secuencias deterministas; About narra el origen de JEV en scrollytelling 2D. Cada fase es una unidad revisable, con sus propias pruebas y puerta de aprobación.

## Dependencias y orden

1. Fase 1 establece una Home que el usuario acepta visualmente; es la referencia para las demás vistas.
2. Fase 2 completa la conducta real de Home y el idioma de habla; también fija el lifecycle al navegar.
3. Fase 3 crea Features usando acciones Rive ya verificadas y el contrato de sesión de Home.
4. Fase 4 compone About con el diseño aprobado y el relato editorial.
5. Fase 5 integra las rutas, accessibility/performance y realiza la validación combinada.

No comenzar una fase posterior hasta que el usuario acepte explícitamente la entrega de la actual. Fase 1 puede recibir correcciones dentro de la misma fase y conservar la evidencia previa como antecedente.

## Fase 1 — Alinear visualmente Home y establecer la referencia

**Propósito:** convertir la infraestructura/implementación inicial en la referencia visual. Esta fase se cerró tras las revisiones y la autorización del usuario para continuar; el registro histórico permanece en `task.md`.

**Estado de partida:** otro modelo implementó shell, navegación, preferencias, tokens y Home; automatización reportada como verde. El usuario indicó que el resultado no coincide con su intención. No descartar el trabajo ni asumir que ya acepta el resultado. El árbol de trabajo contiene cambios locales extensos, que se deben preservar.

**Secuencia de trabajo:**

1. Leer `task.md`, este plan, `spec.md`, `design.md`, evidencia de fase 1 y estado/diff actuales; identificar qué archivos ya modificó el modelo anterior.
2. Arrancar la app/build preview disponible y revisar Home en 1440×900 y 390×844, claro y oscuro. Esperar a que el personaje Rive esté cargado. Usar las capturas existentes como base, no como aprobación.
3. Presentar al usuario una lectura visual específica —composición del personaje, escala/encuadre, jerarquía título→input→HUD, densidad, cabecera y espacio móvil— y pedir/registrar las diferencias que quiere corregir. No iniciar una reinterpretación completa ni inventar el cambio solicitado.
4. Acordar un delta visual acotado con el usuario. Si el feedback cambia paleta o un requisito de producto, actualizar `spec.md`/`design.md` y confirmar las implicaciones antes de implementarlo. Si solo cambia composición, mantener la spec.
5. Ajustar los módulos existentes de Home, CSS/tokens y componentes de UI; conservar respuestas, decisiones, Rive y controles ya implementados. Mantener las rutas Features/About como placeholders sencillos hasta sus fases.
6. Verificar variantes visuales, preferencias y comportamiento responsive. No cerrar fase por el hecho de que pasen pruebas automatizadas: requiere aprobación visual y uso de teclado/móvil señalado en `task.md`.

**Seams y archivos existentes:**
- `src/App.tsx` — shell, ruta, preferencias globales y montaje de página.
- `src/pages/HomePage.tsx` — composición interactiva y jerarquía de Home.
- `src/components/SiteHeader.tsx` — navegación, idioma y tema.
- `src/components/BrainHUD.tsx`, `ContextWhisper.tsx`, `Character.tsx` — HUD, input y personaje.
- `src/App.css`, `src/index.css`, `src/styles/tokens.css` — composición y tokens efectivos.
- `src/i18n/`, `src/stores/preferencesStore.ts`, `src/navigation/routes.ts` — estado ya introducido en la fase inicial.
- `tests/`, `eslint.config.js`, `vite.config.ts`, `index.html` — validación y bootstrap existente.
- Evidencia actual: `.dev/evidence/phase-1/`.

**Aceptación:**
- El usuario reconoce la composición como la dirección que quería y aprueba Home, en escritorio/móvil y claro/oscuro.
- Jev actual sigue visible y no se rediseña su asset/animación.
- Texto corto, input descubrible, HUD compacto; los controles siguen accesibles con layout móvil reducido.
- Cambio de tema/idioma conserva la página/estado básico y no desmonta Rive accidentalmente.
- ESLint, typechecks por proyecto, Vitest, build y Playwright; capturas y limitaciones anotadas en `task.md`.

**Puerta:** no empezar fase 2 sin aprobación explícita de Home. Si el usuario pide ajustes, seguir en fase 1 y devolver nueva evidencia.

## Fase 2 — Completar Home funcional y respuestas bilingües

**Propósito:** alinear la interfaz localizada con conducta real, manejar fallos y mantener sesión mientras Home se oculta por navegación.

**Secuencia de trabajo:**

1. Revisar el lifecycle de `HomePage` al cambiar de ruta. Acordar el dueño de sesión: shell/provider persistente o store de sesión; no duplicar estado de decisión entre React/Zustand.
   **Acuerdo de fase 2:** shell conserva Home montada después de la primera visita; la sesión sigue dentro de Home en memoria. Suspender explícitamente actividad al ocultarse, sin duplicación en Zustand.
   Al volver de Features/About, reanudar sin consultar IA; solo ausencia real de pestaña/ventana puede producir el evento de retorno previo.
2. Auditar traducciones tipadas ES/EN para entrada, HUD, diagnósticos, errores, estados, nombres accesibles y habla.
3. Extender el contrato del habla para incluir locale ES/EN validado en `/api/talk`; actualizar la instrucción al modelo sin enviar preferencias/secretos fuera del contrato.
4. Asociar idioma con la generación de SSE: cancelar request anterior en cambio de idioma/entrada y rechazar fragmentos/cierre obsoletos. No traducir el texto original ni alterar retroactivamente historial existente.
   **Continuación acordada:** cambio de idioma durante habla regenera automáticamente el mismo mensaje en el idioma nuevo. Ocultar Home cancela sin replay al volver. «Borrar contexto» elimina toda la conversación en memoria, no la personalidad.
5. Preservar contexto conversacional en memoria al navegar a Features/About. Suspender sensor, scheduler, red y actividad de Home oculta; al volver, reanudar sin respuesta vieja.
6. Comprobar fallback de decisión local y error de habla diferenciado, breve y localizado. El error de habla no debe fingir que Jev respondió.
7. Cubrir entrada vacía, máximo de texto/historial, abort, fallo de red, falta de proveedor, cambio rápido de idioma y back/forward.

**Seams previstos:** `src/hooks/useCreatureBrain.ts`, `src/creature/brain/speechClient.ts`, `speechProtocol.ts`, `api/talk.ts`, estado de sesión bajo `src/stores/` si se requiere, `src/pages/HomePage.tsx`, `src/i18n/` y `tests/`.

**Aceptación:** respuestas nuevas siguen idioma elegido; no se mezclan generaciones; estado de Home conserva contexto en memoria; offscreen no genera decisiones; local fallback disponible; pruebas real/simulada distinguidas.

**Puerta:** detener y pedir aprobación funcional antes de construir Features.

## Fase 3 — Features determinista con demostraciones

**Propósito:** enseñar las capacidades de Jev viéndolo actuar; contenido breve y fijo.

**Invariante de determinismo:** para capítulo, idioma y progreso lógico iguales, misma acción, datos, texto y secuencia temporal. No se solicita IA, aleatoriedad, sensores reales ni datos de Home. La demostración no actualiza personalidad/contexto reales.

**Secuencia de trabajo:**

1. Verificar en el asset/controlador actual qué reacciones, respuestas, morphs, habla y estados pueden ejecutarse. Mapear los ocho capítulos a acciones reales; lo no demostrable debe tener alternativa DOM descriptiva, no una simulación engañosa.
2. Crear catálogo tipado ES/EN con ID estable, texto corto, fuente de datos fija, acciones y duraciones tokenizadas. Etiquetar toda lectura sintética como ejemplo.
3. Implementar la máquina XState de carga→preparación→reproducción→fin/interrupción/error. Esperar readiness de Rive; toda acción previa se cancela al cambiar capítulo/repetir.
4. Añadir scroll-to-chapter, escenario principal, progreso y controles prev/next/replay utilizables con teclado. El control explícito funciona sin scroll.
5. Asignar GSAP/ScrollTrigger a pinning/timeline y Motion a controles/elementos separados. Lenis solo como instancia global, compatible con scroll nativo y reduced motion. Importar presentación y dependencias de forma lazy.
6. Añadir aislamiento de Home, cancelación al ocultar ruta/pestaña, reanudación definida, estado de error y alternativa textual. Reducir o retirar pinning bajo `prefers-reduced-motion`.
7. Verificar repetibilidad mediante tests de catálogo y scheduling sin reloj/red aleatorios; testear reemplazos rápidos, teclado, mobile, locale/theme, desmontaje y visibilidad.

**Seams previstos:** `src/pages/FeaturesPage.tsx`, `src/features/showcase/`, `src/navigation/routes.ts`, tokens/motion adaptors y tests de feature. No extraer ni copiar bytes del asset Rive.

**Aceptación:** ocho capítulos navegables; secuencias reproducibles; no API calls; salida estable en ES/EN; sin cola ni animaciones solapadas; capacidades no disponibles no se presentan como reales; contenido sigue entendible sin movimiento.

**Puerta:** entregar recorrido y evidencia; esperar aprobación antes de About.

## Fase 4 — About scrollytelling

**Propósito:** presentar el relato original de JEV con escenas de alto impacto y poco texto, sin inventar historia.

**Secuencia de trabajo:**

1. Derivar guion ES/EN de `docs/jev-story.md`, manteniendo cinco beats: pregunta, experimento, evolución técnica, autor Abdair Coca y visión futura.
2. Separar texto principal breve y detalles opcionales (explicación del proceso), asegurar lectura lineal cuando efectos estén desactivados.
3. Diseñar escenas 2D mediante DOM/SVG y el Jev actual: apertura/escape de caja, capas de percepción-comportamiento-cuerpo, composición autoral y cierre.
4. Usar GSAP/ScrollTrigger en el recorrido y Motion en controles autónomos; aplicar tokens, Lenis global y misma política de reduced-motion.
5. Adaptar escenas a móvil y ancho corto; no depender de pinning en reduced motion. Mantener escena/progreso al cambiar idioma/tema.
6. Añadir teclado, skip-to-content, enlaces de vuelta a Home, focus management y Playwright ES/EN, light/dark, desktop/mobile.

**Seams previstos:** `src/pages/AboutPage.tsx`, `src/features/story/`, `docs/jev-story.md`, traducciones, CSS/tokens y pruebas de ruta.

**Aceptación:** autoría correcta; evolución versus visión futura claramente diferenciadas; cinco escenas; texto accesible y breve; revisión visual de idioma, temas y móvil aprobada.

**Puerta:** detener y pedir revisión antes de la integración final.

## Fase 5 — Integración, accesibilidad y rendimiento

**Propósito:** hacer de las tres rutas un sistema coherente, accesible, resiliente y medido.

**Secuencia de trabajo:**

1. Completar URL directa, reload, back/forward, restauración de scroll, offset/focus en cabecera y focus al navegar explícitamente.
2. Verificar estado de Home, tema, idioma y capítulo al cruzar vistas; comprobar que hidden route cancela/suspende lo que no debe correr.
3. Auditar keyboard-only, focus order, ARIA, estados colapsados, contraste AA, touch targets, zoom/reflow, teclado móvil y contenido DOM alternativo.
4. Ejecutar matrix Playwright: tres rutas × dos idiomas × dos temas; desktop/mobile; keyboard/reduced-motion; fallback y errores; Rive readiness; consola y cleanup.
5. Medir build chunks, lazy-load y LCP; medir frame pacing en dispositivo/condiciones indicadas. No reclamar móvil físico desde emulación.
6. Revisar rutas Vercel sin interceptar `/api/*`, seguridad server-only y no añadir historial remoto.
7. Actualizar arquitectura/interacción/README/design según implementación efectiva; registrar resultados/limitaciones en `task.md`.

**Seams previstos:** `src/App.tsx`, `src/navigation/`, `src/stores/`, `vercel.json`, tests e índices de `README.md`/`docs/`.

**Aceptación:** criterios completos de spec; rutas recargables; sin actividad oculta o fugas; typechecks ESLint Vitest build Playwright; rendimiento medido y límites informados; usuario aprueba experiencia final.

**Puerta final:** presentar resumen, evidencias y limitaciones; solo tras aprobación final vaciar el contenido de los tres SDD files, preservando los archivos.

## Contratos entre fases

- `spec.md` define el objetivo y criterios; cambios al producto se aprueban allí antes de alterar fases afectadas.
- `design.md` gobierna visual, tokens, animación 2D, accesibilidad y verificación; implementada la fase 1, valores reales CSS son autoridad.
- Este `plan.md` define el orden y el resultado esperado de las fases, no estado de checkboxes.
- `task.md` es la única fuente de fase activa, checks ejecutados, evidencia, blockers y aprobación de entregas.
- El runtime y `package.json` son autoridad de comportamiento y herramientas actuales; la documentación debe señalar explícitamente si una fase es objetivo o implementada.
- El usuario aprobó cinco resúmenes y el plan original; tras las revisiones de Home/HUD autorizó pasar a fase 3. About espera aprobación de la entrega de Features.
