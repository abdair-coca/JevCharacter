# Fase 1 de la revisión expresiva — esperando aceptación visual

**Implementación y verificación técnica completas; aprobación visual pendiente.** Tres estados modelo: `yes`, `think`, `transform_star`, más idle continuo y bump separado. Generación actual **`710ce87a06900ec688a4`**. El plan sigue en fase 4 histórica; no se avanzó a fase 2 de la revisión ni a fase 5 histórica.

## Resultados reproducibles

| Verificación | Resultado |
|---|---|
| `personality_phase4.py --prepare` | PASS; verify/compile/inspect CLI 1.3.0 sin problemas |
| `personality_phase4.py --check` | PASS; catálogo y escena deterministas; mediciones temporales |
| `personality_phase4.py --render` | PASS; 164 capturas Rive reales, GIFs y filmstrips a 140/48 px |
| `python -m unittest discover -s jev-lab/tests` | **70/70 PASS** |
| `node --test ./jev-lab/tests/*.mjs` | **67/67 PASS**; 20 grupos de personalidad/WASM real |
| `git diff --check` | PASS; sólo avisos de conversión LF/CRLF del repositorio |

La primera ejecución global encontró fallo de CLI y luego `MemoryError` en una prueba previa de fase 3. La máquina tenía ~270 MB de RAM física libre. Tras liberar la sesión de captura, la misma suite completa pasó sin cambiar fuentes de fases anteriores. No se ocultó el fallo relajando validadores.

## Qué cambió

- `yes`: ojos anticipan, dos asentimientos; desplazamiento de -9 a +10 px, squash/stretch, segundo beat menor, hold y settle. Activa 1400 ms; total con transiciones 2050 ms a speed 1.
- `think`: entrada de 500 ms, ciclo de atención de 2100 ms con holds y mirada adelantada al cuerpo; posiciones/giros/escalas contrastados, apertura e inclinación independientes. Activa finita 3400 ms; total 4050 ms.
- `transform_star`: contracción, despliegue completo a morph 1, overshoot, hold estable de ~767 ms, fold y recuperación a esfera. Activa 2400 ms; total 3050 ms.
- Bump previo de 250 ms, pico 8% a 100 ms. Clip y reloj activos empiezan después. Recuperación congelada de 150 ms y bump de retorno separado de 250 ms. Reemplazar conserva escala efectiva del bump saliente; sólo una recuperación y última orden pendiente.
- Intensidad cero conserva idle/base sin tomar canales ni escalar el bump. Stop restaura neutral y lo congela; dispose cancela y libera recursos.
- La respiración continua de 2.8 s y parpadeos seeded se conservan. La receta para derivar `no` y otras formas está en [la guía](../../visual/phase4/README.md).

## Evidencia y mediciones

1. **Original antes de autorar:** [`original-study.png`](original-study.png), enums reales yes/think/MorphState activados en WASM. Se inspeccionaron muestras 0–2600 ms: desplazamiento/deformación vertical, atención cíclica y estrella real respectivamente. Los paneles de 360×200 no certifican visibilidad completa: algunos overshoots exceden su viewport vertical.
2. **Primera pasada preservada:** [`revisions/first-pass/manifest.json`](revisions/first-pass/manifest.json), 115 fuentes/evidencias con hashes comprobados por la suite. Sus tests verdes anteriores no certifican esta revisión. Los diffs revisados de las cuatro acciones fuera de alcance sólo eran experimentales; `happy_bounce`, `curious_look`, `hello` y `speech` se restauraron a sus definiciones anteriores. Las 13 acciones/18 variantes siguen funcionando.
3. **Movimiento completo:** [`sequences/`](sequences/) contiene seis GIFs y seis filmstrips; [`temporal-validation.json`](temporal-validation.json) registra los frames. Son timelines CLI reales equivalentes al scheduling finito con base neutral/speed 1, sin ambientación viva ni interrupciones. Muestreo de 15 fps más neutral exacto al final y hold para reconocer retorno; no es certificación de todos los frames del controlador.
4. **Geometría temporal:** [`motion-validation.json`](motion-validation.json), 435 muestras autoradas a 60 fps. Cada contorno cúbico muestreado se certifica: margen ocular mínimo **15.33 px** (mínimo requerido 4), extensión máxima de halo **145.52 px** (semialto disponible 170), cuerpo máximo **85.66 px**, escalas autoradas máximas **1.12**, estrella alcanza morph **1**. No hizo falta ampliar el rig.
5. **Runtime real:** [`native-validation.json`](native-validation.json), WASM 2.42.2 y generación actual. Bump observado **1.080000043**; escala compuesta máxima **1.120000038** (float32). Seam de pensamiento: salto de pose **0**, velocidades muestreadas ~0/0.0000916 unidades por ms. Reemplazos al mismo instante: salto **0**. Matriz de lifecycle **144 casos** (3 estados × 3 velocidades × 4 etapas × 4 operaciones); intensidad cero se compara contra otro controlador con ambiente/base idénticos. 18 variantes completan y regresan al neutral numérico; retornos CLI RGBA exactos.

**Limitación raster adicional:** los retornos RGBA exactos anteriores corresponden a las máquinas individuales. En la timeline CLI combinada, yes/think también recuperan RGBA exacto, pero estrella conserva una diferencia máxima de 5/255 en color (2 en R, 5 en B, 0 en G/alpha). Se reprodujo al volver a capturar el final y al aislar la transición de máquina; las claves iniciales/finales y los transformadores nativos coinciden, y la máscara ocular neutral permanece idéntica. La causa exacta en el renderer no se ha determinado. Se registra la diferencia, sin afirmar igualdad de píxeles en ese harness ni modificar límites de contención/contorno/escala. La revisión humana debe considerar esta limitación.

## Revisión de código

**Standards:** se corrigieron informes desactualizados y el reporte nativo distingue ejecución completa de filtros parciales (`PARTIAL`). `BumpTransform` es el adaptador ya existente exclusivamente en la escena de fase 4; las fuentes/jerarquía aprobadas de fase 2 permanecen intactas. El primer avance CLI activa la máquina, por eso las capturas usan `frame+1`, siguiendo el harness de fase 3.

**Spec:** se refutó un supuesto de mezcla invertida: el envelope nativo va 1→0, por lo que la mezcla activa es 1 tras la entrada. Una regresión nueva exige movimiento visible de los tres prototipos en el controlador real. Los límites declarados de muestreo geométrico concuerdan con el plan; no se afirma lectura nativa de vértices ni certificación analítica de todo el continuo.

## Revisión humana requerida

- [ ] Bump se percibe antes del gesto a 140 y 48 px.
- [ ] `yes` se reconoce sin etiqueta.
- [ ] `think` mantiene atención y el loop no presenta cortes.
- [ ] Estrella alcanza cinco puntas y recupera la esfera con lectura clara.
- [ ] El usuario confirma que los tres estados superan al original.

Los tests verifican comportamiento técnico; **no otorgan superioridad visual**. No se certifica C1 perfecta en órdenes arbitrarias ni el continuo temporal/geométrico completo. La fase permanece esperando aprobación del usuario.
