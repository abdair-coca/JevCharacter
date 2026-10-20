# Tarea: respuestas largas con UI generada

Handoff vivo de la feature. **Antes de continuar, leer `spec.md`, `plan.md`, este archivo y `../design.md`.**

## Retoma aquí

- **Fase activa:** fase 2 (tarjeta persistente), implementada y verificada el 2026-10-20; **entregada para revisión visual**.
- **Aprobaciones:** spec y plan aprobados el 2026-10-20 («aprobado»). Fase 1 aprobada el 2026-10-20 («continua con el plan y reduce los tokens de respuesta, pero no mucho»).
- **Siguiente acción exacta:** que el usuario revise la fase 2 en escritorio y móvil (capturas en `evidence/long-reply/`). Con su aprobación, abrir la fase 3 (bloques visuales, entrada con desenfoque, chips que envían, `design.md`).
- **Estado del código:** fase 2 commiteada. Los bloques se dibujan como texto semántico sin estilo propio; el estilo es de la fase 3.

## Fase 2 — entrega para revisión, 2026-10-20

Quiz de la fase: lectura desde arriba con «Más ↓» y panel móvil que vuelve a la vista previa; ambos registrados en `spec.md`.

- [x] Sesión: `detail` incluye la frase y ya no caduca. Nuevo `dismissDetail(generation)`, que retira la tarjeta y el rótulo e ignora los bloques y el cierre tardíos de esa respuesta. Se expone como `brain.dismissSpeechDetail`.
- [x] Escritorio (más de 64rem): `data-reply="open"` añade una columna al grid de Home. Jev pasa a la columna 1 con `layout` de Motion (misma transición que la inscripción); la tarjeta va en la columna 2, en la fila del escenario. Título e input conservan su sitio.
- [x] Móvil (64rem o menos): vista previa de 2 líneas (1 línea si el alto es de 45rem o menos) con «Leer todo» y ✕. El panel es un portal a `body`, modal, con dos alturas por `transform`, arrastre desde la barra, fondo que se atenúa según la posición y expansión al hacer scroll.
- [x] Accesibilidad: región con nombre y `tabIndex`, foco dentro del panel con Tab atrapado, `Esc`, foco devuelto y una única región `status` que anuncia la frase una vez (el rótulo ya no tiene la suya).
- [x] Textos ES/EN nuevos en `messages.ts`, hook `useMediaQuery`, módulo `src/features/reply/` y `reply.css` con tokens.
- [x] Docs de estado actual (`architecture`, `interaction`).
- [ ] Aprobación visual del usuario.

**Hallazgo corregido durante la verificación:** el panel abierto del todo quedaba **debajo** de la cabecera fija. `.home-page` crea su propio contexto de apilamiento (`isolation: isolate`), así que el `z-index` del panel no la superaba y la barra de arrastre quedaba tapada. Se corrigió con un portal a `document.body`.

| Comprobación | Resultado |
|---|---|
| `tsc --noEmit -p` app / node / api / tests | PASS. |
| `eslint . --max-warnings=0 --ignore-pattern "playwright-report/**"` | PASS (el `npm run lint` sin filtro sigue fallando solo por `playwright-report/`, ver fase 1). |
| `vitest run --maxWorkers=1` completo | PASS: 39 archivos / 274 tests. Nuevos: `speechReply` (5), y en `speechSession` el cierre, la generación vieja y la suspensión. |
| `npx playwright test` (build + preview, API simulada) | PASS: 19 tests, 10 de ellos nuevos en `tests/e2e/reply.spec.ts`. |
| `git diff --check` | PASS. |

`reply.spec.ts` cubre:
- Escritorio 1440×900: tarjeta junto a Jev, que se desplaza más de 150 px; sigue visible después de 6 s; ✕, `Esc`, mensaje nuevo; sin scroll de página ni overflow.
- 1280×640: empieza arriba y «Más» desplaza.
- Tema oscuro.
- Móvil 390×844: vista previa, panel modal con foco, `Esc` devuelve el foco a «Leer todo», ✕ descarta, la barra expande y el arrastre vuelve a la vista previa.
- 320×568 y 844×390: sin scroll de página ni overflow.

Capturas en `evidence/long-reply/` (generadas con `REPLY_EVIDENCE=.dev/evidence/long-reply npx playwright test tests/e2e/reply.spec.ts`): `desktop-card-{light,dark}`, `mobile-preview-light`, `mobile-sheet-half-light`, `mobile-sheet-full-dark`, `preview-` y `sheet-` en `320x568` y `844x390`.

**Límites:**
- En varias capturas Jev aún muestra el loader, porque Rive tarda más en la emulación de Playwright que la respuesta simulada.
- Arrastre probado con mouse en Chromium emulado; sin dispositivo táctil real, Safari/iOS ni lector de pantalla.
- En horizontal de 390 px de alto, el panel a media altura muestra poco contenido; se expande con la barra o al hacer scroll.
- El reflow a 320 px ya recortaba el título bajo la cabecera antes de esta fase; no se tocó.

## Ajuste de tokens — 2026-10-20

