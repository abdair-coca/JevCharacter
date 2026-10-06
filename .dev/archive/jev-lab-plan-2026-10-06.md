# Plan: JEV Lab — tres estados expresivos, idle y bump

## Descripción general

Pulir exactamente tres estados modelo de Mini JEV: `yes`, `think` y `transform_star`. El objetivo es superar la expresividad y lectura del original, con movimientos amplios y naturales, cambios de silueta visibles y un estándar de autoría replicable. El preview local de fase 4 abrirá en `idle` con respiración continua y sutil. El cambio vive en los archivos existentes de `jev-lab`, sin crear módulos separados ni integrar el personaje en la aplicación principal.

Se conservan el cuerpo morado y los dos ojos, sin boca ni extremidades, y la comparación con el original. El flujo visual será **bump visible → gesto/cambio de forma → hold reconocible → settle → bump de retorno e idle**. El bump tendrá un objetivo inicial de expansión cercano al 8%, ajustado tras revisar el movimiento y limitado por la escala corporal compuesta. La respiración del idle permanece leve; el movimiento llamativo corresponde a las acciones y transiciones.

Una acción nueva interrumpe la activa y toma el control mediante bump sin acumular órdenes. Al ocultar la pestaña, la acción se cancela y al volver se retoma el idle. `Stop` permanece como excepción que congela el neutral. El estado del preview no se persiste entre recargas. Las acciones existentes fuera de los tres prototipos permanecen disponibles; se restaurarán únicamente los cambios experimentales de esta iteración en `happy_bounce`, `curious_look`, `hello` y `speech`, tras revisar sus diffs y sin sobrescribir trabajo ajeno.

El rig se ampliará únicamente si las mediciones o renders demuestran una carencia real. Se prioriza adaptar la escena generada de fase 4 y su validador, conservando las fuentes y evidencias aprobadas de fases 1–3. Un límite o canal nuevo debe quedar explícito y validado; no se relajarán validadores para ocultar deformaciones.

Este trabajo desarrolla la fase 4 activa registrada en `.dev/tasks.md`; no inicia la fase 5 de ese plan histórico. Las fases 1 y 2 siguientes son las etapas de esta revisión.

**Referencia visual:** `C:\Users\abdai\Videos\Screen Recordings\Screen Recording 2026-10-04 212030.mp4` (44.8 s, 546×416, 30 fps). Se inspeccionaron fotogramas espaciados y secuencias más densas de los primeros 12 s. El video demuestra cambios de silueta y movimiento; no identifica por nombre todos los gestos. Para `yes` y `think`, contrastar también las acciones reales del original en el comparador y registrar qué evidencia corresponde a cada estado.

## Fases

### Fase 1 — Tres estados modelo y transiciones expresivas

**Descripción:** rehacer tres prototipos con rigor visual y técnico. `yes` tendrá anticipación ocular y asentimientos corporales claros; `think` tendrá entrada y ciclo sostenido con cambios de atención legibles; `transform_star` tendrá transformación completa de esfera a estrella, hold y recuperación. El bump debe leerse como transición previa al gesto, no como una pequeña escala superpuesta que pasa inadvertida.

**Archivos previstos:**
- `jev-lab/visual/phase4/behavior.json` — idle continuo, parpadeos y definición del bump visible.
- `jev-lab/visual/phase4/actions/yes.json` — asentimiento con anticipación, beats amplios y recuperación.
- `jev-lab/visual/phase4/actions/think.json` — pensamiento sostenido con ciclo expresivo y seams coherentes.
- `jev-lab/visual/phase4/actions/transform_star.json` — anticipación, cambio completo de silueta, hold y retorno.
- `jev-lab/visual/phase4/actions/{happy_bounce,curious_look,hello,speech}.json` — restaurar exclusivamente cambios experimentales de esta iteración fuera del nuevo alcance.
- `jev-lab/visual/phase4/web/controller.mjs` — secuencia de bump y acción, continuidad en reemplazos, composición de canales y retorno a idle.
- `jev-lab/validators/personality_phase4.py` — generación/validación del patrón, adaptación del rig en fase 4 si es necesaria y evidencia temporal de los prototipos.
- `jev-lab/tests/test_personality_phase4.py`, `jev-lab/tests/test_controller_phase4.mjs` y `jev-lab/tests/test_personality_native_phase4.mjs` — regresiones de esquema, scheduling, propiedad de canales, transiciones e instancias Rive reales.
- `jev-lab/visual/phase4/README.md` — estándar de autoría basado en los tres estados y receta para derivar los siguientes.
- `jev-lab/visual/phase4/scene.rml` y `catalog.json` — productos regenerados por el compilador.
- `jev-lab/output/visual-phase4/` — evidencia comparativa y secuencias de renders reales, conservando la evidencia de la primera pasada como antecedente.

