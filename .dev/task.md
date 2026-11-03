# Tarea: Jev escucha, habla, usa plugins y recuerda en la nube

Handoff vivo de la feature. **Antes de continuar, leer `spec.md`, `plan.md`, este archivo y `../design.md`.**

## Retoma aquí

- **Fase activa:** fase 5 (Cierre), sin empezar. Fase 4 aprobada («si funciona, cierra la fase 4 y pushea», 2026-11-02). Fase 1 aprobada («continua con la fase dos»), sin prueba real con micrófono pero con Whisper real (ver fase 2). Fase 2 aprobada («esta bien, sigue con la fase 3», 2026-11-01). Fase 3 aprobada («continua con la fase 4, ya estan los datos en .env», 2026-11-01).
- **Aprobaciones:** spec, plan, cambio de reglas y `@supabase/supabase-js` aprobados el 2026-10-31 («Aprobado, empieza fase 1»). Propuestas: se mantienen la ventana de 8 s y los interruptores de plugins; se descartan el apagado tras 5 min y «Borrar mi cuenta».
- **Siguiente acción exacta:**
  1. Empezar la fase 5 cuando el usuario lo pida. Se verifica solo con los unit tests afectados, sin CI/CD ni e2e.
  2. Para tener login en producción, a pedido: `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` en Vercel y `vercel deploy --prod`.
- **Quiz de la fase 2 (2026-11-01):** voz «Puck» (animada); prueba real con `GEMINI_API_KEY` en `.env.local`, usada solo por un script del scratchpad que no se commitea.
- **Estado del código:** fases 1 a 4 en GitHub (push pedido por el usuario el 2026-11-02). Producción quedó en `4773bfc`, desplegado por esos push, sin las variables `VITE_SUPABASE_*`: allí no aparece el login. Desde `1596ba6` un push ya no despliega. El SDD anterior («Jev compañero con memoria») se aprobó y se vació en `fb6b966`.
- **Verificación de las fases 1 a 4 (2026-11-03):** hallazgos abajo, sin corregir. El usuario eligió «Reportar y tú decides»: esperan su decisión.

## Verificación de las fases 1 a 4 — 2026-11-03

Alcance elegido en el quiz: código contra la spec, unit tests, build y APIs reales («Código + APIs reales»). Sin CI ni e2e, por la regla del 2026-11-02. Scripts en el scratchpad, sin commitear; no se creó ningún usuario ni fila. Ningún código cambió.

| Comprobación | Resultado |
|---|---|
| `tsc -b`, `tsc -p tsconfig.tests.json --noEmit`, `eslint . --max-warnings=0` | PASS. |
| `vitest run --maxWorkers=4` con el `.env` actual | FAIL 562/564: `settingsPanel.test.tsx:34` y `memoryPanel.test.tsx:98`, que suponen un build sin Supabase. |
| El mismo comando con `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` vacías | PASS 564/564. |
| `vite build` a una carpeta aparte | PASS: `index` 381,95 kB (gzip 123,35 kB). supabase-js solo en su chunk diferido. |
| Secretos | PASS: 0 coincidencias de los valores de `.env` en el build y en los archivos versionados de texto. `sb_secret_` aparece solo como comprobación de prefijo de supabase-js. |
| `/api/speak` real | 3/5 con audio: ES 2 y EN 1, primer audio en 1689–2107 ms y total de 2785–3016 ms. 2/5 dieron 502 (ES) y no se repitieron en 2 reintentos; causa sin confirmar, no se capturó la respuesta de Google. |
| Validación de `/api/speak`, `/api/transcribe` y `/api/talk` | PASS 18/18, y el 429 llega en la petición 13 de `/api/talk`. |
| Detector + WAV + Whisper + «Jev» con voz de Gemini | EN con nombre: acierta. ES sin nombre: se descarta bien. **ES con nombre: FAIL 1/1**, Whisper escribió «¿Kid? ¿Qué carreras puedo estudiar?». |
| GitHub real | 4/4 con datos iguales a la API y fuentes: estrellas ES y EN (251 890), commits de esta semana e issues #345810/#345809/#345808. |
| WhatsApp real | 5/5 con bloque y `wa.me`. |
| Supabase sin sesión | PASS 6/6: leer, crear, borrar y editar `memories` y leer `enrollments` dan 401 (`42501`); sin clave, 401. Google está activo. |

**Hallazgos sin corregir, de mayor a menor gravedad:**

