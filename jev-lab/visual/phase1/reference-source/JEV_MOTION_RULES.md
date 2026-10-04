# Movimiento de Mini JEV

JEV es curioso, cariñoso, tierno, un poco torpe y tranquilo. Juega cuando existe un motivo. La mirada comunica intención antes del cuerpo; el cuerpo confirma esa intención con una acción pequeña y clara.

1. Los ojos suelen reaccionar primero.
2. Prefiere desplazamientos pequeños y squash/stretch moderado.
3. Una acción importante puede tener anticipación; una acción fuerte termina con settle.
4. Usa curvas naturales cuando mejoren la lectura. Aquí solo se admiten curvas cúbicas monótonas, sin overshoot oculto entre claves.
5. Anima cada propiedad por una razón. Evita moverlo todo a la vez o mantener movimiento innecesario.
6. La quietud está permitida. Legibilidad e identidad tienen prioridad sobre espectáculo.

## happy_bounce

La intención se escribió primero en `specs/happy_bounce.json`. La implementación vive en `rive/animations/happy_bounce.rml`, a 60 fps durante 45 frames (750 ms), una sola vez.

| Tiempo autorado | Acción |
|---|---|
| 0–50 ms | Ojos miran ligeramente arriba y a la derecha; el cuerpo espera. |
| 67–150 ms | Cuerpo baja 6 px con squash suave. |
| 150–233 ms | Estira y despega. |
| 233–350 ms | Frena hasta un ápice 52 px sobre neutral. |
| 350–417 ms | Pequeño cambio de forma y rotación acompaña el overshoot controlado. |
| 417–533 ms | Cae; ojos se cierran parcialmente antes del contacto. |
| 533–717 ms | Squash de aterrizaje, recuperación pequeña y settle. |
| 717–750 ms | Neutral exacto, quieto; continúa neutral después. |

El overshoot está escrito en las poses, no en un interpolador elástico. Escala máxima real 1.09; rotación máxima aproximada 2°. El GIF repite capturas para facilitar inspección; la animación Rive sigue siendo `oneShot`.

## curious_look

Curiosidad tranquila, no sorpresa: la mirada se desplaza 7 px a la derecha sin cambiar su escala propia ni cerrar los ojos. El cuerpo responde 100 ms después con inclinación de 4° hacia la derecha y stretch vertical del 7%. Los ojos acompañan esa transformación corporal heredada; no reciben una reacción de tamaño adicional. Conserva posición, ancho y anatomía. La intención se escribió antes en `specs/curious_look.json`; implementación: `rive/animations/curious_look.rml`, 48 frames a 60 fps (800 ms), `oneShot`.

| Tiempo autorado | Acción |
|---|---|
| 0–100 ms | Ojos miran suavemente a la derecha; cuerpo neutral. |
| 100–300 ms | Cuerpo se inclina a la derecha y se estira un poco. |
| 300–500 ms | Mantiene la pose para observar. |
| 500–767 ms | Mirada y cuerpo regresan juntos, suavemente. |
| 767–800 ms | Neutral exacto durante los últimos dos frames. |

El retraso se mide desde el inicio del segmento que cambia de valor, no desde la clave de llegada. En coordenadas Rive (x derecha, y abajo), rotación positiva desplaza la parte superior del cuerpo a la derecha. El PNG de hold confirma esa dirección. Curvas cúbicas monótonas evitan sacudidas; la quietud breve comunica atención.
