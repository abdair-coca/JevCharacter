# Tarea: Jev compañero con memoria persistente

Handoff vivo de la feature. **Antes de continuar, leer `spec.md`, `plan.md`, este archivo y `../design.md`.**

## Retoma aquí

- **Fase activa:** fase 3 (panel «Lo que Jev recuerda» y cierre), implementada y verificada el 2026-10-21; **entregada para revisión final**.
- **Aprobaciones:** spec y plan aprobados el 2026-10-21 en el quiz («Aprobado»). «Borrar conversación» conserva la memoria (mismo quiz). Fases 1 y 2 aprobadas el 2026-10-21 («continua con la siguiente fase», dos veces).
- **Siguiente acción exacta:** revisión final del usuario. Tras la aprobación final: informar resultados y después vaciar el contenido de `spec.md`, `plan.md` y `task.md`, conservando los tres archivos.
- **Estado del código:** las tres fases están commiteadas. Sin deploy ni push.

## Gota de agua real sincronizada con la música — 2026-10-30

Pedido: «i want it becomes like real wather, with a few drops it has to be incredible, and i has to match with the music». Quiz 1: «Gota de agua grande», sincronía «Completa», sin sonido «Mismo ritmo». Quiz 2: borde «Agua pura» y plan «Aprobado con deploy» (sin push).

- [x] `storyMusic`: `groove` (pura) decide arpegio, bombo y tema por semicorchea; la usan la banda sonora y un secuenciador silencioso sobre el reloj de `performance` cuando no hay sonido (antes del gesto o silenciado). `onPulse` publica `note`/`melody`/`kick`/`impact` con el instante en que se oyen (hora de audio → `performance` + `outputLatency`). Sin cambios de sonido: los 12 tests previos pasan sin tocar.
- [x] `waterPhysics` (pura): latido, chapoteo y tres lóbulos como muelles subamortiguados; cinco gotitas con muelle de vuelo que se funden al volver; hasta seis ondas. Nota → onda; melodía → gotita (más el tercer lóbulo); bombo → latido; golpe → salpicadura de todas las gotitas.
- [x] `orbShader`: gota de agua por campo de distancia (`smin` cuerpo + gotitas), altura de gota sobre cristal (borde de cuarto de círculo, acotado al 55 % del radio), normales por diferencias finitas, refracción con dispersión leve, borde oscuro por reflexión interna, ventana con Fresnel, destello, cáustica, sombra y luz de estudio tenue cuando no hay imagen. Anillo de agua alrededor de Jev. Variable `distance` renombrada (choca con la función GLSL) y menos muestreos (sombra solo cerca de la gota, 3 muestras de refracción).
- [x] `LiquidOrb`: encola los pulsos y los aplica cuando se oyen; descarta los de más de 250 ms o con la escena en pausa; `dataset.water` expone la energía. `AboutPage` pasa `storyMusic.onPulse`. Tokens `--orb-height`, `--orb-refraction`, `--orb-dispersion`; fuera los colores Siri.
- [x] Tests: `storyMusic` (+2: pulsos con sonido y ritmo silencioso con relevo), `waterPhysics.test.ts` (4) y `liquidOrb.test.tsx` (+1: a tiempo, nunca antes, descarta lo pasado).
- [x] Docs: `design.md`, `docs/interaction.md`, `docs/architecture.md`.

| Comprobación | Resultado |
|---|---|
| `tsc -b`, `tsc -p tsconfig.tests.json --noEmit`, `eslint . --max-warnings=0` | PASS. |
| `vitest run --maxWorkers=1` | PASS: 411 tests en 51 archivos. |
| `npm run build` | PASS: `AboutPage` 35,19 kB JS (antes 29,91); `index` sin cambios (356,57 kB). |
| `npx playwright test` de `routes`, `reduced-motion` y `navigation` | 9/9 PASS. |
| Revisión visual (Playwright sobre `vite preview` temporal, SwiftShader, 1440×900 y 390×844) | Sin errores de consola. Capturas en `evidence/water/`. Energía del agua en ML muestreada cada 150 ms sin sonido: 0,36–0,76 y en movimiento continuo. |
| `npx playwright test` completo | Pendiente: no se corrió la suite entera. |

**Límites:** sin escuchar la sincronía con audio real (headless no tiene gesto de audio; la sincronía con sonido está cubierta por tests con reloj de audio falso); sin GPU real, teléfono real ni Safari. En móvil, la imagen de Bob queda bajo el titular de su escena (composición previa al agua, sin cambiar).

## Orbe transparente y scroll sin saltos al cierre — 2026-10-30

Pedido: «quiero que la gota sea transparente en todo momento y hay un error al pasar a tiny creature big decisions, medio que se vuelve loco». Quiz: el fallo es «El scroll salta», en «Escritorio»; transparencia «Pompa de jabón».

- [x] **Diagnóstico del salto:** `useStoryScroll` ataba el lease de Lenis a `active` (escenario en vista). Al salir el escenario camino del cierre, Lenis se paraba a mitad del desplazamiento y la rueda pasaba a scroll nativo; Features y Abdair ya usaban `visible`. Medido en Chromium con una muesca de 200 px: con el escenario en vista, 14 frames (máx. 48 px/frame); en el cierre, **1 frame de 200 px**. Tras el arreglo, en el cierre: 26 frames (máx. 24 px/frame).
- [x] **Arreglo:** el lease sigue `visible` (documento). El orbe, el trigger de progreso y el asentamiento se siguen pausando fuera de vista. Test nuevo en `storyScroll.test.tsx`, que falló antes del arreglo (`expected last call … [ true ]`) y pasa después.
- [x] **Pompa de jabón:** sin relleno oscuro ni cintas dentro. Dentro solo se ve lo que la lente refracta, más una película iridiscente que crece hacia el borde, brillo y halo tenue. También se corrige la composición: antes el interior mezclaba la imagen refractada con la sin refractar (imagen doble). Retirados `--orb-base`, `--orb-lens-glow` y el uniform `u_glow`.
- [x] Docs: `design.md`, `docs/interaction.md`, `docs/architecture.md`.

| Comprobación | Resultado |
|---|---|
| `tsc -b`, `tsc -p tsconfig.tests.json --noEmit`, `eslint . --max-warnings=0` | PASS. |
| `vitest run --maxWorkers=1` | PASS: 404 tests en 50 archivos. |
| `npm run build` | PASS: `AboutPage` 29,91 kB JS; `index` sin cambios (356,57 kB). |
| `npx playwright test` de `routes`, `reduced-motion` y `navigation` | 9/9 PASS. |
| Revisión visual y medición de rueda (Playwright sobre `vite preview` temporal, SwiftShader, 1440×900 y 390×844) | Sin errores de consola. Capturas `evidence/orb/bubble-*.png`. |
| Deploy a producción (2026-10-30, pedido «sí, despliégalo») | Commit `d20ba65`. `vercel deploy --prod` → `dpl_GuJFeozEA9op5r2QhQ9z78ZQCbyu`, alias `jev-bot-sigma.vercel.app`. Sin push. |
| Humo en producción (Playwright, 1440 y 390 px) | PASS: pompa preparada en las cinco escenas, anillo al revelar, sin errores de consola. Rueda en el cierre: 24 frames, máx. 26 px/frame (sin salto). |

**Límites:** sin rueda física, GPU real ni Safari; la medición usa eventos de rueda simulados; sin push.

## Orbe de cristal en Historia — 2026-10-30

Pedido sobre la gota recién desplegada: «no me gusta el efecto del liquido. tiene que ser como el efecto liquido de apple. premium». Quiz 1: referencia «Orbe de Siri», imágenes en «Colores originales», imagen «Detrás del cristal». Quiz 2: cintas «Espectro Siri» y plan «Aprobado con deploy» (sin push).

