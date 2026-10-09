# Plan: JEVLING — rediseño en cinco fases

- **Base:** [spec.md](spec.md).
- **Contratos de UI/animación:** [design.md](../design.md).
- **Estado:** plan de cinco fases aprobado el 2026-10-06. Fases 1–3 aceptadas al autorizar continuar; fase 4 activa desde 2026-10-07 (host local).

## Tarea independiente — microcommits y publicación frontend

Autorizada el 2026-10-09: revisar/preservar el trabajo pendiente → añadir build estático con decisiones locales sin requests API → verificar → guardar unidades lógicas en microcommits → desplegar el artefacto prebuilt en `jev-bot` → comprobar rutas, Rive y UATF en la URL publicada. No cambia el orden ni las aprobaciones pendientes de las cinco fases.

**Continuación autorizada:** activar el backend existente mediante deploy ordinario, verificar arranque Node ESM y una decisión real desde Home; mantener la evidencia estática como antecedente. Corregir incompatibilidades de empaquetado observadas sin cambiar las decisiones, UI ni proveedores. No inicia fase 5.

## Ampliación de Inicio — demo de inscripción UATF

**Prioridad actual:** entregar la funcionalidad UATF solicitada, conservando la revisión pendiente del rediseño. Este addendum no abre la fase 5 ni reemplaza las fases/evidencias anteriores.

**Aprobaciones:** especificación consolidada aprobada mediante «aprobado»; resumen de una única fase aprobado mediante «hazlo»; plan completo aprobado con «si apruebo». Implementación autorizada de la fase UATF única.

### Fase UATF única — recorrido visual completo

**Propósito:** desde una intención escrita en Inicio, abrir el formulario de Ingeniería Informática · UATF, completar nombre/celular, confirmar localmente con Jev y volver a Inicio. La aceptación es de demostración; los datos no salen de la memoria temporal del formulario.

**Punto de partida:** Home conserva su canvas y sesión al navegar. `ContextWhisper` entrega el texto a `HomePage` mediante `onSubmit`; `useCreatureBrain` admite suspensión explícita de scheduler/habla. `Character` ofrece readiness/error y un controlador con reacciones temporales. Motion, TypeScript, Vitest y Playwright están instalados. Hay cambios locales previos extensos que deben preservarse.

#### Secuencia de implementación

1. **Aislar intención y validación.** Crear `src/features/enrollment/` con tipos estrictos, copias ES/EN y funciones puras. Normalizar tildes, mayúsculas, espacios y puntuación para detectar intenciones claras de inscripción/interés en la carrera; excluir negaciones y referencias explícitas a registros ajenos a la carrera. Validar nombre obligatorio sin imponer un alfabeto ASCII ni un número fijo de apellidos. Para celular, retirar espacios/guiones y aceptar ocho dígitos con `+591` opcional; rechazar letras, signos inesperados y longitudes incorrectas.
2. **Crear el flujo local.** Un único dueño del estado de inscripción controla apertura, edición, confirmación y cierre. Nombre, teléfono y errores pertenecen a esa sesión efímera, no al cerebro, historial ni store persistido. Cerrar o recibir `active=false` por navegación limpia los datos y cancela trabajo pendiente. Cambiar idioma/tema conserva el llenado. Confirmar repetidamente no crea celebraciones superpuestas ni esperas falsas de red.
3. **Conectar solo la frontera de Inicio.** Sustituir el paso directo de `brain.submitContext` por un handler que abre inscripción si reconoce intención, o delega el resto de mensajes al comportamiento actual. Durante la experiencia, suspender cerebro/sensores conversacionales mientras se mantiene activo el mismo Character visible. Comenzar la coreografía después de la suspensión para que el cleanup del cerebro no cancele la bienvenida. Evitar que entrar/salir del formulario se interprete como retorno tras ausencia y dispare IA. El HUD y el input conversacional dejan de ser interactivos mientras está abierto el formulario, recuperando su estado al cerrar; navegación y preferencias continúan utilizables.
4. **Construir el formulario accesible.** Una sección con título institucional, dos campos simultáneos, mensajes asociados mediante ARIA, botón «Confirmar datos» y cierre visible. Usar input de texto para nombre e input `tel`/teclado numérico para celular, nunca `type=number`. Validar en confirmación y corregir errores sin borrar texto; enfocar el primer campo inválido. Escape/cierre regresan al input de Inicio cuando esa ruta sigue activa. La UI debe funcionar sin esperar readiness de Rive o el fin de la animación.
5. **Añadir coreografía acotada.** Motion gobierna la posición/escala del wrapper actual de Jev, la aparición del formulario y las partículas decorativas de entrada/aceptación; Rive conserva el dibujo y sus reacciones existentes. Una breve estela violeta/magenta descubre el formulario; una expansión breve acompaña la celebración. Reutilizar una reacción temporal como Hello al abrir y Flower/yes al confirmar, verificando visualmente cuál expresa mejor el resultado. Usar tokens y un número acotado de partículas DOM/SVG, sin importar el motor de Story, añadir canvas de personaje ni loops ambientales. Readiness tardío no debe ejecutar una bienvenida sobre una confirmación/cierre posterior.
6. **Componer móvil y fallbacks.** En escritorio, Jev y formulario comparten la escena; en móvil, Jev encima y más compacto mientras un campo tiene foco y el teclado reduce el viewport. Mantener campos, errores y botones alcanzables, permitiendo desplazamiento interno de la experiencia cuando la altura lo requiera. Estilos nuevos bajo selectores de inscripción; Home cerrada mantiene su composición. Reduced motion elimina desplazamientos/partículas; carga fallida de Rive conserva formulario y confirmación textual. Ocultar pestaña pausa/cancela decoración sin borrar el formulario, y salir de Inicio lo cierra.
7. **Verificar y documentar la entrega.** Ejecutar tests de comportamiento y navegador, inspeccionar capturas, revisar diff y registrar comandos/resultados/limitaciones en `task.md`. Actualizar el contrato actual de interacción/arquitectura únicamente para explicar la nueva experiencia implementada. Presentar el flujo completo para revisión visual y detenerse.

