# Fase 1 — Home para revisión visual

La Home revisada fue aceptada al autorizar continuar con fase 2. Este directorio conserva la evidencia visual de fase 1; la prueba del teclado en un móvil físico sigue pendiente. Estado actual en [task.md](../../task.md); requisitos en [spec.md](../../spec.md) y secuencia en [plan.md](../../plan.md).

**Referencia visual aceptada:** [input y HUD orgánicos](organic-controls/README.md). Antecedentes: [prove2 y aumento de tamaño](prove2/README.md), [composición/controles previos](revision/README.md). Los harnesses de fase 1 son históricos: esperaban el dropdown anterior o el desmontaje de Home. Para comprobar la sesión persistente actual, usar [la evidencia de fase 2](../phase-2/README.md).

## Capturas

Se tomaron esperando a Rive cargado, en Chromium 153.0.8010.12 con DPR 1. Móvil es emulación, no dispositivo físico.

| Pantalla | Claro ES | Oscuro ES | Claro EN | Oscuro EN |
|---|---|---|---|---|
| Escritorio 1440×900 | [Ver](home-desktop-light-es.png) | [Ver](home-desktop-dark-es.png) | [Ver](home-desktop-light-en.png) | [Ver](home-desktop-dark-en.png) |
| Móvil 390×844 | [Ver](home-mobile-light-es.png) | [Ver](home-mobile-dark-es.png) | [Ver](home-mobile-light-en.png) | [Ver](home-mobile-dark-en.png) |

- [Viewport reducido a 390×420](mobile-short-viewport.png): input alcanzable con scroll; teclado simulado mediante resize.
- [Reflow/movimiento reducido](mobile-reduced-motion.png): 320px y HUD desplegado.
- [Línea base anterior](baseline-desktop.png).
- [Resultados de navegador](browser-results.json): 70 checks, cero errores/fallos y avisos WebGL registrados.
- [Contraste de tokens usados](contrast.json): texto normal ≥4,79:1 y foco ≥4,79:1.

## Reproducción histórica

```powershell
npm run build
npm run preview -- --host 127.0.0.1 --port 5174
```

En otra terminal, desde la raíz del proyecto:

```powershell
npm exec -- playwright install chromium
node ".dev/evidence/phase-1/run-browser.mjs"
```

El runner carga [el harness](browser-check.js), intercepta todas las solicitudes de proveedor y vuelve a generar resultados y capturas. Comprueba preferencias antes de React bloqueando temporalmente el script principal; las respuestas reaction/answer/morph/talk y SSE son fixtures, no respuestas reales de IA. No mide LCP/FPS ni verifica despliegue remoto.

## Revisar ahora

1. Encuadre y tamaño del Jev actual en ambos temas.
2. Jerarquía del título y claridad del input/HUD.
3. Cabecera y distribución en móvil.

La aprobación de esta entrega debe registrarse en `task.md` antes de iniciar fase 2.
