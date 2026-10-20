# Tarea: respuestas largas con UI generada

Handoff vivo de la feature. **Antes de continuar, leer `spec.md`, `plan.md`, este archivo y `../design.md`.**

## Retoma aquí

- **Fase activa:** fase 1 (protocolo de respuesta estructurada), implementada y verificada el 2026-10-20; **entregada para revisión**.
- **Aprobaciones:** spec y plan aprobados el 2026-10-20 («aprobado»).
- **Siguiente acción exacta:** que el usuario revise la fase 1. Con su aprobación, abrir la fase 2 (tarjeta persistente: Jev se aparta en escritorio, vista previa y panel en móvil).
- **Estado del código:** fase 1 commiteada. La burbuja muestra solo la frase hablada; los bloques llegan validados a `brain.speechDetail`, pero todavía no se dibujan.

## Fase 1 — entrega para revisión, 2026-10-20

- [x] Medir `gpt-oss-20b` con el formato antes de implementar.
- [x] Catálogo tipado y normalización compartida en `src/creature/brain/speechBlocks.ts`, más el escáner de objetos JSON.
- [x] `api/talk.ts`: prompt de objetos, historial devuelto como objetos, eventos `spoken` / `block` / `done`, `max_completion_tokens: 512`.
- [x] `speechClient.ts`: callbacks `onSpoken` / `onBlock`, revalidación y `{ spoken, blocks }` como resultado.
- [x] `useSpeechSession.ts`: estado `detail` aparte de la frase; historial con resumen; limpieza al cancelar, regenerar, fallar o suspender. `useCreatureBrain` expone `speechDetail`.
- [x] Docs de estado actual (`docs/architecture.md`, `docs/interaction.md`).
- [ ] Aprobación del usuario.

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
