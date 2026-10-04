# Planes de desarrollo

Este archivo permanece en el proyecto. El contenido de `Plan activo` es temporal y se puede limpiar únicamente cuando todas sus subtareas estén completas y el desarrollador haya aprobado todas las fases. Después se conserva este archivo, sus reglas y su plantilla.

## Reglas de uso

- Mantener aquí el plan activo, sus fases, subtareas y criterios verificables por el desarrollador.
- Trabajar solo en la fase actual. Las fases posteriores permanecen pendientes aunque sus subtareas estén descritas.
- Al completar una fase, ejecutar sus verificaciones, registrar resultados y detenerse para revisión del desarrollador.
- No iniciar otra fase sin aprobación explícita del desarrollador. El silencio o una solicitud de cambios no cuentan como aprobación.
- Si el desarrollador pide cambios, permanecer en la fase actual, corregir y volver a presentar sus verificaciones.
- Solo tras completar y aprobar todas las fases, limpiar el contenido bajo `Plan activo`; conservar este archivo y la plantilla.

## Estructura de cada plan

- Objetivo, alcance, exclusiones y supuestos relevantes.
- Fases ordenadas, cada una con subtareas, verificación local y criterios de aceptación.
- Estado de fase: `Pendiente`, `En curso`, `Esperando aprobación`, `Cambios solicitados` o `Aprobada`.
- Evidencia de pruebas y decisión del desarrollador antes de continuar.

## Plantilla

```md
### Plan: <resultado>
Objetivo: <cambio observable>
Alcance: <incluye / excluye>
Supuestos: <decisiones y restricciones>

#### Fase N — <nombre>
Estado: Pendiente
Subtareas:
- [ ] <trabajo concreto>
Verificación del desarrollador:
- <paso observable en local>
Criterios de aceptación:
- [ ] <resultado que debe cumplirse>
Evidencia / feedback: Pendiente
Aprobación del desarrollador: Pendiente
```

## Plan activo

### Plan: JEV Lab — personaje y animaciones desde código

**Objetivo:** superar al personaje de `public/rive/prove1.riv` en expresividad, continuidad del movimiento y rapidez de autoría.

**Alcance:** implementar dentro de `jev-lab`; registrar seguimiento aquí. Conservar identidad morada, cuerpo y dos ojos, sin boca ni extremidades. Rive será el motor; código y preview serán el flujo de autoría. Sin integración en la app, despliegue ni editor visual de timeline. Mantener inicialmente CLI 1.3.0 y runtime/WASM 2.42.2, sin scripts Luau.

**Control de avance:** comenzar por la fase 1. Cada fase se entrega funcionando, con pruebas y guía breve; registrar evidencia y esperar aprobación explícita antes de iniciar la siguiente. Los ajustes mantienen abierta la misma fase. Los estados, evidencias y decisiones registrados en cada fase gobiernan el avance. El plan anterior queda en espera y conserva sus estados y evidencias.

#### Fase 1 — Identidad visual y comparación

Estado: Aprobada

Subtareas:
- [x] Crear comparador local del original, laboratorio actual y propuesta, con tamaños y fondos equivalentes; original en lectura únicamente.
- [x] Mejorar neutral: silueta, volumen, iluminación, contraste y proporciones de los ojos, conservando la identidad de JEV.
- [x] Conservar fuentes y renders actuales como referencia; actualizar reglas del laboratorio para permitir la evolución.
- [x] Verificar compilación y carga de las tres versiones; entregar capturas y guía de comparación.

Verificación del desarrollador:
- Comparar a tamaño normal y pequeño; confirmar identidad, legibilidad de los ojos y mejora del volumen.

Criterio de aceptación:
- [x] El desarrollador acepta la apariencia neutral y la dirección visual.

