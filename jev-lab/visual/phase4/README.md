# Tres estados modelo, idle y bump

La revisión expresiva de fase 4 establece el patrón con **`yes`, `think` y `transform_star`**. El controlador separa el bump del gesto y conserva la respiración continua. Los JSON son la fuente editable; Rive evalúa las curvas. La entrega técnica queda **esperando aceptación visual del usuario**.

## Probar y comparar

Desde la raíz:

```powershell
python -u jev-lab/validators/personality_phase4.py
```

El proceso muestra las etapas de preparación/compilación y queda sirviendo en **http://127.0.0.1:4184/**. Es normal que no termine: `Ctrl+C` detiene el servidor. `--prepare`, `--check` y `--render` sí terminan.

1. Selecciona `yes`, `think` o `transform_star` y pulsa **Reproducir / comparar**.
2. Observa **bump previo → anticipación → gesto → hold → settle → recuperación → bump de retorno → idle**.
3. Para `think`, usa duración activa o **Sostenida hasta cancelar**; son excluyentes. Interrumpe durante el bump, el gesto y el retorno. Sólo la última orden toma el control.
4. **Stop** congela el neutral completo y desactiva el ambiente; **Reposo** lo habilita de nuevo.

La cámara es fija, fondo negro y cuerpos neutrales de 140/48 px CSS. Original raw: cuerpo 400×400, centro 800,610; propuesta: 122×122, centro 180,170. No se recorta el original a su esfera neutral ni se reajusta la cámara durante la acción. El original conserva su Bump, tiempos y clips. La preparación introduce aproximadamente un frame de desfase; no se afirma sincronización exacta ni se acelera el original al cambiar speed.

## Evidencia antes de autorar

Se activaron los enums reales en WASM 2.42.2 con seguimiento deshabilitado, binding de VM en artboard/máquina, Base asentado durante 120 frames y trigger después de seleccionar estado. [Estudio del original](../../output/visual-phase4/original-study.png): 0/100/200/350/500/700/1000/1400/2000/2600 ms, cámara fija, cuerpo neutral 140 px.

| Estado original | Lectura observada | Decisión de autoría |
|---|---|---|
| `yes` → `Yes` | Bump, desplazamiento vertical fuerte y deformación lobulada durante los beats; vuelve a redondearse. | Ojos primero, dos asentimientos verticales, squash/stretch claramente distintos y segundo beat más pequeño. |
| `think` → `Think` | Ciclo de un segundo con silueta cambiante/asimétrica; no es una pose inmóvil. | Ciclo más deliberado de 2.1 s: considera, pausa, mira al lado opuesto antes de mover el cuerpo, contrasta, vuelve. |
| `MorphState` → `MorphTest` | En estas muestras alcanza cinco puntas y conserva la estrella. | Anticipación contraída, morph completo, overshoot, hold de 767 ms y retorno autorado a esfera. |

Los valores numéricos del VM original no describen toda su deformación: los renders son la evidencia de silueta. El estudio usa paneles de 360×200; algunos overshoots del original exceden su viewport vertical. No sirve para certificar visibilidad completa ni todos los instantes. El video citado en el plan respalda amplitud/silueta; no se usa para asignar automáticamente nombres de gestos.

La primera pasada rechazada está intacta en [`revisions/first-pass/`](../../output/visual-phase4/revisions/first-pass/) con manifest SHA-256 de 115 archivos. Los diffs revisados de `happy_bounce`, `curious_look`, `hello` y `speech` eran exclusivamente experimentales; se restauraron sus definiciones anteriores. Las 13 acciones/18 variantes siguen disponibles.

## Receta de autoría

Edita `actions/*.json`; el compilador descubre definiciones y genera `scene.rml`, `catalog.json` y `rive.yaml`. Usa [el esquema de fase 3](../phase3/README.md) y [los límites v2](../phase2/JEV_BODY_CONTRACT_V2.md). Cada pose define todos los canales poseídos. Entrada y últimas dos poses son neutrales completos, con hold final de dos frames. Cada morph tiene un solo destino fijo.