1. **«Jev» sin medir con voz humana.** La prueba de la fase 1 sigue pendiente y la frase del criterio 1 falló hoy con voz sintética. El listón de ≥9/10 no tiene medición.
2. **Jev responde a ruidos en la ventana de 8 s.** Con silencio, ruido, golpe, zumbido o tecleo sintéticos, Groq devolvió `no_speech_prob` 0 en 10/10, así que el filtro de `api/transcribe.ts:94` no quitó nada («Gracias.», «¡Gracias por ver el video!», «.»). Fuera de la ventana se descartan; dentro, `useHandsFree.ts:76` los envía como mensaje (comprobado con la transcripción simulada). Cada respuesta abre otra ventana. Sin ver aún con micrófono real.
3. **Escape y tocarlo no interrumpen a Jev (spec, «Turnos»).** `HomePage.tsx:161` solo cierra el diagnóstico y `voiceEngine.ts:191` excluye el toque a propósito. `docs/interaction.md:143` dice que apagar el micrófono lo corta, y tampoco lo hace.
4. **Borrar la clave Groq no apaga el micrófono (spec, «Indicador»).** Sigue en `listening` hasta la frase siguiente, que va a `/api/transcribe` sin clave y recibe 401; no llega a Groq.
5. **Un ruido constante que aparece de pronto no se aprende.** Con 3 s de silencio y 2 min de ruido sintético: 8 frases de 15 s, 120 s enviados. `voiceActivity.ts:71` solo actualiza el ruido fuera de una frase. Sin la supresión de ruido del navegador, que puede atenuarlo.
6. **GitHub apagado: no explica cómo encenderlo (spec, sección 3).** 0/5 lo dijeron y uno ofreció buscarlo. No se llamó a GitHub en ninguna.
7. **WhatsApp con un número: promete un borrador que no aparece.** 4/4 dijeron «lo dejo listo» sin bloque. Ningún número salió.
8. **WhatsApp cambia el sentido del mensaje.** En 3/5 («llegué tarde», «nos vemos en el próximo encuentro»), y los 5 añaden frases no pedidas.
9. **Clave Groq equivocada en `/api/talk`.** `api/talk.ts:295` responde 502 y Home dice «no disponible», sin señalar la clave; `/api/transcribe` sí responde 401.
10. **Dos unit tests dependen del `.env` local** (tabla de arriba): `npm test` sale en rojo en este equipo.
11. **«Oí: …» sobrevive al apagar y encender:** la línea no vuelve a decir «Escuchando · di «Jev»». Además, «Hola, Jev» llega como «Hola,».
12. **Email abierto en Supabase:** `email: true` y `disable_signup: false`, aunque la spec solo admite Google. La RLS contiene a esos usuarios, pero evitan el modo «Prueba».
13. **Textos desactualizados:** `spec.md:3` y `plan.md:5` («Fase 1 en curso»), `spec.md:65` («hasta 2 llamadas», el código hace 2 rondas de 2) y `plan.md:25` (`prompt: "Jev"`). `GITHUB_TOKEN` no está en `.env` ni `.env.local`.

### Recorrido en navegador real, 2026-11-03

El usuario pidió «quiero que lo verifiques tu». Sin las suites e2e ni CI: guiones propios de Playwright en el scratchpad, con la app, Whisper, Groq y GitHub reales. El audio entra por `getUserMedia` inyectado (pasa por el `AudioWorklet`, el detector y `/api/transcribe` reales) o por el micrófono falso de Chromium, con eco, ruido y ganancia activos. Las claves de `.env` se cargaron solo en ese navegador aislado, nunca en el Chrome del usuario. Sin GPU, los tiempos valen poco.

| Comprobación | Resultado |
|---|---|
| «Jev» con 4 voces de Windows (80 frases, Whisper real) | Con nombre 37/40: Helena 8/10, Sabina 10/10, David 9/10, Zira 10/10. Sin nombre 0/40 falsos, también con «jefe» y «chef». Whisper por `/api/transcribe`: p50 598 ms, p90 784 ms. |
| Fase 1 en navegador | PASS: encender e indicadores, mensaje sin el nombre y sin `/api/decide`, ignora lo oído mientras Jev habla, ventana de 8 s y su fin, apagado por pestaña, ruta e inscripción, avisos de permiso, micrófono y clave, inglés. Criterio 1 PASS en los dos sentidos con el procesado de Chrome. |
| Fase 2 en navegador | PASS: firma y voz, corte al silenciar, ocultar la pestaña y con un mensaje nuevo; clave falsa real (401); sin clave; 429 y más de 3 s (simulados); aviso de privacidad; Features sin `/api/*`. Sin concluir: la pose termina 0,9–1,5 s después de la voz, sin GPU. Tras agotarse la cuota se usó una voz grabada en `/api/speak`. |
| Fase 3 en navegador | PASS: «Buscando en GitHub…», fuentes que son commits reales de la semana, estrellas iguales a la API, interruptores que persisten, `wa.me` abre `api.whatsapp.com/send` con el texto y sin destinatario, móvil oscuro y claro. Una vez salió «El habla no está disponible» en móvil, sin reproducirse en 3 intentos. |
| Fase 4 sin sesión | PASS 10/10: notas en el navegador, panel, olvidar una, número no guardado, sin llamadas a Supabase, PKCE hasta Google y volver sin entrar. |
| Fase 4 con la cuenta real (Chrome del usuario, 2 pestañas) | PASS: «Ahora no» y su vuelta al recargar, «Llevar 2 notas», otra pestaña las trae de la base, olvidar una, «Olvidar todo», cerrar sesión, login desde `/features` con vuelta a esa vista (el usuario pulsó su cuenta en Google). Quedó como estaba: con sesión y 0 notas. |

**Cambios sobre la lista de arriba:**
- **2 confirmado:** Whisper oyó un tecleo como «¿Qué es esto?» y Jev respondió; tecleo y tos también pasan el procesado de Chrome. Los 26 sonidos sin voz de la medición devolvieron texto inventado.
- **3 y 4 confirmados** midiendo la salida de audio y las pistas del micrófono.
- **5 baja a menor:** con el procesado de Chrome, ruido blanco y ventilador dieron 1 envío en 75 s.
- **7:** 4/5 prometen el borrador sin mostrarlo; una vez dijo que no podía.
- **6:** GitHub apagado 0/6; WhatsApp apagado explica el interruptor 1/2 y la otra pidió copiar un texto que no dio.
- **11 confirmado:** al encender tras cambiar a inglés, la línea seguía en «I heard: ¿Qué es esto?».

