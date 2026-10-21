# Plan: Jev compañero con memoria persistente

- **Base:** [spec.md](spec.md).
- **Contratos de UI/animación:** [design.md](../design.md).
- **Estado:** aprobado el 2026-10-21. Fase 1 entregada para revisión.

## Dependencias y orden

1. **Fase 1 — Memoria:** protocolo `memory`, store local y envío de notas relevantes. La UI no cambia.
2. **Fase 2 — Preguntas con opciones:** bloque `choices`, conversación abierta sin `/api/decide` y prompt de orientación. Depende de la fase 1 para recomendar con lo recordado.
3. **Fase 3 — Panel y cierre:** «Lo que Jev recuerda», cambio de reglas y textos (AGENTS, design, Historia, docs) y matriz completa.

Cada fase se entrega para revisión y se detiene hasta su aprobación.

## Fase 1 — Memoria persistente por fragmentos

**Propósito:** que Jev recuerde entre recargas sin aumentar mucho los tokens.

- `src/creature/brain/speechBlocks.ts` (hoja sin imports): `SPEECH_MEMORY_NOTE_MAX_CHARS = 160`, `parseMemoryNote`, filtro de dígitos y límites compartidos con la API (`MEMORY_SEND_MAX = 8`, `MEMORY_SEND_MAX_CHARS = 1000`).
- `api/talk.ts`:
  - El cuerpo acepta `memory: string[]` validado.
  - El prompt añade el bloque de notas como datos y la instrucción de emitir `memory` al final, solo si hay algo nuevo y nunca datos sensibles.
  - El escáner reconoce `memory` y lo emite como evento SSE `memory`; no cuenta como bloque visible.
  - Se mide el uso real y se ajusta `max_completion_tokens` solo si la nota recorta respuestas (hoy 384, máximo medido 231).
- `src/creature/memory/memoryStore.ts` (nuevo): lectura y escritura con `readStorage`/`writeStorage`, versión, tope de 40, deduplicación, caída a memoria de sesión y `selectRelevant(message)` por palabras en común.
- `speechClient.ts` y `useSpeechSession.ts`: envían las notas relevantes y guardan la nota recibida al completar la respuesta, no si se cancela.
- Tests:
  - Vitest de store: tope, orden, duplicados, storage roto, selección relevante, filtro de dígitos.
  - Vitest de API: validación de `memory`, evento SSE y notas como datos.
  - Vitest de cliente y sesión: envío y guardado.
  - Playwright: recargar conserva y envía las notas.
- **Verificación real:** un par de intercambios en `npm run dev` con Groq, registrando el consumo de tokens.

## Fase 2 — Jev pregunta con opciones

**Propósito:** conversación guiada tipo orientación vocacional.

- `speechBlocks.ts`: tipo `choices` (pregunta ≤120, 2–5 opciones ≤40, una por respuesta, al final); `api/talk.ts`: catálogo y ejemplo en el prompt, más la pauta «pregunta antes de recomendar; no repreguntes lo que la memoria ya sabe».
- `ReplyBlocks.tsx` y `reply.css`: grupo de opciones con rol y etiqueta, entrada en cascada como los demás bloques y opciones deshabilitadas al llegar un mensaje nuevo.
- Conversación abierta en `useCreatureBrain`: si la última respuesta terminó con `choices`, `submitContext` arranca el habla directamente con una decisión TALK local, sin llamar a `/api/decide`. La cancelación, la suspensión y «Borrar conversación» cierran la conversación abierta.
- i18n ES/EN para la etiqueta del grupo de opciones.
- Tests:
  - Vitest: parseo y límites de `choices`; ruta directa a talk sin fetch a decide; cierre de la conversación al cancelar o borrar.
  - Playwright: tocar una opción y escribir otra respuesta, en escritorio y móvil.
- **Verificación real:** el flujo «¿qué carreras puedo estudiar?» en dev, con capturas.

## Fase 3 — Panel «Lo que Jev recuerda» y cierre

- `src/features/memory/MemoryPanel.tsx` (cargado con `lazy`): diálogo con lista, borrar una, «Olvidar todo» con confirmación propia, estado vacío y aviso de que se guarda solo en el navegador. Se abre con un botón «Memoria» en el pie de Home.
- Reglas y textos: `AGENTS.md`, `design.md` (contrato de memoria y de opciones), `docs/architecture.md`, `docs/interaction.md`, `docs/README.md` y la copia de Historia (ES/EN).
- Playwright: matriz ES/EN × claro/oscuro × escritorio/móvil del panel y de las opciones, teclado y movimiento reducido. Capturas en `.dev/evidence/companion/`.

## Riesgos

- **Tokens de Groq (8000 TPM):** las notas suman unos 300 tokens de entrada por petición. Se mitiga con el tope de 8 notas y 1000 caracteres, y se mide en la fase 1.
- **Inyección por memoria:** una nota podría contener instrucciones. Se mitiga con notas validadas, bloque delimitado de datos y la regla en el prompt; las notas nunca llegan a `/api/decide`.
- **Privacidad:** cualquiera con acceso al navegador ve las notas. Se mitiga con el aviso en el panel, borrado fácil y sin datos sensibles.
- **Modelo inconsistente:** puede omitir `choices` o `memory`. Ambos son opcionales y la respuesta se sostiene sin ellos; los tests de protocolo cubren el orden y la ausencia.
- **Cambio de carácter:** Jev pasa de «criatura que prefiere callar» a conversar más, pero solo dentro de una conversación que él mismo abre con `choices`. El resto del camino de decisión no cambia.
