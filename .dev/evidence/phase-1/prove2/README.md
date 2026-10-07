# Prueba de prove2 y aumento de tamaño

La Home consume `/rive/prove2.riv` directamente. El usuario confirmó que funciona bien y pidió un aumento ligero: escala CSS `1.9`, antes `1.72` (+10,5 %). Input y HUD mantienen su composición. La exportación actual ya no presenta el disco oscuro de la anterior en tema claro; conserva el halo del personaje.

## Capturas actuales

| Pantalla | Claro | Oscuro |
|---|---|---|
| Escritorio 1440×900 | [Ver](desktop-light.png) | [Ver](desktop-dark.png) |
| Móvil 390×844 | [Ver](mobile-light.png) | [Ver](mobile-dark.png) |

Transformaciones: [estrella](morph-star.png), [cuadrado](morph-square.png), [triángulo](morph-triangle.png). [Habla con SSE simulado](talk-caption.png).

## Verificación

[Resultados](results.json): 36 checks, 19 capturas, cero errores de aplicación y cuatro advertencias del controlador WebGL durante capturas. Se ejercitaron los once botones de diagnóstico y tres transformaciones. Los checks de diagnóstico confirman la interacción; sus capturas son evidencia visual, no una validación automática de toda la animación interna.

Build PASS. Emulación Chromium con APIs interceptadas; no se llamó a proveedores ni se midió rendimiento físico. El archivo original no se editó ni se copió a documentación. Las capturas se regeneraron con la exportación actual y escala `1.9`.

Para reproducir, con el build preview en `http://127.0.0.1:5174`:

```powershell
node ".dev/evidence/phase-1/prove2/verify.mjs"
```

La aprobación global de fase 1 sigue registrada por separado en [task.md](../../../task.md).
