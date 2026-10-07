# Jev sin máscara radial — 2026-10-07

Delta solicitado: retirar únicamente el desvanecimiento ovalado del canvas. La exportación `prove2.riv` ya tiene fondo transparente.

Se retiran `mask-image`, `-webkit-mask-image` y su token sin consumidores. Se conserva el token de proporción usado para dimensionar Home, la escala `1.9`, los contenedores y el runtime Rive.

## Verificación

Playwright contra `http://127.0.0.1:5173/`, Chromium, en bloques cortos mediante herramientas de navegador:

| Comprobación | Resultado |
|---|---|
| Reproducción previa | `maskImage` y `webkitMaskImage`: gradiente elíptico `46% 43%`, opaco hasta `58%` y transparente en `100%`. |
| Home escritorio 1440×900, claro/oscuro | PASS: Ghost real seleccionado mediante Diagnóstico; ambas máscaras `none`, un canvas, escala `1.9`, sin overflow horizontal. |
| Home móvil 390×844, claro/oscuro | PASS: Flower real seleccionado mediante Diagnóstico; ambas máscaras `none`, escala `1.9`, sin overflow horizontal. |
| Features, ambos viewports y temas | PASS: instancia de presentación cargada; ambas máscaras `none`, un canvas en esa instancia, escala `1.9`, sin overflow horizontal. |
| Movimiento reducido en Features/Home y vuelta a Inicio | PASS: ambas máscaras `none`; Home sigue cargada y con escala `1.9`. |
| Geometría antes/después, Home 1440×900 | Idéntica: Jev `x=459.5375`, `y=178.55`, `520.925×520.925`; input `x=508.8`, `y=737`, `406.4×32` (px CSS). |
| Consola | Cero errores en la sesión de reproducción/matriz; seis mensajes informativos. |
| `npm run build` | PASS (`tsc -b` y Vite); CSS común 37,59 kB / gzip 8,08; JS sin cambios de peso respecto a fase 3. |
| `git diff --check` | PASS; avisos de normalización LF/CRLF de Windows. |

La comprobación CSS en navegador funciona como regresión específica: exigir `maskImage === 'none'` y `webkitMaskImage === 'none'` falla con la versión previa. No se añadieron tests unitarios para CSS ni se repitieron Vitest/ESLint/typecheck de tests por este delta exclusivamente visual. El build verifica los proyectos app/Node/API.

### Capturas

- Home/Ghost: [escritorio claro](home-desktop-light-ghost.png), [escritorio oscuro](home-desktop-dark-ghost.png).
- Home/Flower: [móvil claro](home-mobile-light-flower.png), [móvil oscuro](home-mobile-dark-flower.png).
- Features: [escritorio claro](features-desktop-light.png), [escritorio oscuro](features-desktop-dark.png), [móvil claro](features-mobile-light.png), [móvil oscuro](features-mobile-dark.png).

Se inspeccionaron las capturas de Home/Ghost en claro, Home/Flower móvil oscuro y Features escritorio claro. El halo propio de Rive sigue visible; no se recreó fondo ni alpha.

**Límites:** viewport/movimiento reducido emulados, sin móvil físico/Safari ni medición de rendimiento. Se probaron controles locales, no proveedores IA. La evidencia histórica de fases 1–3 conserva sus expectativas y capturas originales con máscara; no se sustituye ni representa aprobación de fase 3.