Evidencia / feedback (2026-10-03, Bolivia):
- Comparador funcionando en `http://127.0.0.1:4181/`; tres versiones reales con WebGL2 2.42.2 local, neutral congelado, fondos oscuro/claro y cuerpos de 140/48 px CSS.
- Original en lectura exacta; SHA-256 `98aa68170540d448deaed0db6fa57c11b062cebf9036dc1cfada4376254a8daf` intacto. Medición del render original: cuerpo 400×400, centro 800,610; extracción del fondo sólo en render, con interior intacto y halo reconstruido sobre matte negro. Vista raw preservada para verificar esa limitación.
- Propuesta neutral separada en `jev-lab/visual/phase1/proposal/`; fuentes y renders previos preservados por snapshot y manifest de 134 archivos. Reglas del laboratorio actualizadas.
- CLI 1.3.0: verify y compile de referencia actual/propuesta PASS. CUA confirmó carga visible de las tres versiones, fondo claro compartido y escala corporal equivalente; captura nativa descargada e inspeccionada con las 12 vistas pobladas.
- Python: 40 tests PASS. Node: 25 tests PASS. `build.py --check`, preservación y `git diff --check` PASS. Entrega ordinaria unmanaged; sin activación de receipt-driven development.
- Capturas: [`comparison.png`](../jev-lab/output/visual-phase1/comparison.png), [`original-neutral-raw.png`](../jev-lab/output/visual-phase1/original-neutral-raw.png). Guía: [`visual/phase1/README.md`](../jev-lab/visual/phase1/README.md). Informe: [`validation-report.md`](../jev-lab/output/visual-phase1/validation-report.md).
- Apariencia y dirección visual pendientes de aceptación humana. Fases 2–5 permanecen pendientes.
Feedback y revisión 02 (2026-10-04, Bolivia):
- Solicitud: propuesta más tierna, cuerpo redondo, ojos más centrales y redonditos, morado más iluminado con luz detrás, sombras y efectos del estilo original.
- Implementado: esfera Ellipse 122×122, ojos 9×11 separados 18 y a altura central; contraluz violeta/rosa, borde luminoso, reflejo suave y sombra frontal púrpura en capas RML reales. Revisión anterior preservada con manifest SHA-256 en `jev-lab/output/visual-phase1/revisions/revision-01/`.
- Validación: CLI verify/compile PASS; 42 tests Python y 25 Node PASS; anatomía histórica, 134 referencias y hash original intactos. `build.py --check` y `git diff --check` PASS.
- CUA confirmó las tres versiones visibles, círculo y ojos centrales, sombra/contraluz y legibilidad pequeña sobre los dos fondos. Captura nativa de revisión 02 [`comparison.png`](../jev-lab/output/visual-phase1/revisions/revision-02/output/visual-phase1/comparison.png): 1800×1370, 1.369.263 bytes, 12 vistas inspeccionadas; cuerpos de 140/48 px CSS.
- Revisión 02 técnicamente lista, pendiente de aceptación del desarrollador. Fases 2–5 continúan pendientes.
Feedback y revisión 03 (2026-10-04, Bolivia):
- Solicitud: conservar forma y ojos exactos; cambiar únicamente colores e iluminación para seguir el original.
- Implementado: magenta neón saturado arriba/derecha, contorno violeta eléctrico, sombra frontal casi negra y halo violeta amplio. Caída de sombra gradual y luz diagonal más ancha; retirados lavanda pastel y reflejo claro. Capas RML reales, sin modificar cuerpo 122×122, ojos 9×11 separados 18, altura central, posiciones ni artboard. Igualdad exacta de esos datos contra revisión 02 comprobada.
- Revisión 02 preservada por manifest SHA-256 en `jev-lab/output/visual-phase1/revisions/revision-02/`. CLI verify/compile y renders normal/pequeño PASS; pruebas focales 7 Python y 5 Node PASS; `build.py --check`, 134 referencias históricas, hash original y `git diff --check` PASS.
- CUA final confirmó las tres versiones, iluminación neón con highlight diagonal más amplio y ojos legibles a 48 px sobre los dos fondos. Captura nativa de revisión 03 [`comparison.png`](../jev-lab/output/visual-phase1/revisions/revision-03/output/visual-phase1/comparison.png): 1800×1370, 1.343.705 bytes, 12 renders inspeccionados. Evidencia de muestras de color: `jev-lab/output/visual-phase1/revision-03-color-evidence.json`.
- Revisión 03 técnicamente lista, pendiente de aprobación humana. Fases 2–5 permanecen pendientes.
Feedback y revisión 04 (2026-10-04, Bolivia):
- Solicitud: corregir únicamente las deformidades de la sombra central para obtener un contorno redondeado/semiesférico continuo; conservar el resto de la apariencia.
- Implementado: retirada `UpperLeftShade` y suavizada `FrontShadow` como una sola radial negra. Sin lóbulo superior izquierdo ni muesca. Igualdad exacta de cuerpo, ojos, artboard y capas completas `VioletRim`, `PurpleVolume`, `PinkBacklight` y `VioletBacklight` frente a revisión 03; generador y medidas del comparador intactos. Evidencia: `jev-lab/output/visual-phase1/revision-04-scope-evidence.json`.
- Revisión 03 preservada antes del cambio en `jev-lab/output/visual-phase1/revisions/revision-03/`, nueve archivos con hashes PASS. CLI verify/compile y renders normal/pequeño PASS; pruebas focales 7 Python y 5 Node PASS; `build.py --check`, 134 referencias históricas, hash original y `git diff --check` PASS.
- CUA final del agente principal confirmó tres versiones visibles y sombra central continua, redonda y suave; ojos legibles a 48 px CSS sobre ambos fondos. Captura nativa real [`comparison.png`](../jev-lab/output/visual-phase1/comparison.png): 1800×1370, 1.350.148 bytes, 12 vistas inspeccionadas. El agente principal verificó también igualdad de anatomía/luces y los nueve hashes de revisión 03.
- Revisión 04 técnicamente lista, esperando aceptación humana. Fases 2–5 permanecen pendientes.
Aprobación del desarrollador: 2026-10-04 (Bolivia), solicitud explícita de completar la fase dos. Se toma revisión 04 como base para continuar.

