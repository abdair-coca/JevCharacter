# Plan: respuestas largas con UI generada

- **Base:** [spec.md](spec.md).
- **Contratos de UI/animación:** [design.md](../design.md).
- **Estado:** aprobado el 2026-10-20. Fase 1 aprobada; fase 2 activa; la fase 3 espera su aprobación.

## Dependencias y orden

1. **Fase 1 — Protocolo:** la API y el cliente entregan `spoken` y `blocks` validados. La UI solo cambia lo mínimo: la burbuja muestra `spoken`.
2. **Fase 2 — Tarjeta:** composición en escritorio y móvil, persistencia y accesibilidad, con los bloques dibujados como texto simple.
3. **Fase 3 — Bloques visuales:** componentes por tipo de bloque, entrada animada, chips, matriz de navegador y documentación.

## Fase 1 — Protocolo de respuesta estructurada

**Propósito:** que Jev pueda responder con contenido largo y estructurado sin perder la voz corta, la cancelación ni la seguridad actuales.

**Secuencia:**
1. **Catálogo tipado.** En `src/creature/brain/speechProtocol.ts`, o en un módulo hermano si crece:
   - Definir `SpeechBlock` como unión discriminada, más los límites por campo y el total de unos 800 caracteres.
   - Añadir funciones puras `parseBlock` (valida, convierte a `paragraph` o descarta) y `summarizeBlocks` (texto plano acotado para el historial).
   - Sin `any`.
2. **Instrucción al modelo.** En `api/talk.ts`:
   - Pedir una línea JSON por elemento: primero `{"type":"spoken",...}` y después 0–6 bloques. Explicar cuándo usar bloques (explicar, comparar, pasos) y cuándo no (charla).
   - Mantener el idioma forzado.
   - Subir `max_completion_tokens` y `UPSTREAM_TIMEOUT_MS` a valores medidos con `gpt-oss-20b` y `reasoning_effort: "low"`, y registrarlos.
3. **Streaming en el servidor:**
   - Acumular el texto del modelo y procesar cada línea completa.
   - Emitir los eventos SSE `spoken` (texto) → `block` (bloque validado) → `done`, sustituyendo el corte por primera frase.
   - Si `spoken` es inválido o falta, fallar como hoy. Una línea que no es JSON se trata como bloque inválido.
   - Conservar el rate limit, la cancelación y el aviso de error.
4. **Contrato de entrada:**
   - `isExchange` acepta `assistant` hasta el límite del resumen nuevo.
   - `SPEECH_HISTORY_LIMIT` no cambia salvo que la medición lo pida.
5. **Cliente:**
   - `streamSpeechReply` deja de usar `appendFirstSentence`.
   - Expone `onSpoken` y `onBlock` y devuelve `{ spoken, blocks }`.
   - Valida cada evento con las mismas funciones que el servidor.
6. **Sesión:**
   - `SpeechCaption` (o un tipo `SpeechReply`) incluye `blocks` y su generación.
   - El historial guarda `spoken` más `summarizeBlocks`.
   - Voz y animación siguen a `spoken`.
   - Se conservan el idioma, la invalidación por generación, la suspensión y «Borrar conversación».
7. **UI mínima:** la burbuja muestra `spoken`. Mientras no llegue la fase 2, los bloques no se dibujan (quedan disponibles en el estado y en las pruebas).

**Seams:** `api/talk.ts`, `src/creature/brain/{speechProtocol,speechClient}.ts`, `src/hooks/{useSpeechSession,useCreatureBrain}.ts`, `tests/{apiTalk,speechClient,speechSession}.test.ts*`.

**Aceptación:**
- **Unitarias:** bloques válidos, inválidos y mezclados; límites por campo y total; líneas partidas entre chunks; JSON roto; falta de `spoken`; cancelación a mitad de bloque; cambio de idioma; historial con resumen.
- **Prueba manual** con Groq real en local, en ES y EN: una charla y una explicación. Registrar latencia y tokens. Si `gpt-oss-20b` no sigue el formato de forma fiable, detenerse y consultar antes de cambiar de modelo o de formato.
- **Checks:** typecheck de los cuatro proyectos, `npm run lint`, Vitest completo, `npm run build` y `git diff --check`.

**Puerta:** aprobación del usuario antes de la fase 2.

## Fase 2 — Tarjeta de respuesta persistente

**Propósito:** mostrar la respuesta larga sin límite de tiempo, con la composición elegida en escritorio y móvil.

