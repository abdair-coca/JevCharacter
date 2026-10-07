# Tarea: rediseño web de JEVLING

Este es el handoff vivo de la feature. **Antes de continuar, leer `spec.md`, `plan.md`, este archivo y `../design.md`.** `task.md` es la única fuente de fase activa, checks, evidencia, bloqueos, aprobaciones y siguiente acción.

## Retoma aquí

- **Fase activa:** Fase 3 — Features determinista con demostraciones.
- **Estado:** fase 3 implementada y verificada; pendiente revisión visual/funcional del usuario. Fase 2 aceptada con «ahora continua con la fase 3», incluida revisión del HUD/Home sin scroll. Teclado en dispositivo físico continúa pendiente como limitación de evidencia.
- **Siguiente acción exacta:** presentar/recibir revisión de Features libre en `http://127.0.0.1:5173/features` con [capturas y resultados](evidence/phase-3/README.md). No comenzar About hasta aprobación.
- **No iniciar fase 4 hasta:** revisión y aprobación de la entrega de fase 3.
- **Estado actual del código:** la implementación y evidencias del otro modelo siguen en un árbol de trabajo con cambios sin commit. Preservarlos; no resetear, limpiar, stagear, commitear ni reemplazar fuentes como parte de esta migración SDD.

## Migración SDD

- [x] Separar requisitos y aceptación aprobados en `spec.md`.
- [x] Expandir las cinco fases aprobadas en secuencias de implementación dentro de `plan.md`.
- [x] Mover el snapshot anterior de `.dev/TASK.md` a `archive/redesign-TASK-2026-10-06.md` y usar `task.md` como ledger activo. Windows no permite que ambos nombres distinguidos solo por mayúsculas coexistan.
- [x] Actualizar instrucciones de agentes, autoridad de diseño, README, evidencia e historia para enlazar el SDD.
- [x] Verificar enlaces, coherencia de estados/fases, referencias legadas y preservación del árbol de trabajo.

### Verificación de la migración SDD — 2026-10-06

| Comprobación | Resultado |
|---|---|
| Validador temporal `node "C:\Users\abdai\AppData\Local\Temp\opencode\validate-jev-sdd.mjs"` | PASS: 10 documentos, 82 enlaces/anclas locales, tres archivos SDD existentes, cinco fases en el plan y fase 1 activa. |
| `git diff --check -- .dev AGENTS.md README.md design.md docs` | PASS, sin errores de whitespace; Git informó avisos de normalización LF/CRLF de Windows. |
| Referencias al antiguo `.dev/TASK.md` | Solo se conservan como referencia histórica en este registro de migración y en el snapshot archivado. |
| Rename para Windows | `core.ignorecase=true`; se hizo rename Git vía ruta temporal para registrar `.dev/task.md` en minúsculas. El rename está stageado; su contenido actualizado y los demás documentos permanecen en el worktree. No se creó commit. |
| Código de fase 1 | Sin cambios en esta migración; se conservan las modificaciones preexistentes del otro modelo. |

Skill `feature-planner` actualizada a v1.1 con la plantilla `assets/SDD-template.md`; `.atl/skill-registry.md` refleja el nuevo flujo. Su ruta global no forma parte del repositorio de la aplicación.

## Snapshot de la implementación

Observaciones de la fuente revisada al migrar el SDD; no equivalen a aprobación visual:

- `src/App.tsx` posee cabecera, rutas, metadata de tema/idioma y lazy loading. `src/navigation/routes.ts` gestiona `/`, `/features`, `/about` y el historial.
- `src/pages/HomePage.tsx` monta el Rive existente, input, HUD, diagnósticos y sensor pointer. El estado local del cerebro se desmonta al salir de Home.
- `src/pages/PendingPage.tsx` es un placeholder sencillo para Features/About; las presentaciones reales aún no están implementadas.
- Preferencias de idioma/tema y tokens están en `src/stores/preferencesStore.ts`, `src/i18n/` y `src/styles/tokens.css`.
- El árbol activo conserva modificaciones sin commit en app/API/docs/config/tests y nuevos módulos de navegación, preferencias, traducciones, UI, estilos y `.dev/evidence/phase-1/`. Son trabajo del modelo anterior; conservarlos al corregir el diseño.
- Snapshot anterior de TASK: [archive/redesign-TASK-2026-10-06.md](archive/redesign-TASK-2026-10-06.md). Antecedente JEV Lab: [archive/jev-lab-plan-2026-10-06.md](archive/jev-lab-plan-2026-10-06.md).

