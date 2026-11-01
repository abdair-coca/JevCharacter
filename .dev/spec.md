# Spec: Jev escucha, habla, usa plugins y recuerda en la nube

**Estado:** aprobada el 2026-10-31 («Aprobado, empieza fase 1»). Fase 1 en curso.

**Fuentes:** [contrato visual](../design.md), [arquitectura](../docs/architecture.md), [interacción](../docs/interaction.md), [plan](plan.md), [tarea activa](task.md).

Estos tres archivos SDD son registros temporales de esta feature: permanecen durante todo el trabajo y se vacían, sin borrarlos, solo tras completar las fases y recibir la aprobación final explícita.

## Solicitud y decisiones del quiz

El usuario pidió: «Quiero que jev pueda escuchar, también que pueda responder con voz, que tenga su estilo, también que pueda tener pluggings como github, WhatsApp, y que sea un asistente mejor que cualquier otro. Que tenga memoria persistente».

Quiz del 2026-10-31:

- **Escuchar:** Whisper en Groq, con la clave Groq que el visitante ya guarda en Ajustes.
- **Modo:** manos libres. Jev solo responde si lo nombras («Jev»).
- **Voz:** proveedor gratuito → Gemini TTS (Google), con la clave de Google **del visitante** en Ajustes.
- **Estilo:** criatura juguetona: voz aguda y alegre, frases cortas, risitas y sus pitidos como firma.
- **GitHub:** leer GitHub público (repos, issues, PRs, commits y perfiles), con un token de solo lectura en el servidor.
- **WhatsApp:** «Enviar a WhatsApp». Jev redacta y abre WhatsApp con el texto listo (`wa.me`), sin API ni número propio.
- **Memoria:** en una base de datos (Supabase) con **login con Google**.
- **SDD previo:** «Jev compañero con memoria» aprobado y vaciado (commit `fb6b966`).

«Mejor que cualquier otro asistente» no se puede prometer ni medir así. Esta spec lo traduce en los criterios medibles de la sección «Listón de calidad».

## Punto de partida

- Jev solo recibe texto escrito (`ContextWhisper` → `useCreatureBrain.submitContext` → `/api/decide` → `/api/talk`). No hay micrófono.
- La voz de Jev son pitidos sintetizados (`voiceEngine`, `voiceScore`) que siguen la frase hablada (≤120 caracteres).
- `/api/talk` (Groq `openai/gpt-oss-20b`) devuelve objetos JSON por SSE: `spoken`, `memory` y bloques. No usa herramientas.
- La memoria son hasta 40 notas en `localStorage` (`jevling.memory`), visibles y borrables en «Lo que Jev recuerda».
- Supabase ya existe en el servidor solo para `enrollments` (REST con `SUPABASE_SECRET_KEY`, sin dependencias).
- **Reglas aprobadas que esta feature cambia (requieren esta aprobación):**
  - `design.md` («Voz de Jev», 2026-10-16): «Nunca palabras ni voz humana».
  - `design.md` y `AGENTS.md`: lo persistente en el navegador se limita a preferencias, personalidad, notas, clave Groq y color. En el servidor solo persisten las inscripciones UATF, y la persistencia no se amplía a servidor ni sincronización sin aprobación.
  - `AGENTS.md`: la única clave de proveedor que viaja desde el navegador es la de Groq.
  - `design.md` (About) y la copia de Historia: «JEV solo guarda notas cortas en el navegador» y «la memoria persistente completa corresponde a Bob».

## Resultado

### 1. Jev escucha (manos libres)