**Hallazgos nuevos:**
14. **Whisper repite la frase de contexto y despierta a Jev.** Con un ventilador, por el procesado real de Chrome, devolvió «Jev es una criatura digital.» (`api/transcribe.ts:34`) y Jev respondió sin que nadie lo nombrara; también «Jev is a digital creature.» con palmas (1/26). Otros 6 de 26 repiten la frase sin el nombre («I am a digital creature.»), que en la ventana de 8 s también llega a Jev.
15. **Decir solo «Jev» no funciona.** Dura 220–320 ms en las 4 voces y `LISTEN_SPEECH_MIN_MS` (`listenProtocol.ts:6`) exige 400 ms, así que el detector lo descarta. «Oye, Jev» y «Hola, Jev» sí pasan. Falta confirmarlo con voz humana.
16. **Gemini gratis da 10 frases de voz al día.** Respuesta real: «limit: 10 requests per day on Free Tier». Antes solo se había observado el límite por minuto. Cada respuesta gasta una; después, pitidos. Estas pruebas agotaron la cuota del día de la clave de `.env`, que vuelve hacia las 4:00.

**También:** los 3 nombres perdidos están al inicio de la frase y Whisper los pierde igual sin el corte del detector, así que el detector queda descartado. En un navegador sin GPU, la voz empezó 6,4 s tras callar y el primer pitido a los 2,1 s (1 muestra); sumando los tiempos del servidor salen unos 4 s, sobre la meta inicial de p50 ≤ 3 s, que se ajusta en la fase 5. «Llevar 2 notas» tardó entre 2,5 y 8,5 s, sin más aviso que el botón atenuado.

**Sin comprobar:** voz humana y oír la voz (solo el usuario); dos dispositivos reales (lo confirmó el usuario el 2026-11-02; hoy, 2 pestañas); aviso sin conexión con sesión (solo unit tests); RLS entre dos usuarios, que no se repitió para no crear usuarios (PASS 9/9 el 2026-11-02); las variables de Vercel; suites e2e y CI (regla del usuario).

## Fase 4 — implementación, 2026-11-01

- [x] **Antes de codificar:** el proyecto de Supabase estaba pausado (su dominio no resolvía) y el usuario lo reactivó. Auth responde, con Google aún apagado (`/auth/v1/settings`: `google: false`, `email: true`). `.env` tenía `SUPABASE_URL`, `SUPABASE_SECRET_KEY` y `SUPABASE_DB_PASSWORD`, pero no las claves web.
- [x] **Quiz (2026-11-01):** el proyecto «estaba pausado»; «dime como obtengo esas claves» (se dieron los pasos de las claves web, el cliente OAuth y el proveedor Google); Google OAuth «Todavía no»; la migración la aplica el agente con psql; «Ahora no» al importar → «Se vuelve a ofrecer» (sin clave nueva en el navegador).
- [x] **Migración** `supabase/migrations/20261101000000_memories.sql`:
  - Tabla `memories`: `id`, `user_id` (por defecto `auth.uid()`, borrado en cascada), `text` (1–160 caracteres, no en blanco, sin `\d([\s.-]?\d){6,}`, la misma regla del navegador) y `created_at`.
  - Disparador `memories_keep_latest` (40 por usuario).
  - RLS con políticas de select, insert y delete propias para `authenticated`. `revoke all` a `anon` y a `authenticated`, y después `grant select, insert, delete` a `authenticated`.
  - **Prueba en seco** contra el proyecto (pooler de sesión `aws-1-sa-east-1`), dentro de una transacción con `rollback`: 15/15. Cubre RLS al escribir como otro, CHECK de dígitos, 161 caracteres y blancos, sin `update`, B no ve ni borra lo de A, anon sin lectura ni escritura, 40 notas y la cascada; tras el rollback, la tabla no existía.
  - **Aplicada** con aprobación («Sí, aplícala»), con `psql -1`. Comprobado: RLS activa, 3 políticas, permisos `DELETE,INSERT,SELECT` solo para `authenticated` y el disparador. Registrada en `supabase_migrations.schema_migrations` (20261101000000, memories).
- [x] **Dependencia** `@supabase/supabase-js` 2.118.0 (aprobada). En diferido: chunk propio de 214 kB (55 kB en gzip), fuera del `index`. Sin claves web en el build, el import desaparece del bundle.
- [x] `src/lib/supabaseClient.ts`:
  - `supabaseConfigured` y `hasSavedAuth` (claves `jevling.auth*`).
  - `forgetAuthLeftovers` limpia el verificador de un login que no terminó.
  - `loadSupabase` usa PKCE, sesión en `jevling.auth` y `detectSessionInUrl`, y reintenta si falla la descarga.
- [x] `src/vite-env.d.ts`: tipos de `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY`.
- [x] `features/account/`:
  - `accountStore`:
    - `startAccount` solo carga supabase-js con sesión guardada o un login que vuelve.
    - `signIn` va a Google y vuelve a la misma vista. `signOut` usa `scope: "local"`.
    - Si Google vuelve con error, avisa y limpia la URL.
    - Al volver atrás desde Google (bfcache), el botón vuelve a su estado.
  - `memoryRemote`: tabla `memories` con la sesión del visitante; valida las filas.
  - `AccountSection`: Ajustes › Cuenta.
- [x] `memoryStore.ts`:
  - Dos fuentes tras las mismas funciones. `connectAccountMemory`, `disconnectAccountMemory` y `reloadAccountMemory`, al abrir el panel y al volver a la pestaña.
  - Cola de escrituras en orden. Estados `loading`, `ready` y `offline`.
  - `importBrowserMemory` (sin repetidas, con fecha, y luego vacía el navegador). `useMemory`.
- [x] `MemoryPanel.tsx`:
  - Texto según la fuente: «Guardado en tu cuenta.», «Trayendo lo que recuerdo…» o «Sin conexión…».
  - «Iniciar sesión con Google» sin sesión.
  - «Llevar N notas a tu cuenta» o «Ahora no», hasta la siguiente visita.