#### Fase 2 — Rig expresivo y transformaciones

Estado: Aprobada

Subtareas:
- [x] Versionar contrato corporal v2 y separar mirada, apertura/inclinación de cada ojo, parpadeo y deformación corporal.
- [x] Crear contorno Bézier de topología estable para base, estrella, cuadrado, triángulo, fantasma, flor y nube; ojos contenidos e iluminación coherente.
- [x] Implementar neutral completo: geometría, ojos, transformaciones e iluminación; validar contornos y límites con renders de transiciones.

Verificación del desarrollador:
- Recorrer poses de alegría, curiosidad, pensamiento y habla; probar todas las formas, extremos permitidos y retorno a neutral.

Criterio de aceptación:
- [x] Expresiones y formas reconocibles, sin cruces/colapsos del contorno ni ojos fuera del cuerpo; neutral restaurado.

Evidencia / feedback (2026-10-04, Bolivia):
- Rig separado en `jev-lab/visual/phase2/`, contrato corporal schema 2 con hashes de revisión 04. Siete formas con 60 vértices Bézier estables; cuerpo morado y dos ojos, sin boca ni extremidades. Fuentes, apariencia y renders de fase 1 preservados.
- Canales RML disjuntos: mirada, apertura/inclinación independiente de cada ojo, parpadeo multiplicativo, posición/giro/deformación corporal e iluminación. Neutral restaura las 16 propiedades semánticas y todas las propiedades mutables de la escena: vértices, asas, nodos, gradientes y borde.
- CLI 1.3.0 verify/compile/inspect PASS, sin errores ni advertencias; runtime/WASM WebGL2 2.42.2 local. Preview de prueba funcionando en `http://127.0.0.1:4182/`, con poses estáticas de alegría, curiosidad, pensamiento y habla; siete formas, transición, canales, extremos y botón Neutral completo. Guía: [`visual/phase2/README.md`](../jev-lab/visual/phase2/README.md).
- Geometría: 861 muestras, 41 por cada uno de los 21 pares; en cada muestra, comprobación de la curva Bézier continua, área y contención. Margen ocular conservador mínimo 6,29 px, área mínima 7841,49 px² y extensión corporal/halo máxima 145,52 px dentro del artboard. No se afirma certificación analítica de todo el continuo del parámetro morph.
- Renders Rive reales: 105 capturas, intermedios al 25/50/75% de cada par, poses y extremos; 28 retornos con RGBA exactamente igual al neutral inicial del rig v2. Base Bézier aproxima la esfera de revisión 04; sus medidas y parámetros de iluminación se conservan. Capturas: [`contact-sheet.png`](../jev-lab/output/visual-phase2/contact-sheet.png), [`transitions.png`](../jev-lab/output/visual-phase2/transitions.png).
- CUA del agente principal confirmó carga, estrella, nube sobre fondo claro, extremos, controles oculares independientes y cuatro poses; consola sin errores/advertencias. Neutral → extremos → neutral produce capturas de página idénticas en bytes. Parpadeo 1 → 0 → 1 recupera la misma imagen y apertura/inclinación ocular con foco equivalente. Evidencia: [`browser-validation.json`](../jev-lab/output/visual-phase2/browser-validation.json).
- La descarga opcional del preview se pulsó, pero el evento de descarga del navegador integrado agotó 30 s; su finalización queda sin verificar. Las capturas PNG de CLI están disponibles y verificadas.
- Pruebas: 51 Python y 29 Node PASS. `rig_phase2.py --check`, `build.py --check`, preservación de 134 referencias/hash original y `git diff --check` PASS. Entrega ordinaria unmanaged; sin activación de receipt-driven development. Fases 3–5 pendientes.
- Implementación y validación técnica completas; reconocimiento expresivo y aceptación visual final pendientes del desarrollador.
Aprobación del desarrollador: 2026-10-04 (Bolivia), solicitud explícita de continuar con la siguiente fase.

