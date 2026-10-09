# About — fase 4

**PASS: 23 bloques, 365 checks y 66 capturas; cero errores inesperados.** Cinco escenas basadas en el [relato original](../../../docs/jev-story.md): la pregunta, el experimento, la evolución, Abdair Coca y la visión futura. [Avance y aprobación](../../task.md).

## Revisión visual

| Variante | Pregunta y experimento | Evolución | Creador | Visión y cierre |
|---|---|---|---|---|
| Escritorio claro ES | [Pregunta](desktop-light-es-question.png) · [Experimento](desktop-light-es-experiment.png) | [Capas](desktop-light-es-evolution.png) | [Abdair Coca](desktop-light-es-creator.png) | [Visión](desktop-light-es-vision.png) · [Cierre](desktop-light-es-closing.png) |
| Escritorio claro EN | [Question](desktop-light-en-question.png) · [Experiment](desktop-light-en-experiment.png) | [Layers](desktop-light-en-evolution.png) | [Abdair Coca](desktop-light-en-creator.png) | [Vision](desktop-light-en-vision.png) · [Closing](desktop-light-en-closing.png) |
| Escritorio oscuro ES | [Pregunta](desktop-dark-es-question.png) · [Experimento](desktop-dark-es-experiment.png) | [Capas](desktop-dark-es-evolution.png) | [Abdair Coca](desktop-dark-es-creator.png) | [Visión](desktop-dark-es-vision.png) · [Cierre](desktop-dark-es-closing.png) |
| Escritorio oscuro EN | [Question](desktop-dark-en-question.png) · [Experiment](desktop-dark-en-experiment.png) | [Layers](desktop-dark-en-evolution.png) | [Abdair Coca](desktop-dark-en-creator.png) | [Vision](desktop-dark-en-vision.png) · [Closing](desktop-dark-en-closing.png) |
| Móvil claro ES | [Pregunta](mobile-light-es-question.png) · [Experimento](mobile-light-es-experiment.png) | [Capas](mobile-light-es-evolution.png) | [Abdair Coca](mobile-light-es-creator.png) | [Visión](mobile-light-es-vision.png) · [Cierre](mobile-light-es-closing.png) |
| Móvil claro EN | [Question](mobile-light-en-question.png) · [Experiment](mobile-light-en-experiment.png) | [Layers](mobile-light-en-evolution.png) | [Abdair Coca](mobile-light-en-creator.png) | [Vision](mobile-light-en-vision.png) · [Closing](mobile-light-en-closing.png) |
| Móvil oscuro ES | [Pregunta](mobile-dark-es-question.png) · [Experimento](mobile-dark-es-experiment.png) | [Capas](mobile-dark-es-evolution.png) | [Abdair Coca](mobile-dark-es-creator.png) | [Visión](mobile-dark-es-vision.png) · [Cierre](mobile-dark-es-closing.png) |
| Móvil oscuro EN | [Question](mobile-dark-en-question.png) · [Experiment](mobile-dark-en-experiment.png) | [Layers](mobile-dark-en-evolution.png) | [Abdair Coca](mobile-dark-en-creator.png) | [Vision](mobile-dark-en-vision.png) · [Closing](mobile-dark-en-closing.png) |

Detalles abiertos después de cambiar preferencias: [escritorio claro ES](desktop-light-es-expanded.png), [escritorio oscuro EN](desktop-dark-en-expanded.png), [móvil claro ES](mobile-light-es-expanded.png), [móvil oscuro EN](mobile-dark-en-expanded.png). En móvil la ilustración se retira/pausa para que puedas leer sin superposición. El nombre del archivo indica la variante inicial; estos casos cambian idioma y tema durante la prueba.

Movimiento reducido y reflow: [desktop claro ES](desktop-light-es-reduced.png) · [bajo](desktop-light-es-reflow.png); [desktop oscuro EN](desktop-dark-en-reduced.png) · [bajo](desktop-dark-en-reflow.png); [móvil claro ES](mobile-light-es-reduced.png) · [320 px](mobile-light-es-reflow.png); [móvil oscuro EN](mobile-dark-en-reduced.png) · [320 px](mobile-dark-en-reflow.png). [Sin IntersectionObserver](no-observer.png). [Error recuperable del asset](asset-error.png).

Entrada directa con movimiento reducido, sin reproducción visible: [desktop claro ES](desktop-light-es-cold.png), [desktop oscuro EN](desktop-dark-en-cold.png), [móvil claro ES](mobile-light-es-cold.png), [móvil oscuro EN](mobile-dark-en-cold.png). Se verificó igualdad del hash de dos capturas del personaje separadas por 700 ms y de una tercera tras ocultar/mostrar la pestaña, sin repetir el warmup. [Captura adicional de apertura estática](static-opening.png), fuera del agregado.

