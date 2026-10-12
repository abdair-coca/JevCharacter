# Controles de Inicio sin desplazamiento — 2026-10-12

Respuesta de Jev y «Borrar conversación» sin mover el input ni el resto de controles.

- `verify.mjs`: mide posición del input, zona de Jev y footer en reposo, con el botón de borrar y con una respuesta inyectada. Tamaños: escritorio 1440×900, móvil 390×844 y móvil bajo 390×640. Resultado: `noMovement: true` en los seis casos.
- `pixels.mjs`: lee los píxeles del canvas de Rive en el centro del dibujo, en seis cargas por variante. Resultado: el cuerpo de Jev se pinta en las seis cargas.

Cambios en el código:
- `src/components/ContextWhisper.tsx`: el botón «Borrar conversación» entra y sale con fundido (`AnimatePresence` + `m.button`).
- `src/App.css`: la respuesta (`.speech-caption`) se posiciona sobre la zona de Jev, en absoluto, y el hueco reservado del `.speech-slot` queda igual que en reposo. La fila `.whisper__meta` se superpone bajo el input, con `position: absolute`.

Descartado: reservar el espacio de la fila en el flujo. Cambiaba la altura de la zona de Jev en la carga y en algunas cargas dejaba el cuerpo de Jev sin pintar (bitmap de Rive calculado con la escala del canvas).