## Fase 1 — Alineación visual de Home

El usuario aprobó la dirección y, tras las revisiones registradas, autorizó avanzar a fase 2. El historial siguiente conserva los resultados y pendientes de cada revisión; no altera los límites de evidencia física.

### Checklist

- [x] Preservar implementación actual y revisar el árbol antes de editar.
- [x] Registrar seams de arquitectura y ubicar evidencias existentes.
- [x] Iniciar preview y revisar Home a 1440×900 y 390×844 en claro/oscuro; comparar con la matriz de capturas heredada.
- [x] Mostrar composición actual y preguntar qué partes no reflejan la intención del usuario; registrar diferencias antes de editar.
- [x] Acordar un delta visual acotado. Actualizar `spec.md`/`design.md` solo si el usuario aprueba un cambio de requisito/contrato.
- [x] Refinar composición existente sin sustituir a Jev/Rive, perder comportamiento vigente ni tocar trabajo ajeno.
- [x] Revisar viewport corto/reflow, toggles de tema/idioma, foco, teclado, touch y acceso al input. Emulación; teclado físico pendiente.
- [x] Repetir typechecks, ESLint, Vitest, build y Playwright aplicables; capturar resultados nuevos y compararlos con la línea base.
- [x] Presentar resultados/limitaciones y recibir autorización para continuar con la siguiente fase.

### Controles orgánicos — 2026-10-07

**Dirección aprobada:** el usuario pidió input/HUD visualmente más impactantes y con animaciones; eligió aspecto orgánico como Jev y presencia suave también en reposo. Se conserva la paleta, `prove2.riv`, su escala `1.9`, centrado del input y HUD lateral/arriba-derecha según ancho.

**Implementación:** input con superficie de volumen suave, señal orgánica, etiqueta visible, borde/halo violeta, señal elástica al enfocar y respuesta al enviar. El formulario permanece geométricamente estable. HUD con acción y confianza destacadas, origen real, despliegue mediante layout de Motion, métricas secuenciadas y barras basadas en valores reales. La respiración usa atención real y dura 4,8 s en reposo / 1,6 s durante `deciding`; abrir el HUD no aumenta artificialmente la atención. No hay animación numérica que invente progreso/confianza.

**Lifecycle:** `useAmbientMotion` combina IntersectionObserver, visibilidad y movimiento reducido. Fuera de viewport/pestaña la decoración queda estática; sin IntersectionObserver se usa fallback estático. Motion 14 captura su preferencia de movimiento reducido al montar, por lo que `useReducedMotionPreference` añade suscripción nativa reactiva con cleanup; también la usa Character para pausar al cambiar esa preferencia. Sin nuevos loops JS por frame ni procesamiento de canvas.

| Comprobación ejecutada | Resultado |
|---|---|
| `npm exec -- tsc --noEmit -p tsconfig.app.json` | PASS. |
| `npm exec -- tsc --noEmit -p tsconfig.node.json` | PASS. |
| `npm exec -- tsc --noEmit -p tsconfig.api.json` | PASS. |
| `npm exec -- tsc --noEmit -p tsconfig.tests.json` | PASS. |
| `npm run lint` | PASS, cero advertencias. |
| `npm exec -- vitest run --maxWorkers=1` | PASS: 11 archivos / 51 tests. Incluye preferencia reduced-motion en vivo, pausa/lifecycle, fallback sin observer, reemplazo de contexto y accesibilidad del panel al cerrarse. |
| `npm run build` | PASS. Shell 344,30 kB / gzip 109,62; CSS 34,05 / 7,55; Character 211,49 / 59,85; Motion features 85,54 / 28,34. |
| `node ".dev/evidence/phase-1/organic-controls/verify.mjs"` | PASS: 100 checks / 16 capturas. Cero errores y cuatro avisos WebGL de ReadPixels al capturar. |
| Contraste computado | Texto secundario ≥4,79:1; bordes de controles ≥3,60:1 contra fondo. Roles y temas en `results.json`. |
| Revisión Standards / Spec | Sin bloqueos tras corregir escala del formulario, énfasis por expansión y fallback sin observer; se reforzó evidencia de posición móvil y duración/intensidad reales. |
| Validación documental y `git diff --check` | PASS: nueve documentos, 82 enlaces/anclas y render directo. Sin errores de whitespace; normalización LF/CRLF advertida por Git. Validador temporal `validate-jev-home-revision.mjs` fuera del repositorio. |

