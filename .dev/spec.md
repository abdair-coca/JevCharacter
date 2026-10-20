# Spec: respuestas largas con UI generada

**Estado:** aprobada el 2026-10-20 («aprobado»). Fase 1 aprobada; fase 2 entregada para revisión.

**Fuentes:** [contrato visual](../design.md), [arquitectura](../docs/architecture.md), [interacción](../docs/interaction.md), [plan](plan.md), [tarea activa](task.md).

Estos tres archivos SDD son registros temporales de esta feature: permanecen durante todo el trabajo y se vacían, sin borrarlos, solo tras completar las fases y recibir la aprobación final explícita.

## Solicitud y decisiones del quiz

El usuario pidió: «quiero que cuando el modelo responda bastante texto se pueda ver la respuesta por tiempo indefinido, pero que se ve bonito y espectacular tambien, y que se vea bien en mobile y escritorio». Después añadió: «UI generada dinámicamente por IA para las respuestas generadas con el modelo y se muestren impresionantemente».

En el quiz eligió:
- **Escritorio:** Jev se aparta y la tarjeta ocupa el otro lado.
- **Móvil:** vista previa con «Leer todo» que abre un panel inferior.
- **Cierre:** la respuesta se queda hasta un mensaje nuevo o hasta cerrarla.
- **UI generada:** catálogo de bloques tipados; el modelo no escribe HTML.
- **Voz:** Jev dice un resumen corto; la tarjeta muestra todo.
- **Longitud:** media, unos 800 caracteres de contenido visible. Ajuste del 2026-10-20 («reduce los tokens de respuesta, pero no mucho»; quiz: tope 384 y ~650): unos 650 caracteres y tope de 384 tokens de completado.
- **Extras:** palabras que entran con desenfoque, como excepción acotada al contrato de movimiento.
- **Proceso:** tres fases (protocolo → tarjeta → bloques visuales), con revisión entre cada una.

## Punto de partida

- `api/talk.ts` pide «una frase, máximo 120 caracteres» con `max_completion_tokens: 64` y corta en el primer fin de frase (`appendFirstSentence`). El cliente aplica el mismo corte.
- El historial (`SPEECH_HISTORY_LIMIT = 2`) rechaza respuestas de más de 120 caracteres.
- `SpeechCaption` aparece sobre el input y desaparece 5 s después de completarse. Home es un escenario de una pantalla, sin scroll de página.

## Resultado

### Respuesta estructurada

- Cada respuesta tiene `spoken` (obligatorio, una frase de 120 caracteres o menos) y `blocks` (opcional, de 0 a 6 bloques, unos 650 caracteres de texto en total).
- Una charla casual llega solo con `spoken` y se ve como la burbuja actual. Una explicación añade bloques y abre la tarjeta.
- **Catálogo cerrado:**
  - `paragraph`: texto, con énfasis opcional en palabras.
  - `list`: 2–6 ítems.
  - `steps`: 2–6 pasos numerados.
  - `compare`: 2–3 columnas con título y puntos.
  - `highlight`: valor destacado y su etiqueta.
  - `callout`: tono `tip` o `warning`, con texto.
  - `chips`: 1–3 preguntas para continuar.
- Los tipos son estrictos y compartidos entre cliente y servidor. Los textos tienen límites por campo.
- El servidor valida cada bloque antes de reenviarlo. Un bloque inválido se convierte en `paragraph` si tiene texto aprovechable y se descarta si no. Una respuesta sin `spoken` válido falla como hoy.
- El texto se renderiza como texto, nunca como HTML ni markdown interpretado.
- **Streaming por bloques:** `spoken` llega primero y la voz y la animación de Jev empiezan con él. Cada bloque llega completo y validado como su propio evento.
- **Historial:** guarda `spoken` y un resumen plano de los bloques, con límites de tamaño, para dar continuidad sin superar el contrato del servidor.
- Se conservan el idioma ES/EN, la cancelación por cambio de idioma o mensaje, la suspensión al salir de Home y los avisos de error que no inventan una frase de Jev. Las claves se quedan en el servidor.

### Voz

- La voz y la animación de habla siguen solo a `spoken`. Los bloques no suenan.
- Se mantiene el contrato actual: la animación termina cuando la voz suena su última sílaba.