- **Activación:** un botón de micrófono junto al campo de Home activa o desactiva «Manos libres» (`aria-pressed`). La primera vez el navegador pide permiso. Si se niega o no hay micrófono, se muestra un aviso y el botón queda apagado.
- **Indicador:** mientras escucha, hay un anillo visible y el texto «Escuchando, di «Jev»» con movimiento reducido respetado. Se apaga al ocultar la pestaña, salir de Home o borrar la clave Groq.
- **Captura:** `getUserMedia` con cancelación de eco, supresión de ruido y control de ganancia. Un detector de voz local por energía, sin dependencias, corta frases de 0,4 a 15 s tras unos 700 ms de silencio y conserva unos 300 ms previos para no perder el arranque. El audio sale como WAV mono de 16 kHz. Nunca se guarda en el navegador ni en el servidor.
- **Transcripción:** `api/transcribe.ts` reenvía cada frase a Groq (`whisper-large-v3-turbo`) con la clave del visitante en `X-Groq-Api-Key`, el idioma de la interfaz y una frase de contexto que nombra a Jev («Jev es una criatura digital.»; con solo el nombre, Whisper inventaba «Jev,» al inicio, medido el 2026-11-01). Valida tamaño y duración, aplica límite de frecuencia y no registra audio ni texto.
- **Palabra «Jev»:** el cliente busca «Jev» y sus transcripciones habituales («Yev», «Jeff», «Chev») en cualquier parte de la frase. Si no está, la frase se descarta sin mostrarse. Si está, se quita y el resto se envía. Si solo dijiste «Jev», Jev te mira y espera la pregunta.
- **Camino:** una frase dirigida a Jev va directo a respuesta hablada (decisión TALK local, como la conversación abierta de `choices`), sin pasar por `/api/decide`. El texto transcrito se muestra igual que uno escrito.
- **Turnos:** mientras Jev piensa o habla, las frases oídas se ignoran para que no se escuche a sí mismo. Se le interrumpe tocándolo o con Escape. Al terminar de hablar, durante 8 s se le puede contestar sin decir «Jev» (propuesta aprobada en el quiz de aprobación).

### 2. Jev habla con voz y estilo propios

- **Proveedor:** Gemini TTS (`gemini-3.8-flash-lite-tts`, configurable con `GEMINI_TTS_MODEL`). Habla español e inglés y responde en streaming con PCM de 24 kHz.
- **Clave:** el visitante la guarda en Ajustes, en una sección «Voz de Jev» igual a la de Groq: campo de contraseña, guardar, borrar, estado y guía de 4 pasos (`aistudio.google.com/apikey`). Se guarda solo en su navegador (`jevling.geminiKey`) y viaja únicamente en la cabecera `X-Gemini-Api-Key` de `/api/speak`. El servidor no la guarda ni la registra.
- **Aviso fijo** junto a la clave: en el nivel gratuito, Google puede usar el texto que Jev dice para mejorar sus productos. Ninguna clave de Google sale del servidor del proyecto ni entra en el bundle.
- **Qué dice:** solo la frase hablada (≤120 caracteres). Los bloques se muestran, no se leen.
- **Estilo «criatura juguetona»:** voz precargada Puck («Upbeat»), elegida en el quiz de la fase 2. Una firma breve de pitidos de Jev suena justo antes de la voz. **Ajuste del 2026-11-01:** el usuario sintió «muy exagerada» la voz en español con el estilo «juguetón, curioso y alegre, con risitas». Tras oír tres versiones eligió la «suave» para ambos idiomas: criatura pequeña, cálida y curiosa, con un toque juguetón muy ligero, natural y tranquila, sin exagerar la entonación ni reír.
- **Reproducción:** por el bus de voz de `appAudio`, así que «Sonido de Jev», silenciar y ocultar la pestaña la controlan como hoy. La animación de habla dura lo que dura el audio y vuelve a `Base` al terminar.
- **Plan B:** sin clave, con la clave rechazada, sin cuota (429), con error o si el audio tarda más de 3 s en empezar, Jev usa sus pitidos de siempre y la respuesta sigue igual. Ajustes muestra el estado.
- **Features** sigue con pitidos: es determinista y no consulta `/api/*`.

### 3. Plugins: GitHub y WhatsApp