#### Archivos y responsabilidades previstos

| Archivo o área | Responsabilidad |
|---|---|
| `src/pages/HomePage.tsx` | Interceptar la intención, componer el formulario con el mismo Character y coordinar actividad/readiness/foco. |
| `src/features/enrollment/enrollmentIntent.ts` | Detección local conservadora y bilingüe. |
| `src/features/enrollment/validation.ts` | Validación y normalización de los dos campos, sin efectos externos. |
| `src/features/enrollment/useEnrollment.ts` | Estado efímero y transiciones/cancelación del flujo. |
| `src/features/enrollment/EnrollmentExperience.tsx` | Formulario, errores, confirmación y controles accesibles. |
| `src/features/enrollment/copy.ts`, `enrollment.css` | Texto ES/EN y tokens/estilos acotados a la inscripción. |
| `src/features/enrollment/EnrollmentParticles.tsx` si resulta necesario | Decoración breve, separada de campos y datos; un único dueño Motion. |
| `tests/enrollment*.test.ts*`, pruebas de Home pertinentes | Intención, validación, aislamiento, limpieza y continuidad. |
| `.dev/evidence/enrollment/` | Harness por bloques, resultados y capturas nuevas. |

La lista describe responsabilidades; no exige crear módulos triviales si una composición más pequeña mantiene esos límites. No ampliar `api/*`, stores persistentes, dependencias, assets ni las rutas Features/About. Cualquier cambio inevitable fuera de la frontera descrita debe justificarse antes de ampliarla.

#### Aceptación y verificaciones

- **Intención:** ejemplos ES/EN y variaciones aceptadas; negaciones, mensajes ordinarios y registro explícito en otro servicio no abren el formulario.
- **Datos:** nombre con tildes/compuesto, vacíos, celular de 7/8/9 dígitos, `+591`, espacios/guiones y caracteres inválidos. Los errores son corregibles y confirmar inválidos no avanza.
- **Lifecycle:** cerrar/reabrir vacío, navegar fuera/volver vacío, locale/theme conservan campos abiertos; misma instancia de Jev; ausencia de callbacks o reacciones obsoletas tras cierre/reemplazo. Suspensión de habla/decisión previa y regreso a Home sin nueva solicitud por la transición.
- **Aislamiento:** valores de los campos ausentes de cuerpos de requests, localStorage/sessionStorage, URL e historial de conversación. La apertura y confirmación locales no consultan proveedores.
- **Navegador:** escritorio 1440×900 y móvil 390×844 con ambos temas e idiomas; reflow a 320 px y altura reducida; teclado/Enter/Escape/foco, reduced motion, asset bloqueado y cambios de ruta. Probar pantalla con teclado emulado y declarar si falta móvil físico.
- **Checks:** `npm exec -- tsc --noEmit -p tsconfig.app.json`, `tsconfig.node.json`, `tsconfig.api.json` y `tsconfig.tests.json` por separado; `npm run lint`; `npm exec -- vitest run --maxWorkers=1`; `npm run build`; bloques cortos Playwright; `git diff --check`.
- **Revisión:** comparar Home antes/después con inscripción cerrada, comprobar alcance del diff e inspeccionar capturas de entrada, llenado, error, aceptación y cierre. No atribuir a la nueva entrega los tests/capturas del pulido anterior.

**Riesgos conocidos:** Home no se desmonta al navegar; el cleanup del cerebro detiene acciones del controlador; el teclado móvil reduce el espacio disponible; callbacks de Rive pueden llegar después de cerrar. Resolverlos dentro del coordinador local y cubrirlos con pruebas, sin refactorizar el runtime general.

**Puerta:** aprobación de este plan completo → implementación de la única fase → entrega y revisión visual explícita. La aprobación UATF no declara aprobadas las entregas anteriores del rediseño. Mantener los tres SDD mientras exista trabajo/revisión pendiente.

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

**Revisión aprobada — vórtice de proyectos (2026-10-08):** actualizar guion/contratos; preparar posiciones de imágenes y estrella fuera del render; implementar Canvas 2D con ticker GSAP existente y densidad responsive; integrar progreso continuo reversible, holds y revelación de Character; verificar lifecycle, errores, imágenes, ambos temas/idiomas y movimiento reducido. El canvas posee partículas; GSAP posee wrapper/progreso/revelación; Motion posee controles y wrapper de lectura; Rive conserva el personaje. Sin dependencias nuevas. Muestreo solo de los tres recursos de story, nunca del Rive. La entrega se detiene para revisión de fase 4.

**Pulido solicitado de la entrega:** primero reducir chrome y ampliar Jev en Home; después retirar navegación de diapositivas y texto redundante en Features/About; suavizar acciones de scroll y trayectoria con inercia; añadir deformación reversible de partículas y componer móvil con ilustración sobre texto. Verificar integración y registrar evidencia nueva; sigue siendo revisión de fase 4, no apertura de fase 5.

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
- El usuario aprobó cinco resúmenes y el plan original; tras aprobar Features y la retirada del cursor decorativo autorizó implementar About. La integración final espera aprobación de fase 4.