### Tarjeta de respuesta

- **Persistencia:**
  - Una respuesta con bloques no desaparece por tiempo. Se cierra al enviar un mensaje nuevo, con ✕ o `Esc`, o deslizando el panel hacia abajo en móvil.
  - Una respuesta solo con `spoken` conserva la burbuja y su desvanecimiento de unos 5 s.
- **Escritorio:**
  - Jev se desplaza a un lado con una animación `layout` de Motion y la tarjeta ocupa el otro. Al cerrar, Jev vuelve al centro.
  - La tarjeta tiene alto máximo, scroll interno y desvanecido en los bordes.
  - ~~Mientras llegan bloques, el scroll los sigue.~~ **Cambio del 2026-10-20 (quiz de fase 2):** la lectura empieza arriba, con la frase de Jev; si hay contenido debajo aparece «Más ↓», que baja al tocarlo. Motivo: los bloques llegan casi juntos y seguirlos ocultaba el inicio.
- **Móvil:**
  - Encima del input aparece una vista previa de dos líneas con «Leer todo».
  - Ese botón abre un panel inferior con barra de arrastre y dos alturas (aprox. 45 % y 90 % de `dvh`) que respeta `safe-area` y el teclado.
  - Jev sigue visible arriba.
  - **Decisión del 2026-10-20 (quiz de fase 2):** arrastrar el panel hacia abajo, su ✕ o `Esc` vuelven a la vista previa; el ✕ de la vista previa descarta la respuesta.
- **Accesibilidad:**
  - Zona desplazable con nombre accesible y alcanzable por teclado.
  - El foco no se roba al llegar la respuesta. Al abrir el panel, el foco entra; al cerrarlo, vuelve a «Leer todo» (patrón estándar de diálogo, sin abrir el teclado móvil). Al cerrar la tarjeta de escritorio con el foco dentro, vuelve al input.
  - Se anuncia la respuesta una vez, cuando está completa.
- **Compatibilidad:** la tarjeta no aparece durante la inscripción UATF y se suspende al cambiar de ruta. «Borrar conversación» la cierra.

### Bloques visuales

- Componentes propios con tokens CSS, en ambos temas, ES/EN y reflow a 320 px.
- `compare` pasa a pestañas o a una pila vertical en móvil.
- **Entrada animada:** cada bloque entra en cascada; sus palabras pasan de desenfocadas a nítidas con opacidad y un leve ascenso.
- **Excepción aprobada al contrato:** `filter: blur()` animado solo en la entrada de bloques de respuesta, corto, una vez por bloque. Movimiento reducido entrega texto estático.
- Los chips envían su pregunta como un mensaje nuevo.
- El halo y los colores de Jev (`--jev-color-*`) dan identidad a la tarjeta, sin animar sombras ni colores.

## Criterios de aceptación

- Una pregunta que pide explicación produce una tarjeta con bloques válidos en ES y en EN. Una charla casual sigue en la burbuja breve.
- Ninguna salida del modelo, válida o no, inyecta HTML ni rompe la UI. Los bloques inválidos se convierten o se descartan según la regla.
- La voz dice solo `spoken`. La animación de habla termina con la voz.
- La tarjeta se mantiene sin límite de tiempo y se cierra solo por las vías definidas.
- Escritorio 1440×900 y móvil 390×844, claro y oscuro, ES/EN, 320 px y viewport bajo: sin scroll de página, sin overflow horizontal y sin tapar el input.
- Teclado, foco, `Esc`, lector (DOM) y movimiento reducido funcionan.
- Cambiar de idioma, de ruta, enviar un mensaje nuevo o borrar la conversación no deja bloques ni eventos obsoletos.

## Fuera de alcance

- Que el modelo genere HTML, JSX, estilos, imágenes, enlaces o código ejecutable.
- Historial visible de respuestas anteriores (idea 6, para después).
- Lectura sincronizada con la voz.
- Cambios en Features, About, el asset Rive, el contrato de decisión (`/api/decide`) o el proveedor.
- Dependencias nuevas, salvo una justificada y aprobada antes de añadirla.
- Deploy y push sin pedido explícito.

## Aprobaciones

- [x] Spec aprobada el 2026-10-20: «aprobado».
- [x] Plan aprobado el 2026-10-20 en la misma respuesta.