- [x] `LiquidOrb` (sustituye a `LiquidBlob`): shader WebGL2 (`orbShader.ts`). La imagen de la escena va detrás en sus colores, con fundido redondeado y los fondos casi negros recortados (el fondo de Bob ya no forma un rectángulo). Encima va el orbe: lente esférica con dispersión cromática en el borde, cintas de luz con curva suave contra la saturación, brillo, borde iridiscente y halo. Sobre las imágenes las cintas bajan para que el cristal deje ver.
- [x] `orbGeometry` (función pura): orbe solo y centrado (r 0,3) en la primera y la última escena; lente pequeña (r 0,16) que deriva y sigue al cursor en Bob, TitiEdu y ML; crece hasta r 0,6 y se centra mientras cambia la escena (la imagen cambia debajo); anillo de luz (r 0,44) al revelar a Jev.
- [x] Cursor (mouse/pen): muelle amortiguado y aplastamiento según la velocidad. Los ángulos salen de armónicos de la dirección en el marco fijo: `atan` dejaba una línea de un píxel en ±π (vista en SwiftShader) y el marco de la velocidad podía girar el borde al invertir el movimiento.
- [x] `story.css`: tokens `--orb-*` y sangrado del 30 %. Retirados `LiquidBlob`, `liquidGeometry`, `liquidShader` y sus tests.
- [x] Tests: `liquidOrb.test.tsx` (seguimiento y vuelta, movimiento reducido, pausa, texturas, fallo de imagen, sin WebGL2) y `orbGeometry.test.ts` (determinista, solo/lente, cubre centrado, anillo quieto).
- [x] Docs: `design.md` (el orbe prevalece y retira la recoloración de imágenes), `docs/interaction.md`, `docs/architecture.md`.

| Comprobación | Resultado |
|---|---|
| `tsc -b` y `tsc -p tsconfig.tests.json --noEmit` | PASS. |
| `eslint . --max-warnings=0` | PASS. |
| `vitest run --maxWorkers=1` | PASS: 403 tests en 50 archivos. |
| `npm run build` | PASS: `AboutPage` 30,69 kB JS + 8,01 kB CSS; `index` sin cambios (356,57 kB). |
| `npx playwright test` de `routes`, `reduced-motion` y `navigation` | 9/9 PASS. |
| Revisión visual (Playwright sobre `vite preview` temporal con SwiftShader: 1440×900, 390×844 y movimiento reducido) | Sin errores de consola ni de shader y sin desborde horizontal. Capturas en `evidence/orb/`. El servidor de desarrollo se había cerrado por falta de memoria: el usuario liberó RAM y cada captura usó un preview que se cerró al terminar. |
| `npx playwright test` completo | Pendiente: no se corrió la suite entera. |
| Deploy a producción (2026-10-30, «Aprobado con deploy») | Commit `6f0b691`. `vercel deploy --prod` → `dpl_2UANLpNmZKEhqN6Tzq7vezpXLQLu`, alias `jev-bot-sigma.vercel.app`. Sin push. |
| Humo en producción (Playwright, 1440 y 390 px) | PASS: `/about` con el orbe preparado en las cinco escenas, seguimiento del cursor, anillo al revelar, sin aviso de error ni errores de consola. |

**Límites:** GPU por software (SwiftShader); sin GPU real, teléfono real ni Safari; sin push.

## Gota líquida en Historia — 2026-10-30

Pedido: «quiero que reemplacemos una animacion que ya tenemos con un liquido que se deforma». Quiz 1: «Vórtice de Historia» y «Gota viscosa (blob)». Quiz 2: imagen «Dentro de la gota», final «Se abre en gotas», render «Shader WebGL», cursor «Se hunde y ondula». Plan concreto aprobado en un tercer quiz («Aprobado con deploy»; sin push).

- [x] `LiquidBlob` (sustituye a `ParticleVortex`): shader WebGL2 (`liquidShader.ts`) con 12 metaballs colocadas por `liquidGeometry` (función pura de fase y tiempo). Nebulosa en la primera escena; Bob, TitiEdu y ML dentro de la gota, recoloreados por luminancia y refractados en el borde; morph que estira la gota y suelta gotitas en espiral; anillo de gotitas que deja el centro a Jev. Cursor: hoyuelo gaussiano acotado con ondas y resortes (rebote sin crear gotas sueltas).
- [x] El SVG de ML (tamaño porcentual, natural 300×90) se rasteriza entero antes de recortar su gráfico: recortarlo directamente solo dibujaba el fondo y la cuadrícula.
- [x] Sin WebGL2, shader roto, contexto perdido o fallo de imagen → `onError` → lectura estática con aviso. Al desmontar se liberan texturas y programa; el contexto se conserva para el remontaje de Strict Mode.
- [x] `story.css`: tokens `--particle-*` → `--liquid-*`; sangrado 30 % → 15 %; DPR ≤1,5. `AboutPage`: `liquidError`/`.story-liquid-error`; copy `liquidError`. Retirados `ParticleVortex` y `starGeometry` (sin uso).
- [x] Tests: `liquidBlob.test.tsx` (WebGL2 simulado: hoyuelo y rebote, movimiento reducido, pausa, subida única de texturas, fallo de imagen, sin WebGL2) y `liquidGeometry.test.ts` (determinista, cuerpo acotado, gotitas fuera en el morph, centro libre al revelar). Retirado el test de la estrella.
- [x] Docs: `design.md` (excepción WebGL2 2D aprobada), `docs/interaction.md`, `docs/architecture.md`.

| Comprobación | Resultado |
|---|---|
| `tsc -b` y `tsc -p tsconfig.tests.json --noEmit` | PASS. |
| `eslint . --max-warnings=0` | PASS. |
| `vitest run --maxWorkers=1` | PASS: 403 tests en 50 archivos. |
| `npm run build` | PASS: `AboutPage` 30,50 kB JS + 8,11 kB CSS; `index` sin cambios (356,57 kB). |
| `npx playwright test` de `routes`, `reduced-motion` y `navigation` | 9/9 PASS. |
| Revisión visual (Playwright sobre dev con SwiftShader: 1440×900 y 390×844, más movimiento reducido) | Sin errores de consola ni de shader y sin desborde horizontal. Capturas en `evidence/liquid/`: `desktop-creator`, `desktop-bob`, `desktop-morph`, `desktop-pointer-dent`, `desktop-titi`, `desktop-ml`, `desktop-reveal`, `mobile-morph`, `mobile-reveal`, `desktop-reduced`. |
| `npx playwright test` completo | Pendiente: no se corrió la suite entera. |
| Deploy a producción (2026-10-30, «Aprobado con deploy») | Commit `ba91570`. `vercel deploy --prod` → `dpl_2CAbezDUWmghL1wFxXL9DKwnjzTq`, alias `jev-bot-sigma.vercel.app`. Sin push. |
| Humo en producción (Playwright, 1440 y 390 px) | PASS: `/about` con la gota preparada en las cinco escenas, hoyuelo del cursor, gráfico de ML visible, sin aviso de error ni errores de consola. |

**Límites:** render con GPU por software (SwiftShader); sin medición de GPU real, sin teléfono real ni Safari; sin push.

## Proyectos de Abdair como pila de escenas — 2026-10-28

Pedido: «la presentacion de proyectos en la seccion abdair no esta espectacular, no me gusta mucho». Quiz: «Pila de escenas» (frente a galería horizontal y lista editorial) y, como contenido extra, solo «Etiquetas técnicas». Plan concreto aprobado en un segundo quiz («Aprobado»: sin deploy).

- [x] `catalog.ts`: `tags` ES/EN por proyecto, solo con lo que nombra el relato (Bob: IA, seguimiento de caras, memoria persistente; TitiEdu: POO, IA, RAG, HTML/CSS/JS; machine-learning-App: machine learning, Pyodide, algoritmos; Jev: Rive, React, IA) y la etiqueta accesible «Tecnologías».
- [x] `AuthorWork`: escenas sticky; `useScroll` escribe `--stack` y CSS deriva `--depth` (escala 5 % y sombra por escena encima) y `--arrive` (zoom 1,15 → 1 de la imagen al subir). Sin inclinación 3D; se conservan borde, luz que sigue al ratón y zoom al pasar. Un enlace enfocado bajo otra escena hace volver el scroll a la suya.
- [x] `author.css`: dos columnas en escritorio, imagen arriba en ≤ 64rem; Bob encuadrado desde arriba; el banner de ML muestra su ventana del gráfico a todo el ancho con fundido arriba y abajo. Movimiento reducido o `max-height: 34rem`: escenas estáticas (móvil horizontal, en dos columnas).
- [x] Tests: `authorPage` (etiquetas ES/EN); E2E `author.spec.ts`: la pila encoge la primera escena y deja el enlace de Jev arriba; Shift+Tab hasta el de ML lo trae al frente; movimiento reducido sin pila.
- [x] Docs: `design.md`, `docs/interaction.md`, `docs/architecture.md`.