Pedido: «reduce los tokens de respuesta, pero no mucho». En el quiz se eligió un tope de 384 tokens y unos 650 caracteres. Cambios:
- `max_completion_tokens`: de 512 a 384. El máximo medido fue 231.
- El prompt pide unos 650 caracteres visibles, en vez de 800.
- `SPEECH_BLOCKS_MAX_CHARS`: de 900 a 750, con el mismo margen.

Verificación: typecheck de la API y tests de `apiTalk`, `speechBlocks` y `speechClient` en PASS (38 tests).

## Fase 1 — aprobada, 2026-10-20

- [x] Medir `gpt-oss-20b` con el formato antes de implementar.
- [x] Catálogo tipado y normalización compartida en `src/creature/brain/speechBlocks.ts`, más el escáner de objetos JSON.
- [x] `api/talk.ts`: prompt de objetos, historial devuelto como objetos, eventos `spoken` / `block` / `done`, `max_completion_tokens: 512`.
- [x] `speechClient.ts`: callbacks `onSpoken` / `onBlock`, revalidación y `{ spoken, blocks }` como resultado.
- [x] `useSpeechSession.ts`: estado `detail` aparte de la frase; historial con resumen; limpieza al cancelar, regenerar, fallar o suspender. `useCreatureBrain` expone `speechDetail`.
- [x] Docs de estado actual (`docs/architecture.md`, `docs/interaction.md`).
- [x] Aprobación del usuario (2026-10-20).

**Medición previa (script temporal fuera del repo, Groq real):** 15 de 15 respuestas válidas, en 0,4–0,8 s y con 231 tokens de completado como máximo. El modelo **no** separa los objetos con saltos de línea aunque se le pida: los pega uno tras otro. Por eso el servidor usa un escáner de llaves en lugar de dividir por líneas; también tolera arrays y bloques de código markdown. Otros desvíos que se normalizan: pasos numerados («1. …»), varios pasos en un solo ítem con `\n`, claves extra (`max_chars`), listas de más de 6 ítems y claves `type` duplicadas.

**Decisiones de implementación:**
- La frase hablada llega completa en un único evento, ya no letra a letra. Llega en unos 0,5 s y `think` cubre la espera.
- Los bloques viven en un estado aparte (`detail`) para que la voz y la burbuja no se recalculen con cada bloque.
- El prompt pide unos 800 caracteres visibles; el servidor y el cliente admiten hasta 900 como margen.
- El historial guarda `frase\nresumen` (hasta 600 caracteres). El servidor lo devuelve al modelo como `{"type":"spoken"}` + `{"type":"paragraph"}`, para que el historial no le enseñe a responder en texto plano.
- Los archivos compartidos con la API no tienen imports, por la resolución NodeNext; `speechBlocks.ts` también contiene las funciones del historial.

| Comprobación | Resultado |
|---|---|
| `tsc --noEmit -p` app / node / api / tests | PASS. |
| `npm run lint` | Falla con 3687 errores, **todos** en `playwright-report/trace/` (reporte generado, ignorado por git, no ignorado por ESLint). `eslint . --max-warnings=0 --ignore-pattern "playwright-report/**"`: PASS, cero advertencias. |
| `vitest run --maxWorkers=1` completo | PASS: 38 archivos / 266 tests. Nuevos: `speechBlocks` (8) y casos en `apiTalk`, `speechClient` y `speechSession`. |
| `npm run build` | PASS. `index` 328,24 kB / gzip 104,94 kB. |
| `git diff --check` | PASS. |
| Groq real vía `vite` local (`/api/talk`, script temporal) | 5 de 5 válidas: saludo ES/EN solo con frase; fotosíntesis → `steps` + `chips`; gatos/perros → `compare` + `chips`; seguimiento con historial → `compare` coherente con el turno anterior. Frase a los 0,55–1,34 s; total ≤ 1,35 s. |

**Límites y riesgos:**
- El límite gratuito de Groq es de 8000 tokens por minuto y se alcanzó durante la medición (16 peticiones seguidas). El prompt nuevo usa unos 500 tokens por petición, frente a unos 60 del anterior. Con varios usuarios a la vez puede haber errores 429, que la UI muestra como «no disponible».
- No hubo revisión visual: en esta fase la UI solo cambia en que la burbuja aparece completa en vez de escribirse letra a letra.
- Sin Playwright: la fase no cambia la composición. No hubo deploy ni push.
- `npm run lint` necesita ignorar `playwright-report/`. Lo dejo anotado y no cambio `eslint.config.js` porque está fuera de alcance.

## Preparación — 2026-10-20

- [x] Recoger las decisiones del quiz (escritorio, móvil, cierre, UI generada, voz, longitud, extras y fases).
- [x] Detectar los límites anteriores: una frase de 120 caracteres o menos, `max_completion_tokens: 64`, historial de 120 caracteres o menos y burbuja de 5 s.
- [x] Detectar el conflicto con `design.md:221` (no animar filtros). El usuario aprobó una excepción acotada para el desenfoque de entrada (se registrará en la fase 3).
- [x] Verificar y commitear el trabajo de voz pendiente (`3317bfc`): typecheck, ESLint y Vitest 37 archivos / 247 tests en PASS.