#### Fase 3 — Autoría rápida y control desde código

Estado: Aprobada

Subtareas:
- [x] Definir poses, fases, tiempos, curvas y canales en JSON semántico; generar RML, catálogo y máquina de estados sin listas cerradas de acciones.
- [x] Implementar `play`, `sequence`, `lookAt`, `setAmbient`, `stop` y `dispose`; intensidad, velocidad, variantes y manejadores cancelables con resultado de finalización. Nueva orden reemplaza acción y cancela secuencia anterior.
- [x] Resolver propiedad de canales; adaptar `happy_bounce` y `curious_look` conservando intención/duración; añadir recompilación automática, errores localizados y último preview válido.
- [x] Probar compilador, interrupciones, secuencias y neutral; demostrar una acción nueva creada mediante una sola definición.

Verificación del desarrollador:
- Cambiar un parámetro y ver la actualización; añadir una acción sin XML ni cambios al controlador; ejecutar, interrumpir, encadenar y detener acciones.

Criterio de aceptación:
- [x] Autoría práctica desde una definición, comandos predecibles y `stop()` recupera neutral completo.

Evidencia / feedback (2026-10-04, Bolivia):
- Autoría separada en `jev-lab/visual/phase3/`: descubrimiento dinámico de tres JSON, siete variantes, 28 clips y ocho máquinas Rive reales. Poses, fases, curvas salientes, tiempos y canales se validan antes de generar; Rive evalúa las curvas. `attention_pulse.json` demuestra una acción nueva mediante una sola definición. Guía: [`visual/phase3/README.md`](../jev-lab/visual/phase3/README.md).
- Controlador con los seis comandos públicos, intensidad 0–1, velocidad 0.1–4, variantes, handles cancelables y resultados completed/cancelled. Valida la orden completa antes de reemplazar; cancela secuencia anterior, conserva excedente temporal y evita que un handle antiguo cancele al sucesor. Canales poseídos prevalecen sobre ambiente/mirada; `stop()` restaura geometría, ojos, cuerpo y luz, también en frames posteriores. Ambiente estático y puente neutral inmediato; refinamientos de continuidad corresponden a fase 4.
- Adaptación: alegría conserva 750 ms e intención; salto histórico 52 px reducido explícitamente a 10 px según límites del rig v2. Curiosidad conserva 800 ms, mirada 100 ms antes del cuerpo, giro 4°, stretch 1.07 y hold 300–500 ms.
- Watcher local con parejas catálogo/RIV inmutables por generación; verify/compile/inspect completan antes de publicar. Errores muestran archivo/JSON pointer y sintaxis con línea/columna; conservan último preview válido, incluso al abrir o recargar con un error presente. Estado consultado con URL fresca para evitar resultados cacheados. Preview: `http://localhost:4183/` (equivalente `http://127.0.0.1:4183/`).
- CLI 1.3.0 y runtime/WASM 2.42.2: verify/once/inspect-summary PASS, sin problemas; RIV 747995 bytes. 25 renders reales de siete variantes e interrupción; ocho retornos RGBA exactamente iguales al neutral inicial. Captura: [`contact-sheet.png`](../jev-lab/output/visual-phase3/contact-sheet.png). Informe: [`validation-report.md`](../jev-lab/output/visual-phase3/validation-report.md).
- Python: 59 tests PASS; ocho del compilador repetidos tras ajuste final de JSON pointers PASS. Node: 37 PASS, repetidos por el agente principal. Pruebas incluyen descubrimiento, fallo/recuperación CLI, generaciones inmutables, propiedad de canales, cancelación, secuencias, intensidad cero, límites y liberación de recursos.
- CUA del agente principal: flor completa con mirada/luz no poseídas conservadas; neutral de `stop()` idéntico en bytes a su referencia de canvas. Intensidad cero idéntica a referencia neutral tomada en el mismo encuadre. Secuencia completa 3/3 y cancelación por reemplazo verificadas. JSON temporal nuevo produjo cuarta acción, clip/máquina y generación `72e913cf5f18b14d9a81`; se reprodujo y terminó 1/1 en neutral. Error localizado conserva catálogo/reproducción y permite abrir el preview válido. Evidencia: [`browser-validation.json`](../jev-lab/output/visual-phase3/browser-validation.json).
- Definición temporal retirada; navegador recuperó automáticamente tres acciones y generación inicial `08aecb8f160cb11f2c0f`, sin recarga de página. Estado final sin error, neutral completo y consola limpia.
- Agente principal verificó fuentes generadas deterministas, rig v2 (861 muestras), build histórico y 134 referencias. SHA-256 de las 12 fuentes de fase 2 intactos. `git diff --check` PASS. Entrega ordinaria unmanaged; sin activación de receipt-driven development. Fases 4/5 pendientes.
- Implementación y validación técnica completas; aceptación de autoría práctica y comportamiento pendiente del desarrollador.
Aprobación del desarrollador: 2026-10-04 (Bolivia), aceptación explícita «está bien» y solicitud de continuar con la siguiente fase, con mayor rigor y calidad.