| Comprobación | Resultado |
|---|---|
| `tsc -b` y `tsc -p tsconfig.tests.json --noEmit` | PASS. |
| `eslint . --max-warnings=0` | PASS. |
| `vitest run --maxWorkers=1` | PASS: 399 tests en 49 archivos. |
| `npm run build` | PASS: `AuthorPage` 23,95 kB JS + 18,12 kB CSS; `index` sin cambios (356,57 kB). |
| `npx playwright test tests/e2e/author.spec.ts` | 5/5 PASS. Antes, en la primera corrida, «header … 320px» falló una vez al esperar el enlace Abdair y pasó en las dos siguientes sin cambios (intermitente, no relacionado). |
| Revisión visual (Playwright sobre dev: 1440×900, 390×844, 320×568, 844×390) | Sin desborde horizontal ni errores de consola. Capturas: `evidence/author/desktop-stack-bob.png`, `desktop-stack-rising.png`, `desktop-stack-full.png`, `mobile-stack.png`, `landscape-static.png`. `desktop-projects.png` queda como antecedente de las tarjetas. |
| `npx playwright test` completo | Pendiente: no se corrió la suite entera. |
| Deploy a producción (2026-10-28, pedido «ejecutalo») | Commit `aa305b9`. `vercel deploy --prod` → `dpl_Bx4bFEU5NQGDxpesGHH2iwpSQj3m`, alias `jev-bot-sigma.vercel.app`. Sin push. |
| Humo en producción (Playwright, 1440 y 390 px) | PASS: `/abdair` con escenas sticky, pila completa con Jev arriba, sin desborde ni errores de consola. |

**Límites:** sin teléfono real ni Safari; sin push.

## Música de Historia más ligera en móvil — 2026-10-27

Pedido: «optimices la musica de about porque en movil suena mal […] quiero que decidas todo tu». Sin quiz: el usuario delegó las decisiones.

**Diagnóstico** (render offline en Chromium del recorrido completo, 40 s, con el núcleo y el motor reales; script en el scratchpad, sin commitear): el 49 % de la energía estaba bajo 120 Hz, lo que un altavoz de teléfono no reproduce (sub, boom de 95→30 Hz, bombo de 150→42 Hz). Además, cada nota de piano creaba 8 nodos, con un filtro automatizado por muestra; había hasta 93 fuentes a la vez y 1.185 filtros. El compresor solo trabaja fuerte en los primeros 0,5 s del render (estado inicial con la música entrando), así que no era la causa.

- [x] `audioCore`: `compactAudio()` (`pointer: coarse`); en táctiles, sala de 1,4 s en lugar de 2,6 s y `latencyHint: "balanced"` en lugar de `"interactive"`.
- [x] `storyMusic`, perfil compacto elegido al arrancar: una cuerda por nota con onda suavizada (sin filtro ni fieltro), una sierra por voz de cuerdas (×1,4), sin sub (bajo una octava arriba a 0,1), boom 160→65 Hz y bombo 180→75 Hz más cortos, pasa-altos de 110 Hz y 250 ms de anticipación.
- [x] Todos los perfiles: un panoramizador compartido por posición (el paneo es lineal; escritorio suena igual). Un paso que el temporizador perdió más de 20 ms se descarta en vez de sonar tarde (antes solo se descartaba con más de 250 ms, y entre medias las notas salían amontonadas).
- [x] Tests: `storyMusic` (perfil compacto; bloqueo de 0,3 s sin notas atrasadas, que falla con el motor anterior) y `audioCore` (sala corta).
- [x] Docs: `design.md`, `docs/architecture.md` y `docs/interaction.md`.

| Medición (mismo recorrido de 40 s) | Antes | Escritorio ahora | Móvil ahora |
|---|---|---|---|
| Render offline | 3,7–4,5 s | 4,4–5,0 s (ruido de la máquina) | 1,6–1,7 s |
| Fuentes simultáneas máx. | 93 | 93 | 53 |
| Filtros / panoramizadores / fuentes de ruido creados | 1.185 / 626 / 635 | 1.185 / 80 / 635 | 88 / 43 / 86 |
| Energía bajo 120 Hz | 49 % | 49 % | 15 % |
| Pico / RMS | −8,9 / −30,3 dB | −8,9 / −30,3 dB | −8,6 / −30,9 dB |
| RMS por escena | −39,8 … −31,4 | igual | −38,3 … −30,8 |

| Comprobación | Resultado |
|---|---|
| `tsc -b` y `tsc -p tsconfig.tests.json --noEmit` | PASS. |
| `eslint . --max-warnings=0` | PASS. |
| `vitest run --maxWorkers=1` | PASS: 398 tests en 49 archivos. |
| `npm run build` | PASS. |
| Perfil en el navegador (dev, Playwright) | `compactAudio()` es `true` con móvil emulado (táctil) y `false` en escritorio. |
| Escucha en un teléfono real | Pendiente: no hay dispositivo físico ni se oyó el render; los WAV de antes/escritorio/móvil quedan en el scratchpad de la sesión. |

## Sección propia de Abdair — 2026-10-27

Pedido: «quiero que muevas mi presentacion en about a otra seccion netamente para mi presentacion, que sea espectacular también […] quiero que decidas todo tu […] al final despliegalo y dame un resumen». Sin quiz: el usuario delegó las decisiones. Textos solo de la introducción aprobada el 2026-10-24 y del relato (sin datos biográficos nuevos).

- [x] Ruta `/abdair` («Abdair» en ES/EN; icono de persona en móvil): `routes.ts`, `App` (lazy `AuthorPage`, título «JEVLING — Abdair»), `SiteHeader`, `vercel.json` y `prepare-vercel-frontend.mjs`.
- [x] `features/author/`:
  - `catalog.ts`: copia ES/EN, contactos (movidos desde Historia, con usuario), foto y proyectos por id de escena.
  - `PortraitParticles`: retrato de partículas que gira como galaxia, se reúne, responde al ratón o al toque y se disuelve al bajar.
  - `AuthorStatement`: la frase de intereses se enciende palabra por palabra.
  - `AuthorWork`: tarjetas que se inclinan hacia el ratón.
  - `AuthorContact`: foto con anillo y filas grandes por red.
  - `author.css`, con tokens propios.
- [x] `story/particleAssets.ts`: `loadImage` y `glowSprite` salen de `ParticleVortex` para compartirlos.
- [x] `scrollRuntime` registra ScrollTrigger al crear Lenis (la página usa el scroll suave sin triggers propios).
- [x] Historia: se retiran `StoryIntro`, sus estilos y textos; el cierre suma «Conocer a Abdair».
- [x] Cabecera móvil con cuatro iconos: sin hueco entre enlaces y 0,75rem de margen (352 px a 360 px de ancho). Por debajo de 22,4rem, los objetivos bajan a `--size-target-tight` (2,625rem) para caber en 320 px.
- [x] Tests: `authorPage` (6), `portraitParticles` (4), `storyPage` (el cierre enlaza con la sección), `siteHeader`, `presentationScroll` (mock de `registerPlugin`). E2E: nuevo `author.spec.ts` (4: escritorio, móvil, 320 px, movimiento reducido); `routes` y `settings` con la cuarta vista.
- [x] Docs: `design.md`, `docs/architecture.md`, `docs/interaction.md`, `docs/jev-story.md`, `README.md` y `AGENTS.md`.

