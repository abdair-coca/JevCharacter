# Revalidación de fase 3

Verificación actual del recorrido Features después de retirar la máscara radial de Jev. La [entrega anterior](../README.md) conserva sus capturas y resultados; esta ejecución registra su propia evidencia. Estado y aprobación en [task.md](../../../task.md).

## Reproducir

Preparar el build y abrir el preview en el puerto 5174, como indica el README de la entrega. En otra terminal:

```powershell
$env:JEV_EVIDENCE_DIRECTORY = ".dev/evidence/phase-3/revalidation"
node ".dev/evidence/phase-3/verify.mjs" desktop-light-es layout
```

Ejecutar individualmente los 29 bloques definidos en [aggregate.mjs](../aggregate.mjs), manteniendo la variable de salida. Al terminar:

```powershell
node ".dev/evidence/phase-3/aggregate.mjs"
```

## Resultado

**PASS: 29 bloques completos, 240 checks y 35 capturas; cero errores inesperados.** [Resultado agregado](results.json) registra el fingerprint de fuentes y los reportes individuales. Se repitieron los cuatro typechecks, ESLint, 111 tests y build; comandos/peso en [task.md](../../../task.md).

Esta matriz usa el harness reforzado tras la revisión: el contador API empieza antes de abrir Features, y el fingerprint/frescura incluye `src/App.css` y los propios scripts de verificación. También pasaron sintaxis de scripts, 231 enlaces/anclas documentales y whitespace del diff.

| Revisión | Escritorio | Móvil |
|---|---|---|
| Claro ES | [Percibe](desktop-light-es-perceives.png) · [Reacciona](desktop-light-es-reacts.png) · [Decide](desktop-light-es-decides.png) | [Percibe](mobile-light-es-perceives.png) · [Reacciona](mobile-light-es-reacts.png) · [Decide](mobile-light-es-decides.png) |
| Claro EN | [Perceives](desktop-light-en-perceives.png) · [Reacts](desktop-light-en-reacts.png) · [Decides](desktop-light-en-decides.png) | [Perceives](mobile-light-en-perceives.png) · [Reacts](mobile-light-en-reacts.png) · [Decides](mobile-light-en-decides.png) |
| Oscuro ES | [Percibe](desktop-dark-es-perceives.png) · [Reacciona](desktop-dark-es-reacts.png) · [Decide](desktop-dark-es-decides.png) | [Percibe](mobile-dark-es-perceives.png) · [Reacciona](mobile-dark-es-reacts.png) · [Decide](mobile-dark-es-decides.png) |
| Oscuro EN | [Perceives](desktop-dark-en-perceives.png) · [Reacts](desktop-dark-en-reacts.png) · [Decides](desktop-dark-en-decides.png) | [Perceives](mobile-dark-en-perceives.png) · [Reacts](mobile-dark-en-reacts.png) · [Decides](mobile-dark-en-decides.png) |

Acciones: [estrella](morph-MorphState.png), [cuadrado](morph-square.png), [triángulo](morph-triangle.png), [habla escrita](talk-example.png). Recuperación: [asset no disponible](asset-error.png).

Movimiento reducido: [desktop claro ES](desktop-light-es-reduced.png), [desktop oscuro EN](desktop-dark-en-reduced.png), [móvil claro ES](mobile-light-es-reduced.png), [móvil oscuro EN](mobile-dark-en-reduced.png). Reflow 320 px: [claro ES](mobile-light-es-reflow.png), [oscuro EN](mobile-dark-en-reflow.png).

Además del layout se verificaron acciones Rive reales, teclado/touch, cambios de preferencias sin remontaje, reload/back-forward, cero llamadas API desde Features, offline tras cargar recursos, suspensión y retorno desde paso cero, conservación de Home y recuperación de error.

## Condiciones y límites

Chromium 153; preview de producción en `127.0.0.1:5174`. Escritorio 1440×900, móvil 390×844 y reflow 320×568. Visibilidad, touch y movimiento reducido emulados; proveedor solo con fixture de Home. Sin móvil físico/Safari/iOS ni mediciones de LCP/FPS.

El agregado registra 120 avisos WebGL ReadPixels de captura y dos errores esperados del asset 404. Dos corridas concurrentes iniciales excedieron el timeout durante el cierre sin guardar reporte. En la matriz reforzada, un arranque excepcionalmente demorado activó el deadline de `action-6`; su repetición pasó en 7 s. El agregado contiene solo los 29 reportes finales completos posteriores al último cambio de scripts. Se ejecutaron uno a uno en aproximadamente 3–18 s por bloque habitual y 56 s para aislamiento/recuperación.

**Siguiente paso:** revisión visual/funcional del usuario en [Features](http://127.0.0.1:5173/features). La fase 3 sigue pendiente de aprobación.