**Peso:** sin dependencias nuevas. Se cambió el conjunto diferido de Motion de `domAnimation` a `domMax` para la proyección de layout del HUD, evitando animar height/width. El JS+CSS de Home aumenta aproximadamente 16,51 kB gzip frente a la revisión anterior: +13,84 de features, +1,32 del shell y +1,09 de CSS. Incluye funciones de interacción del conjunto de Motion aunque no todas se usan; no se afirma un coste aislado por componente ni mejora de FPS.

**Incidencias de verificación:** la primera prueba reprodujo que reduced-motion no actualizaba el hook instalado; se corrigió y añadió regresión. Hubo una ejecución interrumpida por el usuario, un timeout acompañado de pérdida de contexto WebGL que no se reprodujo en la repetición, y una espera de 12 s insuficiente para readiness de Rive; el harness espera ahora hasta 45 s. La corrida final completa pasó. El diagnóstico descartado no es evidencia visual final.

**Límites:** APIs, cambio de visibilidad y teclado móvil se simularon; viewport y preferencia de movimiento se emularon. No hay medición de móvil físico, disponibilidad de IA ni LCP/FPS. Las capturas cubren claro/oscuro, escritorio/móvil, reposo, foco, detalles EN y decisión ES. La aceptación visual del usuario sigue pendiente.

### Nueva exportación y ajuste de tamaño

- El usuario aportó `public/rive/prove2.riv` para corregir el fondo en claro. Se cambió únicamente la referencia en `Character.tsx`, preservando los tres archivos `.riv` y el render directo; no se modificaron sus bytes ni se hizo procesamiento de píxeles.
- Tras indicar «ya funciona bien», pidió que el personaje fuera un poco más grande: `--character-canvas-scale` pasa de `1.72` a `1.9` (+10,5 %), sin cambiar el layout del input/HUD. No equivale a aprobación final de fase 1.
- `npm run build`: PASS tras el cambio de asset y de escala. CSS 27,45 kB / gzip 6,46; shell 338,90 / 108,30; Character 211,49 / 59,85.
- `node ".dev/evidence/phase-1/prove2/verify.mjs"`: PASS, 36 checks y 19 capturas. Carga de la nueva URL, un canvas, controles de diagnóstico, las tres formas, SSE simulado, navegación, preferencias sin remontaje y pointer/touch sin IA. Cero errores de aplicación, cuatro advertencias WebGL durante capturas. No es prueba de proveedor real ni móvil físico.
- Inspección de las capturas finales: en claro desaparece el disco oscuro anterior; se conserva el halo violeta/sombra y el personaje queda completo con el aumento. La primera prueba capturó todavía el disco oscuro; la compilación posterior al feedback del usuario y las capturas regeneradas muestran la exportación actual corregida. No se atribuye esa diferencia al cambio de escala.
- Evidencia actual: [prove2/README.md](evidence/phase-1/prove2/README.md). Las pruebas anteriores se conservan como historial. Typechecks/tests/ESLint previos no se repitieron por este delta de ruta y token; el build sí verifica app/node/API y se ejecutó la prueba de integración pertinente.

### Revisión solicitada — 2026-10-06

**Delta confirmado:** el usuario aclaró que «centrado verticalmente» significa input debajo de Jev, centrado en el eje de la página. HUD lateral en escritorio y compacto arriba a la derecha en móvil. Botón sol/luna sin opción «Sistema», manteniendo detección inicial y override persistido. ES/EN conserva ambas opciones con indicador animado.