| Comprobación | Resultado |
|---|---|
| `tsc -b` y `tsc -p tsconfig.tests.json --noEmit` | PASS. |
| `eslint . --max-warnings=0` | PASS. |
| `vitest run --maxWorkers=1` | PASS: 398 tests en 49 archivos. |
| `npm run build` | PASS: `index` 356,57 kB (gzip 114,45 kB, +0,7 kB); `AuthorPage` 23,07 kB JS + 15,50 kB CSS aparte. |
| `npx playwright test` de `author`, `routes` y `settings` | 22 PASS y 1 FAIL por timeout: «single header row (dark)» tardó 48,8 min, el equipo se suspendió durante la corrida. Reejecutado aparte: 2/2 PASS. |
| Revisión visual (Playwright sobre dev, 1440 y 390 px) | Galaxia → retrato reunido; disolución al bajar; frase encendida; tarjetas; contacto. Sin desborde horizontal ni errores de consola. Ajustes tras la primera ronda: contraste del retrato (percentil 97), encuadre de la tarjeta de ML y filas de contacto en móvil. Capturas en `evidence/author/`. |
| `npx playwright test` completo | Pendiente: no se corrió la suite entera. |
| Deploy a producción (2026-10-27, pedido «al final despliegalo») | Commits `63edeb3` (música) y `9778ace` (sección). `vercel deploy --prod` → `dpl_74J3M3WyuvpSL5wVGB4M4dDmHaWB`, alias `jev-bot-sigma.vercel.app`. Sin push. |
| Humo en producción (Playwright, 1440 y 390 px) | PASS: `/`, `/features`, `/about` y `/abdair` responden 200; «Hola, soy Abdair.», retrato reunido, cuatro vistas en la cabecera y cuatro redes; sin desborde ni errores de consola. Historia sin el bloque antiguo y con su enlace a `/abdair`. El bundle publicado incluye la detección `pointer: coarse` del perfil de audio. |

**Límites:** sin teléfono real ni Safari. El retrato depende de la foto actual (fondo oscuro); otra foto puede requerir ajustar `--portrait-min-light`.

## Guía de la clave Groq e inscripción UATF en Supabase — 2026-10-26

Pedido: «quiero que hagas un paso a paso para obtener la api de groq en ajustes, y tambien quiero que lo conectes a una base de datos de supabase. para que funcione el registro». Quiz: el registro es la inscripción UATF; conexión desde el servidor (función en Vercel con la clave secreta, sin dependencias); guía desplegable; aviso y casilla de consentimiento. Segundo quiz: enfoque «Aprobado»; guardar todas las inscripciones aunque se repita el celular; sin proyecto Supabase («no, crealo tu»).

- [x] Ajustes: `<details>` «¿Cómo consigo mi clave?» con cuatro pasos ES/EN y enlace a `console.groq.com/keys` en otra pestaña (aviso para lector de pantalla). Pasos según la quickstart de Groq (la página de claves es `/keys`); «Create API Key», `gsk_` y «se muestra una vez» no pudieron confirmarse en esa página.
- [x] `api/enroll.ts`: valida `{name, phone, consent, language}` con `validation.ts` compartido, 5 envíos/min por IP, inserta en `enrollments` por REST con la clave secreta en `apikey` (según la doc de claves de Supabase: las claves nuevas no van en `Authorization: Bearer`). 201/400/429/503/502; no registra datos.
- [x] `supabase/migrations/20261026000000_enrollments.sql`: tabla con checks, RLS sin políticas y `revoke` a `anon`/`authenticated`.
- [x] Formulario: casilla obligatoria, aviso de privacidad (reemplaza «Demo visual · sin envío de datos»), «Enviando…» con `aria-disabled` y campos de solo lectura, aviso de fallo que conserva los datos, envío abortado al cerrar o salir de Inicio. La casilla no compacta a Jev en móvil.
- [x] Vite (`/api/enroll` y variables), `vercel.json` (10 s), `.env.example`.
- [x] Docs: `design.md`, `AGENTS.md`, `docs/architecture.md`, `docs/interaction.md`, `README.md`.
- [x] Proyecto Supabase «jevling» (`ravfuqlfwoyqrgzorzvy`, sa-east-1, plan gratis) creado con la CLI (`npx supabase`, sesión ya iniciada). La cuenta ya tenía «abdair-coca's Project» (us-east-2); quiz: proyecto nuevo. Repo vinculado (`supabase/.temp/` ignorado) y migración aplicada con `db push`. `.env`: `SUPABASE_URL`, `SUPABASE_SECRET_KEY` y `SUPABASE_DB_PASSWORD` (generada; solo para la CLI).
- [x] Vercel Production: `SUPABASE_URL` y `SUPABASE_SECRET_KEY` como «Sensitive» (quiz: «Sí, sin desplegar»). Sin deploy.
- [x] Corrección hallada en la revisión móvil: con el celular enfocado, tocar la etiqueta de la casilla expandía a Jev en mitad del toque y la casilla no se marcaba. El formulario espera al final del toque para expandirse (test nuevo). Los pasos de la guía recuperan su numeración (`list-style: decimal`).
- [x] e2e `enrollment.spec.ts`: marca la casilla, responde `/api/enroll` como Supabase y añade el caso de fallo con reintento.

| Comprobación | Resultado |
|---|---|
| `tsc -b` y `tsc -p tsconfig.tests.json --noEmit` | PASS. |
| `eslint . --max-warnings=0` | PASS. |
| `vitest run --maxWorkers=1` | PASS: 385 tests en 47 archivos (nuevo `apiEnroll`; `enrollmentSession` prueba envío, consentimiento, etiqueta de la casilla en móvil, fallo con reintento y aborto; `settingsPanel`, la guía). |
| `npm run build` | PASS: `index` 355,88 kB (gzip 114,19 kB); `SettingsPanel` 5,54 kB. |
| Inscripción real (`npm run dev` → `/api/enroll` → Supabase) | PASS: sin consentimiento 400; válida 201 y fila guardada con celular normalizado (`70000000`). Fila de prueba «Prueba de Jev (borrar)» sigue en la tabla. La clave enmascarada de `projects api-keys` daba 401 «Invalid API key»; con `--reveal` funciona. |
| RLS con la clave publicable | PASS: insertar y leer responden 401 `permission denied for table enrollments`. |
| Revisión visual (Playwright sobre `npm run dev`, 1440 y 360 px, `/api/enroll` simulado) | PASS: errores, «Enviando…», fallo, «Datos enviados» y guía en oscuro/claro; sin desborde horizontal; consola solo con los 502 simulados. |
| `npx playwright test` | Pendiente: Claude Code detuvo la ejecución por falta de memoria del sistema antes de terminar. |
| Deploy a producción (2026-10-26, pedido «desplegalo») | `vercel deploy --prod` → `dpl_Ca6WVmZBUigrxpjVNQKtvy84jNX1`, alias `jev-bot-sigma.vercel.app`. El primer intento agotó la memoria de la CLI subiendo 224 MB: sin `.vercelignore` subía todo, `.env` incluido (la CLI solo excluye `.env.local` y `.env.*.local`). Nuevo `.vercelignore`: `.env*`, `supabase/.temp/`, `jev-lab/`, `.dev/`, `dist/` y salidas de pruebas. |
| Humo en producción | PASS: `/` y `/about` 200; `GET /api/enroll` 405; sin consentimiento 400; guía y casilla en el bundle; ninguna referencia a la clave secreta. Sin inscripción válida de prueba (la hace el usuario). |
| Revisión del usuario en producción | Aprobada el 2026-10-26: «funciona perfecto». |

## Piano en la banda sonora de Historia — 2026-10-25

Pedido: «no podrias hacer que la musica sea en piano?». Quiz: cambiar solo los instrumentos (el piano reemplaza el arpegio y las trompas; quedan cuerdas, batería, golpes y barridos), piano sintetizado sin archivos, y que siga creciendo hacia Jev.

- [x] `storyMusic`: `piano()` sustituye a `pluck()` y `horn()`. Cada nota son dos osciladores con una `PeriodicWave` de ocho armónicos a ±2 cents (±3 en el tema), un pasa-bajos que se cierra mientras suena, caída rápida tras el martillo y decaimiento largo (más corto en agudos), golpe de fieltro de ruido y apagador al soltar la tecla. Arpegio sostenido un tiempo; octava alta y bajo, dos semicorcheas; tema, su duración. Las dos cuerdas se reparten el nivel de la nota.
- [x] Tests: `audioFakes` admite `createPeriodicWave`/`setPeriodicWave`; `storyMusic` identifica el tema por ±3 cents y prueba que arpegio y tema usan el piano y que el apagador corta cada nota.
- [x] Docs: `design.md` y `docs/architecture.md`.