- [x] Textos ES/EN, estilos reutilizados (acento para iniciar sesión y llevar notas) y `.env.example` con las claves web.
- [x] `playwright.config.ts`: el build de e2e apunta a un proyecto falso (`jev-e2e.supabase.co`), nunca al real.
- [x] Docs de estado actual: `docs/architecture.md` y `docs/interaction.md`.

| Comprobación | Resultado |
|---|---|
| `tsc -b`, `tsc -p tsconfig.tests.json --noEmit`, `eslint . --max-warnings=0` | PASS. |
| `vitest run` | PASS: 59 archivos / 564 tests (antes 542). Nuevos: `accountMemory` (10: fuente de cuenta, escrituras en orden, olvidar todo, recarga con notas sin guardar y olvidadas, sin conexión, 40 notas, importación y fallo de importación), `accountStore` (7: sin sesión no carga Supabase, sesión guardada, escrituras en la tabla, ida a Google, login cancelado, fallo de carga, cerrar sesión), `memoryPanel` (+4) y `settingsPanel` (+1). |
| `npm run build` | PASS: `index` 381,63 kB (gzip 123,16 kB), +6,3 kB; con claves web, 381,91 kB más el chunk diferido de supabase-js. `dist/` no contiene `sb_secret`, `SUPABASE_SECRET` ni `SUPABASE_DB_PASSWORD`. |
| e2e `account.spec.ts` (nuevo, Chromium, sesión simulada) | PASS 2/2. (1) Con sesión: Ajustes dice la cuenta; el panel lista las notas de la cuenta; llevar 1 nota hace un `POST` y vacía `jevling.memory`; olvidar hace `DELETE id=eq.row-1`; cerrar sesión borra `jevling.auth*` y vuelve a «Se guarda solo en este navegador.». (2) Sin sesión no hay requests a Supabase; «Iniciar sesión con Google» va a `/auth/v1/authorize` con `provider=google`, `redirect_to` de la misma vista y PKCE `s256`. |
| e2e Chromium `settings`, `companion`, `account`, `plugins`, `voice` | PASS 32/32 en 9,8 min. |
| e2e Chromium `memory`, `listen` | PASS 3/3. |
| CI de `ca8caf5` (2026-11-02) | FAIL `verify`: `npm test` 563/564 en `enrollmentSession.test.tsx:88`, así que no corrió el e2e Chromium. PASS `phones` (Android e iPhone). |
| Corrección de esa prueba | La prueba esperaba al campo y miraba el foco de inmediato; si el commit supera la franja de 5 ms del programador de React, el efecto de foco llega después. Reproducido 3/3 con un commit y un programador retrasados (scripts del scratchpad, sin commitear); con la espera sobre el foco, PASS 3/3 y el archivo 9/9 con el mismo retraso. La app no cambia. |
| `vitest run` tras la corrección | PASS 564/564 dos veces con `--maxWorkers=4`. Con todos los workers de esta máquina, FAIL 4/4 `homeSession` (timeout de 5 s) y 2/4 `siteHeader`; solas pasan 5/5 y en el CI de `ca8caf5` también. Limitación local por carga, sin corregir. |

**Verificación real (2026-11-02):**
- RLS por REST con la clave publicable y sincronización entre dos clientes de una cuenta: PASS 9/9 con `scratchpad/memory-real.mjs`. Los 2 usuarios temporales se borraron.
- Google en un proyecto de Google Cloud propio, en modo «Prueba»: login en Chrome normal y en incógnito con la misma cuenta. «Llevar 1 nota a tu cuenta» en Chrome normal creó la fila bajo esa cuenta y «Olvidar todo» allí dejó la tabla en 0.
- Nota vista en incógnito: la confirmó el usuario («si funciona»); no la observé directamente. «Olvidar todo» no se usó en incógnito, y el borrado entre clientes lo cubre `memory-real.mjs`.
- Login en producción: sin probar, faltan las variables en Vercel y un despliegue. Solo los usuarios de prueba de Google pueden entrar mientras la app siga en «Prueba».

**Sin correr:**
- e2e Chromium completo en CI: sin correr. El usuario pidió el 2026-11-02 no usar CI/CD ni e2e, solo los unit tests afectados («tarda mucho»), y el run de `4773bfc` se canceló con `npm test` y `phones` en verde. Esto cambia la matriz Playwright de la fase 5.

## Fase 3 — implementación, 2026-11-01

- [x] **Estructura:** los plugins de servidor viven en `api/_plugins/` y no en `api/plugins/` como decía el plan, porque Vercel publica como función todo archivo de `api/` salvo las carpetas con `_`. Actualizados `plan.md` y `spec.md`.
- [x] `speechProtocol.ts`: `SPEECH_PLUGINS` (`github`, `whatsapp`), `isSpeechPlugin`.
- [x] `speechBlocks.ts`:
  - Bloques `links` (hasta 3; `githubUrl` acepta solo `https://github.com/…` sin credenciales ni puerto) y `whatsapp` (≤500, sin 7 o más dígitos).
  - Un `links` o `whatsapp` rechazado se descarta entero y nunca pasa a párrafo.
  - En el historial, «WhatsApp: …»; los enlaces se omiten.
- [x] `api/_plugins/registry.ts` y `github.ts`: 5 herramientas de solo lectura (repo, búsqueda, issues/PRs, commits y perfil).
  - `owner/name` también desde una URL; `GITHUB_TOKEN` opcional.
  - Errores para el modelo: `not_found`, `rate_limited` y `unavailable`.
  - Campos ≤140 caracteres y resultado ≤1500. Solo URLs de GitHub.