**Integración acordada:** el usuario precisó render directo, máscara CSS original y escala `1.72`; eligió conservar `prove1.riv` pese a existir `character.riv`. La investigación encontró una técnica de matte distinta en el comparador estático del laboratorio, que no era la solicitada: se retiró íntegramente la prueba temporal de procesamiento por píxeles. La entrega usa un solo canvas, sin getImageData, BFS, copia de frames ni modificaciones del `.riv`. Se quitó el óvalo decorativo; el wrapper vuelve a ser cuadrado y limita su tamaño por altura para que la máscara no tenga cortes rectos. El fondo interno de `prove1.riv` sigue visible en claro: la restauración de CSS no equivale a eliminarlo.

| Comprobación | Resultado nuevo |
|---|---|
| `npm exec -- tsc --noEmit -p tsconfig.app.json` | PASS. |
| `npm exec -- tsc --noEmit -p tsconfig.node.json` | PASS. |
| `npm exec -- tsc --noEmit -p tsconfig.api.json` | PASS. |
| `npm exec -- tsc --noEmit -p tsconfig.tests.json` | PASS. |
| `npm run lint` | PASS, cero advertencias. |
| `npm exec -- vitest run --maxWorkers=1` | PASS: 10 archivos, 46 tests. Se agregaron dos pruebas del control de preferencias: automático→manual y selección ES/EN. |
| `npm run build` | PASS. Shell JS 338,90 kB / gzip 108,30; Character 211,49 / 59,85; Motion 37,79 / 14,50; CSS 27,45 / 6,46. Sin dependencias añadidas para esta revisión. |
| `node ".dev/evidence/phase-1/revision/verify.mjs"` | PASS: 76 comprobaciones y ocho capturas. Cero errores; cuatro avisos WebGL `GPU stall due to ReadPixels` del navegador al capturar. |
| Validador temporal `validate-jev-home-revision.mjs` y `git diff --check` | PASS: seis documentos, 48 enlaces/anclas locales y render directo; sin errores de whitespace. Script en el directorio temporal de OpenCode. |

El harness nuevo verifica un canvas, máscara/escala, wrapper proporcional, centrado geométrico del input, ubicación del HUD, ambos temas/idiomas, sistema implícito, persistencia, teclado/foco, continuidad de canvas/borrador, touch, viewport 390×420, reflow 320px y movimiento reducido. API interceptada sin solicitudes desde controles. [Evidencia y capturas](evidence/phase-1/revision/README.md); la matriz previa se conserva como antecedente y su harness antiguo todavía espera un dropdown.

**Pendientes de aprobación:** integración visual en claro con el fondo interno conservado, tamaño del personaje, composición y controles; teclado en móvil físico. No se midieron LCP/FPS ni se validó proveedor real. Fase 1 permanece abierta.

### Evidencia heredada del otro modelo

El modelo anterior registró resultados en [`.dev/evidence/phase-1/`](evidence/phase-1/README.md). Son evidencia heredada, no una repetición de este agente ni aceptación del usuario.

| Comprobación | Resultado previamente reportado | Interpretación actual |
|---|---|---|
| TypeScript app/node/API/tests | PASS con strict | Reportado por modelo anterior; repetir tras cambios visuales. |
| ESLint | PASS, cero warnings | Reportado por modelo anterior. |
| Vitest | 9 archivos / 44 tests PASS | Reportado por modelo anterior. |
| Build | PASS; chunks separados documentados | Reportado por modelo anterior. |
| Harness navegador | 70 checks, 8 capturas de matriz y vistas de viewport corto/movimiento reducido | Emulación Chromium 153; no implica prueba en móvil físico. |
| Contraste | Roles principal, secundario, botón y foco por encima de objetivos registrados | Reportado en `evidence/phase-1/contrast.json`; conservar si no cambian tokens. |
| Lint/audit | ESLint PASS; audit de producción sin vulnerabilidades | Reportado por modelo anterior. |
| Revisión visual / teclado físico en móvil | Pendiente | El usuario dice que la composición no corresponde a lo que quería; es el bloqueo activo. |

## Fase 2 — Aceptada para avanzar