#### Fase 4 — Personalidad y repertorio completo

Estado: Esperando aprobación

Subtareas:
- [x] Añadir respiración discreta, parpadeos y pausas amplias en reposo.
- [x] Completar saludo, pensamiento, sí/no, variantes de habla y transformaciones del original mediante ojos y cuerpo.
- [x] Afinar anticipación, mirada, recuperación y continuidad; acciones puntuales regresan a neutral y reposo, pensamiento/habla admiten duración o reproducción sostenida.
- [x] Probar composición de canales y cambios rápidos; entregar comparaciones de acciones equivalentes contra el original.

Verificación del desarrollador:
- Observar reposo, identificar cada intención y comparar movimiento/transiciones con el original.

Criterio de aceptación:
- [ ] Repertorio completo, personalidad aceptada y movimiento superior al original sin actividad ambiental insistente.

Evidencia / feedback (2026-10-04, Bolivia):
- Repertorio independiente en `jev-lab/visual/phase4`: 13 acciones, 18 variantes, seis transformaciones, saludo, sí/no, pensamiento y habla A/B/C/BC. Curvas y envelope de recuperación evaluados por Rive real; duración activa independiente de velocidad, reproducción sostenida cancelable y secuencias finitas.
- Reposo seed731: respiración de 2.8 s con pausas de 5–9 s, parpadeo de 150 ms con pausas de 5–12 s; aproximadamente 70.3% de las muestras de diez minutos sin actividad. Corregido defecto detectado por validación independiente: ticks cada100ms y único tick a600000ms producen exactamente el mismo schedule, ocupación y pose nativa.
- CLI 1.3.0 verify/compile/inspect PASS, sin errores ni advertencias; WASM local2.42.2, generación `9158312fca163a88ecf5`. Regresión completa: 67 tests Python y 56 Node PASS; incluye 12 pruebas nativas de personalidad y lifecycle. Informe: [`validation-report.md`](../jev-lab/output/visual-phase4/validation-report.md).
- Validación independiente reproducible, ejecutada también por el agente principal: 13/13 grupos PASS, fuentes estables. 54 reemplazos al mismo instante: diferencia máxima de pose nativa0; recuperación hacia base no neutral: delta máximo4.77e-7 en muestra de0.001ms. 1000 órdenes mantienen44 instancias; dispose elimina44/44 una sola vez. Sólo una recuperación saliente y última orden pendiente. Evidencia: [`native-independent-validation.json`](../jev-lab/output/visual-phase4/independent/native-independent-validation.json).
- 44 renders CLI reales de todas las variantes/formas; 19 retornos RGBA exactamente iguales al neutral inicial. Captura inspeccionada: [`contact-sheet.png`](../jev-lab/output/visual-phase4/contact-sheet.png). Interrupción de máquina CLI y recuperación del controlador nativo se prueban por separado.
- Preview `http://127.0.0.1:4184/`: original raw y propuesta a140/48pxCSS, fondo negro y cámara fija. CUA confirmó habla BC sostenida más de60s/cancelación, estrella visible en ambos tamaños, pensamiento con duración1500ms/speed4 y stop completo; canvas neutral inicial/retorno exactamente igual en bytes y encuadre. [`browser-validation.json`](../jev-lab/output/visual-phase4/browser-validation.json). Original real:22 clips,16 enums,0 inputs,15 activaciones comprobadas; preserva Bump. Reloj de pared compartido con desfase inicial aproximado de un frame; sincronización exacta queda en fase5.
- Preservación comprobada por el agente principal:58 fuentes/evidencias anteriores,12 archivos de app/original y134 referencias históricas intactos. Original SHA-256 `98aa68170540d448deaed0db6fa57c11b062cebf9036dc1cfada4376254a8daf`. `git diff --check` PASS. Guía/API: [`visual/phase4/README.md`](../jev-lab/visual/phase4/README.md). Entrega ordinaria disabled/unmanaged.
- Fase4 técnicamente lista; aceptación de personalidad y superioridad visual permanece humana. Muestras finitas sustentan continuidad de pose C0, sin certificar C1 perfecta ni todo el continuo geométrico. Fase5 permanece pendiente.
Aprobación del desarrollador: Pendiente

#### Fase 5 — Laboratorio completo y validación final

Estado: Pendiente

Subtareas:
- [ ] Completar preview con catálogo, pausa, avance temporal, velocidad, intensidad, variantes, comparación sincronizada y capturas reproducibles.
- [ ] Verificar teclado, touch, resize, DPR y activación sobre cuerpo real sin halo; ocultar página cancela acciones/frames, volver recupera sólo comportamiento ambiental.
- [ ] Ejecutar regresiones de rig, compilación, canales, interrupciones, secuencias y neutral; documentar creación de acciones y uso del módulo desde código.

Verificación del desarrollador:
- Seguir la guía para crear/ajustar una acción; probar tamaños, teclado/touch y cambio de pestaña durante una acción; comparar resultado final normal y pequeño.

Criterio de aceptación:
- [ ] Pruebas pasan y el desarrollador confirma superioridad del personaje, estabilidad y mayor rapidez de autoría/control.

Evidencia / feedback: Pendiente
Aprobación del desarrollador: Pendiente
