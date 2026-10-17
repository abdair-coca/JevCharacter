# Fase 5 — integración, accesibilidad, rendimiento y voz de Jev

Evidencia del 2026-10-16/17 sobre el build de producción servido con `vite preview` en `127.0.0.1:5174`. Chromium 153 de Playwright. Viewport, touch, movimiento reducido, visibilidad y throttling son emulados. `/api/*` se responde con fixtures: no se llamó a proveedores reales.

## Cómo repetir

```powershell
npm run build
npm run preview -- --host 127.0.0.1 --port 5174 --strictPort
node .dev/evidence/phase-5/verify.mjs static
node .dev/evidence/phase-5/verify.mjs sound
node .dev/evidence/phase-5/verify.mjs navigation
node .dev/evidence/phase-5/verify.mjs keyboard
node .dev/evidence/phase-5/verify.mjs fallback
node .dev/evidence/phase-5/verify.mjs matrix <desktop|mobile>-<light|dark>-<es|en>
node .dev/evidence/phase-5/verify.mjs perf
```

Cada bloque abre su propio navegador, informa el progreso con tiempos, tiene un plazo máximo y escribe `results-<bloque>[-variante].json`.

## Resultado final

| Bloque | Checks | Qué demuestra |
|---|---|---|
| `static` | 7 | Rewrites de Vercel solo para `/features` y `/about`; nada intercepta `/api/*`. Solo `decide`/`talk` son funciones de servidor. Sin claves ni `process.env` en el bundle. El cliente solo llama a `/api/decide` y `/api/talk`. En storage solo quedan preferencias, sonido y personalidad; `jevling.context` es una clave heredada que solo se borra. |
| `sound` | 15 | Sin audio antes del primer gesto; el saludo inicial es silencioso. El primer gesto crea un `AudioContext` en marcha. Pensar y Saludo suenan con sus motivos. La respuesta «¿Quieres jugar conmigo hoy?» da 8 pitidos (uno por sílaba) y el último sube de 640 a 1121 Hz. Silenciar persiste tras recargar y bloquea el audio. Activar desde la cabecera suena en ese mismo clic. La pestaña oculta suspende el audio. Historia está en silencio, incluida la revelación de Jev. «Habla» en Capacidades entona su frase. |
| `navigation` | 14 | Foco en el h1 al navegar, título por ruta. Inicio oculto, inerte y suspendido, sin API ni sonido. Borrador y canvas conservados. Atrás restaura Historia a 1600 px; adelante; la recarga conserva ruta y posición. El idioma conserva la ruta y el capítulo de Capacidades. Ruta desconocida → «Página no encontrada». |
| `keyboard` | 16 | Orden de tabulación: salto, marca, tres rutas, sonido, tema, ES, EN. Foco visible en todos. El salto lleva al título y luego al input. Mensaje solo con teclado. HUD con `aria-expanded` y Escape. Escenas y revelación por teclado. Enlaces «Ver proyecto» con `_blank` + `noopener`. Movimiento reducido: Historia visualmente quieta (capturas idénticas a 1,5 s, también tras cambiar de escena) y pasos estáticos en Capacidades. |
| `fallback` | 6 | Sin Rive: Inicio oculta el cargador y sigue decidiendo; Capacidades ofrece reintentar; Historia sigue legible. Con `/api` caída: instinto local. Solo se registraron los 7 errores inyectados. |
| `matrix` ×8 | 192 | Escritorio/móvil × claro/oscuro × ES/EN × tres rutas: HTTP 200 directo, idioma/tema, un h1 y `main`, ruta actual marcada, sin overflow horizontal, todos los controles con nombre, objetivos ≥24×24 px y contraste AA del texto medible. |
| `perf` | 2 | LCP y ritmo de frames en tres rutas y dos perfiles con GPU real, más pesos del bundle (abajo). |

Total: 252 checks y 31 capturas, todos sobre el build final.

## Hallazgos corregidos durante la fase