**Acuerdos confirmados:** Home permanece montada en memoria después de visitarla, con actividad suspendida al ocultarse. Cambiar ES/EN durante habla cancela y regenera el mismo mensaje; nunca mezcla fragmentos ni duplica historial. «Borrar conversación» borra contexto, intercambios y caché que contenía texto, conservando personalidad/preferencias/cuotas. Volver de Features/About reanuda sin consultar IA; la ausencia real de pestaña/ventana conserva su comportamiento de retorno por separado.

- [x] Inspeccionar contratos actuales y registrar decisiones de continuidad.
- [x] Enviar y validar idioma ES/EN en cliente/API; errores localizados separados de respuestas de Jev.
- [x] Implementar generaciones/cancelación, regeneración y limpieza del historial sin persistir mensajes.
- [x] Conservar Home y suspender scheduler, sensores, timers, solicitudes y Rive al ocultarse.
- [x] Verificar entrada, teclado/touch, fallos, cambios rápidos, historial y navegación con tests y Playwright.
- [x] Ejecutar typechecks por proyecto, ESLint, Vitest, build y revisión final de cambios.
- [x] Presentar evidencia y recibir autorización para continuar con fase 3.

**Punto de partida:** fase 1 cerró con 51 tests, cuatro typechecks, ESLint, build y 100 checks de navegador. El runtime efectivo limita el habla a **dos** intercambios (`SPEECH_HISTORY_LIMIT=2`), aunque algunas notas antiguas decían cuatro; conservar el límite de código y corregir documentación, sin ampliar el contrato.

### Entrega de fase 2 — 2026-10-07

**Seams implementados:** `useSpeechSession` posee generaciones, idioma, caption, avisos, deadline y dos intercambios en memoria. `useCreatureBrain` conserva su scheduler durante suspensiones; el shell conserva Home, sin copiar esa sesión a Zustand. `usePageVisibility`, los sensores y Character reciben actividad explícita. El controlador cancela/resuelve todos sus waits; Rive pausa render y reanuda en Base. El API valida idioma e historial y aborta upstream/reader al desconectarse el cliente.

| Comprobación | Resultado |
|---|---|
| `npm exec -- tsc --noEmit -p tsconfig.app.json` | PASS. |
| `npm exec -- tsc --noEmit -p tsconfig.node.json` | PASS. |
| `npm exec -- tsc --noEmit -p tsconfig.api.json` | PASS. |
| `npm exec -- tsc --noEmit -p tsconfig.tests.json` | PASS. |
| `npm run lint` | PASS, cero advertencias. |
| `npm exec -- vitest run --maxWorkers=1` | PASS: 15 archivos / 86 tests. |
| `npm run build` | PASS. Shell 349,18 kB / gzip 111,06; Character 211,57 / 59,92; Motion 85,54 / 28,34; CSS 34,27 / 7,58. |
| `node ".dev/evidence/phase-2/verify.mjs"` | PASS: 60 checks / 11 capturas; HTTP y SSE reales contra un fixture local, sin llamar a proveedores desde el harness. |
| Smoke real con `node --input-type=module -e …` / fetch a Vite | Dos `POST /api/talk` reales: ES con mensaje inglés produjo «¡Hola!»; EN con mensaje español produjo «Hey there!». HTTP 200, SSE con `done` en ambos. Detalles reproducibles en el README de evidencia; no se leyeron ni registraron claves. |
| Revisión Standards / Spec | Sin bloqueos tras separar ausencia de pestaña/navegación, distinguir decisión interrumpida de habla, validar historial vacío y ampliar cobertura de fallos/back-forward. |
| Validación documental / `git diff --check` | PASS: 13 documentos, 122 enlaces/anclas locales y render directo. Sin errores de whitespace; avisos LF/CRLF de Git. Validador temporal fuera del repositorio. |

**Contratos verificados:** idioma inválido/missing rechazado antes del proveedor; prioridad del idioma seleccionado sobre texto/historial; cambio durante decisión usa idioma vigente; cambios rápidos durante SSE abortan generaciones anteriores; solo resultados completos se guardan. Borrar conversación elimina también claves de caché que contenían texto. El cliente descarta deltas tras abort, cancela readers y aplica deadline de 12 s. Un error de habla se muestra en HUD, sin frase ficticia de Jev. Se corrigió el bucket de rate-limit del API para reiniciarse a los 60 s; suspender/borrar no reinicia cuotas del cliente.

