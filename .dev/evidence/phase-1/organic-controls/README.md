# Input y HUD orgánicos

Revisión solicitada: estética orgánica como Jev, animación al interactuar y respiración suave también en reposo. [Estado y aprobación](../../../task.md). Esta revisión conserva el personaje y la composición anterior; la entrega visual espera revisión del usuario.

## Capturas finales

| Vista | Reposo | Foco | HUD desplegado | Decidiendo |
|---|---|---|---|---|
| Escritorio claro | [Ver](desktop-light-idle-es.png) | [Ver](desktop-light-focus-es.png) | [Ver](desktop-light-expanded-en.png) | [Ver](desktop-light-deciding-es.png) |
| Escritorio oscuro | [Ver](desktop-dark-idle-es.png) | [Ver](desktop-dark-focus-es.png) | [Ver](desktop-dark-expanded-en.png) | [Ver](desktop-dark-deciding-es.png) |
| Móvil claro | [Ver](mobile-light-idle-es.png) | [Ver](mobile-light-focus-es.png) | [Ver](mobile-light-expanded-en.png) | [Ver](mobile-light-deciding-es.png) |
| Móvil oscuro | [Ver](mobile-dark-idle-es.png) | [Ver](mobile-dark-focus-es.png) | [Ver](mobile-dark-expanded-en.png) | [Ver](mobile-dark-deciding-es.png) |

## Qué se comprobó

[Resultados](results.json): **100 checks**, cero errores y cuatro advertencias WebGL de captura. El harness mide además la animación real del navegador: 4.800 ms en reposo, 1.600 ms durante decisión y un pico de opacidad dependiente de la atención recibida. Movimiento reducido en vivo y pausa por evento de visibilidad quedan estáticos. El test unitario comprueba offscreen/cleanup y fallback sin observer.

- Input centrado independientemente del HUD y HUD arriba/derecha en móvil.
- Foco estable, envío/reemplazo, rechazo de blanco y contexto conservado al cambiar idioma.
- Confianza/probabilidades reales, panel cerrado fuera del árbol accesible, expansión por teclado.
- Texto secundario mínimo 4,79:1 y bordes mínimo 3,60:1 en ambos temas.
- Un canvas Rive, preferencias sin remontaje, navegación, reflow 320px y viewport de teclado simulado 390×420.

## Reproducir

Con el build preview corriendo en `http://127.0.0.1:5174`:

```powershell
node ".dev/evidence/phase-1/organic-controls/verify.mjs"
```

Emulación Chromium, 1440×900 y 390×844. API de decisión interceptada con latencia/respuesta fija; no se consultaron proveedores. Los estados EN/ES pertenecen a la misma sesión. `diagnostic-failure.png`, si existe, documenta una corrida fallida previa y no forma parte de la matriz final. Estas pruebas no sustituyen revisión visual, teclado físico ni mediciones de rendimiento.
