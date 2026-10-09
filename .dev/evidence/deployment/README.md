# Publicación frontend en Vercel — 2026-10-09

**Publicado y verificado:** [jev-bot-sigma.vercel.app](https://jev-bot-sigma.vercel.app). Artefacto estático, sin funciones ni llamadas API de la aplicación. Home usa reacciones locales; Features, Story y la demo UATF están disponibles.

## Entrega

- Proyecto: `abdairs-projects/jev-bot`.
- Deploy final: [jev-88s8hcdov-abdairs-projects.vercel.app](https://jev-88s8hcdov-abdairs-projects.vercel.app), `dpl_BubWMWhaUeeQjcBHJ7qWymkJkL23`, estado **Ready**, target **production**.
- Commit de runtime: `169d8e5`. Los commits posteriores guardan únicamente evidencia y documentación.
- Comandos: `npm run build:frontend` → `vercel deploy --prebuilt --prod --yes` → `vercel inspect <URL del deploy>`.
- `.vercel/output` contiene `config.json` y `static/`; no contiene `functions/`. Los handlers opcionales del repositorio no forman parte del artefacto publicado.

## Smoke remoto

| Bloque | Condiciones | Resultado |
|---|---|---|
| [Desktop](desktop.json) | 1440×900, claro, ES | 24 checks / 4 capturas, cero errores y cero requests API de la web. |
| [Mobile](mobile.json) | 390×844, oscuro, EN, touch emulado | 24 checks / 4 capturas, cero errores y cero requests API de la web. |

Se comprueban rutas directas HTTP 200, Rive listo, decisión local, validación/confirmación UATF, limpieza de campos, retorno de foco, ocho capítulos Features, cinco escenas Story y revelación final. No overflow horizontal. Sondas HTTP independientes con body vacío confirman `/api/decide` y `/api/talk` ausentes (404); no son solicitudes de la aplicación.

Capturas: [Home desktop](desktop-home.png), [UATF móvil](mobile-enrollment.png), [Features móvil](mobile-features.png), [Story desktop](desktop-story.png). El resto figura en los JSON.

```powershell
node ".dev/evidence/deployment/verify.mjs" "https://jev-bot-sigma.vercel.app" desktop
node ".dev/evidence/deployment/verify.mjs" "https://jev-bot-sigma.vercel.app" mobile
```

Los dos bloques finales se ejecutaron de forma individual, aproximadamente 35–40 s cada uno. Chromium headless en Windows; móvil emulado, sin móvil físico, Safari/iOS ni benchmark LCP/FPS. Datos ficticios de formulario. La publicación no equivale a aprobación visual de las entregas pendientes.

## Corrección encontrada al publicar

El primer deploy pasó escritorio, pero el blur del celular expandía el formulario móvil entre `pointerdown` y `pointerup`: Confirmar se desplazaba y el toque no enviaba. Se reprodujo con eventos, se observó un test rojo y se corrigió preservando composición mientras el foco pasa a un control de inscripción. Suite final: **26 archivos / 179 tests PASS**; ESLint, typecheck de tests y build frontend también PASS. El build ejecuta `tsc -b` para app/Node/API.

Las primeras capturas de Features eran prematuras respecto a la pose GPU: el harness añade la misma estabilización de 1,8 s que la evidencia anterior. Se regeneraron ambos bloques/capturas finales. Una corrida móvil adicional agotó el timeout del comando y se repitió completa; no cuenta como aprobada. Los probes temporales de eventos se retiraron; los PNG diagnósticos quedan locales sin commit. Más detalle y revisiones pendientes en [task](../../task.md).