- **Ajustes › Plugins:** interruptores «GitHub» y «WhatsApp», encendidos por defecto y persistidos en `jevling.plugins`. Cada mensaje envía cuáles están activos y el servidor solo ofrece al modelo esas herramientas. Propuesta aprobada en el quiz de aprobación. La lista es extensible: cada plugin declara su esquema, sus límites y su ejecución en `api/_plugins/`.
- **GitHub (solo lectura, público):** herramientas para ver un repo, buscar repos, listar issues o PRs, ver commits recientes y ver un perfil. Usan la API REST con `GITHUB_TOKEN` del servidor, opcional y de solo lectura. Cada resultado se recorta a ≤1500 caracteres, con hasta 2 llamadas por mensaje y 4 s por llamada.
- **Flujo:** `/api/talk` llama a Groq en streaming con las herramientas activas. Si el modelo pide una, el servidor la ejecuta, emite el evento SSE `tool` (`{plugin, status}`) para que Home muestre «Buscando en GitHub…» mientras Jev piensa, y abre una segunda llamada en streaming con el resultado. Sin herramientas, el camino es el actual.
- **Fuentes:** un bloque nuevo `links` (hasta 3 enlaces) muestra de dónde salió el dato. El servidor solo acepta URLs `https://github.com/…` que aparecieron en los resultados de la herramienta. Se dibujan como enlaces de React con `rel="noopener noreferrer"`, nunca como HTML del modelo.
- **WhatsApp:** un bloque nuevo `whatsapp` (`{"text":"≤500"}`) cuando pides enviar o compartir algo por WhatsApp. Muestra el mensaje y un botón «Abrir en WhatsApp» (`https://wa.me/?text=…`, en otra pestaña); el destinatario se elige dentro de WhatsApp. Se rechazan textos con secuencias de 7 o más dígitos, como en la memoria.
- Sin el plugin activo, Jev explica que está apagado y cómo encenderlo.

### 4. Memoria persistente en la nube

