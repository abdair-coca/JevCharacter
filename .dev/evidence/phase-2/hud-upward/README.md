# HUD hacia arriba y Home sin scroll

Revisión solicitada el 2026-10-07: menú del HUD hacia arriba, resumen móvil minimalista a la derecha sobre el input y Home de una pantalla. **393 comprobaciones y 20 capturas aprobadas**, sin errores de aplicación. [Estado de fase 2](../../../task.md).

## Capturas

| Variante | Cerrado | Abierto |
|---|---|---|
| Escritorio claro ES | [Ver](desktop-light-es-collapsed.png) | [Ver](desktop-light-es-expanded.png) |
| Escritorio claro EN | [Ver](desktop-light-en-collapsed.png) | [Ver](desktop-light-en-expanded.png) |
| Escritorio oscuro ES | [Ver](desktop-dark-es-collapsed.png) | [Ver](desktop-dark-es-expanded.png) |
| Escritorio oscuro EN | [Ver](desktop-dark-en-collapsed.png) | [Ver](desktop-dark-en-expanded.png) |
| Móvil claro ES | [Ver](mobile-light-es-collapsed.png) | [Ver](mobile-light-es-expanded.png) |
| Móvil claro EN | [Ver](mobile-light-en-collapsed.png) | [Ver](mobile-light-en-expanded.png) |
| Móvil oscuro ES | [Ver](mobile-dark-es-collapsed.png) | [Ver](mobile-dark-es-expanded.png) |
| Móvil oscuro EN | [Ver](mobile-dark-en-collapsed.png) | [Ver](mobile-dark-en-expanded.png) |

Viewport corto con contexto retenido: [claro ES](mobile-light-es-short.png), [claro EN](mobile-light-en-short.png), [oscuro ES](mobile-dark-es-short.png), [oscuro EN](mobile-dark-en-short.png).

## Qué se comprobó

- Página sin overflow horizontal/vertical ni desplazamiento por rueda o PageDown; input y pie alcanzables.
- Panel por encima del HUD, dentro del ancho de pantalla y por debajo de la cabecera; abrirlo conserva las coordenadas del input y del botón.
- Resumen móvil de 208 × 49,6 px, alineado a la derecha encima del input; abrir por touch/Enter y cerrar con Escape.
- Escritorio 1440×900, 1366×768, 1024×768, 1366×600; móvil 390×844, 390×780, 390×667, 390×568, 320×568, 390×420 y horizontal 844×390.
- Movimiento reducido, conversación retenida y fallo de habla en viewport corto, ambos idiomas/temas.
- Navegar conserva el HUD abierto y libera el bloqueo de scroll al abandonar Home.

[Resultados y medidas completos](results.json). Typechecks app/Node/API/tests, ESLint y build aprobados; Vitest: **87 tests en 15 archivos**, incluido cierre con Escape/foco.

## Reproducir

```powershell
npm run build
npm run preview -- --host 127.0.0.1 --port 5174
```

En otra terminal:

```powershell
node ".dev/evidence/phase-2/hud-upward/verify.mjs"
```

## Límites e incidencias

Chromium 153; móvil, teclado por reducción de viewport y movimiento reducido emulados. APIs interceptadas con fixtures, sin consultas a proveedores. No acredita teclado físico, Safari/iOS ni rendimiento LCP/FPS.

La primera corrida detectó recorte superior tras retener contexto a 390×420. Se corrigió la composición baja: diagnóstico a la izquierda del resumen, métricas compactas y avisos con interlineado reducido. La matriz final completa pasó. `diagnostic-failure.png` es antecedente descartado, no captura final.

La corrida final conserva 32 avisos WebGL ReadPixels durante capturas y cuatro HTTP 503 esperados del fixture. No se añadieron dependencias ni se modificó el asset Rive. Pendiente revisión visual del usuario.
