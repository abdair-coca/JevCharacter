# Tarea: Jev compañero con memoria persistente

Handoff vivo de la feature. **Antes de continuar, leer `spec.md`, `plan.md`, este archivo y `../design.md`.**

## Retoma aquí

- **Fase activa:** fase 3 (panel «Lo que Jev recuerda» y cierre), implementada y verificada el 2026-10-21; **entregada para revisión final**.
- **Aprobaciones:** spec y plan aprobados el 2026-10-21 en el quiz («Aprobado»). «Borrar conversación» conserva la memoria (mismo quiz). Fases 1 y 2 aprobadas el 2026-10-21 («continua con la siguiente fase», dos veces).
- **Siguiente acción exacta:** revisión final del usuario. Tras la aprobación final: informar resultados y después vaciar el contenido de `spec.md`, `plan.md` y `task.md`, conservando los tres archivos.
- **Estado del código:** las tres fases están commiteadas. Sin deploy ni push.

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