## Comprobaciones

- Cinco escenas y detalles nativos ES/EN; autoría fiel, sin retrato/hitos inventados. Visión identificada como exploración, no capacidades entregadas.
- Salida de la caja de chat, trayectoria, capas y horizonte 2D. Jev existente en Base; sin nuevo personaje ni cambios del asset.
- Teclado, skip-link, foco de ruta, touch, recarga, atrás/adelante y controles con objetivos de al menos 44 px, incluido reflow a 320 px.
- Idioma/tema conservan escena, detalles abiertos y canvas. Fuera de vista se suspenden los triggers visuales y Rive; ocultar pestaña detiene nuevos RAF. Scroll nativo sigue disponible.
- Zero API desde About, incluida la carga inicial. Home conserva contexto, borrador, personalidad y canvas; volver no consulta IA.
- Error 404 deja la historia accesible; el control de reintento permanece pulsable por encima de la composición y recupera solo el personaje.
- Cuatro typechecks, ESLint, build y 124 tests PASS. Trece tests nuevos cubren contenido, preferencias, lectura móvil, error/deadline, epochs, ownership de scroll y preparación estática/cancelación/layout/retorno de Rive. [Comandos completos y peso](../../task.md).

[Agregado](results.json): requiere los 23 reportes completos con fingerprint idéntico a fuentes actuales y fechas posteriores a sus modificaciones. Las capturas existen y los resultados parciales no cuentan. [Regresión adicional de Features](results-desktop-light-es-action-1.json): seis checks con Hello/Flower/Ghost reales y cero API, fuera del agregado de About.

## Reproducir un bloque

El harness se ejecuta en bloques individuales contra el preview de producción en `127.0.0.1:5174`.

```powershell
npm run build
# En otra terminal:
npm run preview -- --host 127.0.0.1 --port 5174
node ".dev/evidence/phase-4/verify.mjs" desktop-light-es layout
node ".dev/evidence/phase-4/verify.mjs" mobile-dark-en controls
node ".dev/evidence/phase-4/verify.mjs" mobile-light-es reduced
node ".dev/evidence/phase-4/verify.mjs" desktop-light-es cold
node ".dev/evidence/phase-4/verify.mjs" lifecycle
node ".dev/evidence/phase-4/verify.mjs" isolation
node ".dev/evidence/phase-4/verify.mjs" fallback
```

Matriz requerida: ocho variantes `desktop|mobile` × `light|dark` × `es|en` con `layout`; `desktop-light-es`, `desktop-dark-en`, `mobile-light-es`, `mobile-dark-en` con `controls`, `reduced` y `cold`; `lifecycle`, `isolation` y `fallback`. Ejecutar cada comando individualmente, con progreso y deadline. Al terminar:

```powershell
node ".dev/evidence/phase-4/aggregate.mjs"
```

## Condiciones y límites

Chromium 153; escritorio 1440×900, móvil 390×844, reflow 320×568, viewport bajo 1024×420. Touch, visibilidad y movimiento reducido emulados; no móvil físico/Safari/iOS ni LCP/FPS. No proveedores: únicamente fixture API para Home. Offline presupone HTML/JS/WASM/asset cargados; el SDK Rive todavía carga su WASM desde CDN. Se dejan 1,8 s de estabilización visual tras binding/Base, como en el harness de Features. La presentación estática prepara su pose oculta durante un periodo acotado de 3 s, se pausa y detiene render antes de declararse lista; no es reproducción visible bajo movimiento reducido ni muestreo de píxeles en la app.

El agregado contiene 96 avisos WebGL ReadPixels de capturas y dos errores esperados del asset 404. Durante trabajo intermedio hubo una corrida de layout que agotó su deadline, una recuperación inicialmente bloqueada por el hit target de la escena y capturas prematuras del primer frame Rive. Una comprobación adicional de arranque directo reducido encontró un canvas vacío: se corrigió la preparación de la pose, el bloqueo de acciones de presentaciones estáticas y la estabilidad del layout. Una suspensión prolongada del host produjo `ERR_NETWORK_IO_SUSPENDED` al cargar WASM; su repetición pasó. Solo los 23 bloques finales completos, posteriores a la corrección estática, integran el resultado.

**Siguiente paso:** revisar [About](http://127.0.0.1:5173/about) y aprobar la fase 4 antes de la integración final.