- [x] `api/talk.ts`:
  - Acepta `plugins`. Las herramientas solo se ofrecen con GitHub encendido.
  - Hasta 2 rondas de hasta 2 herramientas: evento `tool`, 10 s por ronda y 4 s por herramienta.
  - Reintento sin herramientas tras `tool_use_failed`, solo si aún no salió la frase.
  - `whatsapp` solo con su plugin. `links` solo con páginas vistas, y fuentes automáticas si el modelo no las escribió.
  - El prompt pauta cada plugin encendido o apagado. `vercel.json`: `talk` a 30 s.
- [x] Cliente:
  - `preferencesStore.plugins` (`jevling.plugins`, ambos encendidos) y `enabledPlugins`.
  - `speechClient` envía `plugins` y avisa `tool`. `useSpeechSession` expone `tool`, que se borra con la frase, y reinicia el plazo de 12 s al llegar `tool`.
  - Home muestra y anuncia «Buscando en GitHub…».
- [x] UI:
  - «Fuentes» con enlaces en otra pestaña.
  - Borrador de WhatsApp como cita con «Abrir en WhatsApp» (`wa.me/?text=`).
  - Ajustes › Plugins con dos interruptores y su explicación. Textos ES/EN.
- [x] `.env.example` (`GITHUB_TOKEN`) y `vite.config.ts` lo pasa al servidor de desarrollo.
- [x] Docs de estado actual: `docs/architecture.md` (`api/talk.ts`, `api/_plugins/`, bloques y cliente) y `docs/interaction.md` («Plugins en Home»).

**Verificación real.** El script `scratchpad/talk-real.mjs` (sin commitear) usa el `/api/talk` del proyecto con el `GROQ_API_KEY` de `.env` y GitHub sin token. Son 9 casos espaciados 20 s, y cada dato se contrasta con la API de GitHub.

| Corrida | Resultado |
|---|---|
| 1 (una ronda, `tool_choice: "none"` tras herramientas) | 6/9 con respuesta. Los datos de React (252 070), los issues de VS Code, los PRs de Deno y torvalds (12 repos) coinciden. **Fallos:** next.js; Groq cortó con `Tool choice is none, but model called a tool` al querer pedir los commits tras el repo. 2 de 3 de WhatsApp dieron error; la segunda vez salieron, pero no se pudo reproducir la causa (lo más probable, aún sin confirmar, es `tool_use_failed` por una herramienta inventada). El modelo no escribió `links` en 4 de 6. |
| Correcciones | Hasta 2 rondas. Reintento sin herramientas tras `tool_use_failed`. Fuentes automáticas desde las páginas vistas. Descripción de `github_commits` para «qué cambió». |
| 2 | 9/9 con respuesta y fuentes, y WhatsApp 3/3. **Errores del modelo:** inventó «Upgrade React a 18.2.0» (el commit dice «from `a703ca64…` to `e84e1492…`») y dijo que Deno no tiene PRs abiertos: pidió issues con `kind`. En WhatsApp decía «Te mando el mensaje». |
| Correcciones | `github_issues` y `github_pull_requests` separadas. Temperatura 0,2 tras herramientas. El prompt pide copiar títulos y cifras tal cual, no concluir sobre lo que no se consultó y no decir que Jev envía el mensaje. |
| Recomprobación | Deno: 20b acertó 2/2 y 120b 1/1. next.js: 20b siguió inventando la versión de React (2/2: «18.3.0» y «18.3.1»); 120b citó los identificadores exactos (1/1), con la misma latencia. |
| Quiz del modelo (2026-11-01) | **«120b solo tras GitHub»:** la charla sigue con `GROQ_MODEL` (20b) y las respuestas tras herramientas usan `GROQ_TOOL_MODEL` (por defecto `openai/gpt-oss-120b`). |
| 3 (final) | **GitHub 6/6 correctas con fuentes:** React 252 069 estrellas (API 252 069); next.js sin versiones inventadas; VS Code #345433/#345431/#345430 = API; búsqueda con 417 k / 310 k / 259 k estrellas (API 417 687 / 310 444 / 259 400); torvalds 12 repos; Deno #37115/#37113/#37112 = API. **WhatsApp 3/3**, ya sin decir que Jev lo envía; uno cambió «llego» por «llegué». Latencia con GitHub: 2,0–3,5 s en total y frase a los 1,8–3,1 s. Con WhatsApp: 0,5–0,7 s. |

| Comprobación | Resultado |
|---|---|
| `tsc -b`, `tsc -p tsconfig.tests.json --noEmit`, `eslint . --max-warnings=0` | PASS. |
| `vitest run --maxWorkers=1` | PASS: 57 archivos / 542 tests (antes 496). Nuevos: `apiTalk` (+14: validación de `plugins`, herramientas solo con GitHub, ronda completa con token, fuentes filtradas, enlaces sin consulta, herramienta inventada, WhatsApp según plugin, dos rondas con fuentes automáticas, `GROQ_TOOL_MODEL`, reintento tras `tool_use_failed` y sin reintento si ya salió la frase), `githubPlugin` (14), `pluginBlocks` (17: URLs válidas e inválidas, enlaces, borrador, cliente con `tool`, render de fuentes y `wa.me`, Ajustes › Plugins), `preferences` (+1) y `useCreatureBrain` (+1: aviso de herramienta). |
| `npm run build` | PASS: `index` 375,38 kB (gzip 120,95 kB), +3,6 kB. El bundle no contiene `api.github.com`, `GITHUB_TOKEN` ni nombres de modelos. |
| e2e Chromium de Home tras el último cambio: `plugins`, `settings`, `reply-blocks`, `choices`, `memory` y `voice` | PASS 36/36 en 7,2 min. |
| e2e `plugins.spec.ts` (nuevo, Chromium) | PASS 5/5: fuentes y borrador de WhatsApp en escritorio y móvil, claro y oscuro, dentro del ancho y con el `wa.me` exacto; apagar GitHub en Ajustes lo quita de los mensajes siguientes. |