| Comprobación | Resultado |
|---|---|
| `tsc -b` y `tsc -p tsconfig.tests.json --noEmit` | PASS. |
| `eslint . --max-warnings=0` | PASS. |
| `vitest run --maxWorkers=1` | PASS: 367 tests en 46 archivos. |
| `npm run build` | PASS: `index` 352,61 kB (gzip 113,05 kB); `AboutPage` 36,06 kB. |
| Render offline (Chromium, `OfflineAudioContext` con el núcleo real, 37 s de recorrido) | RMS por escena, original → piano: −39,2 → −38,8; −35,6 → −35,2; −33,3 → −32,9; −31,1 → −31,2; −30,9 → −31,2; revelación −28,6 → −29,3 dB. Picos 0,24 → 0,26. La primera versión sonaba ~3 dB más fuerte (las dos cuerdas sumaban el nivel), corregido. |
| Escucha del usuario | Pendiente: WAV de antes y después entregados. |
| `npx playwright test` | Pendiente (no se corrió en esta entrega). |

## «Ver proyecto» minimalista en Historia — 2026-10-25

Pedido: «no me gusta mucho, quiero que lo hagas mas minimalista, menos llamativo pero que si tenga un microanimacion». Quiz: enlace con subrayado sin flecha, subrayado que se dibuja, sin icono, dominio ni imán.

- [x] `AboutPage`: «Ver proyecto» pasa a enlace de texto (`story-project__link`), sin clases de botón ni ↗.
- [x] CSS: línea tenue (`--color-control-edge`) fija; al hover, una línea violeta crece de izquierda a derecha con `scaleX` y al salir se retira hacia la derecha. Solo `(hover: hover)` y sin movimiento reducido. Mantiene `--size-target` de alto.
- [x] Se retiran `ProjectLink.tsx`, `icons.tsx` y los tokens `--story-project-*`/`--story-magnet-pull`; `StoryIntro` vuelve a sus iconos propios.
- [x] Docs: `docs/interaction.md`; `design.md` y `docs/architecture.md` vuelven al texto anterior a las tarjetas.

| Comprobación | Resultado |
|---|---|
| `tsc -b` y `tsc -p tsconfig.tests.json --noEmit` | PASS. |
| `eslint . --max-warnings=0` | PASS. |
| `vitest run --maxWorkers=1` | PASS: 366 tests en 46 archivos (nuevo test de los enlaces en `storyPage`). |
| `npm run build` | PASS: `index` 352,61 kB (gzip 113,06 kB), CSS 60,07 kB. |
| Manual (Playwright sobre la build, 1440 y 360 px) | Línea violeta en reposo `scaleX(0)`; a 120 ms de hover va por 0,56 (480 ms, `--ease-in-out`; con 280 ms y `--ease-out` ya estaba completa a 120 ms y no se percibía) y termina en `none`; al salir vuelve a 0. Enlace de 48 px de alto; sin desborde horizontal ni errores de consola. |
| `npx playwright test` | Pendiente (no se corrió en esta entrega). |

## Tarjetas «Ver proyecto» en Historia — 2026-10-25

