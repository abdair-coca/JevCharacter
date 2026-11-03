# Plan: Jev escucha, habla, usa plugins y recuerda en la nube

- **Base:** [spec.md](spec.md).
- **Contratos de UI/animación:** [design.md](../design.md).
- **Estado:** aprobado el 2026-10-31. Fase 1 en curso.

## Dependencias y orden

1. **Fase 1 — Escuchar:** micrófono manos libres, detector de voz, `/api/transcribe` y la palabra «Jev».
2. **Fase 2 — Voz:** `/api/speak` con Gemini TTS, clave en Ajustes, estilo, reproducción y plan B. Depende de la fase 1 para el turno de habla en manos libres.
3. **Fase 3 — Plugins:** registro de plugins, GitHub con herramientas, bloques `links` y `whatsapp` y Ajustes › Plugins.
4. **Fase 4 — Memoria en la nube:** Supabase Auth con Google, tabla `memories`, sincronización e importación.
5. **Fase 5 — Cierre:** reglas y textos, listón de calidad con 20 casos reales y unit tests afectados.

Cada fase se entrega para revisión y se detiene hasta su aprobación.

## Fase 1 — Jev escucha

- `src/creature/listen/` (nuevo):
  - `voiceActivity.ts` (puro): detector por energía con umbral adaptable al ruido, inicio y fin de frase, pre-roll, mínimos y máximos.
  - `wav.ts` (puro): PCM → WAV mono de 16 kHz.
  - `wakeWord.ts` (puro): normaliza, encuentra «Jev» y sus variantes y devuelve el resto de la frase.
  - `micCapture.ts`: `getUserMedia` y un `AudioWorklet` que entrega PCM; se libera al apagar.
  - `useHandsFree.ts`: estado `off | requesting | listening | transcribing | denied`, apagado por pestaña oculta, salida de Home o clave borrada; ignorar lo oído mientras Jev piensa o habla, y ventana de 8 s sin «Jev» al terminar de hablar.
- `api/transcribe.ts`: valida el WAV (tamaño ≤ ~600 kB, ≤15 s, cabecera RIFF), idioma y clave; aplica límite de frecuencia; reenvía multipart a Groq `audio/transcriptions` (`whisper-large-v3-turbo`, `language`, `prompt: "Jev"`). Al empezar se confirma cómo entrega Vercel un cuerpo binario; si no lo entrega, el audio viaja en base64 dentro de JSON.
- `useCreatureBrain`: nueva entrada `submitSpoken(text)` que arranca el habla con una decisión TALK local, el mismo camino que la conversación abierta de `choices`.
- UI: botón de micrófono e indicador en `ContextWhisper`, ES/EN y avisos de permiso denegado, sin micrófono y sin clave.
- Tests:
  - Vitest de detector, WAV, palabra «Jev», API (validación, 401, reenvío) y `useHandsFree` (turnos y apagados).
  - Playwright con micrófono simulado en Chromium (`--use-fake-device-for-media-stream` y un WAV de prueba) y `/api/transcribe` simulado.
- **Verificación real:** frases ES/EN en dev con Groq, ruido de fondo sin «Jev» y tiempo de transcripción.

## Fase 2 — Jev habla

- **Antes de codificar:** confirmar en la doc de Gemini la forma REST exacta (streaming, `speech_metadata`, `response_format`) y elegir la voz oyendo 2 o 3 candidatas con el usuario.
- `api/speak.ts`: valida `{text ≤120, language}` y `X-Gemini-Api-Key`; llama a Gemini con `fetch` y estilo fijo; reenvía PCM en streaming; 401, 429 y 502 se distinguen para el plan B. Sin logs de texto ni clave.
- `src/creature/brain/geminiKeyStore.ts`: copia del patrón de `groqKeyStore` (`jevling.geminiKey`, `parseGeminiKey`).
- `src/creature/voice/speechAudio.ts`: reproduce PCM por fragmentos en el bus de voz de `appAudio`, con cancelación, firma de pitidos previa y aviso de fin.
- `useSpeechVoice`: elige voz Gemini o pitidos; la animación termina con el audio; con timeout de 3 s pasa a pitidos.
- `SettingsPanel`: sección «Voz de Jev» con guía, estado y aviso de privacidad de Google.
- Tests:
  - Vitest de API, key store, reproducción con streaming falso, plan B (401, 429 y timeout) y fin de animación.
  - Playwright de Ajustes (matriz) y respuesta con `/api/speak` simulado.
- **Verificación real:** respuestas ES/EN con clave real, latencia de voz y escucha de la voz elegida.

## Fase 3 — Plugins