**Límites:**
- GitHub sin token comparte 60 consultas por hora en todo el servidor; con `GITHUB_TOKEN` son 5000.
- Ningún modelo es infalible: las fuentes enlazadas siempre son reales, pero el texto lo escribe el modelo.
- El aviso «Buscando en GitHub…» se probó con Vitest; en e2e la respuesta simulada llega entera de una vez.

## Fase 2 — implementación, 2026-11-01

- [x] **Forma REST confirmada en la doc de Gemini:**
  - `POST https://generativelanguage.googleapis.com/v1beta/interactions` con `x-goog-api-key`, `stream: true`, `response_format` `audio/l16` a 24 kHz y `generation_config.speech_config: [{voice}]`.
  - El estilo va en `speech_metadata.style`.
  - El audio llega en eventos `step.delta` con `delta.type: "audio"` y `delta.data` en base64.
  - La doc no muestra el formato SSE exacto ni un evento final; el parser acepta líneas `data:` y `[DONE]`, y se confirma con la prueba real.
- [x] `speechProtocol.ts`: `GEMINI_KEY_HEADER`, `parseGeminiKey` (la misma forma que la de Groq) y `SPEECH_AUDIO_SAMPLE_RATE`.
- [x] `keyStore.ts` (nuevo): fábrica de clave por proveedor. `groqKeyStore` la usa sin cambiar sus exportaciones; `geminiKeyStore` (`jevling.geminiKey`) es la segunda.
- [x] `api/speak.ts`:
  - Valida `{text ≤120, language}` y la clave, y limita a 20 frases por minuto por IP.
  - Pide a Gemini el estilo de Jev por idioma (en español, latinoamericano neutro) con `Puck` y `gemini-3.8-flash-lite-tts` por defecto (`GEMINI_TTS_VOICE` y `GEMINI_TTS_MODEL`).
  - Reenvía el PCM en cuanto llega. Las cabeceras salen con el primer audio, así que 400/401/403 → 401, 429 → 429, sin audio en 6 s → 504 y lo demás → 502.
  - `vercel.json` le da 15 s.
- [x] `voiceEngine.beginSpeech` y `SpeechHandle` (`play`, `finish`, `fallback`):
  - La firma «¡Ui!» suena primero y el audio se encola en el canal de habla, así que silenciar, una acción, una frase nueva u ocultar la pestaña lo cortan.
  - Al silenciar a mitad de frase se avisa el final, para que Jev no quede atascado en la pose de habla.
  - `fallback` pitea la frase justo tras la firma.
- [x] `geminiVoice.ts` (nuevo):
  - `createPcmDecoder` une bytes partidos y `streamVoice` lee `/api/speak`.
  - `createGeminiVoice` usa los pitidos sin clave, sin sonido o con texto incompleto. Pasa a pitidos si el primer audio tarda más de 3 s o si falla antes de sonar, y si falla a mitad suena lo que llegó.
  - `voiceProblem` (`rejected` o `quota`) es lo que muestra Ajustes. `homeVoice` es la voz de Home; `useSpeechVoice` le pasa el idioma de la frase.
- [x] Ajustes: `KeySection` reutilizable (Groq y voz comparten el mismo marcado). La sección «Voz de Jev (Google)» tiene aviso fijo de privacidad del nivel gratuito, guía a `aistudio.google.com/apikey`, estado de clave rechazada o cuota agotada, y «Guardar/Borrar clave de voz». La ayuda de Groq ahora menciona la escucha. Textos ES/EN.
- [x] `.env.example`: `GEMINI_TTS_MODEL` y `GEMINI_TTS_VOICE`; `vite.config.ts` monta `/api/speak` y acepta escrituras binarias.
- [x] Docs de estado actual: `docs/architecture.md` (claves, `api/speak.ts` y voz con palabras) y `docs/interaction.md` (sección «Voz con palabras en Home»). `AGENTS.md`: regla de la clave de Google y del audio de voz. La regla «nunca palabras» de `design.md` se cambia en la fase 5, como dice el plan.
- [x] **Prueba real con Gemini (2026-11-01).** Clave en `GEMINI_API_KEY` de `.env` (ignorado por git). Scripts del scratchpad, sin commitear: `speak-real.mjs` carga el `/api/speak` del proyecto con Vite y guarda un WAV por frase; `transcribe-real.mjs` pasa esos WAV a 16 kHz con `wav.ts` y los manda al `/api/transcribe` del proyecto con el `GROQ_API_KEY` de `.env`.
  - El SSE real coincide con el parser: 200 en las 3 frases, sin cambios de código.
  - Primer audio en 1514–1969 ms y total de 2545–3110 ms para 3,76–5,4 s de audio, en 44–69 fragmentos: la voz se genera más rápido de lo que suena y el plan B de 3 s no salta.
  - Es voz clara: RMS 0,13–0,20; la frase 1 llega al pico 1,0 con 1 muestra recortada de 90 240.
  - **Whisper real (verificación de la fase 1):** las 3 frases se transcriben bien en 385–821 ms. Gemini pronuncia «Jev» y Whisper escribe «Jeff» en español y «Jev» en inglés; las variantes de `wakeWord` cubren los dos.