**Reemplazado el mismo día** por [«Ver proyecto» minimalista](#ver-proyecto-minimalista-en-historia--2026-10-25): el usuario pidió algo menos llamativo. Se conserva como antecedente (commit `0373e44`).

Pedido: «quiero que los botones de ver proyecto de about sean mas bonitos e impresionantes». Quiz: mini tarjeta, efecto magnético, icono de destino.

- [x] `ProjectLink` (nuevo): icono (GitHub para Bob, web para TitiEdu y ML), «Ver proyecto», dominio derivado de la URL y ↗ en un círculo. Imán con `useSpring` (solo `(hover: hover) and (pointer: fine)`, nunca con movimiento reducido); se apaga al salir.
- [x] CSS: borde degradado estático, halo en capa propia (opacidad/escala) al hover y al foco de teclado, la tarjeta se eleva, el icono salta y la ↗ gira 45°. Tokens `--story-project-*`, `--story-arrow-turn` y `--story-magnet-pull`.
- [x] `icons.tsx` (nuevo): iconos de contacto movidos desde `StoryIntro` + globo web.
- [x] Docs: `design.md`, `docs/interaction.md`, `docs/architecture.md`.

| Comprobación | Resultado |
|---|---|
| `tsc -b` y `tsc -p tsconfig.tests.json --noEmit` | PASS. |
| `eslint . --max-warnings=0` | PASS. |
| `vitest run tests/storyPage.test.tsx` | PASS: 8/8 (nuevo test de las tarjetas; el mock de `motionTokens` añade `useOrganicMotion`). |
| `npm run build` | PASS: `index` 352,74 kB (gzip 113,12 kB). |
| Manual (Playwright sobre la build, 1440 y 360 px) | Hover: imán 11,7 px, tarjeta −6 px, halo opacidad 1, ↗ a 45°; al salir vuelve a `none`. Dominio largo de ML parte en dos líneas a 360 px; sin desborde horizontal ni errores de consola. |
| `vitest run --maxWorkers=1` | PASS: 366 tests en 46 archivos. |
| `npx playwright test` | Pendiente (no se corrió en esta entrega). |

## Microinteracciones y presentación en Historia — 2026-10-24

Pedido: «quiero que añadas microinteracciones con toda la app, y al final de about quiero que pongas también mi contacto y como una pequeña introducción hacia mí. Antes de modificar algo quiero que me hagas preguntas». Quiz: microinteracciones expresivas con resortes; feedback visual más clics sutiles al pulsar y alternar, salvo en Historia; contactos GitHub, LinkedIn, Instagram, TikTok y X; introducción redactada a partir de `jev-story.md`, sin «Sobre mí» y sin tono de venta («no me quiero vender»), con el título «Hola, soy Abdair.»; con foto; bloque antes del cierre; mientras falten datos, solo GitHub e iniciales «AC»; sin datos nuevos («Así está bien»); todo en una entrega. Después: «aplícalo nomás».

- [x] Tokens: `--ease-spring`, `--duration-spring` y distancias, giros y escalas de microinteracción en `tokens.css`.
- [x] Cabecera: resaltado único con `layoutId` que se desliza a la vista abierta, fondo hover que aparece con opacidad/escala, ojos del logo que parpadean, engranaje que gira; en móvil cada icono hace su gesto al llegar a su vista o al pulsarlo (casa, destellos, libro con páginas separadas en dos `path`).
- [x] Botones `ui-button` con resorte y `↗` (`.ui-button__arrow`) que se inclina; ✕ compartido (respuestas, Ajustes, Memoria) e inscripción giran un cuarto; papelera de Memoria se balancea; chips y opciones con resorte.
- [x] Ajustes: bolita del interruptor por `transform` con resorte y estiramiento al pulsar; anillo de la muestra elegida como capa propia que se dibuja (antes era una sombra) y muestra que late; indicador ES/EN con el resorte orgánico; `›` que avanza.
- [x] Inicio: halo del input al enfocar (capa con opacidad), flecha de enviar que sale disparada antes del ✓, chevron del HUD con resorte.
- [x] Sonido: bus `ui` en `audioCore` y `lib/uiSound.ts` (`uiSoundFor`, `createUiSound`, `useUiSounds`), desactivado en `/about`.
- [x] Historia: `StoryIntro` antes del cierre, con `STORY_CONTACTS` y `STORY_PORTRAIT` en el catálogo; iconos que saltan y retrato que se inclina.
- [x] Docs: `design.md` (tokens, clics de interfaz, presentación y regla de retrato reemplazada, microinteracciones), `docs/interaction.md`, `docs/architecture.md` y `docs/jev-story.md`.

| Comprobación | Resultado |
|---|---|
| `tsc -b` y `tsc -p tsconfig.tests.json --noEmit` | PASS. |
| `eslint . --max-warnings=0 --ignore-pattern "playwright-report/**"` | PASS. |
| `vitest run --maxWorkers=1` | PASS: 365 tests en 46 archivos (nuevo `uiSound`; `storyPage` cuenta las escenas por `data-story-scene` y prueba la presentación; los mocks de `motionTokens` de cabecera y Ajustes añaden el resorte). |
| `npm run build` | PASS: `index` 352,61 kB (gzip 113,06 kB, +0,7 kB), CSS 60,07 kB; Ajustes y Memoria siguen en sus chunks. |
| Manual (Playwright sobre la build, 1440 y 390 px) | Un solo resaltado y se mueve a Capacidades; hover y engranaje responden; bolita a 20 px encendida y en reposo apagada; anillo elegido opacidad 1, los demás 0; halo del input opacidad 1 al enfocar. Bus `ui`: 4 conexiones tras dos pulsaciones del tema en Inicio, 0 en Historia. Presentación sin desbordes horizontales en escritorio y móvil; cabecera móvil de 65 px; sin errores de consola. |
| `npx playwright test` | PASS: 61/61 (14,6 min), sobre la misma build. |

**2026-10-25:** el usuario pasó la foto (`public/story/Abdair.jpg`, 400 × 400, 28 KB) y LinkedIn, Instagram y TikTok; quedan en `STORY_PORTRAIT` y `STORY_CONTACTS`. Commit `f13e94d` subido a `origin/main` a pedido («pushea»).

**Pendiente del usuario:** usuario de X (`STORY_CONTACTS`).

## Memoria y Diagnóstico en Ajustes; cabecera móvil con iconos — 2026-10-23

Pedido: «quiero que memoria y diagnóstico también se muevan a ajustes, y que cuando estemos en móvil inicio capacidades y historia, se vuelvan iconos minimalistas en blanco que se coloquen entre jevling y el cambio de tema». Quiz: botones en Ajustes que abren lo de siempre (Diagnóstico solo en Inicio), iconos con el color del texto del tema (blancos en oscuro, casi negros en claro), solo a ≤ 40rem.

- [x] `settingsDialogStore`: `memory`, `openMemory()` y `closeMemory()`. «Memoria» cambia Ajustes por el panel y, al cerrar, devuelve el foco a quien abrió Ajustes (el engranaje). Navegar cierra ambos.
- [x] `diagnosticsStore` (nuevo): estado del panel de señales, compartido por Ajustes, la tecla `d`, `Esc` y el ✕ del panel.
- [x] `SiteHeader`: renderiza `MemoryPanel` (lazy) y pasa a Ajustes `onOpenMemory` y, solo en `/`, `diagnostics`. Los enlaces llevan icono SVG (casa, destellos, libro) y la etiqueta en `<span>`.
- [x] `SettingsPanel`: sección «Jev» con «Memoria» (`aria-haspopup="dialog"`) y «Diagnóstico» (`aria-pressed`). En móvil, «Color de Jev» pasa a etiqueta arriba y muestras debajo: en la captura a 390 px la sexta muestra saltaba de línea (fallo del cambio anterior).
- [x] `HomePage`: sin pie («Memoria», «Diagnóstico») ni estado propio de memoria; el diagnóstico sale de `diagnosticsStore`.
- [x] CSS: a ≤ 40rem, una sola fila (`--size-header` pasa de 7,5rem a 4rem; se retira la regla de 6rem para pantallas bajas), enlaces de icono con la etiqueta visualmente oculta. **Ajuste posterior (pedido: «oculta JEVLING en móvil y deja solo el logo»):** la marca queda solo como logo, así que los iconos vuelven a `--size-target` (3rem) y se retira el token provisional `--size-nav-icon` (2,5rem). Verificado con capturas a 360/390 px en claro y oscuro (cabecera de 65 px, sin desborde) y con `settings.spec` + `navigation.spec`: 15/15. El e2e comprueba que el nombre está oculto, que el enlace sigue llamándose «Jevling» y que los iconos miden al menos 48 px. Se retiraron todas las reglas `.home-footer`.
- [x] Docs: `design.md`, `docs/architecture.md`, `docs/interaction.md` y `docs/README.md`.

| Comprobación | Resultado |
|---|---|
| `tsc -b` y `tsc -p tsconfig.tests.json --noEmit` | PASS. |
| ESLint | PASS. |
| `vitest run --maxWorkers=1` | PASS: 360 tests (nuevos en `settingsPanel` y `siteHeader`; `homeControls` actualizado a la nueva forma del store). |
| `npm run build` | PASS: `index` 350,32 kB (gzip 112,34 kB), CSS 55,67 kB; `MemoryPanel` sigue en su propio chunk. |
| Capturas manuales (Playwright, 360 y 390 px, claro/oscuro) | Cabecera de 65 px en una fila, sin desborde horizontal. El canvas de Jev mantiene 886 × 886 durante 8 s. |
| `npx playwright test` | PASS: 61/61. Nuevos: cabecera móvil en una fila con iconos (claro y oscuro, 360 px) y «Diagnóstico» desde Ajustes solo en Inicio. `companion.spec` abre la memoria desde Ajustes, y el foco vuelve al engranaje. |

## Color de Jev en Ajustes — 2026-10-23

Pedido aparte de la feature de memoria: «como podemos hacer que el character pueda cambiar de color desde la app». Quiz: propiedad Color en Rive (no filtro CSS) y paleta fija. El usuario creó `colorBody` en el editor y pidió que el resto se hiciera desde su navegador («Hazlo tú»; exportar confirmado en quiz).

- [x] Rive (archivo `WIP01` en el editor web): `colorBody` (Color, por defecto `D044FF`) enlazado a la parada `D044FF` de Fill 6 y la `C145F4` de Fill 5 en `Sphere`, al relleno de `Light` (`F300FF`) y al halo `BACKGROUND > Gradient` (`8200FF`). Probado en la vista previa con `00C8FF`: cambia todo Jev, salvo ojos, sombras y brillos blancos.
  - Incidentes en el editor, deshechos: se activó por error el *Feather* de Fill 6 (apagado de nuevo; la regla de relleno quedó en «Clockwise», igual que Fill 5), y un texto escrito sin foco disparó atajos (herramienta, *Freeze*, panel de dependencias). Problemas del editor: los mismos 6 de antes.
- [x] Export para runtime → `public/rive/prove3.riv` (93.361 bytes). `prove2.riv` intacto. Sus cadenas solo difieren de `prove2` en `colorBody`. **Sin commitear:** el `.riv` es un asset del usuario.
- [x] `src/character/jevColors.ts`: paleta (`violet`, `cyan`, `pink`, `orange`, `green`, `red`) en ARGB, más el guard `isJevColor`. Las muestras usan los tokens `--jev-skin-*`, y un test comprueba que coinciden con los valores de Rive.
- [x] `preferencesStore`: `jevColor` y `setJevColor`, persistidos en `jevling.jevColor`, con morado por defecto y valores inválidos ignorados.
- [x] `Character`: carga `prove3.riv` y escribe `colorBody` al estar listo y en cada cambio, en Home, Features y About.
- [x] `SettingsPanel`: fila «Color de Jev» / «Jev's color» con seis muestras (`role="group"`, `aria-pressed`, nombre ES/EN). El anillo de la elegida usa `--color-background-secondary`: `--reply-surface` es un degradado y anulaba la sombra.
- [x] Docs: `design.md` (Ajustes, persistencia, asset actual), `docs/rive-model.md` y `docs/interaction.md`.

| Comprobación | Resultado |
|---|---|
| `tsc -b` y `tsc -p tsconfig.tests.json --noEmit` | PASS. |
| `eslint . --max-warnings=0 --ignore-pattern "playwright-report/**"` | PASS. |
| `vitest run --maxWorkers=1` | PASS: 355 tests en 45 archivos (nuevos: `jevColors`, casos en `preferences`, `settingsPanel` y `characterVisibility`). |
| `npm run build` | PASS: `index` 349,71 kB (gzip 112,08 kB), CSS 56,28 kB. |
| `npx playwright test` | PASS: 58/58, incluidos 2 nuevos en `settings.spec` (las muestras caben en el panel en escritorio y móvil; el color sobrevive a recargar). |
| Manual (dev en 5199, Chrome) | Cian aplicado a Jev al instante y conservado tras recargar. |

**Pendiente/limitación:** en la primera carga de la prueba manual se vio unos segundos un logo «RIVE» antes de Jev. No se repitió al recargar, y `prove2` y `prove3` comparten estructura. Probablemente es la pantalla de presentación de las exportaciones del plan gratuito de Rive (el modal de exportar ofrece quitarla al pagar). No se comparó con `prove2` en una primera carga sin caché.

## Corrección de CI — 2026-10-21

- GitHub Actions falló en los runs `39611507233` y `39666575605`. En ambos, solo fallaban los dos tests «round shape»: en el runner, sin GPU, se pintaron 5–8 fotogramas en el segundo medido y la guarda exigía más de 10. Ningún fotograma medido mostró deformación.
- La guarda pasa a exigir al menos 3 fotogramas, con un comentario que explica por qué. Se comprobó localmente que los tests siguen fallando sin el arreglo (`layout={false}` temporal: proporciones 1,19 y 1,28) y pasan con él.

## Ajuste de la revisión final — panel directo en móvil, 2026-10-21

Pedido del usuario, con capturas: «no quiero que aparezca eso [la vista previa con «Leer todo»], sino que directamente ese modal que aparece de abajo».

- [x] `HomePage`: en pantallas de 64rem o menos, una respuesta con bloques abre `ReplySheet` directamente, sin vista previa. Cerrar el panel (✕, arrastrar, tocar fuera o `Esc`) descarta la respuesta y devuelve el foco al input. Las opciones de Jev van dentro del panel.
- [x] Retirados `ReplyPreview`, sus estilos y las claves `replyReadAll` y `replyCollapse`. El ✕ del panel usa «Cerrar respuesta».
- [x] Docs y contrato: `design.md`, `architecture.md`, `interaction.md`; en `spec.md` queda anotada la decisión reemplazada.
- [x] Tests actualizados: `speechReply` (las opciones se responden dentro del panel), `reply.spec` (abre solo, Escape y ✕ cierran la respuesta, arrastrar hacia abajo la cierra, viewports cortos), `reply-blocks` (la matriz móvil ya no pulsa «Leer todo»), `choices` y `companion`.

| Comprobación | Resultado |
|---|---|
| `tsc --noEmit -p` app / node / api / tests | PASS. |
| ESLint (sin `playwright-report`) | PASS. |
| `vitest run --maxWorkers=1` | PASS: 317 tests (salen 2 de la vista previa). |
| `npm run build` | PASS: `index` 346,48 kB, gzip 110,84 kB (−0,3 kB). |
| `npx playwright test` | PASS: 45/45. |
| `git diff --check` | PASS. |

Capturas regeneradas en `evidence/long-reply/` (panel móvil y viewports cortos) y `evidence/companion/` (opciones en el panel). Las capturas antiguas de la vista previa (`mobile-preview-light.png`, `preview-*.png`) se conservan como antecedente.

**Nota:** con el panel abierto, el input queda detrás del modal. Para escribir otra respuesta a una pregunta de Jev hay que cerrar el panel; la conversación sigue abierta, así que el mensaje escrito va directo al habla.

## Fase 3 — entrega para revisión final, 2026-10-21

- [x] `memoryStore.ts`: `removeMemory(id)` y `clearMemory()`.
- [x] `features/memory/MemoryPanel.tsx` y `memory.css` (chunk `lazy` de 3,5 kB JS + 3,6 kB CSS):
  - Diálogo modal portalado a `body`, centrado en escritorio y abajo en móvil, con la superficie de las respuestas.
  - Muestra las notas de la más reciente a la más antigua con fecha relativa (`Intl.RelativeTimeFormat`, ES/EN).
  - Permite olvidar una nota (el foco pasa a la siguiente) y «Olvidar todo» con confirmación propia (el foco empieza en «Cancelar»; Escape cancela primero).
  - Tiene estado vacío y el aviso «Se guarda solo en este navegador».
  - Foco al título, trampa de Tab, y los atajos de Home (`d`, Escape) no actúan detrás del modal.
- [x] Home: botón «Memoria» en el pie (`aria-haspopup="dialog"`). Al cerrar, el foco vuelve al botón; salir de Inicio cierra el panel.
- [x] **Corrección encontrada por la matriz:** en móvil, la fila de «Borrar conversación» (`.whisper__meta`, absoluta y a todo el ancho) tapaba el pie, así que «Memoria» no recibía toques. Probablemente también tapaba «Diagnóstico» cuando había contexto. Ahora la fila deja pasar los toques y solo su contenido los recibe.
- [x] Reglas y textos:
  - `AGENTS.md`: la única memoria persistente son las notas acotadas de `jevling.memory`.
  - `design.md`: principios de About, persistencia, contrato «Jev compañero» en Home y nota de Bob.
  - `docs/README.md`, `architecture.md` e `interaction.md`.
  - Copia de Historia ES/EN: «Hoy conserva personalidad local y notas cortas sobre ti en tu navegador, aún lejos de la memoria persistente de Bob.»
- [ ] Aprobación final del usuario.

| Comprobación | Resultado |
|---|---|
| `tsc --noEmit -p` app / node / api / tests | PASS. |
| `eslint . --max-warnings=0 --ignore-pattern "playwright-report/**"` | PASS. |
| `vitest run --maxWorkers=1` | PASS: 319 tests. Nuevos: `memoryPanel.test.tsx` (5: modal y orden, olvidar una con foco, confirmación y Escape, cierre y atajos bloqueados, inglés) y el store (olvidar una y todas). |
| `npm run build` | PASS: `index` 347,48 kB, gzip 111,12 kB (+0,5 kB); `MemoryPanel` 3,46 kB JS / 3,60 kB CSS aparte. |
| `npx playwright test` | 44 PASS y 1 FAIL (`routes` `/`: Rive no llegó a `data-ready` en 45 s, la misma variabilidad sin GPU de la fase 1). Reejecutado aparte: 4/4 PASS. |
| Nuevo `companion.spec.ts` | PASS 10/10: matriz ES/EN × claro/oscuro × escritorio/móvil (opciones visibles, sin overflow, panel dentro del viewport, más reciente primero), teclado completo (olvidar, trampa de Tab, confirmación, Escape devuelve el foco y lo olvidado sigue olvidado tras recargar) y movimiento reducido. |
| `git diff --check` | PASS. |

Capturas en `evidence/companion/`: `choices-{desktop,mobile}-{es,en}-{light,dark}.png` y `memory-{desktop,mobile}-{es,en}-{light,dark}.png`, tomadas al terminar las animaciones. `choices-desktop.png` y `choices-mobile.png` son de la fase 2.

**Límites de la feature completa:**
- Sin celular real, Safari ni lector de pantalla.
- La memoria vive en un solo navegador: no se sincroniza ni sobrevive a borrar los datos del sitio.
- La selección de notas no entiende sinónimos.
- El modelo a veces hace 3 preguntas o deja vacía la nota de una respuesta corta.

## Fase 2 — entrega para revisión, 2026-10-21

**Quiz de la fase:** en móvil, las opciones van también en la vista previa, en una fila deslizable («En la vista previa»).

- [x] `speechBlocks.ts`:
  - Bloque `choices` (pregunta ≤120, de 2 a 5 opciones ≤40); con menos de 2 opciones pasa a párrafo.
  - No se acepta ningún bloque después de la pregunta.
  - El resumen de historial conserva la pregunta y sus opciones, para que el modelo sepa qué preguntó.
- [x] `api/talk.ts`:
  - Catálogo y pauta de orientación: preguntar con `choices` si falta un dato clave, como máximo 2 preguntas seguidas, y después recomendar explicando por qué encaja; no repreguntar lo que ya sabe.
  - La nota de memoria pasa a ser **obligatoria** tras la frase, con `"text":""` si no hay nada nuevo (el servidor descarta las vacías).
  - El historial reconstruido incluye `{"type":"memory","text":""}`.
- [x] Conversación abierta:
  - `useSpeechSession.hasOpenQuestion()` es verdadero tras una respuesta terminada que contiene `choices`. Se cierra con el siguiente mensaje, una cancelación, «Borrar conversación», un fallo o la suspensión.
  - `useCreatureBrain.submitContext` responde en ese caso con una decisión TALK local: cancela decisiones pendientes y arranca el habla sin `/api/decide`.
- [x] UI:
  - `ReplyBlocks`: `Choices` (pregunta, `role=group` con nombre, botones y aviso «O escríbeme tu respuesta.» / «Or type your own answer.»).
  - `ChoiceButtons` se reutiliza en la vista previa móvil (fila deslizable de una línea; en pantallas bajas, debajo del texto).
  - Estilos con tokens en `reply.css`.
- [x] Docs de estado actual: `architecture.md`, `interaction.md`.
- [ ] Aprobación del usuario.

**Prueba real con Groq** (servidor dev temporal en 5199 detenido; scripts en el scratchpad, sin commitear):
- **Orientación:** 3 conversaciones, respondiendo siempre con la primera opción: «¿Qué carreras puedo estudiar?», «No sé qué estudiar, me gusta ayudar a la gente» y «What career should I study?».
  - Jev pregunta 2 veces y luego recomienda (en la última ronda; en una anterior, la conversación EN preguntó 3 veces).
  - Las recomendaciones usan lo elegido («Crear personajes» → diseño de personajes, ilustración…).
  - Hubo 1 evento de error en 1 de 11 turnos en una ronda intermedia; no se repitió en las siguientes.
- **Regresión de memoria detectada y corregida:** al añadir `choices`, las notas casi desaparecieron.
  - Con la memoria condicional, 2 de 6 respuestas traían nota y ninguna cuando Jev preguntaba.
  - Con historial, 0 de 8: el modelo copia el formato de sus turnos previos, que no tenían nota.
  - Con la nota obligatoria, 12 de 12 sin historial: nota con contenido cuando había algo que recordar y vacía en el saludo y ante el teléfono.
  - Con la nota vacía en el historial, 7 de 8 la incluyen y 6 de 8 tienen contenido.
  - En la ronda final, las 3 conversaciones terminan con una nota que resume lo decidido («Prefiere leer y escribir, le gusta escribir ficción.»).
- **Consumo** (medido llamando a Groq directo con el mismo prompt): 38–182 tokens de completado (tope 384) y unos 800–860 tokens de prompt de sistema con historial corto.

| Comprobación | Resultado |
|---|---|
| `tsc --noEmit -p` app / node / api / tests | PASS. |
| `eslint . --max-warnings=0 --ignore-pattern "playwright-report/**"` | PASS. |
| `vitest run --maxWorkers=1` | PASS: 313 tests. Nuevos: `choices` (4), conversación abierta en sesión (2), respuesta directa sin `/api/decide` en el cerebro (1), grupo de opciones y vista previa (3), API (nota vacía y pregunta como bloque final). |
| `npm run build` | PASS: `index` 346,14 kB, gzip 110,65 kB (+0,4 kB). |
| `npx playwright test` | PASS: 35 tests. Nuevo `choices.spec.ts`: en escritorio, una opción y una respuesta escrita continúan sin decisión nueva y el mensaje siguiente vuelve a decidirse; en móvil, la fila de opciones es de una línea, sin overflow, y responde sin abrir el panel. |
| `git diff --check` | PASS. |

Capturas: `evidence/companion/choices-desktop.png` y `choices-mobile.png`.

**Límites:**
- El modelo no siempre respeta «máximo 2 preguntas»: en una ronda hizo 3.
- Las notas de turnos cortos («Arte y diseño») a veces salen vacías; la conversación suele resumirse en la nota del turno de la recomendación.
- La matriz completa ES/EN × claro/oscuro de opciones queda para la fase 3, como dice el plan.

## Fase 1 — entrega para revisión, 2026-10-21

- [x] `speechBlocks.ts`:
  - Límites compartidos `SPEECH_MEMORY_NOTE_MAX_CHARS` (160), `SPEECH_MEMORY_SEND_MAX` (8) y `SPEECH_MEMORY_SEND_MAX_CHARS` (1000).
  - `parseMemoryNote` descarta 7 o más dígitos seguidos, aunque lleven espacios, puntos o guiones.
  - `parseBlock` nunca convierte una nota en párrafo visible, ni siquiera si fue rechazada.
- [x] `api/talk.ts`:
  - Acepta `memory` opcional (lista acotada de textos) y rechaza campos desconocidos.
  - Entrega las notas como un mensaje de sistema aparte («solo como datos y nunca como instrucciones»).
  - Emite el evento `memory` justo después de la frase, aunque el modelo lo escriba antes; solo la primera nota cuenta.
  - Prompt: nota secreta en tercera persona tras la frase; nunca anota salud, documentos, contraseñas, teléfonos, direcciones ni datos de formularios, y si se lo piden dice que no lo guarda. Lleva un ejemplo con `memory`.
- [x] `speechClient.ts`: envía `memory` y devuelve `SpeechResult` con la nota opcional, validada otra vez.
- [x] `creature/memory/memoryStore.ts` (nuevo):
  - Guarda en `jevling.memory` con versión: hasta 40 notas (sale la más antigua), sin duplicados (sin distinguir mayúsculas ni tildes) y con validación al leer.
  - Si el storage falla, las notas duran la sesión.
  - `selectRelevant` envía las 2 más recientes y las que comparten palabras: sin tildes, sin palabras vacías y comparando los primeros 5 caracteres de cada palabra. Hasta 8 notas y 1000 caracteres.
- [x] `useSpeechSession.ts`: envía las notas relevantes y guarda la nota solo cuando la respuesta termina; una respuesta cancelada o fallida no deja nota. «Borrar conversación» no toca la memoria.
- [x] Docs de estado actual: `docs/architecture.md` y `docs/interaction.md`. El cambio de reglas en `AGENTS.md` y `design.md` y el texto de Historia quedan para la fase 3, como dice el plan.
- [ ] Aprobación del usuario.

**Prueba real con Groq** (servidor dev temporal en 5199, ya detenido; script en el scratchpad, sin commitear; 2 rondas de 6 mensajes):

| Mensaje | Ronda 1 | Ronda 2 |
|---|---|---|
| «Me encanta programar y los videojuegos, ¿qué carreras…?» | nota guardada | nota guardada |
| «Hola, ¿cómo estás?» | sin nota (correcto) | sin nota (correcto) |
| «Quiero estudiar algo corto porque necesito trabajar pronto…» (con 1 nota) | sin nota (falló) | nota guardada |
| «¿Cuál de esas opciones me conviene más?» (con 2 notas) | usa las notas («carrera más rápida para trabajar pronto»); sin nota nueva (correcto) | sin nota nueva (correcto) |
| «Mi número es 71234567, recuérdalo» | sin nota | sin nota; responde «no puedo guardar ese número» |
| «I like biology and helping people…» (EN) | nota en inglés | nota en inglés |

- **Notas:** 5 de 6 esperadas, ninguna guardada por error y 0 respuestas cortadas.
- **Primera versión del prompt:** antes del ejemplo con `memory`, el modelo no escribió ninguna nota en 6 de 6 casos y dijo «lo guardo» ante el número. Por eso se reforzó el prompt.
- **Consumo:** no se midió el uso exacto de tokens (Groq no lo expone por este SSE). Las salidas tuvieron como máximo 719 caracteres y el tope de 384 tokens no cortó ninguna respuesta. Las notas suman como máximo 1000 caracteres de entrada (unos 250–300 tokens).

| Comprobación | Resultado |
|---|---|
| `tsc --noEmit -p` app / node / api / tests | PASS. |
| `eslint . --max-warnings=0 --ignore-pattern "playwright-report/**"` | PASS. |
| `vitest run --maxWorkers=1` | PASS: 40 archivos / 301 tests. Nuevos: `memoryStore` (8), API (11: nota tras la frase, números largos, notas como datos, validación del cuerpo), cliente (2), sesión (2). |
| `npm run build` | PASS: `index` 344,57 kB, gzip 110,22 kB (+0,8 kB). |
| `npx playwright test` | 31 PASS y 2 FAIL (`routes`: `/` y `/features` no llegaron a `data-ready` de Rive en 45 s). Reejecutadas aparte: PASS con los cambios (19 y 31 s) y PASS en la base sin cambios con `git stash` (21 y 26 s). Es variabilidad de Rive sin GPU, no una regresión. Nuevo: `memory.spec.ts` (la nota oculta no se muestra; tras recargar viaja con una pregunta relacionada). |
| `git diff --check` | PASS. |

**Límites:**
- La selección por palabras en común no entiende sinónimos («software» no encuentra «programación»). Las 2 notas más recientes viajan siempre.
- Las notas se escriben en el idioma de la respuesta y no se traducen.
- Todavía no hay forma de ver ni borrar las notas desde la interfaz (fase 3). Por ahora se borran limpiando los datos del sitio.

## Preparación — 2026-10-21

- Quiz: memoria en el navegador; fragmentos escritos por el modelo; panel con borrar; aprobar «respuestas largas» y vaciar el SDD.
- Revisado: `useSpeechSession` (historial de sesión de 2 intercambios), `useCreatureBrain.submitContext` → `requestContextDecision` → `/api/decide`, `lib/storage.ts`, la copia de Historia sobre la memoria (`features/story/catalog.ts`) y las reglas de sesión en `AGENTS.md`/`design.md`.