| Modelo | Motivo y ritmo | Canales |
|---|---|---|
| `yes` | Ojos 100 ms antes de elevar cuerpo; nod fuerte, rebound, confirmación 200 ms, settle. Activa 1400 ms. | Mirada Y, apertura, posición Y, escalas X/Y. |
| `think` | Entrada 500 ms; ciclo 500–2600 ms con pausas de atención; salida desde 2900 ms. Activa finita 3400 ms. | Mirada, apertura/inclinación independiente, giro, posición X/Y y escalas. |
| `transform_star` | Contracción 300 ms; llega a morph 1 en 667 ms; hold estable 900–1667 ms; fold y settle. Activa 2400 ms. | Morph, ojos, giro, posición Y y escalas. |

1. Escribe intención, evidencia original y **un solo motivo reconocible**.
2. Separa **ojos primero → anticipación → beat/cambio de forma → hold → settle**. Dos poses iguales separadas en tiempo producen un hold real.
3. Usa contraste de silueta y pausas; no añadas beats por llenar la timeline. Las escalas extremas son 0.82–1.12, movimiento ±10 px y giro ±0.2 rad. No se amplió el rig: las mediciones/render actuales no justificaron canales nuevos.
4. Para un ciclo sostenido, declara `behavior.kind: "sustained"`, entryEnd/cycleStart iguales y endpoints idénticos por canal/variante. Todas las curvas tienen tangentes planas (`y1=0`, `y2=1`); verifica pose y velocidades cerca del seam en Rive real.
5. Verifica secuencia completa a 140/48 px, geometría, ownership, interrupciones y recuperación; después pide revisión humana.

**Derivar `no`:** usa la estructura de anticipación/beat/hold/settle de `yes`, sustituyendo el motivo vertical por mirada X y oscilación lateral/giro. Los ojos anuncian el rechazo y el segundo beat reduce amplitud. No copies nods verticales ni combines ambos motivos.

**Derivar otras transformaciones:** usa la estructura de estrella, sustituye un solo `targetShape`, mide contención ocular y luces en toda la transición, ajusta overshoot/hold según la lectura a 48 px. No extrapoles la certificación de estrella a otra forma. Estas derivaciones son recetas, no cambios adicionales en esta revisión.

## Scheduling y composición

- **Entrada:** bump de 250 ms, pico autorado 1.08 a los 100 ms. Clip/elapsed activos permanecen en cero hasta terminar el bump. Takeover de base/ambiente poseídos ocurre dentro de esa entrada, con envelope nativo de 150 ms.
- **Acción:** velocidad 0.1–4 modifica tiempo del clip. `durationMs` mide sólo tiempo activo de pared; no incluye transiciones. Default finito usa duración autorada/speed.
- **Salida:** congela la muestra actual y recupera en 150 ms; después reproduce bump de retorno de 250 ms. Default a speed 1: `yes` 2050 ms, `think` 4050 ms, estrella 3050 ms. `finished` de ejecución completa resuelve después del retorno.
- **Reemplazo:** valida la orden completa antes de mutar. Una recuperación saliente y sólo la última orden pendiente. Reemplazar durante recuperación no reinicia el fade; durante bump congela también su escala efectiva y la desvanece antes del bump del sucesor. No se apilan recuperaciones.
- **Intensidad cero:** mantiene los relojes pero no toma canales ni suprime el idle/base, y ambos bumps tienen mezcla cero.
- **Escala compuesta:** `BodyDeform × BumpTransform` nunca excede 1.12 por eje. Una base ya expandida puede limitar el pico visible; no se relaja el validador para ocultarlo. Ojos/luces heredan la escala del cuerpo.
- **Idle:** respiración continua de 2.8 s, escala máxima 1.035/1.045, deriva ±1 px y apertura ocular leve. Blink de 150 ms, pausas seeded de 5–12 s. Los canales no poseídos siguen vivos. Stop permanece neutral en ticks posteriores.

