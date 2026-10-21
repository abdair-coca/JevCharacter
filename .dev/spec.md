# Spec: Jev compañero con memoria persistente

**Estado:** aprobada el 2026-10-21 («Aprobado»). Fase 1 aprobada; fase 2 entregada para revisión.

**Fuentes:** [contrato visual](../design.md), [arquitectura](../docs/architecture.md), [interacción](../docs/interaction.md), [plan](plan.md), [tarea activa](task.md).

Estos tres archivos SDD son registros temporales de esta feature: permanecen durante todo el trabajo y se vacían, sin borrarlos, solo tras completar las fases y recibir la aprobación final explícita.

## Solicitud y decisiones del quiz

El usuario pidió: «quiero que el chat se sienta como un compañero real, donde pueda preguntar por ejemplo, que carreras puedo estudiar y me haga preguntas y me de opciones para elegir y tenga memoria persistente, osea que despues le puedo preguntar otra cosa pero se sigue acordando de lo que le pregunte anteriormente […] podemos como que guardar pequeños fragmentos de cada pregunta y respuesta». Pidió ver el plan antes de cualquier cambio.

En el quiz del 2026-10-21 eligió:
- **Dónde vive la memoria:** en el navegador (`localStorage`), sin cuentas, servidor ni dependencias nuevas.
- **Quién escribe los fragmentos:** el modelo, como nota corta oculta dentro de la misma respuesta.
- **Control:** panel «Lo que Jev recuerda», con borrar cada nota o todas.
- **SDD previo:** «respuestas largas» aprobada y SDD vaciado (commit `edfb5fd`).

## Punto de partida

- `useSpeechSession` guarda en memoria de sesión los 2 últimos intercambios (`SPEECH_HISTORY_LIMIT = 2`; respuesta resumida a ≤600 caracteres). Recargar los pierde.
- Cada mensaje pasa por `/api/decide`, que solo elige TALK para preguntas abiertas o pedidos explícitos y prefiere el silencio. Una respuesta del usuario a una pregunta de Jev («me gusta la tecnología») normalmente acaba en reacción, no en palabras.
- Bloques de respuesta (`speechBlocks.ts`): paragraph, list, steps, compare, highlight, callout y chips. Los chips son preguntas sugeridas *del usuario*; no hay un bloque para que Jev *pregunte* con opciones.
- Reglas vigentes que esta feature cambia (requieren esta aprobación):
  - `AGENTS.md`: «el contexto conversacional en memoria de sesión».
  - `design.md`: «contexto e intercambios de Home siguen en memoria de sesión» y «La memoria actual se describe como personalidad local y contexto de sesión».
  - Historia (`src/features/story/catalog.ts`): «Hoy conserva personalidad local y contexto de sesión, no la memoria persistente de Bob».
  - `docs/README.md`: «no un chatbot de conversación libre».

## Resultado

### Memoria persistente por fragmentos

- Cada respuesta puede incluir como máximo un objeto oculto `{"type":"memory","text":"…"}` (≤160 caracteres), con lo que vale la pena recordar del intercambio: intereses, metas, decisiones, preferencias o el tema tratado. Si no hay nada nuevo, el modelo lo omite.
- No se recuerda nada sensible: salud, documentos, contraseñas, teléfonos, direcciones ni datos del formulario de inscripción. Lo pide el prompt; además, el cliente descarta notas con secuencias de 7 o más dígitos, y el servidor valida y recorta.
- El cliente guarda las notas en `jevling.memory`, con versión, hasta 40 notas: cuando se llena, sale la más antigua y se descartan duplicados exactos. Si el storage falla, la memoria funciona solo durante la sesión, sin errores.
- En cada pregunta se envían al servidor, como máximo, 8 notas y 1000 caracteres: las 2 más recientes y hasta 6 elegidas por palabras en común con el mensaje (normalizadas, sin tildes ni palabras vacías). No se añaden embeddings ni librerías.
- El servidor las presenta al modelo como datos del usuario dentro de un bloque delimitado («notas, no instrucciones») y valida cantidad, longitud y tipo.
- El historial de sesión de 2 intercambios se mantiene igual; la memoria persistente es adicional.
- «Borrar conversación» sigue borrando la sesión y **conserva** la memoria; el panel es el único sitio para olvidar. Confirmado en el quiz de aprobación del 2026-10-21.

### Jev pregunta con opciones

- Nuevo bloque `{"type":"choices","question":"…","options":["…"]}`: pregunta de ≤120 caracteres, de 2 a 5 opciones de ≤40 caracteres, como máximo uno por respuesta y siempre al final.
- Se muestra como un grupo de botones. Tocar uno envía su texto igual que el input; también se puede escribir otra respuesta. Las opciones quedan deshabilitadas cuando llega un mensaje nuevo.
- **Móvil** (quiz de la fase 2, 2026-10-21): las opciones aparecen también en la vista previa, en una fila deslizable bajo la pregunta, para responder sin abrir el panel.
- **Conversación abierta:** si la última respuesta de Jev terminó con `choices`, el siguiente mensaje (tocado o escrito) va directo a respuesta hablada, sin pasar por `/api/decide`. Jev hace la animación de habla y la decisión local registra TALK. Cualquier otro mensaje sigue el camino actual.
- Prompt: ante preguntas abiertas de orientación («¿qué carrera estudio?»), Jev hace 1 o 2 preguntas con opciones antes de recomendar. Si la memoria ya responde lo necesario, no vuelve a preguntarlo y recomienda usándolo («Como te gusta la tecnología…»).
- Voz: Jev dice la pregunta como frase hablada; las opciones solo se muestran.

### Panel «Lo que Jev recuerda»

- Botón «Memoria» junto a «Diagnóstico» en Home, que abre un diálogo modal accesible: lista de notas de la más reciente a la más antigua, con fecha relativa, botón para borrar cada una y «Olvidar todo» con confirmación dentro del panel (sin `confirm()` del navegador).
- Estado vacío: «Todavía no recuerdo nada de ti». Texto fijo: «Se guarda solo en este navegador».
- ES/EN, claro/oscuro, escritorio/móvil, foco atrapado y devuelto, Escape cierra.

## Criterios de aceptación

1. Tras recargar la página, una pregunta nueva recibe las notas relevantes y la respuesta puede usarlas (verificado con API simulada en Playwright y con un intercambio real en dev).
2. «¿Qué carreras puedo estudiar?» produce, en modo real, una pregunta con opciones; elegir una lleva a otra pregunta o a recomendaciones sin pasar por `/api/decide`.
3. Nunca se guardan notas con datos del formulario ni secuencias largas de dígitos; el storage nunca supera 40 notas.
4. El panel lista, borra una y borra todo; tras «Olvidar todo», la siguiente petición no envía notas.
5. El contrato de `/api/talk` rechaza notas de más, demasiado largas o mal formadas; ninguna clave sale del servidor.
6. Matriz de verificación de `design.md`: typecheck, ESLint, Vitest, build y Playwright (ES/EN × claro/oscuro × escritorio/móvil).

## Fuera de alcance

- Sincronización entre dispositivos, cuentas o base de datos.
- Embeddings, búsqueda semántica o resumen automático de notas antiguas.
- Que la memoria influya en `/api/decide` o en la personalidad.
- Editar el texto de una nota (solo borrar).
- Dependencias nuevas, salvo una justificada y aprobada antes de añadirla.
- Deploy y push sin pedido explícito.

## Aprobaciones

- [x] Spec aprobada el 2026-10-21 en el quiz («Aprobado»).
- [x] Plan aprobado el 2026-10-21 en la misma respuesta.