**Tareas:**
- [x] Revisar las acciones originales equivalentes y describir intención, ritmo, amplitud y cambio de silueta antes de autorar cada prototipo.
- [x] Preservar la primera pasada como antecedente y revisar/restaurar exclusivamente sus cambios experimentales en las cuatro acciones fuera del alcance.
- [x] Pulir `yes`, `think` y `transform_star`, con gestos principales, anticipación, hold y settle reconocibles; asegurar loop de pensamiento sin salto.
- [x] Mantener el idle de respiración continua, expansión leve de cuerpo/ojos, deriva ocular y parpadeos ocasionales.
- [x] Rediseñar bump para que preceda al gesto y acompañe retorno/reemplazo; definir claramente duración de transición y duración activa.
- [x] Validar orden nueva antes de sustituir la anterior; no acumular órdenes ni apilar recuperaciones; conservar Stop neutral.
- [x] Medir escala compuesta, visibilidad corporal/halo, contención ocular y morph a lo largo del movimiento; adaptar el rig de fase 4 únicamente si existe una carencia demostrada.
- [x] Documentar la receta estándar y cómo derivar `no` y otras transformaciones a partir de los tres ejemplos, sin implementarlos en esta revisión.

**Verificación:**
- [x] `python jev-lab/validators/personality_phase4.py --prepare`, `--check` y `--render` completan correctamente, incluidos verify/compile/inspect.
- [x] `python -m unittest discover -s jev-lab/tests` y `node --test ./jev-lab/tests/*.mjs` pasan.
- [x] Tests con WASM Rive real cubren entrada, bump, fin, cancelación/reemplazo durante cada transición, secuencias, velocidades extremas, intensidad cero, Stop y dispose.
- [x] Secuencias de renders o clips reproducibles muestran el movimiento completo de los tres prototipos y bump a 140/48 px, no solo una pose activa aislada.
- [ ] Comparación visual con el original: bump se percibe antes del gesto; yes se reconoce sin etiqueta; think sostiene atención; estrella alcanza su silueta y recupera la esfera sin cortes.
- [ ] Registrar mediciones y limitaciones de muestras; no declarar superioridad visual por número de tests. El usuario confirma que los tres prototipos superan al original antes de dar la fase por aprobada.

**Estado:** Esperando aprobación visual de la entrega  
**Aprobación del resumen de fase:** Aprobado por el usuario: tres estados `yes`, `think`, `transform_star`, más idle y bump.  
**Hallazgos/evidencia:** Primera pasada técnicamente verde (69 Python, 64 Node, 17 grupos WASM), pero el usuario rechazó su expresividad. Preservada en `jev-lab/output/visual-phase4/revisions/first-pass/` con manifest de 115 archivos. Revisión actual: generación `710ce87a06900ec688a4`; 70 Python, 67 Node y 20 grupos WASM PASS. 144 casos de lifecycle, bump separado de 250 ms/pico 8%, escala compuesta limitada a 1.12. 164 capturas reales y seis GIFs a 140/48 px; 435 muestras geométricas, margen ocular mínimo 15.33 px, halo máximo 145.52 px, morph estrella 1. Informe: `jev-lab/output/visual-phase4/validation-report.md`. Sin ampliación del rig. Un fallo inicial de memoria del entorno se reprodujo como `MemoryError`; la suite completa pasó después de liberar la sesión de captura, sin tocar fases previas. Las mediciones finitas no certifican superioridad visual.  
**Aprobación del plan completo revisado:** 2026-10-05, solicitud explícita del usuario de ejecutar la fase 1. Autoriza su implementación; la aceptación visual de la entrega sigue pendiente.

