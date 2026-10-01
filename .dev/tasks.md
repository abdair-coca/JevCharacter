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

### Plan: Reorientar JevBot alrededor de `prove1.riv`

**Objetivo:** convertir la interacción en un compañero vivo y tranquilo, guiado por el modelo Rive real.

**Alcance:** cambios locales al personaje, las decisiones de Jev, la respuesta condicional de Groq y sus pruebas. Sin despliegue ni publicación de `dist`.

**Restricciones:** preservar el seguimiento y el click del personaje implementados dentro de Rive; no duplicar esas interacciones desde React; movimiento no dispara llamadas; conservar el límite de mensaje de 280 caracteres; no persistir conversaciones; mantener `prove1.riv` fuera de commits/publicaciones; no añadir controles manuales de morph.

#### Fase 1 — Personaje y eventos locales

Estado: Aprobada

Subtareas:
- [x] Contrastar el estado exacto `think` y los bindings usados con la ficha de inspección del modelo; reservarlo para uso interno.
- [x] Activar `think` al comenzar `deciding`; retirar `Cloud` del flujo normal y conservarlo en el panel de diagnóstico.
- [x] Preservar sin cambios el seguimiento y el bump nativos del modelo; el desarrollador confirmó que ambos funcionan. No se modificaron `Character.tsx`, el sensor, `App.tsx` ni el asset Rive.
- [x] Revisar el bump de escenario mediante el handler existente, sin duplicar el trigger Rive.
- [x] Confirmar en el código que `pointermove` solo actualiza sensores/estilos locales; no aporta coordenadas al estado ni solicita decisión.
- [x] Mantener Idle/Blink y morphing del modelo sin cambios ni llamadas añadidas.
- [x] No publicar ni incluir en commit el modelo ni recursos exclusivos; no se crearon commits ni publicaciones en esta fase.
- [x] Completar typecheck, lint, build y smoke test de carga local; preparar estos pasos manuales para el desarrollador.

Verificación del desarrollador:
- Abrir la app local, mover el cursor y observar el seguimiento integrado del modelo sin bumps adicionales.
- Hacer click/tap directamente sobre el personaje y comprobar su bump Rive nativo.
- Hacer click/tap en escenario despejado y controles; comprobar que solo el escenario active el bump gestionado por la app.
- Durante una decisión demorada, comprobar `think` mientras el estado sea `deciding` y la reacción final al resolverse.
- Confirmar carga estable del modelo y actividad Idle/Blink sutil.
- Entregar los pasos numerados al cerrar la fase y detenerse para recibir feedback.

Criterios de aceptación:
- [x] Seguimiento Rive conservado sin modificaciones.
- [x] Eventos de movimiento no producen llamadas de red ni acciones.
- [x] Click sobre el personaje conserva su bump nativo; el escenario produce un solo bump de app.
- [x] Los bindings utilizados están verificados contra el archivo Rive.
- [x] El flujo de espera usa `think`, no `Cloud`.

Evidencia / feedback: `npm run typecheck`, `npm run lint`, `npm run build` y `git diff --check` pasan. El desarrollador verificó cursor y bump y confirmó que el comportamiento de la fase es correcto.
Aprobación del desarrollador: Aprobada explícitamente el 2026-09-29.

#### Fase 2 — Decisiones de Jev

Estado: Aprobada

Subtareas:
- [x] Definir y validar una unión discriminada de acciones excluyentes: reacción, respuesta visual `yes/no`, habla o morph.
- [x] Restringir estados de habla a `Talk`, `talkb`, `talkc` y `talkbc`; `yes/no` son visuales y no generan texto.
- [x] Instruir a Jev para usar `yes/no` solo ante preguntas binarias claras y `talk` para preguntas ambiguas/no binarias.
- [x] Reservar morph para solicitudes explícitas; si falta forma, Jev puede elegirla según contexto.
- [x] Ejecutar morph sin habla, restaurar forma original tras ~5 s y cancelar/restaurar si otra acción lo interrumpe; morph tiene prioridad sobre habla.
- [x] Validar acción/estados/formas y métricas de salida; API rechaza claves extra en el estado, incluidos datos de cursor.

Verificación del desarrollador:
- Usar un entorno que sirva `api/decide.ts` con `TYPESAFE_API_KEY`. `npm run dev` usa un stub que siempre devuelve `unavailable`, así que solo verifica fallback local.
- Enviar “I'm trying to scare you”; esperar acción `reaction` y estado `Ghost`.
- Hacer una pregunta binaria clara; esperar animación visual `yes` o `no`, sin texto.
- Hacer una pregunta ambigua/no binaria; esperar un estado `Talk`/`talkb`/`talkc`/`talkbc`. Esta fase no genera texto ni llama a Groq.
- Pedir “Morph into a triangle”; esperar morph silencioso y retorno a la forma original en ~5 s. Confirmar visualmente el mapa de forma, reportado pero no probado independientemente.
- Combinar explícitamente morph y habla; comprobar que se ejecute solo morph. Revisar que el HUD/diagnóstico muestre la acción elegida.

Criterios de aceptación:
- [x] Solo se ejecutan acciones permitidas y verificadas.
- [x] Morph y habla nunca se combinan.
- [x] Sin estado de habla no se solicita texto a Groq.

