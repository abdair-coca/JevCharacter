# Tarea: rediseño web de JEVLING

Este es el handoff vivo de la feature. **Antes de continuar, leer `spec.md`, `plan.md`, este archivo y `../design.md`.** `task.md` es la única fuente de fase activa, checks, evidencia, bloqueos, aprobaciones y siguiente acción.

## Retoma aquí

- **Trabajo actual / fase activa:** Fase 5 — integración, accesibilidad, rendimiento y voz de Jev. Implementada y verificada el 2026-10-16/17; **entregada para revisión**. Solicitud: «quiero que culmines la fase 5 y que agregues sonido a jev…»; quiz: encendido tras el primer toque, Inicio y Capacidades, síntesis en el navegador, sonido primero.
- **Fase anterior:** Fase 4 — About scrollytelling, aprobada el 2026-10-11 («la fase 4 ya está aprobada»).
- **Estado:** fases 1–4 aprobadas; fase 5 pendiente de aprobación final. La demo UATF también sigue pendiente de aprobación visual. Teclado y rendimiento en dispositivo físico continúan como limitación de evidencia.
- **Siguiente acción exacta:** que el usuario revise la fase 5, incluidas de oído la voz juguetona y la banda sonora épica de Historia ([revisiones de sonido](#revisiones-de-sonido--2026-10-17)). Pendiente: regenerar la evidencia de sonido de fase 5. Tras la aprobación final: informar resultados y después vaciar el contenido de `spec.md`, `plan.md` y `task.md`, conservando los tres archivos.
- **Estado actual del código:** el 2026-10-07 el usuario autorizó a Luna a organizar el trabajo pendiente en microcommits; la implementación previa, documentación y evidencias ya están guardadas. Los PNG diagnósticos temporales se conservan sin commit. La restricción de no commitear durante la migración SDD queda como antecedente de aquella tarea.

## Fase 5 — entrega para revisión, 2026-10-17

- [x] Registrar en `spec.md` la voz de Jev aprobada en el quiz, y en `plan.md` su orden dentro de la fase.
- [x] Voz: partitura pura, motor Web Audio, desbloqueo por gesto, silencio persistido, pestaña oculta, habla en streaming y motivos por acción; Inicio y Capacidades suenan, Historia no.
- [x] URL directa, recarga, atrás/adelante, restauración de scroll por entrada del historial y foco en el h1 al navegar.
- [x] Estado al cruzar vistas: Inicio oculto, inerte y suspendido, sin API ni sonido; tema, idioma y capítulo conservados.
- [x] Auditoría: teclado, orden de foco, ARIA, colapsados, contraste AA, objetivos táctiles, reflow sin overflow, DOM alternativo y movimiento reducido.
- [x] Matriz Playwright: tres rutas × ES/EN × claro/oscuro × escritorio/móvil, más teclado, movimiento reducido, fallos de Rive/API, consola y limpieza.
- [x] Rendimiento: chunks, carga diferida, LCP y ritmo de frames con GPU real, con las condiciones declaradas.
- [x] Vercel/seguridad: rewrites, `/api/*` sin interceptar, claves solo en servidor, sin historial remoto.
- [x] Docs de estado actual (`architecture`, `interaction`, `README`, `docs/README`) y contrato `design.md`.
- [ ] Aprobación final del usuario.

**Cambios de runtime:** nuevos `src/creature/voice/{voiceScore,voiceEngine,useVoiceRuntime,useSpeechVoice}.ts` y `src/features/story/StillImage.tsx`. Ediciones en `useCharacterController` (`onCue` tras cada trigger), `Character` (prop `voice` y parada al desactivarse), `HomePage`, `FeaturesPage` (frase de «Habla»), `App` (runtime de voz y restauración de scroll), `routes` (`rememberScroll`/`savedScroll`), `SiteHeader` (botón de altavoz), `preferencesStore` (`sound`), `messages` (sonido y texto de ruta desconocida), `PendingPage`, `ContextWhisper` (`tabIndex={-1}` en el envoltorio de `whileTap`), catálogo y copy de Features/Historia, `AboutPage` y `story.css`. Sin dependencias nuevas ni cambios en el asset Rive.

| Comprobación | Resultado |
|---|---|
| Línea base antes de editar: `npm run typecheck`, `typecheck:tests`, `lint`, Vitest | PASS: 29 archivos / 187 tests. |
| `tsc --noEmit -p` app / node / api / tests (cuatro comandos) | PASS. |
| `npm run lint` | PASS, cero advertencias. |
| `npm exec -- vitest run --maxWorkers=1 --reporter=dot` | PASS: 34 archivos / 216 tests. Nuevos: `voiceScore`, `voiceEngine`, `speechVoice`, `navigation`, `stillImage`, y casos en `characterController`, `siteHeader` y `preferences`. |
| `npm run build` | PASS. Shell 358,80 kB / gzip 114,99 (+3,1 kB gzip frente a la línea base 350,71 / 111,86). |
| `node .dev/evidence/phase-5/verify.mjs <bloque>`: `static`, `sound`, `navigation`, `keyboard`, `fallback`, `matrix` ×8, `perf` | PASS: 252 checks y 31 capturas sobre el build final. Detalle en [evidencia de fase 5](evidence/phase-5/README.md). |

**Hallazgos corregidos:** envoltorio de Enviar enfocable sin nombre por `whileTap`; WebP animado de TitiEdu moviéndose en la lectura estática; texto obsoleto «se construirá en una próxima fase» en ruta desconocida; atrás/adelante sin restaurar el scroll.

**Incidencias de verificación:** el harness inicial chocaba en el enlace «Capacidades» (coincidía con «Ver sus capacidades») y esperaba con `isVisible()` sin aguardar la carga diferida; ambos se corrigieron. Hubo dos falsos positivos de auditoría, ajustados con su causa documentada: `mask-*` de tailwind-merge confundido con una clave `sk-`, y el ES/EN activo, que se pinta sobre un indicador hermano. Contar frames con movimiento reducido no servía, por el bucle vacío `_rafBugFix` de ScrollTrigger; se sustituyó por capturas idénticas. El primer perf corrió con SwiftShader (software) y se repitió con GPU vía ANGLE/D3D11. Una corrida intermedia mostró un hueco de unos 15 s en Historia escritorio en frío, no reproducido en 5 sondas ni en la final. Ningún resultado de una corrida fallida forma parte del registro final.

**Límites:** emulación de Chromium, sin móvil físico, Safari/iOS, lector de pantalla ni teclado virtual. El audio se verificó por instrumentación, no de oído. El contraste de texto sobre imágenes o canvas no es medible. Inicio en escritorio tiene un 10,6 % de frames por encima de 33 ms en la GPU integrada Intel UHD. Historia tiene un tirón único de 157–430 ms al inicializar Rive durante el scroll, que es el diseño aprobado. No se llamó a proveedores reales, no hubo deploy y no hubo push.

### Revisiones de sonido — 2026-10-17

**Primera revisión (arrullo cálido y pads):** una sesión anterior aplicó la revisión registrada en `spec.md` (voz de arrullo, música de Historia y control único) junto con su evidencia local. Quedó sustituida por la segunda revisión.

**Segunda revisión (voz juguetona sin eco y banda sonora épica):** solicitudes en `spec.md`; alcance limitado al sonido. Cambios de runtime solo en `lib/audioCore.ts` (la voz ya no envía señal a la sala), `creature/voice/{voiceScore,voiceEngine}.ts` y `features/story/{storyMusic,useStoryMusic}.ts`; tests en `tests/{audioFakes,audioCore,voiceScore,voiceEngine,storyMusic}.test.ts`. Sin dependencias ni archivos de audio.

| Comprobación | Resultado |
|---|---|
| Tests de sonido antes de editar | PASS: 4 archivos / 29 tests. |
| `tsc --noEmit -p` app / node / api / tests | PASS; app y tests repetidos tras el último cambio. |
| `npm run lint` | PASS, cero advertencias. |
| `npm exec -- vitest run --maxWorkers=1 --reporter=dot` | PASS: 36 archivos / 235 tests. Nuevos: voz seca (sin camino a la sala), scoops, pentatónica, risita, golpe en la siguiente semicorchea, fusión de golpes, clímax que nunca se pierde, barrido silenciado al llegar y crecimiento por escena. |
| Render offline (OfflineAudioContext en Chromium, script temporal fuera del repo) | 0 clics a 24, 32 y 48 kHz. La voz cae a −74/−81 dB 150 ms después de cada frase: sin cola de eco. Música: −39 dB en la escena 0 hasta −31 dB en las escenas 3–4, unos +4 dB en cada golpe y los medios y agudos más altos en el clímax. Render 20 veces más rápido que el tiempo real. |
| Humo en Historia real (dev server, Chromium, script temporal) | Sin audio antes del gesto; contexto en marcha tras el clic; 5 golpes (4 escenas + clímax) recorriendo con la rueda rápida; ningún oscilador nuevo tras salir de Historia; 0 errores. |

**Hallazgos corregidos:** clics de una muestra en las fuentes de ruido. Un `GainNode` vale 1 antes de su primer evento y la fuente podía sonar un frame antes; ahora el envolvente nace en 0. Además, al desplazarse rápido el golpe del clímax se fundía con el de la escena 4; ahora un golpe más fuerte siempre suena.

**Límites y pendientes:** la mezcla se ajustó por mediciones, no de oído: la calidad sonora espera la revisión del usuario. Los scripts de render y humo no están en el repo. La evidencia local de fase 5 (`verify.mjs` bloque `sound`, `results-*.json`, capturas `sound-*` y `audio/`) corresponde a la primera revisión y no se commiteó. Hay que adaptar el bloque `sound` a la segunda revisión y volver a generarla; no se hizo porque el sistema cerró el dev server por falta de memoria.

### Activación de decisión remota en producción — 2026-10-09

**Autorización:** «hazlo tu, las variables ya estan en vercel.com», después de explicar que un artefacto prebuilt no se puede reconstruir desde Redeploy con variables nuevas. Se usa el proyecto existente y `vercel deploy --prod --yes`, sin `--prebuilt`; no se leen ni imprimen valores de credenciales.

**Resultado final:** [producción](https://jev-bot-sigma.vercel.app), deploy `dpl_Dwo7XoNHxPNgMUAwCBXAVHbCV6p9`, [URL inmutable](https://jev-2j38bemo6-abdairs-projects.vercel.app), Ready. `vercel inspect` confirma `api/decide` (35,46 kB) y `api/talk` (12,39 kB), región iad1. Home envió «Hola Jev» realmente; HTTP 200, `source: "jev"`, acción `reaction / HELLO`, confianza 1 y HUD remoto. Una llamada real por corrida de navegador, sin fixture ni claves del navegador. Se repitió sobre el deploy final limpio. Las tres rutas cargan HTTP 200; ambas funciones rechazan body vacío con 400 antes de consultar proveedores. Cero errores de aplicación/consola. No se probó una respuesta Groq real: la verificación solicitada es de decisión.

**Causa y reparación:** primer deploy ordinario `jev-f806mk90d` publicó funciones, pero `/api/decide` devolvió 500 `FUNCTION_INVOCATION_FAILED`. Logs runtime (`--no-branch`) confirmaron `ERR_MODULE_NOT_FOUND` para `brainConfig` sin extensión. El builder no consume los project references del tsconfig raíz: además reportó falta de tipos Node/lib adecuados. Se añadieron imports `.js` en los handlers y el type import compartido; `tsconfig.api.json` usa NodeNext con `rootDir: "."`; `api/tsconfig.json` extiende ese contrato para que el builder lo encuentre junto al entrypoint. El tsconfig raíz conserva únicamente sus referencias. No cambian prompts, validación ni lógica de decisiones.

**Regresión y checks:** typecheck NodeNext explícito observado rojo antes; `npm run typecheck` (app/Node/API), `npm run typecheck:tests` y `npm run lint`: PASS después. Compilación de `api/tsconfig.json` a `node_modules/.tmp/jev-node-runtime` y smoke Node nativo: ambos handlers importan/ejecutan y rechazan GET con 405, sin proveedor. Vitest dirigido a API, scheduler y morph: 4 archivos / 39 tests PASS. Build remoto `npm run build` y compilación de las dos funciones: PASS, sin errores TS anteriores. Chromium remoto: 10 checks PASS, una captura y JSON en [evidencia](evidence/decision-production/README.md). `git diff --check`: PASS.

**Registro final:** corrección de runtime guardada en `e8b6b3a`; documentación y evidencia en un microcommit posterior, sin push a GitHub. Validador temporal de enlaces: 16 documentos / 235 destinos locales existentes; no verifica anclas. Sintaxis de ambos scripts de evidencia: PASS. El deploy final usa el mismo código de runtime; los cambios posteriores son únicamente documentación/evidencia.

**Incidencias y limpieza:** primera corrida dirigida se quedó sin progreso y agotó 180 s; su repetición y una segunda corrida limpia pasaron. El primer emit de prueba detectó TS5011 por rootDir de TypeScript 6 y, con emisión permitida pese al error, generó cuatro `.js` junto a fuentes compartidas. Se inspeccionaron y eliminaron únicamente esos artefactos nuevos; rootDir explícito resuelve el layout. Se repitieron tests, deploy ordinario y smoke remoto sin esos `.js`; el deploy final empaqueta desde las fuentes TS. No se incluyen artefactos generados ni secretos en commits. Las capturas diagnósticas anteriores se conservan locales.

**Handoff de sesión:** objetivo cumplido — nueva producción con decisión remota usando variables existentes. Hallazgo persistente: los imports compartidos de funciones Node ESM necesitan extensión `.js`, y el builder encuentra el tsconfig desde el directorio del entrypoint, sin resolver project references del root. Verificado con Node emitido y proveedor real. Archivos: `api/decide.ts`, `api/talk.ts`, `api/tsconfig.json`, `tsconfig.api.json`, `src/creature/brain/morphIntent.ts`, README/arquitectura/interacción y `evidence/decision-production/`. Próximo paso: revisión del usuario de About/UATF; habla Groq real no verificada en esta tarea. Engram no está disponible; este ledger conserva el resumen.

### Microcommits y publicación frontend — 2026-10-09

**Solicitud:** «quiero que microcomitees y lo desplegues en vercel, sin backend aun». Vercel CLI autenticada como `abdair-coca`; proyecto existente `jev-bot` en `abdairs-projects`. Engram no está disponible en las herramientas de esta sesión; este ledger conserva el handoff.

**Preparación:** `build:frontend` compila con modo Vite `frontend`; el scheduler usa el fallback local directamente, sin consultar `/api/decide`. El fallback solo genera reacciones, por lo que no solicita habla. El script de empaquetado crea únicamente `static/` y `config.json` bajo `.vercel/output`, con soporte para las rutas directas; el deploy usa `--prebuilt --prod` para excluir handlers y secretos. El backend opcional permanece disponible en desarrollo/otros builds.

**Línea base comprobada antes de preparar publicación:** `npm run typecheck` (proyectos app/Node/API), `npm run typecheck:tests`, `npm run lint` y `npm exec -- vitest run --maxWorkers=1`: PASS, 26 archivos / 177 tests. `git diff --check`: PASS con avisos LF/CRLF de Windows.

**Verificación del modo frontend:** `npm run build:frontend`, `npm run lint`, `npm run typecheck:tests` y suite completa Vitest: PASS, 26 archivos / 178 tests, incluido el nuevo contrato sin red. Build verifica app/Node/API mediante `tsc -b`; el artefacto contiene únicamente `config.json` y `static/`, sin `functions/`. Shell 346,92 kB / gzip 110,89. Vercel vinculado al proyecto existente. La CLI añadió una regla redundante `.env*`: se retiró para preservar la excepción `.env.example`; los archivos locales de credenciales siguen ignorados. Se repuso el índice de partículas referenciado pero ausente, usando el agregado existente como antecedente. Despliegue y smoke remoto pendientes.

**Fallo móvil encontrado en el smoke remoto:** primer deploy `jev-pnge6l8tk-abdairs-projects.vercel.app` listo; escritorio pasó 23 checks. En móvil, Confirmar no avanzaba. Reproducción en tres corridas: `pointerdown` caía en BUTTON a y=657; el blur del celular expandía la composición y movía el botón de top=630 a 771; `pointerup` caía en LABEL y click en FORM, sin submit. Causa: `onBlurCapture` solo preservaba composición al pasar a otro input. Corrección mínima: conservar la composición compacta mientras el foco pase a cualquier control dentro de inscripción, incluyendo Confirmar/Cerrar. La confirmación existente libera ese estado después del submit. Test nuevo observado rojo antes y verde después; suite final verbose PASS, 26 archivos / 179 tests; lint, typecheck tests y build frontend PASS. Una primera suite sin reporter agotó 180 s; no cuenta como aprobada. El probe temporal de eventos se retiró del harness; los PNG diagnósticos quedan locales. Sin cambios de backend ni datos persistidos. Corrección pendiente de repetir el smoke móvil sobre el deploy actualizado.

**Cierre de publicación:** deploy final `dpl_BubWMWhaUeeQjcBHJ7qWymkJkL23`, target production, Ready; [URL estable](https://jev-bot-sigma.vercel.app) y [URL del deploy](https://jev-88s8hcdov-abdairs-projects.vercel.app). Fuente de runtime `169d8e5`; el registro posterior añade solo evidencia/documentación. Se guardaron 16 microcommits lógicos, incluida la corrección móvil y este cierre; no hubo push a GitHub. Únicamente permanecen sin commit las capturas diagnósticas previas/locales. Los archivos SDD se conservan porque hay revisiones pendientes.

| Verificación final de publicación | Resultado |
|---|---|
| `npm run build:frontend` | PASS; app/Node/API mediante `tsc -b`, build frontend y artefacto estático sin funciones. Repetido tras la corrección móvil. |
| `npm run lint`, `npm run typecheck:tests` | PASS tras la corrección. |
| `npm exec -- vitest run --maxWorkers=1 --reporter=verbose` | PASS: 26 archivos / 179 tests. |
| `vercel deploy --prebuilt --prod --yes`, `vercel inspect <URL final>` | Ready; proyecto existente y alias de producción correcto. |
| Dos bloques `node ".dev/evidence/deployment/verify.mjs" "https://jev-bot-sigma.vercel.app" desktop|mobile` | PASS: 48 checks / 8 capturas; escritorio claro ES y móvil oscuro EN, aproximadamente 35–40 s por bloque final. |
| Rutas y backend ausente | `/`, `/features`, `/about`: HTTP 200 directo. `/api/decide` y `/api/talk`: POST vacío 404 mediante sondas externas; cero requests API originados por la web. |
| Inscripción y presentaciones | Validación, confirmación al primer toque, campos eliminados, foco restaurado, un Character en Home, ocho capítulos, cinco escenas y revelación final; cero errores de aplicación/consola y sin overflow horizontal. |
| Documentación y whitespace | Validador temporal final: 15 documentos / 227 destinos de enlaces locales existentes; anclas no verificadas. `node --check` del harness y `git diff --check`: PASS. `.env.local`/`.vercel/project.json` siguen ignorados. Se repuso el README histórico de partículas ausente. |

**Evidencia final:** [publicación](evidence/deployment/README.md). Se inspeccionaron Home desktop, éxito UATF móvil, Features móvil y revelación Story desktop. La primera captura de Features era prematura; se añadió la estabilización GPU de 1,8 s usada en los harnesses anteriores y se repitieron ambos bloques completos. Una corrida móvil se interrumpió por timeout antes del cierre; no integra los JSON finales. En el SVG aportado se retiraron cinco líneas con espacios finales para aprobar whitespace, sin cambiar su render; los binarios originales no fueron reescritos por esta sesión.

**Handoff de sesión:** objetivo cumplido — microcommits y publicación solo frontend. Restricción aprendida: sin backend todavía. Decisión: build `frontend` + artifact prebuilt; frontend local desde el primer contexto, sin sondeos de API. Corrección descubierta/verificada: blur móvil no debe cambiar geometría durante el toque a Confirmar/Cerrar. Archivos principales: `scripts/prepare-vercel-frontend.mjs`, `package.json`, `decisionScheduler.ts`, `EnrollmentExperience.tsx`, sus tests, README/arquitectura y `evidence/deployment/`. Próximo paso: revisión visual de About/UATF; no abrir fase 5 sin aprobación. Chromium headless/móvil emulado, sin Safari/iOS ni móvil físico/LCP/FPS. Engram no disponible; se conserva este resumen en el ledger.

### Inscripción UATF — entrega actual

- [x] Completar diez decisiones de descubrimiento y revisar los puntos de integración existentes.
- [x] Obtener aprobación explícita de la especificación y registrarla sin reemplazar el contexto del rediseño.
- [x] Aprobar el resumen de una única fase de implementación: respuesta «hazlo».
- [x] Registrar el plan técnico detallado conservando las cinco fases anteriores.
- [x] Aprobar el plan completo antes de implementar: «si apruebo».
- [x] Implementar, verificar y entregar la fase para revisión visual.
- [ ] Recibir aprobación visual/funcional de la demo UATF.

**Resumen aprobado:** una entrega de extremo a extremo: detección local desde el input → aparición animada de Jev/formulario → validación de nombre/celular → celebración local → cierre y limpieza. Composición móvil, teclado, ES/EN, temas y fallback forman parte de esa misma entrega.

**Hallazgos de integración:** `HomePage.tsx` conecta directamente `ContextWhisper.onSubmit` con `brain.submitContext`; esa es la frontera para interceptar la intención antes de enviarla al cerebro. `useCreatureBrain` ya acepta actividad explícita, suspende scheduler/habla y detiene acciones al pausarse; la nueva coreografía debe comenzar después de esa suspensión, conservando Character activo. El shell mantiene Home montada al cambiar de ruta: salir de Inicio necesita una limpieza explícita del estado de inscripción, no depender del desmontaje. `Character` ofrece readiness/error y el controlador ya tiene reacciones temporales; no hace falta modificar el asset. Datos y UI propuestos bajo `src/features/enrollment/`, con estilos acotados al estado de inscripción.

#### Implementación y evidencia UATF — 2026-10-09

**Resultado:** activación local ES/EN desde el input; formulario de dos campos simultáneos; validación; confirmación local con Flower/partículas; cierre suave y vuelta a Inicio. En móvil, Jev encima y compacto al enfocar; scroll interno y altura basada en `visualViewport` para el teclado. Fallback funcional si falla Rive; reduced motion sin partículas. Nombre/celular se eliminan al confirmar, cerrar o navegar; preferencias/pestaña no borran un formulario abierto.

**Cambios de runtime propios de esta entrega:** únicamente `src/pages/HomePage.tsx` y los nuevos archivos de `src/features/enrollment/`. Se añaden dos archivos de tests y `.dev/evidence/enrollment/`. No se editó el cerebro, APIs, rutas ajenas, asset, componentes compartidos ni dependencias en esta implementación. Los cambios preexistentes en esas áreas se conservan.

**Coordinación:** `HomePage` intercepta la intención antes del cerebro; pausa cerebro/sensores con sus props existentes, manteniendo Character activo. La coreografía parte de un RAF cancelable después del cleanup de la pausa. Entrada Hello y aceptación Flower usan el controlador actual. Un solo canvas de personaje; Motion posee layout y partículas SVG finitas. `useEnrollment` posee la sesión efímera; `useEnrollmentViewport` retira listeners y variable de altura al cerrar. El estado `completed` mantiene la composición de éxito mientras se cierra sin conservar datos.

| Comprobación ejecutada | Resultado |
|---|---|
| `npm exec -- tsc --noEmit -p tsconfig.app.json`, `tsconfig.node.json`, `tsconfig.api.json`, `tsconfig.tests.json` (por separado) | PASS. |
| `npm run lint` | PASS, cero advertencias. |
| `npm exec -- vitest run --maxWorkers=1 --reporter=verbose` | PASS: 26 archivos / 177 tests. Incluye 39 nuevos casos de intención, validación y sesión/aislamiento con Strict Mode. |
| `npm run build` | PASS. Shell 350,26 kB / gzip 111,78; CSS común 43,19 / 8,95. Incremento aproximado frente al pulido: 4,59 kB gzip de JS+CSS; sin dependencias nuevas. |
| `node ".dev/evidence/enrollment/verify.mjs" <tamaño> <tema> <idioma> [modo]` | PASS: 13 bloques / 298 checks / 46 capturas. Ocho variantes principales escritorio/móvil × claro/oscuro × ES/EN; dos reduced, 320 px, viewport bajo y fallo de Rive. |
| Aislamiento del formulario en navegador | Cero requests `/api/*` en los 13 bloques, incluidos cambios de preferencias, cierre/reapertura y navegación a Features/regreso. Sin datos ficticios de formulario en localStorage/sessionStorage; valores retirados del formulario en aceptación/cierre. |
| `git diff --check` | PASS; avisos LF/CRLF de Windows. |

**Evidencia:** [UATF](evidence/enrollment/README.md). Inspección visual de escritorio, móvil claro/oscuro, celebración real Flower y teclado simulado. TypeScript, tests y navegador se ejecutaron para esta funcionalidad; no se reutiliza el pulido como evidencia de UATF.

**Último ajuste de accesibilidad:** el ancla `#page-title` pasa al título de inscripción mientras está abierta y regresa al título de Home al cerrar; así «Ir al contenido» no apunta a un título oculto. Después se repitieron build, lint, typecheck de tests y `enrollmentSession`/`homeSession` (6 tests PASS). Playwright adicional confirmó una sola ancla, foco en el título visible y retorno al input con Escape. La matriz de 13 bloques precede únicamente a este ajuste semántico, sin cambios visuales ni de lógica de datos.

**Correcciones durante verificación:** lint pidió capturar el controlador usado por el cleanup; se corrigió. El primer test de foco esperaba un input aún oculto usando una query que incluye elementos ocultos; ahora espera el control accesible al finalizar cierre. Se conservó la vista de éxito durante su fade para evitar volver brevemente al formulario. El harness inicial buscaba ES/EN por texto en lugar de sus nombres accesibles Español/English y agotó timeout; se corrigió y repitió. El rótulo de éxito móvil se hizo visible explícitamente. Solo los reportes completos posteriores integran esta entrega.

**Límites y puerta:** Chromium headless; touch, viewport, teclado visual y reduced motion emulados. No móvil físico/Safari/iOS ni benchmark LCP/FPS. Se usaron datos ficticios y Rive real, salvo el fallo 404 inyectado. No se llamó a proveedores ni se creó commit/push. La demo queda pendiente de aprobación visual; los SDD siguen conservados. Engram no está disponible en las herramientas de esta sesión; este ledger guarda el handoff.

### Ajuste acotado aprobado — reacción `QUESTION` en Home, 2026-10-08

### Pulido visual solicitado — 2026-10-08

- [x] Inicio: mayor protagonismo de Jev, controles minimalistas sin logos ni texto redundante.
- [x] Features/Story: quitar UI de diapositivas y detalles redundantes; scroll suave e inercia; composición móvil.
- [x] Partículas: deformación al cursor con retorno y mayor expresividad.
- [x] Verificar checks y navegador; documentar evidencia y límites.

Se preserva el trabajo local previo de partículas/QUESTION y los assets. Esta revisión continúa dentro de fase 4; su entrega requiere revisión visual.

#### Entrega de pulido — 2026-10-09

**Inicio:** título secundario sin introducción/pie promocional; canvas protagonista con escenario flexible y escala local `2.1` (presentaciones `1.9`). Input de 56 px, sin logotipo ni texto de ayuda, y HUD de una fila sin logotipo/halo. Acción/confianza y etiquetas accesibles conservadas; detalles hacia arriba, sin mover el input. Borrar conversación y diagnóstico disponibles.

**Features/Story:** retiradas barras anterior/repetir/siguiente, contadores, numeración y detalles «Cómo funciona»/«Un poco más de historia». Relato principal más corto, conservando autoría de Abdair, Bob y memoria persistente, TitiEdu, machine learning y JEV como experimento/visión. Features conserva ocho demostraciones y datos de ejemplo. «Ver escena» usa 1,2 s de scroll suave; Jev sigue con scrub de 1 s, deriva vertical e inclinación. «Revelar a Jev» usa 1,8 s y la historia asienta su progreso en 900 ms. Restauración de preferencias mantiene scroll inmediato. Móvil sitúa ilustración arriba y texto debajo; viewports bajos y reduced motion tienen lectura estática.

**Partículas:** deformación local de mouse/pen con retorno elástico, buffers de desplazamiento/velocidad y paso temporal acotado. Corrientes entre formas, estelas/brillo reforzados y halo de revelación dentro del canvas. Un ticker GSAP, DPR y densidad adaptables conservados; suspensión y reduced motion verificados. Sin dependencias nuevas ni cambios de assets en esta revisión.

| Comprobación | Resultado |
|---|---|
| `npm exec -- tsc --noEmit -p tsconfig.app.json`, `tsconfig.node.json`, `tsconfig.api.json`, `tsconfig.tests.json` (cuatro comandos) | PASS. |
| `npm run lint` | PASS, cero advertencias. |
| `npm exec -- vitest run --maxWorkers=1 --reporter=verbose` | PASS: 24 archivos / 138 tests. Nuevos casos de scroll suave/nativo, pausa/cleanup del asentamiento y deformación/retorno de partículas. |
| Tests dirigidos posteriores de `storyScroll`, `presentationScroll`, `homeSession` | PASS: 3 archivos / 12 tests tras ajustar cleanup y composición estática. |
| `npm run build` | PASS; repetido tras corregir el min-height heredado del input en viewport bajo. |
| `node ".dev/evidence/polish/verify.mjs" <ruta> <tamaño> <tema> <idioma> [reduced]` | PASS: 17 bloques, 207 checks y 38 capturas. Escenarios exactos en el README de evidencia. |
| `node ".dev/evidence/polish/lifecycle.mjs"` | PASS: 12 checks; dos recorridos entre rutas, mismo canvas/borrador de Home, cambio de reduced motion en vivo, sin pins residuales ni llamadas API. |
| `git diff --check` | PASS; avisos LF/CRLF de Windows. |

**Evidencia:** [pulido visual](evidence/polish/README.md). Inspeccionadas capturas de Home, HUD en viewport bajo, Features y Story/revelación móvil, y partículas desktop. Los casos de 390×420 detectaron una regla antigua de input a 64 px: se sustituyó por el token compacto y se repitió ese caso después del build; las demás capturas corresponden al build previo a ese único ajuste CSS, fuera de sus media queries.

**Incidencias de ejecución:** primera suite completa sin progreso agotó timeout; repetición verbose aprobó. La matriz inicial guardaba preferencias en formato incorrecto: se corrigió a JSON y se repitieron los doce casos principales con aserción explícita de tema/idioma. La medición de inercia se trasladó dentro del navegador para evitar latencia entre llamadas; el test reducido de Story espera la preparación de Rive al llegar a su sección, no mientras está fuera de vista. Tras interrupción se reinició preview. En desarrollo durante HMR se observó `pin.enable is not a function`; no se reprodujo en visitas limpias de producción ni en los dos ciclos de navegación/cambio de movimiento reducido. Ninguna corrida fallida se cuenta como aprobada.

**Límites:** Chromium headless, móvil/touch/reduced motion emulados; sin Safari/iOS ni móvil físico, sin benchmark LCP/FPS. No se consultó a proveedores reales. Fase 4 continúa pendiente de aprobación visual. No se creó commit ni push. Herramientas Engram no disponibles en esta sesión; este ledger conserva el handoff.

### Reacción `QUESTION`: antecedente y evidencia

El usuario pidió `QUESTION` como reacción bilingüe de Home, decidida remotamente ante comentarios claramente raros/juzgables o preguntas incómodas; preguntas neutras no la activan y una decisión ambigua conserva reacción normal. El gesto Rive dura brevemente y vuelve a `Base`; también queda disponible en diagnóstico. El usuario confirmó que `prove2.riv` ya incluye el estado en minúsculas. El fallback local no lo selecciona. Este ajuste se añade al trabajo activo sin retirar la revisión de storytelling aprobada.

- [x] Añadir reacción tipada, instrucciones remotas, umbral de confianza, duración y etiquetas ES/EN.
- [x] Conectar el enum Rive `question`, el botón de diagnóstico y el retorno temporal a `Base`.
- [x] Verificar selección del contrato remoto y recorrido visual de Home.

| Comprobación | Resultado |
|---|---|
| `npm exec -- vitest run --maxWorkers=1` | PASS: 24 archivos / 135 tests. Incluye schema del endpoint, decisión de baja confianza y binding Rive. |
| Typechecks `tsconfig.app.json`, `tsconfig.node.json`, `tsconfig.api.json`, `tsconfig.tests.json` | PASS, los cuatro proyectos. |
| `npm run lint` | PASS, cero advertencias. |
| `npm run build` | PASS. |
| Playwright local con `/api/decide` interceptado | PASS ES/EN: formularios «¿Eres gay?» / “Do you like FOMO?” → decisión remota `QUESTION` → HUD «Duda» / “Skeptical” → estado Rive `question` → retorno a `Base`; Rive listo, un canvas, cero errores de consola. Estado manual de diagnóstico también comprobado. |

Captura visual: [question-state.png](evidence/question-state.png). La semántica del modelo remoto se probó con respuesta mock; no se llamó al proveedor real. La revisión de storytelling de partículas sigue siendo el siguiente trabajo de fase 4.

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

## Fase 3 — Aprobada para avanzar

**Dirección visual confirmada durante implementación:** el usuario pidió Jev libre, sin marco/contenedor; texto alternado izquierda/derecha y desplazamiento de Jev por los espacios libres al deslizar. Versión móvil con puesta en escena adaptada. Confianza/decisión se explican en su capítulo, sin HUD ni etiquetas repetidas constantemente.

- [x] Revisar contrato Rive y mapear ocho capítulos a acciones existentes y alternativa DOM de percepción.
- [x] Crear catálogo tipado ES/EN y máquina XState; tests de repetición, reemplazo, suspensión, carga/error y Strict Mode.
- [x] Aplicar composición abierta, texto alternado y trayectoria scroll desktop/móvil.
- [x] Verificar secuencias reales, aislamiento de Home, teclado, preferencias, errores, reduced motion y teardown.
- [x] Ejecutar matriz final y registrar capturas, dependencias, peso y límites.
- [x] Presentar entrega y recibir aprobación de fase 3: «perfecto, aora continua con la siguiente fase, esta ya esta aprobada», tras corregir el cursor.

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

### Corrección acotada — Jev sin máscara radial, 2026-10-07

**Solicitud:** retirar únicamente el óvalo de desvanecimiento que recorta acciones amplias, porque `prove2.riv` ya tiene fondo transparente. El usuario también autorizó lanzar a Luna para microcommitear el proyecto.

**Delta:** `src/App.css` deja de aplicar `mask-image` / `-webkit-mask-image` a `.character-rive`; se elimina solo el token del gradiente sin consumidores en `src/styles/tokens.css`. Escala `1.9`, asset, dimensiones, proporción de Home, composición, sensores y controlador conservados. Se actualizan únicamente las menciones del contrato vigente en spec/design/interacción; las evidencias históricas siguen intactas.

**Verificación:** reproducción previa mediante estilos computados confirmó el gradiente elíptico. Playwright posterior pasó Home/Features en 1440×900 y 390×844 con ambos temas: máscaras `none`, escala `1.9`, sin overflow horizontal. Home ejercitó Ghost/Flower reales desde Diagnóstico. Geometría Jev/input idéntica antes/después en escritorio; retorno de Features y movimiento reducido también comprobados. Ocho capturas y detalles en [unmasked-jev](evidence/unmasked-jev/README.md). Consola sin errores. `npm run build` PASS (`tsc -b` + Vite), `git diff --check` PASS con avisos LF/CRLF. Por el delta solo CSS no se repitieron Vitest/ESLint/typecheck de tests; no se afirma una nueva matriz completa de fase 3.

**Microcommits:** Luna guardó el trabajo previo en nueve commits lógicos (tooling, shell, sesión Home/API, Features, asset, guías/evidencia, integración Jev, contrato SDD y rename del task). La retirada de máscara y su registro se guardan después en un fix independiente. No hubo push ni cambios del código previo durante esta organización.

**Estado:** corrección verificada; pendiente revisión visual del usuario. Fase 3 continúa pendiente de aprobación y About no comenzó. Emulación de Chromium, sin móvil físico/Safari ni benchmark.

### Revalidación solicitada de fase 3 — 2026-10-07 (host local)

**Solicitud:** «quiero que ejecutes la fase tres». Al retomar, la implementación de Features ya estaba entregada en los commits existentes. Se contrastó con spec/plan/design y se repitió la verificación completa sobre el build actual, incluida la retirada de máscara. No se requirieron cambios del runtime para cumplir la fase.

| Comprobación ejecutada | Resultado |
|---|---|
| `npm exec -- tsc --noEmit -p tsconfig.app.json` | PASS. |
| `npm exec -- tsc --noEmit -p tsconfig.node.json` | PASS. |
| `npm exec -- tsc --noEmit -p tsconfig.api.json` | PASS. |
| `npm exec -- tsc --noEmit -p tsconfig.tests.json` | PASS. |
| `npm run lint` | PASS, cero advertencias. |
| `npm exec -- vitest run --maxWorkers=1` | PASS: 18 archivos / 111 tests. |
| `npm run build` | PASS: Features JS 197,36 kB / gzip 71,09; CSS Features 7,88 / 1,92; shell 340,99 / 108,48; JSX compartido 8,77 / 3,33; Character 211,71 / 59,99; Motion 85,59 / 28,34; CSS común 37,59 / 8,08. |
| 29 bloques individuales `node ".dev/evidence/phase-3/verify.mjs" <caso> <bloque>` con `JEV_EVIDENCE_DIRECTORY=.dev/evidence/phase-3/revalidation` | PASS: 240 checks / 35 capturas en Chromium de producción. |
| `node ".dev/evidence/phase-3/aggregate.mjs"` con la misma variable de salida | PASS: todos los reportes completos/posteriores a fuentes, cero errores inesperados, 120 avisos WebGL ReadPixels y dos errores esperados del asset 404. |
| `node --check ".dev/evidence/phase-3/verify.mjs"` / `aggregate.mjs` | PASS, ejecutados por separado. |
| Validador temporal `validate-jev-home-revision.mjs` | PASS: 16 documentos, 231 enlaces/anclas locales y render directo. Incluye la nueva evidencia. |
| `git diff --check` | PASS; avisos de normalización LF/CRLF de Windows. |

**Evidencia:** [revalidation](evidence/phase-3/revalidation/README.md) guarda los resultados/capturas nuevos; se conservan íntegros los originales. Los scripts permiten elegir su carpeta de salida mediante `JEV_EVIDENCE_DIRECTORY`, manteniendo el default anterior. La revisión Standards no encontró problemas; Spec detectó dos huecos del harness, corregidos: contar API desde antes de cargar Features y añadir `src/App.css`/los dos scripts al fingerprint y a la comprobación de frescura. Después se repitieron los 29 bloques: solo esta segunda matriz completa integra el agregado final. Se inspeccionaron capturas de ambos temas y tamaños, texto alternado y triángulo sin recorte radial.

**Revisión final:** Standards PASS, cero hallazgos; Spec PASS, cero hallazgos pendientes. Ambos ejes comprobaron las correcciones y el registro final sin ampliar el alcance ni repetir pruebas del runtime.

**Incidencias:** las dos primeras ejecuciones concurrentes aprobaron los checks de layout pero excedieron el timeout del comando durante el cierre, sin guardar su reporte. El cierre mínimo aislado y las repeticiones individuales terminaron correctamente; no se identificó una causa suficiente para modificar el cierre. En la segunda matriz, `action-6` sufrió una demora excepcional de arranque (primer progreso tras unos 490 s), registró failure por deadline y se repitió con éxito en 7 s. Ninguna corrida incompleta/fallida cuenta en el agregado. Los 29 bloques finales se ejecutaron uno a uno, con progreso: aproximadamente 3–18 s por bloque habitual y 56 s para aislamiento/recuperación. No se lanzó una matriz monolítica.

**Límites y puerta:** viewport, touch, visibilidad y movimiento reducido emulados; API de Home con fixture y offline tras cargar recursos. Sin móvil físico/Safari/iOS ni LCP/FPS. Fase 3 presentada para revisión, pendiente aprobación visual/funcional; fase 4 sigue pendiente. No se creó commit ni push en esta solicitud.

### Corrección acotada — retirar cursor decorativo de Percibe

**Solicitud:** el usuario señaló el cursor junto a Jev en móvil y pidió «solo arregles eso».

**Causa reproducida:** `.showcase-cursor` era un SVG añadido por `FeaturesPage`, con ruta `m5 3 14 11-7 1-3 7z` y coordenadas del catálogo de Percibe; el DOM móvil confirmó una instancia de 20×20 px. No procedía del asset Rive.

**Delta:** retirar ese elemento, su cálculo/tipo de estilos, las coordenadas del catálogo y las dos reglas CSS exclusivas. Ajustar únicamente la descripción ES/EN de Percibe y su mención en interacción para no anunciar un cursor eliminado. Las acciones Base, los tiempos y los demás capítulos conservan sus contratos.

**Verificación:** `npm run build` PASS; ESLint de `FeaturesPage.tsx`/`catalog.ts` PASS (primera ejecución tuvo timeout; repetición correcta); `vitest run tests/showcasePlayer.test.ts --maxWorkers=1` PASS, 15 tests existentes. Playwright en 390×844 y 1440×900 confirmó cero cursores decorativos, ocho capítulos, un canvas listo, reproducción Base y siguiente capítulo funcional, sin overflow horizontal ni errores de consola. [Captura móvil posterior](evidence/phase-3/cursor-removed-mobile.png). `git diff --check` PASS con avisos LF/CRLF. No se repitió la matriz completa ni se añadieron tests para este delta visual reversible; la matriz previa permanece como antecedente anterior al arreglo. Fase 3 sigue pendiente de aprobación.

## Fase 4 — Entrega para revisión

**Guion y alcance:** cinco escenas — pregunta, experimento 2D, evolución de Rive a comportamiento, Abdair Coca y visión futura. Relato original preservado, sin nuevas fechas/retratos ni promesas de funcionalidades entregadas. Composición abierta, metáfora 2D de salir de la caja de chat, capas DOM y autoría tipográfica. GSAP controla el escenario; Motion los controles; Rive el personaje actual. Se reutiliza el manager global Lenis existente, sin nuevas dependencias ni sesión de Home.

- [x] Registrar aprobación de fase 3 y revisar relato, contratos y seams.
- [x] Implementar catálogo ES/EN y cinco escenas accesibles.
- [x] Implementar scroll/presentación, pausa, preferencias y alternativa estática.
- [x] Verificar teclado, mobile, idiomas/temas, aislamiento, error y limpieza.
- [x] Registrar checks/evidencia y presentar fase 4 para revisión.
- [x] Recibir aprobación visual/funcional de fase 4 («la fase 4 ya está aprobada», 2026-10-11).

### Entrega de fase 4 — 2026-10-08

**Resultado:** cinco escenas con composición abierta, texto breve ES/EN y detalles ampliables. La primera abre la pregunta original con una metáfora de caja de chat; el scroll libera a Jev, presenta capas conceptuales, firma al creador y señala la visión futura. Cierre original en inglés con metadata de idioma. No fechas, retratos ni capacidades inventadas. Personaje/asset/escala `1.9` y Home conservados.

**Seams:** `features/story/catalog.ts` es el guion y verifica claves ES/EN; `useStoryScroll` posee selección, anchors, pin/timeline y cleanup; `AboutPage` posee estado de lectura/carga por intento, deadline/retry y un Character de presentación que entra en Base. GSAP gobierna trayectoria/diagramas; Motion, controles/estado y un wrapper separado que retira la ilustración durante lectura móvil; Rive, el dibujo. El manager Lenis ya existente se reutiliza. `useStageVisibility` se movió sin cambio de comportamiento a `features/presentation/` y el timeout de readiness pasa a token compartido con alias de Showcase. Features conserva su sesión/guion; se ajusta únicamente ese import y la referencia de su agregador. Sin dependencias nuevas ni llamadas API en About.

| Comprobación ejecutada | Resultado |
|---|---|
| `npm exec -- tsc --noEmit -p tsconfig.app.json` | PASS. |
| `npm exec -- tsc --noEmit -p tsconfig.node.json` | PASS. |
| `npm exec -- tsc --noEmit -p tsconfig.api.json` | PASS. |
| `npm exec -- tsc --noEmit -p tsconfig.tests.json` | PASS. |
| `npm run lint` | PASS, cero advertencias. |
| `npm exec -- vitest run --maxWorkers=1` | PASS: 20 archivos / 124 tests. Trece tests nuevos de narrativa/lifecycle/ownership/arranque estático y retorno. |
| `npm run build` | PASS: About JS 14,60 kB / gzip 5,48; CSS About 8,31 / 2,05; scrollRuntime compartido 133,71 / 50,24; Features JS 63,11 / 20,86; shell 341,20 / 108,55; Character 212,57 / 60,31; Motion 85,59 / 28,34; CSS común 38,35 / 8,22; JSX compartido 8,77 / 3,33. |
| 23 bloques `node ".dev/evidence/phase-4/verify.mjs" <caso> <bloque>` | PASS: 365 checks / 66 capturas; ocho variantes visuales, cuatro controles, cuatro reduced/reflow, cuatro entradas directas reducidas con retorno, lifecycle, aislamiento/error y fallback sin observer. |
| `node ".dev/evidence/phase-4/aggregate.mjs"` | PASS: 23 reportes completos con fingerprint vigente; cero errores inesperados, 96 avisos ReadPixels y dos errores 404 esperados. |
| `node ".dev/evidence/phase-3/verify.mjs" desktop-light-es action-1` con salida en fase 4 | PASS: seis checks adicionales de Features; bindings Hello/Flower/Ghost reales, sin inicializar Home ni consultar API. Reporte independiente, fuera del agregado de About. |
| `node --check ".dev/evidence/phase-4/verify.mjs"` / `aggregate.mjs` | PASS, ejecutados por separado. |
| Validador temporal `validate-jev-home-revision.mjs` | PASS: 17 documentos / 309 enlaces-anclas locales, incluido el índice completo de capturas; render directo preservado. |
| `git diff --check` | PASS; avisos de normalización LF/CRLF de Windows. |

**Peso:** About propio JS+CSS cuesta aproximadamente 7,53 kB gzip; al entrar en cualquiera de las presentaciones se añade el chunk compartido GSAP/Lenis de 50,24 kB gzip si aún no estaba cargado. Es una nueva partición de dependencias existentes, no una instalación nueva ni coste duplicado por ruta. El conjunto JS/CSS de Home sube aproximadamente 0,53 kB gzip frente a la retirada del cursor (+0,07 shell, +0,14 CSS común, +0,32 Character). Excluye WASM/`.riv`; no es un benchmark de LCP/FPS.

**Hallazgos corregidos:** pausa explícita de los propios triggers visuales fuera de vista, manteniendo selección textual; reanudación del motor tras ocultar pestaña reafirma esa pausa. Detalles largos se superponían a la ilustración en móvil: se retira/pausa al leer y se conserva canvas/escena. Las etiquetas de capas se recolocaron dentro del viewport. El retry se movió fuera del wrapper GSAP a una capa independiente, porque una sección interceptaba el pointer. Base se prepara con el controlador vigente antes de declarar readiness editorial; el harness espera además 1,8 s para evitar capturar el primer frame GPU prematuro.

**Corrección adicional de arranque estático:** una visita directa con reduced motion mostró un canvas vacío aunque el binding decía Base; las pruebas de cambio de preferencia en vivo no detectaban ese caso. Character prepara solo las presentaciones estáticas de forma invisible y acotada (`--presentation-pose-warmup: 3000ms`), selecciona Base mediante los bindings vigentes con trigger en el siguiente RAF, pausa/detiene render antes de anunciar readiness y bloquea nuevas acciones del controlador mientras la pose está congelada. Memoiza el layout por instancia para evitar reasignaciones en rerenders. Timer/RAF se cancelan al ocultar/desmontar; errores se envían al callback vigente. Las pruebas manuales de uno/dos draws y preparación de 1,8 s no dieron una pose válida, por lo que no se conservan como solución. La solución final se verificó visualmente y con igualdad del hash de capturas separadas por 700 ms en cuatro entradas frías. Home mantiene sus defaults: el warmup y el bloqueo de acciones solo se aplican a `presentation` estática. Asset y canvas directo intactos, sin capturar/transformar píxeles para la UI.

**Retorno estático:** la revisión Spec detectó que volver a una pose ya lista podía arrancar otra preparación antes de ocultarla. Se añadió un ref de pose preparada: al reactivar una presentación estática se conserva su framebuffer pausado, sin resize/play/warmup. La preparación que sí necesita arrancar oculta su host sincrónicamente antes de `play`, sin esperar al commit React. Un test unitario y las cuatro entradas frías verifican ausencia de replay y hash idéntico tras ocultar/mostrar. Se repitieron los 23 bloques tras esta última corrección; el agregado no mezcla matrices anteriores.

**Revisión final:** Standards PASS, cero hallazgos pendientes; Spec PASS, cero hallazgos pendientes tras corregir el retorno estático. Ambos ejes confirmaron el cierre sin ampliar alcance. Validación documental/sintaxis/whitespace PASS, registrada en la tabla anterior.

**Incidencias y límites:** una primera corrida de tests tuvo timeout; tras ajustar los nombres accesibles con saltos de línea y esperar la transición del botón, los tests dirigidos y la suite final pasaron. Una corrida intermedia de layout agotó 60 s antes de terminar. La suspensión prolongada del host interrumpió una carga WASM con `ERR_NETWORK_IO_SUSPENDED`; se repitió con éxito. Los reportes fallidos/intermedios y la primera matriz de 19 bloques no integran el agregado final. La matriz final de 23 bloques se ejecutó uno a uno, aproximadamente 9–54 s por bloque, con avance/deadline; sin matriz monolítica. Chromium 153; viewport/touch/visibilidad/reduced motion emulados, fixture de Home y offline tras cargar recursos. Sin móvil físico/Safari/iOS ni LCP/FPS. [Evidencia completa](evidence/phase-4/README.md).

**Puerta:** About presentado para revisión; fase 4 sigue pendiente de aprobación y fase 5 no comenzó. No se creó commit ni push en esta entrega. La matriz de fase 3 permanece como historial anterior a la nueva partición compartida; no se presenta como matriz actual del rediseño completo.

### Comprobaciones tras aprobación de fase 4 — 2026-10-11

**Solicitud:** «La fase 4 ya está aprobada, ejecuta las comprobaciones para confirmar que siguen pasando». Solo se repitieron comprobaciones; no se cambió código ni se inició la fase 5. Se ejecutó `npm ci` desde el lockfile (278 paquetes, cero vulnerabilidades) porque `node_modules` no estaba presente. Árbol sin modificar antes de esta entrada; sin commit ni push.

| Comprobación | Resultado |
|---|---|
| `npm exec -- tsc --noEmit -p tsconfig.app.json`, `tsconfig.node.json`, `tsconfig.api.json`, `tsconfig.tests.json` (por separado) | PASS, sin salida de error. |
| `npm run lint` (`eslint . --max-warnings=0`) | PASS, cero advertencias. |
| `npm exec -- vitest run --maxWorkers=1 --reporter=verbose` | PASS: 26 archivos / 179 tests. |
| `npm run build` (`tsc -b && vite build`) | PASS. Shell 350,24 kB / gzip 111,78; About JS 23,42 / 9,48; About CSS 7,11 / 2,08; scrollRuntime 133,83 / 50,29; Features JS 61,64 / 20,57; Character 212,57 / 60,31. |

No se repitieron las matrices de Playwright de fase 4 (23 bloques) en esta comprobación; la evidencia de esa matriz permanece en `evidence/phase-4/`.

## Estado de fases restantes

### Revisión aprobada — storytelling de partículas, 2026-10-08

Usuario aportó historia real y tres recursos en `public/story/`; aprobó escenario cinematográfico oscuro en ambos temas, relato de proyectos y estrella final que se abre para revelar a Jev. Aprobó plan y solicitó «implementalo». Alcance registrado en spec/plan; implementación en curso. La evidencia anterior se conserva como antecedente, no verifica esta revisión.

- [x] Inspeccionar recursos, trabajo local y contratos; registrar aprobación.
- [x] Implementar guion ES/EN y composiciones de partículas (trabajo previo conservado y pulido).
- [x] Integrar scroll reversible, estrella/revelación, móvil y alternativa estática.
- [x] Verificar checks/navegador y registrar resultados de la revisión; evidencia vigente en `evidence/polish/`.
- [ ] Recibir revisión visual; fase 5 espera aprobación.

| Fase | Estado | Puerta |
|---|---|---|
| 1 — Home de referencia | Aceptada para avanzar | Autorización del usuario; teclado físico sigue pendiente. |
| 2 — Conducta real de Home y habla bilingüe | Aceptada para avanzar | Autorización del usuario tras revisión HUD/Home sin scroll. |
| 3 — Features determinista | Aprobada | Autorización explícita tras corregir cursor decorativo. |
| 4 — About scrollytelling | Aprobada | Aprobación explícita del usuario el 2026-10-11; comprobaciones repetidas. |
| 5 — Integración, accesibilidad y rendimiento | Pendiente, no iniciada | Desbloqueada por la aprobación de fase 4; requiere instrucción para empezar. |

## Carga de Jev — ampliación 2026-10-11

**Solicitud:** «Sí, adelante con las cuatro decisiones y actualiza `design.md`». Contrato en [design.md](../design.md#carga-de-jev-ampliación-aprobada-2026-10-11) y requisitos en [spec.md](spec.md#carga-de-jev--ampliación-aprobada-el-2026-10-11). Sin push ni deploy.

**Nota de registro:** se pidió crear `TASK.md`. En Windows, el sistema de archivos no distingue mayúsculas, así que ese nombre apuntaba a este mismo `task.md` y lo habría sobrescrito. El registro se añadió aquí para conservar el historial.

**Checklist:**

- [x] Decisiones aprobadas registradas en `design.md` y `spec.md`.
- [x] Línea base antes de editar: typecheck (`tsc -b`), `typecheck:tests`, lint y Vitest: 26 archivos / 179 tests PASS.
- [x] Jev revelada con retardo de 1,8 s. Revertida la detección por `Advance`: el usuario vio el logo en todos los casos. Vuelve el retardo de CSS (`data-ready` + `transition ... 1.8s`), y `onPainted` avisa a los mismos 1,8 s para el cargador y el freno.
- [x] Pantalla de carga en Home con vuelo de partículas hacia «Historia» y reacción del enlace (verificado en Chromium headless: vuelo de ~1,2 s y enlace reaccionando).
- [x] Capacidades: freno con rebote hasta que Jev esté pintada (verificado con `prove2.riv` retrasado: el scroll se detiene en el inicio de «Reacciona», el rebote sube 16 px y vuelve a 0, y se libera tras pintarse).
- [x] Historia: inicio de la carga en el primer cambio de partículas (verificado: el personaje se monta al entrar en «Todo empezó con cartón»; se pinta después).
- [x] Pruebas y comprobaciones: `tsc -b`, `typecheck:tests`, `npm run lint`, Vitest 29 archivos / 191 tests PASS, `npm run build` PASS.
- [ ] Verificación visual en navegador: pendiente de revisión del usuario (estética del vuelo, rebote, logo en primeros frames). Chromium headless con Playwright se usó como comprobación de comportamiento, no visual. La extensión de Chrome no estaba conectada.

**Supuestos a verificar:**

- Con el retardo fijo de 1,8 s, el logo puede seguir visible si la primera pose tarda más en el equipo del usuario. Revisar en el navegador real.
- Con movimiento reducido elegí una parada seca sin rebote en Capacidades, porque el usuario no decidió ese caso. Revisar.
- Movimiento reducido en Home y Capacidades no se ha probado en navegador; solo en pruebas unitarias.
- En Historia, la carga sí arranca al primer cambio, pero el tiempo hasta pintar en Chromium headless con SwiftShader fue de unos 3 s; en un equipo real será menor. No es una medición de rendimiento.

### Pantalla de carga reutilizable — 2026-10-11

**Solicitud:** la pantalla de carga también en Capacidades, sin vuelo hacia About, con las partículas de About (incluida su reacción al cursor) y como componente reutilizable.

**Cambios:**

- `CreatureLoader` en `src/features/loading/`: componente reutilizable con `visible`, `active`, `reduced` y `caption`. Usa `ParticleVortex` en su estado inicial (`StarParticles`, cargado con `lazy`). Con movimiento reducido muestra un punto estático.
- `ParticleVortex`: nueva prop opcional `sources` (por defecto, las imágenes de la historia). El cargador pasa una lista vacía para no preparar imágenes.
- `story.css`: las variables `--particle-*` se movieron de `.story-page` a `:root`, con los mismos valores.
- Home y Capacidades usan el mismo cargador. Capacidades lo muestra mientras el freno está activo.
- Eliminados: el vuelo hacia About, `id="nav-about"` en la cabecera (revertido), las reglas de reacción del enlace y el módulo de geometría propio con su prueba.

**Verificación:** `tsc -b`, `typecheck:tests`, lint y build: PASS. Vitest: 29 archivos / 187 tests PASS. En Chromium (Playwright, WebGL por SwiftShader): el cargador muestra las partículas en ambas páginas (`prepared` y `running`), la deformación del cursor responde (`data-deformation` ≈ 0,08), no hay atributos de vuelo, y el cargador se oculta al revelarse Jev, 1,8 s después de estar lista.

**Pendiente:** revisión visual del usuario de las partículas en el cargador (tamaño, densidad y contraste sobre Home y Capacidades).

### Cambio posterior del cargador — 2026-10-11

**Solicitud:** sustituir las partículas por tres puntos animados sencillos, quitar el texto «Despertando a Jev…» en Home y Capacidades, y limpiar el código de este cambio.

**Cambios:**

- `CreatureLoader` ahora solo renderiza tres puntos CSS (`transform` y `opacity`), decorativos (`aria-hidden`), sin props de texto.
- Eliminados: `StarParticles.tsx`, la prop `sources` de `ParticleVortex`, el reubicado de `--particle-*` en `:root` de `story.css` (revertidos a su versión original), las claves `waking` y `observing` de `messages.ts`, y la clase huérfana `.character-loading` de `App.css`.
- `tests/creatureLoader.test.tsx` cubre los puntos, la visibilidad y el modo reducido.

**Verificación:** `tsc -b`, `typecheck:tests`, lint y build: PASS. Vitest: 29 archivos / 187 tests PASS. En Chromium (Playwright, WebGL por SwiftShader): tres puntos presentes, animación activa, sin texto en el cargador en ambas páginas, y el cargador se oculta al revelarse Jev.

**Pendiente:** revisión visual del tamaño y ritmo de los puntos.

### Corrección del tope de Capacidades — 2026-10-11

**Problema:** mientras Jev cargaba, el scroll llegaba hasta «Reacciona» sin tope en «Percibe».

**Corrección:** el límite pasa al inicio de «Percibe». Se mide una vez al activarse el freno y al cambiar el tamaño de la ventana, porque el rebote desplaza las tarjetas y una medición en vivo hacía que el tope se corriera 16 px.

**Verificación:** `tsc -b`, `typecheck:tests`, lint, build: PASS. Vitest: 187 tests PASS. En Chromium con la descarga de Rive retrasada: el scroll se detiene en la posición de «Percibe» (332 px) y se libera al cargar Jev.

### Freno rígido en Capacidades — 2026-10-11

**Solicitud:** quitar el rebote del freno, para que la parada sea rígida y sin errores, y limpiar el código de esa eliminación.

**Cambios:**

- `useShowcaseScroll`: eliminados el rebote (`pull`, la animación con Motion, su ref y su transición), el caché del límite y el listener de `resize`. El límite se mide en vivo con `targetTop(0)`, porque ya nada desplaza las tarjetas.
- `scrollGate.ts`: eliminada `GATE_PULL_PX`.
- Documentación actualizada en `design.md`, `docs/interaction.md` y `.dev/spec.md`.

**Verificación:** typecheck, typecheck de pruebas, lint y build: PASS. Vitest: 29 archivos / 187 tests PASS. Chromium con la descarga de Rive retrasada: la parada es rígida en 332 px (inicio de «Percibe») y se libera al cargar Jev, sin errores.

### Recorte de Jev y de partículas — 2026-10-12

**Solicitud:** revisión visual: el halo de Jev (Inicio, Capacidades) y la nube de partículas (Historia) aparecían cortados en rectángulos. Pedido: aplicar el arreglo sin romper móvil ni escritorio.

**Causa verificada:** el canvas de partículas mide el cuadrado `.story-art`; un `<canvas>` siempre recorta su bitmap, así que la nube se corta en sus bordes (visible en móvil en «Machine learning»). Jev tenía `overflow` de recorte en `.creature-zone`, `.showcase-creature` y `.story-creature`, y su canvas se agranda con `transform: scale` (2,1 en Inicio, 1,9 en el resto).

**Cambios:**

- `App.css`, `story.css`, `showcase.css`: retirado el `overflow` de recorte de los contenedores de Jev. La página conserva su recorte horizontal (`overflow-x: clip` / `overflow: clip` del home).
- `story.css`: nuevo token `--particle-bleed: 0.3`; `.story-particles` ocupa el cuadrado más un 30 % por lado.
- `ParticleVortex.tsx`: el bitmap se dimensiona con el canvas completo y el sistema de coordenadas se desplaza al cuadrado del host; `clearRect` limpia el bitmap completo. La geometría, el cursor y el presupuesto de partículas no cambian.
- `design.md` y `docs/architecture.md`: documentados el nuevo contrato y el sangrado.

**Verificación:** `npm run typecheck`, `typecheck:tests`, `lint`, `npm run build`: PASS. `npx vitest run`: 29 archivos / 187 tests PASS. Playwright (Chromium, SwiftShader) en escritorio 1440×900 y móvil 390×844, claro y oscuro: sin overflow horizontal ni errores de consola. Medición de alfa en el borde del canvas en 10 posiciones de scroll: 0 en todas. Cursor: deformación ≈0,14 y retorno a 0. Evidencia en [clipping-2026-10-12](evidence/clipping-2026-10-12/README.md).

**Limitación y decisión pendiente:** en Features móvil, el cuerpo de Jev ya tapaba parte del capítulo «Reacciona» antes de este cambio. Tras el cambio, el halo difuminado pasa también por detrás de ese texto; el texto sigue encima y legible con menos contraste. Pendiente de revisión visual del usuario.

**Estado:** cambio en el working tree, sin commit.

### Controles de Inicio sin desplazamiento — 2026-10-12

**Solicitud:** la respuesta de Jev con texto y «Borrar conversación» no deben mover los componentes; el texto se superpone y el botón aparece con suavidad sin mover el input. Sin cambios adicionales.

**Causa verificada:** el `speech-slot` y la fila `whisper__meta` crecían dentro del flujo y empujaban la zona de Jev y el input (medido: zona −30 px con respuesta; input −46 px con el botón en escritorio).

**Cambios:**

- `ContextWhisper.tsx`: el botón de borrar entra y sale con fundido (`AnimatePresence` + `m.button`).
- `App.css`: `.speech-caption` pasa a posición absoluta sobre la zona de Jev; `.speech-slot` conserva su altura en reposo. `.whisper__meta` pasa a posición absoluta bajo el input (`.whisper-wrap` relativo); se elimina el reservado de altura y se mantiene la regla `:empty`.

**Descartado:** reservar la altura de la fila en el flujo. Cambiaba el layout en reposo (zona de Jev −46 px en escritorio) y, en la carga, dejaba el bitmap de Rive calculado con la escala del canvas y el cuerpo de Jev sin pintar.

**Verificación:** typecheck, typecheck de pruebas, lint, build: PASS. Vitest: 29 archivos / 187 tests PASS. Playwright (Chromium) en escritorio 1440×900, móvil 390×844 y móvil bajo 390×640: input, zona y footer idénticos en reposo, con botón y con respuesta. El reposo coincide con el original (escritorio: input 784, zona 594; móvil: input 728, zona 473). Canvas de Rive pintado en las seis cargas medidas. Evidencia en [home-controls-2026-10-12](evidence/home-controls-2026-10-12/README.md).

**Limitación:** en desarrollo no hay respuesta remota de Jev, así que la respuesta se verificó inyectando un nodo `speech-caption` en el DOM.

## Reglas de handoff

- Seguir `spec.md` para intención y `plan.md` para secuencia. Si código y docs divergen, inspeccionar comportamiento real y conservar clara la diferencia entre objetivo e implementación.
- Trabajar solo la fase activa. Limitar cambios al alcance aprobado; preguntar ante ambigüedad material.
- Después de cada ciclo de implementación/check, actualizar este archivo con comandos, resultados, capturas, limitaciones, decisiones y siguiente paso. Un test verde no equivale a aprobación.
- Tras entregar una fase, detenerse y esperar revisión explícita. Si pide cambios, mantener abierta la misma fase.
- Al finalizar toda la feature, presentar findings y obtener aprobación final. Después vaciar el contenido de `.dev/spec.md`, `.dev/plan.md` y `.dev/task.md`, conservando los tres archivos.