**Navegación y recursos:** se comprobó el mismo canvas al volver, borrador/contexto/HUD conservados, Home oculta/inert fuera del árbol accesible, cero solicitudes mientras está oculta o al volver de una ruta interna. Un contador de `window.requestAnimationFrame` no observó frames nuevos durante la suspensión; pruebas unitarias complementarias comprueban cancelación de timers/RAF/listeners y `pause`/`stopRendering`. No se presentan esas comprobaciones como perfil de memoria o benchmark de FPS.

**Evidencia y límites:** [matriz de capturas/resultados](evidence/phase-2/README.md). La corrida final no tuvo errores de aplicación; conserva 48 advertencias WebGL de ReadPixels (cuatro por proceso con Rive) y dos fallos de red esperados e inyectados (503 y conexión cerrada). El harness aisló cada caso en un navegador nuevo después de una ejecución que agotó memoria WASM al acumular contextos en el host. Las navegaciones de cada caso sí comparten la misma instancia de Home. Los streams de idioma se liberan por compuertas del fixture para evitar carreras de latencia del harness. Los diagnósticos de corridas fallidas no son capturas finales.

**Alcance:** sin nuevas dependencias ni cambios del asset/diseño aceptado. Incremento aproximado de Home JS+CSS: 1,54 kB gzip frente a fase 1 (excluye WASM y `.riv`). Prueba real limitada a los dos requests de habla indicados; flujo Jev→habla, fallos, visibilidad y teclado móvil se verificaron mediante simulación/emulación. Móvil físico, despliegue, restauración completa de scroll y LCP/FPS permanecen pendientes de sus verificaciones/fases. La fase 3 aún no comenzó.

### Revisión de HUD / Home sin scroll — 2026-10-07

**Solicitud:** desplegar HUD hacia arriba; resumen móvil pequeño/minimalista a la derecha encima del input, pulsable para abrir las métricas; Home sin scroll en móvil/escritorio.

**Implementación:** panel absoluto con origen inferior derecho, sin aumentar altura del dock ni mover input/botón. Resumen estrecho de una fila conserva acción/confianza y etiquetas accesibles; touch/Enter alternan y Escape cierra conservando foco. Home usa altura `dvh`, grid con escenario flexible y bloqueo de scroll solo mientras esa ruta está visible. En viewport bajo, métricas en dos columnas y diagnóstico junto a la izquierda del resumen; se conserva composición/input al retener conversación. Meta viewport solicita resize de contenido al teclado en navegadores compatibles. Sin dependencias nuevas ni cambios de Rive/escala.

| Comprobación | Resultado |
|---|---|
| `npm exec -- tsc --noEmit -p tsconfig.app.json` / `tsconfig.node.json` / `tsconfig.api.json` / `tsconfig.tests.json` | PASS, ejecutados por separado. |
| `npm run lint` | PASS, cero advertencias. |
| `npm exec -- vitest run --maxWorkers=1` | PASS: 15 archivos / 87 tests. |
| `npm run build` | PASS. Shell 349,23 kB / gzip 111,06; CSS 37,58 / 8,05; Character 211,57 / 59,92; Motion 85,54 / 28,34. |
| `node ".dev/evidence/phase-2/hud-upward/verify.mjs"` | PASS: 393 checks / 20 capturas; claro/oscuro, ES/EN, escritorio/móvil, pantallas bajas y movimiento reducido. |
| Revisión Standards / Spec | Sin bloqueos en la revisión final; el clipping detectado durante la primera corrida quedó corregido antes de la matriz final. |
| Validador documental temporal `validate-jev-home-revision.mjs` | PASS: 13 documentos / 124 enlaces-anclas; referencias de las 20 capturas nuevas comprobadas contra archivos existentes. |
| `git diff --check` sobre archivos de la revisión | PASS; avisos de normalización LF/CRLF. |

**Incidencia y límites:** primera corrida falló por recorte superior al retener contexto a 390×420; se corrigió, repitió la matriz completa y se inspeccionaron capturas. La evidencia final tiene cero errores de aplicación, 32 avisos WebGL ReadPixels y cuatro HTTP 503 inyectados. APIs simuladas; viewport/teclado emulados, sin móvil físico ni LCP/FPS. Evidencia independiente en [hud-upward](evidence/phase-2/hud-upward/README.md); capturas anteriores preservadas. La entrega sigue esperando revisión del usuario y no habilita fase 3.