El envelope usa un nodo no visible fuera del cuerpo. Los reemplazos conservan continuidad de pose C0 en las muestras nativas; no se afirma C1 perfecta para cualquier orden. El diagnóstico expone `stage: entry/action/sustained/recovery/return/idle`, elapsed activo, transición, escala efectiva, ownership y pendientes.

## Interface de seis comandos

```javascript
import {createController} from './web/controller.mjs';
const controller = createController({runtime, artboard, contract, catalog, now, subscribe, onChange});
const handle = controller.play('think', {durationMs: 2400, speed: 1.4});
controller.sequence(['yes', {action: 'think', durationMs: 1800}, 'transform_star']);
handle.cancel(); // Un handle antiguo no afecta al sucesor.
controller.lookAt(-5, 3);
controller.setAmbient({enabled: true, seed: 731});
controller.stop();
controller.dispose();
```

`play` acepta intensidad 0–1, speed 0.1–4 y variante descubierta. Sólo sostenidas admiten duración 1–3600000 ms o loop booleano; secuencias 1–100 ítems rechazan loop infinito y se validan completas. `setAmbient` reemplaza base numérica, `{}` la limpia y comandos sólo enabled/seed la conservan. Ninguna forma ambiental. `dispose` es idempotente; elimina instancias/suscripción y deja artboard/archivo/renderer al llamador.

`finished` resuelve `{status, reason, completedItems, totalItems}`; status completed/cancelled, reason completed/replaced/handle/stopped/disposed. Cancelar resuelve enseguida, mientras recuperación/retorno siguen sin cola.

## Verificación y límites de evidencia

```powershell
python -u jev-lab/validators/personality_phase4.py --prepare
python jev-lab/validators/personality_phase4.py --check
python -u jev-lab/validators/personality_phase4.py --render
python -m unittest discover -s jev-lab/tests
node --test ./jev-lab/tests/*.mjs
git diff --check
```

[`sequences/`](../../output/visual-phase4/sequences/) contiene GIFs y filmstrips a 140/48 px de los tres movimientos completos, incluidos ambos bumps y retorno a esfera. Son renders CLI reales, muestreados a 15 fps, a speed/intensidad 1 y base neutral sin ambientación: una timeline combinada reproduce el scheduling finito. No sustituye las pruebas del controlador ni es un video continuo de 60 fps. El pequeño hold al final facilita ver la esfera antes de repetir el GIF. Las secuencias yes/think recuperan RGBA exacto; la timeline combinada de estrella conserva una diferencia máxima de 5/255 en color, aunque sus claves y transformadores regresan a neutral. Ese límite raster se registra en `temporal-validation.json`; no se afirma igualdad exacta de sus píxeles ni se relajan los checks geométricos. Los retornos de las máquinas individuales siguen pasando igualdad RGBA exacta.

[`motion-validation.json`](../../output/visual-phase4/motion-validation.json) mide 435 muestras autoradas a 60 fps y certifica cada contorno cúbico muestreado: margen ocular mínimo 15.33 px, halo máximo 145.52 px, morph estrella 1. [`native-validation.json`](../../output/visual-phase4/native-validation.json) mide Rive/WASM real: escalas compuestas, seam, scheduling, secuencias, duración, zero intensity y matriz de lifecycle en cada transición. El runtime/CLI permanecen 2.42.2/1.3.0; sin dependencias nuevas.

Muestras finitas no certifican todo el continuo temporal/geométrico ni superioridad subjetiva. **El usuario debe confirmar que los tres prototipos superan al original antes de aprobar la fase.** El ciclo de ocultar/volver y la presentación dedicada del preview corresponden a fase 2 del plan revisado; se conserva abierta la fase 4 histórica.