- [x] **Corrección encontrada con la prueba real (fase 1):** con `prompt: "Jev"`, Whisper inventó «Jev,» al inicio de una frase que no lo dice («Como te gusta la tecnología…»), así que Jev habría respondido a algo que no era para él. Comparado sobre el mismo audio, sin pista o con una frase de contexto no lo inventa y reconoce el nombre igual. `api/transcribe.ts` usa ahora «Jev es una criatura digital.» / «Jev is a digital creature.» según el idioma. Reejecutado: la frase 2 ya no se toma como dirigida a Jev y las otras dos sí. `apiTranscribe` pasa a 17 tests (+1, la pista en inglés).
- [x] **Escucha del usuario (2026-11-01):** «esta genial, pero siento que la voz en español es muy exagerada». Con `style-variants.mjs` (misma petición que `api/speak.ts`, solo cambia el estilo) se generaron tres versiones de las mismas frases con Puck: suave, media y neutra. En el quiz eligió **«Suave»** y el **mismo nivel en inglés**. `STYLE` queda así: criatura pequeña, cálida y curiosa, con un toque juguetón muy ligero, natural y tranquila, sin exagerar la entonación y sin reír (en español, latinoamericano neutro). La firma de pitidos no cambia. Se actualizaron `apiSpeak` (16 PASS), `spec.md`, `docs/architecture.md` y `docs/interaction.md`.
  - Muestras finales con el handler real: ES 1 y 2 → 200, primer audio en 1874–1971 ms, total de 2926–3261 ms y 4,8–5,32 s de audio. EN → 429, y al minuto 200: primer audio en 2020 ms y total de 3274 ms para 4,2 s.
- **Cuota gratuita de Gemini observada:** tras 3 o 4 frases seguidas, la siguiente da 429 (tres veces en la sesión) y vuelve a funcionar al minuto. Una vez dio 503 (Google saturado). En los dos casos, `/api/speak` responde 429 o 502 y Jev usa sus pitidos: en una conversación rápida algunas respuestas sonarán con pitidos, y Ajustes lo explica. Los límites exactos solo se ven en el AI Studio de cada visitante.
- [x] Aprobación del usuario (2026-11-01, «esta bien, sigue con la fase 3»).
- **Latencia de punta a punta (sin medir):** se suman unos 0,7 s de silencio de cierre, ~0,6 s de Whisper, la frase de Groq y ~1,7 s hasta el primer audio de Gemini, unos 3,5–4 s en total. La firma de pitidos suena en cuanto llega la frase. Se mide en la fase 5 contra la meta de p50 ≤ 3 s.

| Comprobación | Resultado |
|---|---|
| `tsc -b`, `tsc -p tsconfig.tests.json --noEmit`, `eslint . --max-warnings=0` | PASS. |
| `vitest run --maxWorkers=1` | PASS: 55 archivos / 496 tests (antes 454). Nuevos: `apiSpeak` (16: cuerpo hacia Gemini con Puck, estilo y formato, idioma y variables, evento partido, clave, 5 cuerpos inválidos, método, 400/403/429/500, sin audio y red), `geminiVoice` (15: decodificador PCM, `streamVoice`, voz con firma y fin, 3 casos de pitidos, 401/429/502 con aviso, aviso que se limpia, lentitud de 3 s, corte a mitad, cancelación y reemplazo, audio de una frase cortada), `voiceEngine` (+6: firma y cola, corte, reemplazo, silencio a mitad, plan B tras la firma, sin sonido), `settingsPanel` (+3), `speechVoice` (+1) y `groqKeyStore` (+1). |
| `npm run build` | PASS: `index` 371,76 kB (gzip 119,82 kB), +5,1 kB; `SettingsPanel` 6,08 kB. El bundle no contiene `generativelanguage`, `x-goog-api-key`, `api.groq.com` ni `SUPABASE_SECRET`; solo el nombre de la cabecera `x-gemini-api-key`. |
| e2e Chromium `settings.spec.ts` y `voice.spec.ts` (nuevo) | PASS 15/15: matriz ES/EN × claro/oscuro × escritorio/móvil con la sección de voz (aviso visible, guardar y estado, dentro del ancho), y en Home una frase con clave de Google va a `/api/speak` con `{text, language}` y la cabecera; sin clave no se llama. |

## Fase 1 — entrega para revisión, 2026-11-01

- [x] `src/creature/listen/` (nuevo):
  - `listenProtocol.ts` (hoja compartida con la API): 16 kHz, frases de 0,4 a 15 s, tope del WAV y del texto.
  - `wav.ts`: remuestreo por promedio en streaming (48 o 44,1 kHz → 16 kHz), WAV de 16 bits y base64.
  - `voiceActivity.ts`: detector por energía con ruido de fondo adaptable (baja rápido y sube lento), umbral con histéresis, 300 ms previos, 700 ms de silencio de cierre, 200 ms de cola y corte a los 15 s.
  - `wakeWord.ts`: «Jev» y sus variantes («Yev», «Jeff», «Chev», «Shev», «Jeb») en cualquier parte de la frase. Quita el nombre y limpia la puntuación. «Oye, Jev» solo llama a Jev y «Hola, Jev» lo saluda.
  - `micCapture.ts`: `getUserMedia` con cancelación de eco, supresión de ruido y control de ganancia, en un `AudioContext` propio creado dentro del gesto y con un `AudioWorklet` desde un Blob. Al apagar libera pistas y contexto.
  - `transcribeClient.ts`: envía la frase y convierte 401 en `SpeechKeyRequiredError` y 429 en `TranscribeQuotaError`.
  - `useHandsFree.ts`: turnos (descarta lo oído mientras Jev decide o habla, antes de transcribir), cola de una frase, ventana de 8 s tras hablar o tras oír solo «Jev», y apagado con la vista, la pestaña, la inscripción o una clave rechazada.