- `api/_plugins/registry.ts` (tipos de plugin, esquemas de herramientas y límites) y `api/_plugins/github.ts` (con `_`: Vercel publica como función todo archivo de `api/` salvo las carpetas que empiezan por `_`) (5 herramientas, recorte de resultados, timeout y `GITHUB_TOKEN` opcional).
- `api/talk.ts`: el cuerpo acepta `plugins`; añade `tools` a la llamada en streaming; ejecuta `tool_calls` (≤2) y abre la segunda llamada; emite `tool`; revisa `UPSTREAM_TIMEOUT_MS` y `MAX_COMPLETION_TOKENS` con medición; actualiza el prompt (cuándo usar GitHub y cuándo redactar para WhatsApp).
- `speechBlocks.ts`: bloques `links` (solo URLs vistas en los resultados) y `whatsapp` (≤500, sin 7 o más dígitos).
- `ReplyBlocks.tsx` y `reply.css`: enlaces de fuente y tarjeta de WhatsApp; Home muestra «Buscando en GitHub…» con el evento `tool`.
- `src/features/settings`: sección Plugins y `pluginStore` (`jevling.plugins`).
- Tests:
  - Vitest de cada herramienta con `fetch` simulado, ciclo de `tool_calls`, URLs no vistas rechazadas, bloque `whatsapp` y plugins apagados.
  - Playwright de enlaces, WhatsApp y Ajustes.
- **Verificación real:** 6 preguntas de GitHub contrastadas con la API y 3 pedidos de WhatsApp.

## Fase 4 — Memoria en la nube

- **Antes de codificar:** el usuario configura Google OAuth en Supabase (`@supabase/supabase-js` ya está aprobada).
- `supabase/migrations/…_memories.sql`: tabla, CHECK de longitud y dígitos, disparador de 40 notas y políticas RLS de select, insert y delete propias.
- `src/lib/supabaseClient.ts` (carga diferida) y `src/features/account/` (estado de sesión, login y logout).
- `memoryStore.ts`: dos fuentes tras la misma interfaz (navegador y cuenta), cambio de fuente al iniciar o cerrar sesión e importación ofrecida.
- `MemoryPanel.tsx`: texto según la fuente, login e importación.
- Tests:
  - Vitest de la fuente de cuenta (cliente simulado), importación y caída sin conexión.
  - Prueba SQL/RLS contra el proyecto: sin sesión no se lee nada y un usuario no lee notas ajenas.
  - Playwright con sesión simulada.
- **Verificación real:** dos navegadores con la misma cuenta.

## Fase 5 — Cierre

- Reglas y textos: `AGENTS.md` (claves, persistencia en servidor y Supabase en el navegador), `design.md` (voz con palabras, escucha, plugins, persistencia y nota de Bob), `docs/architecture.md`, `docs/interaction.md`, `docs/README.md`, `README.md` (variables y pasos de configuración) y la copia de Historia ES/EN.
- `.env.example`: `GEMINI_TTS_MODEL`, `GITHUB_TOKEN`, `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY`.
- Listón de calidad: los 20 casos reales con resultados en `task.md`.
- Unit tests afectados, sin CI/CD ni e2e (cambio pedido por el usuario el 2026-11-02), y capturas en `.dev/evidence/assistant/`. Se comprueba que `dist/` no contiene secretos.

## Riesgos

- **Privacidad del micrófono:** manos libres envía a Groq cada frase que oye, aunque no diga «Jev». Se mitiga con un indicador siempre visible, apagado automático, frases sin «Jev» descartadas sin mostrarse y audio nunca guardado.
- **Cuota de Groq:** Whisper y el chat comparten la clave del visitante (chat: 8000 TPM). Cada frase oída consume cuota de Whisper, así que se medirá en la fase 1 y se descartarán frases muy cortas o de poca energía.
- **Eco:** Jev podría oírse a sí mismo. Se mitiga con cancelación de eco e ignorando lo oído mientras piensa y habla.
- **Detector de voz por energía:** puede fallar con ruido. Si falla, se propone `@ricky0123/vad-web` con aprobación.
- **Gemini TTS:** la cuota gratuita es del proyecto de Google de cada visitante y sus límites no son públicos. El nivel gratuito usa el texto para mejorar productos de Google. Se mitiga con el plan B de pitidos y un aviso fijo.
- **Herramientas con `gpt-oss-20b`:** puede elegir mal la herramienta o no usarla. Se mitiga con un prompt con ejemplos, y `GROQ_MODEL` permite probar `gpt-oss-120b`. Se mide en la fase 3.
- **Tiempo de función en Vercel:** dos llamadas a Groq y una a GitHub en el mismo pedido. Se miden los tiempos y se ajustan el timeout y `maxDuration`.
- **Autenticación:** errores en las URLs de retorno o en la RLS exponen datos. Se mitiga con migración revisada, prueba RLS real y ningún secreto en el navegador.
- **Muchos archivos:** las cinco fases tocan API, cerebro, voz, Ajustes, Home y Supabase. Cada fase se revisa por separado.
- **Carácter de Jev:** pasa de criatura de pitidos a hablar con palabras. La firma de pitidos y el estilo juguetón conservan su identidad, y Features mantiene los pitidos.