**Limitación registrada al cerrar:** las máquinas individuales recuperan RGBA exacto; la timeline CLI combinada de estrella muestra delta de color máximo 5/255 al volver, con claves y transformadores neutrales y máscara ocular idéntica. Causa exacta del renderer pendiente; no se afirma igualdad de píxeles en ese harness ni se modifican límites geométricos. Los tests registran esa diferencia en la evidencia, además de los checks estrictos de rig y runtime.

### Fase 2 — Preview y validación de ciclo de vida

**Descripción:** conectar el patrón de movimiento al preview local existente, reflejar su estado y comprobar las transiciones del personaje con la comparación original.

**Archivos previstos:**
- `jev-lab/visual/phase4/web/app.mjs` — inicio en idle, cancelación al ocultarse la pestaña y retorno a idle al volver.
- `jev-lab/visual/phase4/web/index.html` y `jev-lab/visual/phase4/web/style.css` — mostrar claramente el estado del preview y conservar los controles de comparación.
- `jev-lab/tests/test_controller_phase4.mjs`, `jev-lab/tests/test_personality_native_phase4.mjs` y `jev-lab/tests/test_original_phase4.mjs` — ampliar pruebas integradas sin introducir un módulo de aplicación nuevo.
- `jev-lab/visual/phase4/README.md` — actualizar instrucciones de preview, comparación y verificación manual.
- `jev-lab/output/visual-phase4/` — guardar renders y evidencia actualizados sin reemplazar evidencias de fases anteriores.

**Tareas:**
- [ ] Iniciar el preview con idle activo y mostrar la transición entre idle, acción, bump e interrupción.
- [ ] Al ocultar la pestaña, cancelar la acción y suspender frames; al volver, recuperar idle, sin reanudar una acción antigua.
- [ ] Mantener el original como referencia de comparación, sin modificar su fuente ni sus animaciones.
- [ ] Conservar Stop como congelación explícita del neutral y no persistir la selección entre recargas.
- [ ] Presentar claramente los tres estados modelo en el preview y capturar/revisar sus movimientos, idle y transiciones a tamaños normal y pequeño; actualizar la guía de uso.

**Verificación:**
- [ ] Preview manual local: arranque en idle, tres estados, bump, reemplazo rápido, retorno a idle, Stop neutral y ciclo de ocultar/volver.
- [ ] Comparación original/propuesta legible y estable a 140/48 px; las acciones reemplazadas no continúan ni quedan en cola.
- [ ] Suites Python/Node, generación determinista y verify/compile/inspect del runtime Rive pasan; `git diff --check` pasa.

**Estado:** Pendiente  
**Aprobación del resumen de fase:** Aprobado por el usuario antes de redactar este plan  
**Hallazgos/evidencia:** Pendiente  
**Aprobación del usuario:** Pendiente de revisión de este plan completo revisado y de la entrega de cada fase.

## Hallazgos y sugerencias

- El controlador actual ya compone clips Rive, ambientación, reemplazos y recuperación; extender esos archivos es más coherente que añadir otro módulo.
- La primera pasada ya habilitó respiración continua de 2.8 s, deriva ocular y parpadeos ocasionales. Su bump de 3.5% superpuesto a la acción no logró la presencia visual solicitada.
- Las escalas de cuerpo también afectan visualmente los ojos; el contrato v2 ofrece margen para expansión sutil y canales de mirada/apertura ocular. La inspección visual determinará si hace falta ampliar el rig.
- Se debe preservar el trabajo sin relación ya presente en la aplicación principal; la implementación de la feature queda dentro de `jev-lab`.
- El video evidencia siluetas diferenciadas y movimiento amplio. Sus fotogramas no bastan para etiquetar automáticamente yes/no/think: usar el runtime original para contrastar esos estados.
- La comparación temporal y la aceptación humana tienen prioridad sobre ampliar el catálogo. Esta revisión se limita a tres estados, idle y bump, y conserva el plan abierto hasta la aprobación final.