Evidencia / feedback: `npm run typecheck`, `npm run lint`, `npm run build`, `npx tsc -p tsconfig.api.json --noEmit` y `git diff --check` pasan. El desarrollador confirmó que las acciones y morph funcionan correctamente y aprobó explícitamente continuar.
Aprobación del desarrollador: Aprobada explícitamente el 2026-09-30.

#### Fase 3 — Respuestas de Groq

Estado: Esperando aprobación

Subtareas:
- [x] Ejecutar el flujo secuencial Jev → Groq; iniciar `think` al enviar y mantenerlo hasta el primer texto.
- [x] Transmitir progresivamente una frase de hasta 120 caracteres en el idioma del usuario; español si no se puede determinar.
- [x] Mostrar un rótulo cinematográfico único; desvanecerlo unos 5 s después de completarse y reemplazarlo ante una respuesta nueva.
- [x] Mantener los últimos cuatro intercambios solo en memoria de sesión; no guardar texto ni crear historial visual.
- [x] Cancelar operaciones anteriores al llegar un mensaje nuevo; ante fallos, degradar sin texto prefabricado ni reintentos.
- [x] Mantener claves del lado servidor; dejar `.env.example` con marcadores, no secretos.

Verificación del desarrollador:
- Ejecutar `npm run dev` con `TYPESAFE_API_KEY`, `JEV_MODEL`, `GROQ_API_KEY` y `GROQ_MODEL` en el `.env` raíz. Vite carga las variables solo server-side y ejecuta ambos handlers.
- No exponer claves con prefijo `VITE_`; confirmar que no aparecen en el bundle del navegador.
- Enviar una petición no hablada (por ejemplo, una pregunta binaria clara). Confirmar la acción visual y, en Network, que no se solicita `/api/talk`.
- Enviar una pregunta explicativa/ambigua que Jev clasifique como `talk`. Confirmar `think` mientras deciden Jev y Groq, y que la animación hablada empiece al llegar el primer fragmento.
- Revisar el rótulo: respuesta progresiva de una frase en el idioma del mensaje, máximo 120 caracteres, reemplazo al enviar otra y desvanecimiento unos 5 s tras completarse.
- Mientras una respuesta está pendiente, enviar otro mensaje. Confirmar que la petición anterior se cancela y no sobrescribe el nuevo resultado.
- Simular clave ausente/incorrecta o desconexión. Confirmar que se limpia cualquier fragmento parcial, vuelve a reposo y no aparece texto prefabricado ni reintento.
- Recargar y confirmar que no se conserva conversación ni reaparece la clave en el bundle del navegador.

Criterios de aceptación:
- [x] El código llama a Groq únicamente tras una acción contextual `talk` de Jev; acciones visuales y fallback no llaman a `/api/talk`.
- [ ] En la prueba del desarrollador, el texto aparece progresivamente, es breve, de una frase y no persistente; errores no dejan texto parcial.
- [x] Las claves/configuración server-side no aparecen en el bundle del navegador.

Evidencia / feedback: la validación de `wantsAttention` se corrigió para aceptar la probabilidad numérica de TypeSafe; `/api/decide` devolvió `source: jev` y acción `GHOST`. El antiguo middleware de Vite producía 503 fijo para `/api/talk`; ahora ejecuta `api/talk.ts` con las variables Groq solo server-side. Prueba directa sintética: HTTP 200 `text/event-stream`, varios fragmentos `delta` y `done`. Prueba visual local: «Prueba Groq recibida.» apareció en pantalla. Una prueba posterior del caso de error del stream agotó tiempo y no confirmó ese fallback visual; la verificación de fallos y la aprobación del desarrollador siguen pendientes. No se desplegó.
Aprobación del desarrollador: Pendiente

#### Fase 4 — Regresión y cierre local

Estado: Pendiente

Subtareas:
- [ ] Añadir pruebas Vitest con Jev/Groq simulados para acciones, límites, morph, cancelación, errores y eventos de cursor/click.
- [ ] Ejecutar smoke test de navegador con el Rive real: carga, seguimiento, bump, `think` → habla, morph y retorno.
- [ ] Ejecutar typecheck y build local; registrar resultados.
- [ ] Confirmar que las pruebas automatizadas no consumen cuotas, no se despliega y el modelo no se incluye en publicaciones.

Verificación del desarrollador:
- Revisar y recorrer el smoke test local; inspeccionar el resumen de pruebas y build.

Criterios de aceptación:
- [ ] Pruebas, typecheck y build pasan.
- [ ] El desarrollador aprueba el comportamiento completo.
- [ ] Solo después de completar y aprobar todas las fases se puede limpiar el plan activo; este archivo permanece.

Evidencia / feedback: Pendiente
Aprobación del desarrollador: Pendiente

**Nota de costo:** Jev permanece como decisor activo, según la indicación del desarrollador. TypeSafe publica una tarifa de $0.042 por millón de tokens de entrada; Groq tiene cuotas gratuitas sujetas a límites. No habilitar upgrades pagados ni asumir que el uso en vivo cuesta $0. Fuentes: [precio de Jev](https://www.typesafeai.org/guides/jev-pricing), [límites de Groq](https://console.groq.com/docs/rate-limits), [streaming de Groq](https://console.groq.com/docs/text-chat).
