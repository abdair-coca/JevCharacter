# Features libre — fase 3

**240 checks, 35 capturas y 29 ejecuciones cortas aprobadas.** Jev recorre los espacios libres de ocho capítulos, con explicaciones alternadas izquierda/derecha. No hay tarjetas ni marco alrededor del personaje; confianza y decisión se explican en su capítulo. [Entrega y aprobación](../../task.md).

## Revisión visual

| Variante | Texto a la izquierda | Texto a la derecha | Decisión y confianza |
|---|---|---|---|
| Escritorio claro ES | [Percibe](desktop-light-es-perceives.png) | [Reacciona](desktop-light-es-reacts.png) | [Decide](desktop-light-es-decides.png) |
| Escritorio claro EN | [Perceives](desktop-light-en-perceives.png) | [Reacts](desktop-light-en-reacts.png) | [Decides](desktop-light-en-decides.png) |
| Escritorio oscuro ES | [Percibe](desktop-dark-es-perceives.png) | [Reacciona](desktop-dark-es-reacts.png) | [Decide](desktop-dark-es-decides.png) |
| Escritorio oscuro EN | [Perceives](desktop-dark-en-perceives.png) | [Reacts](desktop-dark-en-reacts.png) | [Decides](desktop-dark-en-decides.png) |
| Móvil claro ES | [Percibe](mobile-light-es-perceives.png) | [Reacciona](mobile-light-es-reacts.png) | [Decide](mobile-light-es-decides.png) |
| Móvil claro EN | [Perceives](mobile-light-en-perceives.png) | [Reacts](mobile-light-en-reacts.png) | [Decides](mobile-light-en-decides.png) |
| Móvil oscuro ES | [Percibe](mobile-dark-es-perceives.png) | [Reacciona](mobile-dark-es-reacts.png) | [Decide](mobile-dark-es-decides.png) |
| Móvil oscuro EN | [Perceives](mobile-dark-en-perceives.png) | [Reacts](mobile-dark-en-reacts.png) | [Decides](mobile-dark-en-decides.png) |

Capacidades: [estrella](morph-MorphState.png), [cuadrado](morph-square.png), [triángulo](morph-triangle.png) y [habla de ejemplo](talk-example.png). Error recuperable: [carga del asset](asset-error.png).

Movimiento reducido: [desktop claro ES](desktop-light-es-reduced.png), [desktop oscuro EN](desktop-dark-en-reduced.png), [móvil claro ES](mobile-light-es-reduced.png), [móvil oscuro EN](mobile-dark-en-reduced.png). Reflow: [320 px claro ES](mobile-light-es-reflow.png), [320 px oscuro EN](mobile-dark-en-reflow.png).

## Comprobaciones

- Ocho capítulos ES/EN; script y tiempos fijos, sin IA, sensores reales ni modificación de Home.
- Binding Rive real: Base, Hello, Flower, Ghost, think, yes, no, Talk, MorphState, square y triangle. Capturas inspeccionadas; asset original consumido desde `Character`.
- Jev se desplaza de lado según el scroll; texto alternado y ninguna superficie visible de tarjeta/escenario. Móvil adapta la separación vertical y los controles.
- Confianza, acción, intensidad y atención se explican en Decide. 94 % es un ejemplo fijo, no una lectura actual ni garantía de respuesta correcta.
- Idioma/tema conservan capítulo, paso y mismo canvas; teclado, touch, reload, atrás/adelante y controles de capítulos comprobados.
- Offline después de cargar recursos; pausa sin nuevos RAF al ocultar pestaña; retorno desde paso cero del capítulo seleccionado; scroll nativo funciona fuera del escenario.
- Home conserva contexto, borrador, personalidad y canvas, sin consulta de IA al regresar. Pinning y Lenis se retiran al salir.
- Asset no disponible deja los capítulos legibles y permite reintentar; recuperación real comprobada.

[Resumen agregado](results.json) contiene el fingerprint de las fuentes y la lista explícita de 29 reportes finales. Cada reporte debe estar completo, sin errores y ser posterior al último cambio de código. No se incluyen las corridas interrumpidas en ese resultado.

## Ejecutar un bloque corto

```powershell
npm run build
npm run preview -- --host 127.0.0.1 --port 5174
```

En otra terminal, ejecutar cada bloque por separado:

```powershell
node ".dev/evidence/phase-3/verify.mjs" desktop-light-es layout
node ".dev/evidence/phase-3/verify.mjs" mobile-dark-en controls
node ".dev/evidence/phase-3/verify.mjs" mobile-light-es reduced
node ".dev/evidence/phase-3/verify.mjs" desktop-light-es action-5
node ".dev/evidence/phase-3/verify.mjs" desktop-light-es lifecycle
node ".dev/evidence/phase-3/verify.mjs" desktop-light-es navigation
node ".dev/evidence/phase-3/verify.mjs" desktop-light-es scroll
node ".dev/evidence/phase-3/verify.mjs" isolation
```

Casos: `desktop|mobile` + `light|dark` + `es|en`. Bloques: `layout`, `controls`, `reduced`, `scroll`, `lifecycle`, `navigation` y `action-0` a `action-7`. `isolation` es independiente. Cada ejecución imprime avance con tiempos, guarda su reporte y cierra únicamente su navegador de prueba.

La lista requerida para el agregado está en [aggregate.mjs](aggregate.mjs): ocho variantes de layout; cuatro de controles/reduced; ocho secuencias reales; scroll, lifecycle, dos navegaciones e isolation. Tras completarla:

```powershell
node ".dev/evidence/phase-3/aggregate.mjs"
```

## Condiciones y límites

Chromium 153; desktop 1440×900, móvil 390×844, reflow 320×568. Touch, visibilidad y movimiento reducido emulados; no dispositivo físico ni Safari/iOS. Solo Home usa fixture de decisión, sin proveedores. La prueba offline presupone HTML/JS/WASM/asset cargados. No se midieron LCP/FPS.

La corrida final conserva **120 avisos WebGL ReadPixels** de captura y **dos errores esperados** del asset 404. Cero errores inesperados. `runtime-baseline-results.json` es antecedente previo al ajuste final de pausa fuera de viewport; los reportes sin bloque y `diagnostic-failure.png` son diagnósticos descartados.

La prueba monolítica fue interrumpida por el usuario. Un límite de 45 s también cortó un caso mientras aún avanzaba (16 checks aprobados); no se interpretó como fallo de la aplicación. Se separaron los bloques y se añadió deadline/cierre forzado del navegador propio. Los bloques finales terminaron en aproximadamente 3–20 s.