**Secuencia:**
1. **Ciclo de vida:**
   - Sin temporizador de 5 s para respuestas con bloques.
   - La tarjeta se cierra al enviar un mensaje nuevo, con ✕, con `Esc`, al deslizar el panel en móvil y con «Borrar conversación».
   - Se suspende al ocultar Home y no aparece durante la inscripción UATF.
2. **Escritorio:**
   - `creature-zone` usa `layout` de Motion (el mismo patrón que la inscripción) para apartar a Jev.
   - La tarjeta ocupa el otro lado, con alto máximo, scroll interno y desvanecido con `mask-image`.
   - Mientras llegan bloques el scroll los sigue; si el usuario sube, deja de seguirlos y aparece «↓ nuevo».
3. **Móvil:**
   - Vista previa de dos líneas sobre el input, con «Leer todo».
   - Panel inferior con barra de arrastre (`drag` de Motion), dos alturas y `safe-area`/`dvh`/`visualViewport`.
   - Jev visible arriba.
4. **Accesibilidad:**
   - Región con nombre, `tabIndex` y lectura completa en el DOM.
   - El foco entra al panel y vuelve al input al cerrarlo.
   - Un solo anuncio cuando la respuesta está completa.
   - Textos ES/EN en `src/i18n/messages.ts`.
5. **Bloques:** en esta fase se dibujan como texto simple, para revisar composición y comportamiento antes del estilo.

**Seams:** `src/pages/HomePage.tsx`, un componente nuevo de respuesta (por ejemplo `src/features/reply/`), `src/App.css` o el CSS de la feature, `src/i18n/messages.ts`, `src/hooks/useSpeechSession.ts`, `tests/homeControls.test.tsx` y pruebas nuevas de la tarjeta.

**Aceptación:**
- Unitarias de cierre, persistencia, foco, suspensión, UATF y generación obsoleta.
- Playwright con la API simulada, en 1440×900 y 390×844, claro y oscuro: aparece, se desplaza, se cierra, `Esc` funciona y no hay scroll de página ni overflow.
- Capturas registradas en `.dev/evidence/long-reply/`.
- Mismos checks de la fase 1.

**Puerta:** revisión visual y aprobación del usuario antes de la fase 3.

## Fase 3 — Bloques visuales y entrada animada

**Propósito:** que cada tipo de bloque se vea espectacular y coherente con Jev.

**Secuencia:**
1. **Componentes:** uno por bloque (`paragraph`, `list`, `steps`, `compare`, `highlight`, `callout`, `chips`), con tokens y ambos temas. `compare` se apila o pasa a pestañas en móvil.
2. **Entrada:**
   - Cascada por bloque y palabras de desenfoque a nítido (`filter: blur`, opacidad, `transform`), según la excepción de la spec.
   - Duraciones con tokens de movimiento.
   - Movimiento reducido entrega texto estático.
3. **Chips:** envían su pregunta por el mismo camino que el input, con las mismas reglas de cancelación.
4. **Identidad:** halo y colores de Jev en la tarjeta, sin animar sombras ni colores.
5. **Contratos:**
   - `design.md`: Home deja de ser solo «respuesta breve»; se registran la tarjeta, el catálogo y la excepción de `blur`.
   - Docs de estado actual (`docs/architecture.md` y `docs/interaction.md`) actualizados.

**Seams:** el módulo de respuesta de la fase 2, `src/lib/motionTokens.ts`, `design.md`, `docs/`, `tests/` y `tests/e2e/`.

**Aceptación:**
- Unitarias por tipo de bloque, chips y movimiento reducido.
- Matriz Playwright: ES/EN × claro/oscuro × escritorio/móvil, 320 px y viewport bajo, teclado, movimiento reducido, fallo de la API y consola sin errores.
- Capturas de cada bloque.
- Medir el ritmo de frames durante la entrada en escritorio y móvil emulado.
- Mismos checks de la fase 1.

**Puerta:** aprobación final. Después, informar resultados y vaciar los tres SDD, conservando los archivos.

## Riesgos

- `gpt-oss-20b` puede no respetar el formato de líneas JSON. Mitigaciones: validación estricta, conversión a `paragraph` y medición en la fase 1 antes de seguir.
- Más tokens implican más latencia. `think` ya cubre la espera; hay que medir que `spoken` llegue pronto.
- El panel inferior con teclado móvil y `visualViewport` solo se puede verificar con emulación: declarar el límite sin dispositivo físico.
- El desenfoque animado en móvil puede costar frames. Si la medición lo muestra, limitarlo a bloques cortos o cambiarlo por opacidad, consultando al usuario.
