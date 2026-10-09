/** Local, conservative entry point. Form values never pass through this function. */
export function isEnrollmentIntent(message: string): boolean {
  const text = message.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase()
    .replace(/[’']/g, "").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  if (/\b(no|nunca|tampoco|not|never|dont|cannot|cant)\b/.test(text)) return false;
  const career = /\b(informatica|computer (engineering|science)|uatf|tomas frias)\b/;
  if (/\b(otra|otro|other|github|facebook|instagram|gmail|medicina|derecho|medicine|law)\b/.test(text)) return false;
  // Explicit destinations must be this career; bare requests remain discoverable.
  const destination = /\b(?:inscribirme|registrarme|matricularme|inscribeme|registrame|register|enroll|sign up|sign me up)\s+(?:en|para|at|for|in|on|to)\s+(.+)$/.exec(text)?.[1];
  if (destination && !career.test(destination) && !/^(la carrera|esta carrera|the course|this course)$/.test(destination)) return false;
  return /\b(quiero|quisiera|deseo|me gustaria)\s+(inscribirme|registrarme|matricularme)\b/.test(text)
    || /\b(inscribeme|registrame)\b/.test(text)
    || (/\b(quiero|quisiera|me gustaria)\s+estudiar\b/.test(text) && career.test(text))
    || /\bme interesa (la carrera|informatica)\b/.test(text)
    || /\b(i want to|id like to|i would like to|can i)\s+(enroll|register|sign up)\b/.test(text)
    || /\bsign me up\b/.test(text)
    || (/\b(i want to study|im interested in|i am interested in)\b/.test(text) && career.test(text));
}