- **Sin sesión:** todo funciona como hoy (notas en `jevling.memory`).
- **Login:** «Iniciar sesión con Google» en Ajustes y en «Lo que Jev recuerda», con Supabase Auth. Con sesión, las notas viven en la tabla `memories` y se sincronizan entre dispositivos.
- **Primera vez:** si el navegador tiene notas, Jev ofrece «Llevar N notas a tu cuenta» (sí/no). Tras llevarlas, las locales se borran para no tener dos memorias.
- **Tabla `memories`:** `id`, `user_id` (de `auth.users`, borrado en cascada), `text` (1–160 caracteres; la base rechaza secuencias de 7 o más dígitos) y `created_at`. Un disparador mantiene 40 notas por usuario borrando la más antigua. RLS: cada usuario solo lee, crea y borra las suyas. No hay edición.
- **Claves:** el navegador usa la URL y la clave publicable de Supabase (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`), que son públicas por diseño y quedan protegidas por RLS. `SUPABASE_SECRET_KEY` nunca va al navegador.
- **El panel** «Lo que Jev recuerda» lista, olvida una y olvida todo, igual que hoy, sobre la fuente activa. El texto fijo cambia a «Guardado en tu cuenta» o «Se guarda solo en este navegador».
- **Cerrar sesión** quita las notas de la cuenta de este navegador. «Olvidar todo» borra todas las notas de la cuenta.
- **Lo demás no cambia:** la selección (2 recientes + relacionadas, ≤8 notas y ≤1000 caracteres), el filtro de datos sensibles y el contexto de sesión de 2 intercambios. Lo dicho por voz o con plugins genera notas por el mismo camino.
- **Sin conexión o con error de Supabase:** las notas nuevas duran la sesión y se avisa, sin romper la conversación.

## Listón de calidad («mejor asistente», medible)

Se mide con un set de 20 casos reales en dev (claves reales) y se registra en `task.md`:

1. **Voz:** se mide el tiempo desde que el usuario calla hasta que Jev empieza a sonar (p50 y p90). La meta inicial de p50 ≤ 3 s se confirma o ajusta con la medición de las fases 1 y 2.
2. **Palabra «Jev»:** en 2 min de conversación ajena o tele sin decir «Jev», Jev responde 0 veces; de 10 frases con «Jev», responde al menos a 9.
3. **GitHub:** 6 preguntas reales cuyos datos (estrellas, último commit, issues abiertos) coinciden con la API, con enlace de fuente.
4. **WhatsApp:** 3 pedidos producen un bloque con texto útil y un enlace que abre WhatsApp.
5. **Memoria:** una nota creada en un navegador aparece en otro tras iniciar sesión; «Olvidar todo» la borra en ambos.
6. **Seguridad:** ninguna clave en `dist/` ni en logs, y las tablas no se pueden leer sin sesión (prueba con la clave publicable).

## Criterios de aceptación

1. Con manos libres, «Jev, ¿qué carreras puedo estudiar?» dicho al micrófono produce la respuesta hablada sin escribir nada; una frase sin «Jev» no produce nada (Playwright con micrófono simulado y prueba real en dev).
2. Con clave de Google, Jev responde con voz Gemini en ES y EN; sin clave o con error, con pitidos, y la respuesta llega igual.
3. «¿Qué cambió en facebook/react esta semana?» usa el plugin GitHub, muestra «Buscando en GitHub…» y responde con datos reales y enlace; con el plugin apagado no se llama a GitHub.
4. «Mándale a mi grupo por WhatsApp que llego tarde» muestra el bloque y el enlace `wa.me` correcto.
5. Con login, las notas se sincronizan entre dos navegadores; sin login, todo sigue en el navegador; la RLS impide leer notas ajenas.
6. Contratos de API (`/api/transcribe`, `/api/speak` y `/api/talk` con plugins) rechazan cuerpos inválidos, claves mal formadas y exceso de tamaño; ninguna clave sale del servidor.
7. Matriz de verificación de `design.md`: typecheck, ESLint, Vitest, build y Playwright (ES/EN × claro/oscuro × escritorio/móvil, teclado y movimiento reducido).

## Fuera de alcance

- Número propio de Jev en WhatsApp (API de Meta), y enviar mensajes sin abrir WhatsApp.
- Escribir en GitHub (crear issues o PRs) y repos privados u OAuth de GitHub.
- Interrumpir a Jev hablando mientras él habla (*barge-in*).
- Palabra de activación procesada en el dispositivo; la detección de «Jev» se hace sobre la transcripción.
- Leer en voz alta los bloques, voces clonadas y multi-voz.
- Embeddings o búsqueda semántica de notas; guardar conversaciones completas en la base de datos.
- Login distinto de Google.
- «Borrar mi cuenta» desde la web y apagado automático de manos libres por inactividad: propuestas descartadas en el quiz de aprobación.
- Deploy y push sin pedido explícito.

## Dependencias y acciones del usuario

- **Dependencia nueva:** `@supabase/supabase-js` (fase 4), cargada en diferido solo al iniciar sesión o si hay sesión guardada. Groq, Gemini y GitHub se llaman con `fetch`, y el detector de voz es propio. Si el detector por energía falla en las pruebas, se propondrá `@ricky0123/vad-web` para aprobarla antes de añadirla.
- **Solo el usuario puede hacer esto:**
  1. Crear una clave de Gemini para probar (los visitantes usan la suya).
  2. Crear un token de GitHub de solo lectura de repos públicos y ponerlo en `GITHUB_TOKEN` (Vercel y `.env.local`).
  3. Crear el cliente OAuth de Google, activar el proveedor Google en Supabase con las URLs de retorno (producción y `localhost`) y aplicar la migración.

## Aprobaciones

- [x] Spec aprobada el 2026-10-31 («Aprobado, empieza fase 1»).
- [x] Plan aprobado en la misma respuesta.
- [x] Cambio de las reglas listadas en «Punto de partida».
- [x] Dependencia `@supabase/supabase-js`.
- Propuestas: se mantienen «8 s sin decir «Jev»» e «Interruptores de plugins»; se descartan «Apagado tras 5 min» y «Borrar mi cuenta».
