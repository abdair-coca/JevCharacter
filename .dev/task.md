# Tarea: Jev escucha, habla, usa plugins y recuerda en la nube

Handoff vivo de la feature. **Antes de continuar, leer `spec.md`, `plan.md`, este archivo y `../design.md`.**

## Retoma aquí

- **Fase activa:** fase 1 (Escuchar), implementada el 2026-11-01; **entregada para revisión**.
- **Aprobaciones:** spec, plan, cambio de reglas y `@supabase/supabase-js` aprobados el 2026-10-31 («Aprobado, empieza fase 1»). Propuestas: se mantienen la ventana de 8 s y los interruptores de plugins; se descartan el apagado tras 5 min y «Borrar mi cuenta».
- **Siguiente acción exacta:** prueba real del usuario con micrófono y clave Groq en `npm run dev` y aprobación de la fase 1. Después, fase 2 (Voz) según `plan.md`.
- **Estado del código:** fase 1 commiteada. Sin deploy ni push. El SDD anterior («Jev compañero con memoria») se aprobó y se vació en `fb6b966`.

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
- [ ] Aprobación del usuario.

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