- **Parada de tabulación sin nombre:** `whileTap` de Motion volvía enfocable (`tabindex="0"`) el envoltorio del botón Enviar. Ahora tiene `tabIndex={-1}`.
- **Movimiento en la lectura estática:** `curiousTiti.webp` es un WebP animado y se movía con movimiento reducido. `StillImage` muestra su primer fotograma en un canvas, cargado al acercarse a la vista.
- **Texto de ruta desconocida:** decía «Esta vista se construirá en una próxima fase». Ahora dice que la dirección no lleva a ninguna vista.
- **Restauración de scroll:** antes, atrás/adelante siempre volvían arriba. Ahora cada entrada del historial guarda y restaura su posición.

## Rendimiento (corrida final)

GPU: `ANGLE (Intel UHD Graphics, Direct3D11)`, mediante `--use-angle=d3d11`. Chromium headless usa por defecto SwiftShader (software); una primera corrida así daba en Inicio p95 de 266 ms, un artefacto que no es representativo.

| Perfil | Ruta | LCP | Frames p95 | >33 ms | En caliente p95 / >33 ms |
|---|---|---|---|---|---|
| Escritorio 1440×900 | `/` | 600 ms | 33,4 ms | 10,6 % | — |
| Escritorio | `/features` | 236 ms | 16,7 ms | 0,4 % | 33,3 ms / 0,4 % |
| Escritorio | `/about` | 216 ms | 50 ms | 9,2 % | 16,8 ms / 1,8 % |
| Móvil 390×844, CPU ×4, 1,6 Mbps/150 ms | `/` | 1176 ms | 16,7 ms | 0 % | — |
| Móvil | `/features` | 1972 ms | 16,7 ms | 0,5 % | 16,7 ms / 0 % |
| Móvil | `/about` | 1788 ms | 16,8 ms | 0,9 % | 16,8 ms / 0,9 % |

- Inicio en reposo mide 4 s; Capacidades e Historia, un scroll programático de 6000 px. La pasada en frío de Historia incluye la carga de Rive a mitad del scroll, como está aprobado. Cinco sondas dirigidas mostraron un tirón único de 157–430 ms entre montar Jev y tenerlo listo.
- En una corrida intermedia, la pasada en frío de Historia en escritorio tuvo un hueco de unos 15 s. No se reprodujo en 5 sondas posteriores (3 con GPU, 2 por software) ni en la corrida final; queda como valor atípico no explicado.
- Inicio en escritorio, con el canvas grande de Rive (escala 2,1), tiene alrededor de un 10 % de frames por encima de 33 ms en esta GPU integrada.
- Con movimiento reducido, Historia mantiene el bucle vacío `_rafBugFix` de ScrollTrigger (unos 60 frames/s sin dibujar) mientras existen sus disparadores de sección. Se mide, no se exige.

Bundle (kB / gzip): shell `index` 358,81 / 113,85 (+3,1 gzip frente a la línea base de la fase, por la voz y la restauración de scroll); Character 212,8 / 59,86; scrollRuntime 133,83 / 49,87; motionFeatures 85,59 / 28,12; Features 63,64 / 21,01; About 24,82 / 9,87; CSS común 44,32 / 9,21. Sin dependencias nuevas.

## Límites

- Todo es emulación de Chromium: no se probó en móvil físico, Safari/iOS, lector de pantalla real ni teclado virtual. El presupuesto «60 fps en móvil de gama media» no puede afirmarse desde aquí.
- El contraste se calcula sobre colores declarados. El texto sobre imágenes, canvas o en animación queda fuera de la medida (en Historia, por ejemplo, 26 elementos sin medir frente a 8 medidos en escritorio claro ES).
- El audio se verificó por instrumentación de Web Audio (contextos, osciladores, frecuencias y tiempos), no escuchando una salida real. La calidad sonora está pendiente de tu revisión de oído.
- `vite preview` responde 200 a cualquier ruta (fallback SPA). En Vercel, solo `/`, `/features` y `/about` llegan a la app; una ruta desconocida dará el 404 de la plataforma.