## Fase 3 — Trabajo activo

**Dirección visual confirmada durante implementación:** el usuario pidió Jev libre, sin marco/contenedor; texto alternado izquierda/derecha y desplazamiento de Jev por los espacios libres al deslizar. Versión móvil con puesta en escena adaptada. Confianza/decisión se explican en su capítulo, sin HUD ni etiquetas repetidas constantemente.

- [x] Revisar contrato Rive y mapear ocho capítulos a acciones existentes y alternativa DOM de percepción.
- [x] Crear catálogo tipado ES/EN y máquina XState; tests de repetición, reemplazo, suspensión, carga/error y Strict Mode.
- [x] Aplicar composición abierta, texto alternado y trayectoria scroll desktop/móvil.
- [x] Verificar secuencias reales, aislamiento de Home, teclado, preferencias, errores, reduced motion y teardown.
- [x] Ejecutar matriz final y registrar capturas, dependencias, peso y límites.
- [ ] Presentar entrega y recibir aprobación de fase 3.

**Checks de implementación intermedia:** cuatro archivos / 21 tests PASS; typecheck tests y build PASS. Son línea intermedia, no evidencia de la nueva dirección visual. XState/@xstate-react, GSAP/@gsap-react y Lenis instalados para las responsabilidades aprobadas; npm audit de instalación: cero vulnerabilidades. No se modifican bytes del asset.

### Entrega de fase 3 — 2026-10-07

**Resultado:** ocho capítulos con texto ES/EN alternado y Jev libre atravesando espacios vacíos. No hay tarjetas ni escenario con marco. Móvil conserva esa composición mediante separación vertical, movimiento horizontal acotado y navegación por iconos/contador desplegable. Decide explica acción, confianza y otras lecturas; métricas de ejemplo contextualizadas, sin HUD/rótulos permanentes. Habla tiene texto preescrito sin audio; Percibe usa un cursor ilustrativo, no un sensor. Asset/escala original conservados.

**Seams:** `catalog.ts` es el guion tipado; XState en `player.ts` posee el reloj/cancelación; `useShowcasePlayer` usa el controlador y epochs para rechazar resultados obsoletos. `useShowcaseScroll` gobierna pin/trayectoria y preserva anchors al localizar; el manager compartido `features/presentation/scrollRuntime.ts` posee una sola instancia Lenis y driver GSAP. Rive recibe `presentation/staticPose`, readiness/error y callbacks por intento. No se montan cerebro/sensores ni se consulta API desde Features. Home conserva su sesión oculta.

