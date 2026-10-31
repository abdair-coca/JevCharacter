# Tarea: Jev escucha, habla, usa plugins y recuerda en la nube

Handoff vivo de la feature. **Antes de continuar, leer `spec.md`, `plan.md`, este archivo y `../design.md`.**

## Retoma aquí

- **Fase activa:** fase 1 (Escuchar), en curso.
- **Aprobaciones:** spec, plan, cambio de reglas y `@supabase/supabase-js` aprobados el 2026-10-31 («Aprobado, empieza fase 1»). Propuestas: se mantienen la ventana de 8 s y los interruptores de plugins; se descartan el apagado tras 5 min y «Borrar mi cuenta».
- **Siguiente acción exacta:** implementar la fase 1 según `plan.md` y entregarla para revisión.
- **Estado del código:** sin cambios. El SDD anterior («Jev compañero con memoria») se aprobó y se vació en `fb6b966`.

## Preparación — 2026-10-31

- **Quiz:** Whisper en Groq; manos libres con «Jev»; Gemini TTS con la clave del visitante; estilo de criatura juguetona; GitHub público de solo lectura; «Enviar a WhatsApp»; memoria en base de datos con login de Google; aprobar y vaciar el SDD previo.
- **Revisado:**
  - `api/talk.ts`: prompt, SSE, sin herramientas y timeout de 8 s.
  - `api/enroll.ts`: Supabase por REST con clave secreta.
  - `.env.example`, `design.md` (voz «nunca palabras», persistencia, Ajustes y Bob) y `docs/architecture.md`.
- **Hallazgos:**
  - Groq TTS solo tiene inglés y árabe ([doc](https://console.groq.com/docs/text-to-speech)).
  - Gemini TTS tiene nivel gratuito ([precios](https://ai.google.dev/gemini-api/docs/pricing)), habla español, transmite PCM de 24 kHz en streaming y acepta indicaciones de estilo ([doc](https://ai.google.dev/gemini-api/docs/speech-generation)). Sus límites gratuitos se ven solo en AI Studio y se aplican por proyecto.
