# Recorte de halo y de partículas — 2026-10-12

Antes/después del ajuste visual que quita el recorte de Jev (Inicio, Capacidades, Historia) y sangra el canvas de partículas de Historia.

- `before/`: estado previo al cambio. `after/`: estado tras el cambio. Capturas de 1× en escritorio 1440×900 y móvil 390×844, tema claro, ES.
- `report.json`: medidas de cada captura (overflow horizontal, cajas de canvas, errores de consola). Ambos estados: overflow 0, sin errores.
- `capture.mjs`: genera las capturas y el informe (`node capture.mjs <dir>`).
- `edges.mjs`: alfa en el borde del bitmap del canvas de partículas, en 10 posiciones de scroll, claro/oscuro, escritorio/móvil. Resultado tras el cambio: 0 píxeles con alfa en el borde en las 40 mediciones. Indica que la nube ya no se corta en el canvas.
- `deform.mjs`: el cursor deforma la nube (≈0,14 con el puntero encima) y vuelve a 0 al salir, en escritorio y móvil.

Comprobaciones: typecheck (`tsc -b`), typecheck de pruebas, lint y Vitest (29 archivos / 187 tests) PASS.

Limitación: en Features móvil, el cuerpo de Jev ya tapaba parte del título y del párrafo del capítulo «Reacciona» antes del cambio. Tras el cambio, el halo difuminado también pasa por detrás de ese texto. El texto sigue encima y legible, pero el contraste baja en esa zona. Pendiente de decisión visual.