| Comprobación | Resultado |
|---|---|
| Typechecks app/Node/API/tests por proyecto | PASS; comandos completos en [contrato](../design.md#verificación-y-evidencia). |
| `npm run lint` | PASS, cero advertencias. |
| `npm exec -- vitest run --maxWorkers=1` | PASS: 18 archivos / 111 tests. Nuevos casos de determinismo, suspensión, error/retry, Strict Mode, epochs y manager compartido. |
| `npm run build` | PASS: Features 197,36 kB / gzip 71,09; CSS Features 7,88 / 1,92; shell 340,99 / 108,48; JSX compartido 8,77 / 3,33; Character 211,71 / 59,99; Motion 85,59 / 28,34; CSS común 37,79 / 8,13. |
| 29 bloques `node ".dev/evidence/phase-3/verify.mjs" <caso> <bloque>` | PASS: 240 checks / 35 capturas. Layout: ocho variantes; controles/reduced: cuatro variantes; ocho secuencias reales; lifecycle, scroll, dos navegaciones y aislamiento/error. |
| `node ".dev/evidence/phase-3/aggregate.mjs"` | PASS: exige todos los reportes completos sin error y posteriores al último cambio de fuente; registra fingerprint y capturas existentes. |
| Revisión Standards | Sin bloqueos en la revisión final; contrato de cleanup GSAP comprobado en la librería instalada, no supuesto. |
| Revisión Spec | Sin bloqueos tras comprobar pausa por viewport y scroll nativo de retorno; global Lenis compartido y alternativas estáticas verificadas. |
| Validación documental `validate-jev-home-revision.mjs` / `git diff --check` | PASS: 15 documentos, 189 enlaces/anclas, render directo y sin errores de whitespace; avisos LF/CRLF de Windows. Validador temporal fuera del repositorio. |

**Dependencias/peso:** XState 5.33.2 + React 6.1.0, GSAP 3.15.0 + React 2.1.2 y Lenis 1.3.26 cumplen las responsabilidades del plan aprobado. Se cargan solo al abrir Features. El chunk diferido JS+CSS cuesta aproximadamente 73,01 kB gzip. El conjunto JS/CSS de Home aumenta aproximadamente 0,90 kB gzip frente a fase 2 revisada (incluye JSX compartido; excluye WASM/`.riv`). No se atribuye mejora de FPS ni un peso aislado a cada motor.

**Hallazgos corregidos:** el canvas escalado podía ampliar overflow horizontal; se limita el overflow de su envolvente invisible, preservando máscara/render directo. Cambiar idioma podía activar el capítulo anterior por reflow/scroll anchoring: se preserva el ancla con selección bloqueada, sin reiniciar el actor/canvas. ScrollTrigger `enable()` añade su propio workaround RAF/intervalo: se protege activación y se usa `disable(false)` al ocultar pestaña para conservar pinning sin actividad. Caption se desmonta al pausar; Lenis retira driver suave fuera de viewport y libera scroll nativo, evitando bloquear entrada/salida de la escena. Readiness tardío/error de intento previo no reinician una escena fallida; retry es explícito.

**Preferencia de ejecución del usuario:** pidió que el comando devolviera respuesta, al interrumpir la matriz larga. Ejecutar verificaciones de navegador en bloques cortos con avance y tiempos; no volver a lanzar una matriz monolítica como feedback principal. Se confirmó que un límite de 45 s cortaba un caso mientras seguía avanzando (16 checks/42 s), no un fallo de la app. El harness ahora tiene casos/bloques, deadline y cierre forzado únicamente de su navegador; los bloques finales tomaron aproximadamente 3–20 s. Los resultados de corridas canceladas/timeouts no se mezclan con el agregado final.

**Límites:** Chromium 153, móvil/touch/visibilidad/reduced motion emulados; no móvil físico/Safari/iOS ni LCP/FPS. APIs solo con fixture de Home. Offline probado después de cargar recursos. Cero errores inesperados; 120 avisos WebGL ReadPixels de captura y dos errores esperados del asset 404. [Evidencia final](evidence/phase-3/README.md). About continúa provisional y la fase 4 no comenzó.

## Estado de fases restantes

| Fase | Estado | Puerta |
|---|---|---|
| 1 — Home de referencia | Aceptada para avanzar | Autorización del usuario; teclado físico sigue pendiente. |
| 2 — Conducta real de Home y habla bilingüe | Aceptada para avanzar | Autorización del usuario tras revisión HUD/Home sin scroll. |
| 3 — Features determinista | Implementada/verificada, pendiente aprobación | Revisión visual/funcional del recorrido libre. |
| 4 — About scrollytelling | Pendiente | Aprobación explícita de fase 3. |
| 5 — Integración, accesibilidad y rendimiento | Pendiente | Aprobación explícita de fase 4. |

## Reglas de handoff

- Seguir `spec.md` para intención y `plan.md` para secuencia. Si código y docs divergen, inspeccionar comportamiento real y conservar clara la diferencia entre objetivo e implementación.
- Trabajar solo la fase activa. Limitar cambios al alcance aprobado; preguntar ante ambigüedad material.
- Después de cada ciclo de implementación/check, actualizar este archivo con comandos, resultados, capturas, limitaciones, decisiones y siguiente paso. Un test verde no equivale a aprobación.
- Tras entregar una fase, detenerse y esperar revisión explícita. Si pide cambios, mantener abierta la misma fase.
- Al finalizar toda la feature, presentar findings y obtener aprobación final. Después vaciar el contenido de `.dev/spec.md`, `.dev/plan.md` y `.dev/task.md`, conservando los tres archivos.