- [x] `api/transcribe.ts`: valida el WAV (RIFF, PCM 16 bits, mono, 16 kHz, de 0,4 a 15 s) y el idioma, rechaza campos desconocidos, exige la clave y limita a 30 frases por minuto por IP. Reenvía a Groq `whisper-large-v3-turbo` con `language`, `prompt: "Jev"` y `verbose_json`, y quita los segmentos con `no_speech_prob ≥ 0,6`. Pasa 401 y 429; lo demás es 502. Sin logs. El audio viaja en base64 dentro de JSON (`vite.config.ts` acepta hasta 700 kB en esa ruta; `vercel.json` le da 10 s).
- [x] `useCreatureBrain.submitContext(message, { direct })`: lo dicho por nombre va directo al habla con TALK local, por el mismo camino que `choices`. `useSpeechSession` expone `speaking`, de la frase hablada hasta que la voz termina.
- [x] Home: botón «Manos libres» (`aria-pressed`) en el campo, con anillo que respira al escuchar y late al oír (fijo con movimiento reducido), y una línea bajo el campo con el estado, «Oí: …» (`<q>`) o el aviso. Solo los avisos y lo oído se anuncian. Textos ES/EN.
- [x] Docs de estado actual: `docs/architecture.md` (`creature/listen/`, `api/transcribe.ts` y camino `direct`) y `docs/interaction.md` (sección «Manos libres en Home»). `AGENTS.md`: la clave Groq viaja también a `/api/transcribe` y el audio no se guarda ni se registra. `design.md` queda para la fase 5, como dice el plan.
- [ ] Prueba real con micrófono y Groq (pendiente: no hay clave Groq en este equipo y la prueba necesita voz real).
- [x] Aprobación del usuario (2026-11-01, «continua con la fase dos»).

| Comprobación | Resultado |
|---|---|
| `tsc -b`, `tsc -p tsconfig.tests.json --noEmit`, `eslint . --max-warnings=0` | PASS. |
| `vitest run --maxWorkers=1` | PASS: 53 archivos / 454 tests (antes 400). Nuevos: `listenAudio` (10: remuestreo, WAV, base64 y detector: frase, estado, clic corto, corte a 15 s y ruido de fondo), `wakeWord` (15), `apiTranscribe` (16: reenvío y campos, segmentos de silencio, clave, 8 cuerpos inválidos, método, 401/429/500 y red), `handsFree` (10: nombre, sin nombre, Jev ocupado, ventana tras hablar, solo «Jev», clave rechazada, cuota, sin clave, permiso denegado, apagado) y casos en `homeControls` (2) y `useCreatureBrain` (1). |
| `npm run build` | PASS: `index` 366,64 kB (gzip 118,15 kB), +10,1 kB frente a 356,57 kB; la escucha va en el bundle de Home. |
| `listen.spec.ts` (Chromium con micrófono simulado: `--use-file-for-fake-audio-capture` con un WAV sintético, pasando por el procesado real de Chrome) | PASS 2/2: «Jev, ¿qué carreras puedo estudiar?» llega a `/api/talk` como «¿qué carreras puedo estudiar?», sin decisión con ese texto, con «Oí:» y la frase hablada. Al apagar no se transcribe nada más. Frases sin «Jev» no producen respuesta. |
| e2e de Home en Chromium: `reply`, `reply-blocks`, `memory`, `choices`, `companion`, `routes`, `reduced-motion` y `listen` | 42 PASS y 2 FAIL en la tanda (`reply.spec.ts:129` y `:156`). El reporte no guardó el detalle y la fecha del sistema cambió durante la corrida. Reejecutadas solas: PASS. `reply.spec.ts` completo otra vez: PASS 9/9 (`:129` tardó 1,0 min de 1,5 permitidos, por la carga de Rive). |
| e2e `navigation`, `settings` y `enrollment` en Chromium | Incompleto: Claude Code detuvo la tanda por falta de memoria del sistema. 2 PASS (inscripción: abre el formulario y no lo abre con una intención negada) y 4 caídas del navegador (`Target crashed`, `code=3221225794`), sin fallos de aserción. No se reintentó. Queda pendiente, igual que el proyecto `android` y la suite completa; el CI los corre al hacer push. |

## Preparación — 2026-10-31

- **Quiz:** Whisper en Groq; manos libres con «Jev»; Gemini TTS con la clave del visitante; estilo de criatura juguetona; GitHub público de solo lectura; «Enviar a WhatsApp»; memoria en base de datos con login de Google; aprobar y vaciar el SDD previo.
- **Revisado:**
  - `api/talk.ts`: prompt, SSE, sin herramientas y timeout de 8 s.
  - `api/enroll.ts`: Supabase por REST con clave secreta.
  - `.env.example`, `design.md` (voz «nunca palabras», persistencia, Ajustes y Bob) y `docs/architecture.md`.
- **Hallazgos:**
  - Groq TTS solo tiene inglés y árabe ([doc](https://console.groq.com/docs/text-to-speech)).
  - Gemini TTS tiene nivel gratuito ([precios](https://ai.google.dev/gemini-api/docs/pricing)), habla español, transmite PCM de 24 kHz en streaming y acepta indicaciones de estilo ([doc](https://ai.google.dev/gemini-api/docs/speech-generation)). Sus límites gratuitos se ven solo en AI Studio y se aplican por proyecto.
