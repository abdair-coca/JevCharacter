# Fase 2 — idioma, sesión y suspensión de Home

Home conserva contexto, borrador, HUD e historial en memoria al navegar; su actividad se suspende mientras está oculta. El habla usa ES/EN validado y regenera al cambiar idioma durante una respuesta. «Borrar conversación» vacía contexto/historial/caché sin reiniciar personalidad ni cuotas. [Estado y aprobación](../../task.md).

## Evidencia automatizada

[Resultados completos](results.json): **60 checks**, **11 capturas**, cero errores de aplicación. Pruebas unitarias: **86 tests en 15 archivos**, typechecks por proyecto, ESLint y build aprobados.

| Pantalla | Claro ES | Claro EN | Oscuro ES | Oscuro EN |
|---|---|---|---|---|
| 1440×900 | [Ver](desktop-light-es.png) | [Ver](desktop-light-en.png) | [Ver](desktop-dark-es.png) | [Ver](desktop-dark-en.png) |
| 390×844 | [Ver](mobile-light-es.png) | [Ver](mobile-light-en.png) | [Ver](mobile-dark-es.png) | [Ver](mobile-dark-en.png) |

Casos de integración: [respuesta EN simulada](english-reply.png), [Home suspendida en Features](features-home-suspended.png), [fallo de habla como estado localizado](speech-unavailable-es.png).

El harness utiliza un **servidor HTTP/SSE local** y redirige `/api/*` hacia él. Así prueba readers abiertos, deltas, desconexiones y aborts reales de transporte, con respuestas del proveedor simuladas. Las compuertas controlan qué generación finaliza, sin depender de que una demora fija sea suficiente para hacer clicks.

Se verifican:
- Regeneración al cambiar idioma, cambios rápidos antes del primer delta, ausencia de mezcla y captions con `lang` propio.
- Historial solo con resultados completos; mensajes originales conservados y limpieza completa de conversación.
- Borrador, HUD y mismo canvas retenidos, `hidden`/`inert`, atrás/adelante y entrada directa a Features.
- Sin red al ocultar Home, cambiar idioma fuera de ella o regresar de otra ruta; sin nuevos `requestAnimationFrame` de la ventana principal durante la suspensión.
- Cancelación antes de recibir decisión, interrupción de habla y reanudación sin respuestas obsoletas.
- Fallos HTTP, SSE y conexión, avisos traducidos y fallback de decisión local sin habla ficticia.

Las pruebas unitarias cubren además límites/validación de API, falta de proveedor, ventana de cuota, teardown de timers/readers, Strict Mode y cambios de idioma mientras se espera la decisión.

## Prueba real de habla

Además del harness, se ejecutaron dos requests con Node `fetch` contra el middleware real de Vite (`http://127.0.0.1:5173/api/talk`), con claves únicamente en servidor:

| Body enviado | Resultado observado |
|---|---|
| `{"message":"Say hello briefly.","language":"es","history":[]}` | HTTP 200, deltas «¡», «Hola», «!» y evento `done`. |
| `{"message":"Salúdame brevemente.","language":"en","history":[]}` | HTTP 200, deltas «Hey», « there», «!» y evento `done`. |

Esto comprueba el idioma solicitado contra Groq en esa ejecución; no acredita todo el flujo Jev→habla con proveedor real ni disponibilidad futura. No se incluyen tokens ni headers de autorización.

## Reproducir los tests de navegador

```powershell
npm run build
npm run preview -- --host 127.0.0.1 --port 5174
```

En otra terminal desde la raíz:

```powershell
node ".dev/evidence/phase-2/verify.mjs"
```

El servidor fixture se crea en un puerto local efímero y se cierra al terminar. Cada caso usa un proceso Chromium nuevo para limitar presión de memoria WASM/GPU; las navegaciones dentro de un caso comparten la misma Home. Para probar servicios reales manualmente, usar **`npm run dev`**, no el preview estático.

## Límites registrados

- Chromium 153.0.8010.12; móvil y visibilidad emulados, no dispositivo físico.
- 48 avisos WebGL ReadPixels del navegador al capturar; dos errores de red esperados inyectados se guardan por separado.
- Una corrida anterior agotó memoria WASM del host al acumular contextos; la corrida aislada final pasó. `diagnostic-failure.png`, si existe, es un diagnóstico descartado, no la matriz final.
- Sin medición LCP/FPS, despliegue ni validación física de teclado. La entrega espera revisión del usuario antes de iniciar fase 3.
