# Inscripción visual UATF — entrega para revisión

En Inicio, escribir **«quiero inscribirme»** o **“I'd like to register”** abre el formulario de Ingeniería Informática · UATF. Solo es una demostración visual, con nombre/celular efímeros y confirmación local.

## Verificación

Build de producción servido con `npm run preview -- --host 127.0.0.1 --port 4175`. Cada comando ejecuta un bloque corto independiente de Chromium headless:

```powershell
node ".dev/evidence/enrollment/verify.mjs" desktop dark es
node ".dev/evidence/enrollment/verify.mjs" mobile light en
node ".dev/evidence/enrollment/verify.mjs" mobile light en reduced
node ".dev/evidence/enrollment/verify.mjs" mobile dark es fallback
```

| Casos aprobados | Checks | Capturas |
|---|---:|---:|
| Desktop 1440×900, light/dark × es/en, motion (4 casos) | 84 | 12 |
| Mobile 390×844, light/dark × es/en, motion (4 casos) | 96 | 16 |
| Desktop dark/es reduced | 22 | 3 |
| Mobile light/en reduced | 25 | 4 |
| Narrow 320×568 light/es motion | 24 | 4 |
| Short 390×420 dark/en motion | 24 | 4 |
| Mobile dark/es fallback, asset 404 | 23 | 3 |
| **Total: 13 bloques** | **298** | **46** |

Los JSON se escriben únicamente al completar el bloque. Contienen checks, capturas y errores. Todos los reportes aprobados tienen cero errores inesperados y cero llamadas API. En modo fallback se inyecta un 404 del asset, con mensajes de red esperados. Datos de prueba ficticios: «Estudiante de Prueba», `+591 7000-0000`.

Se comprueban campos simultáneos, errores/foco, preservación al cambiar preferencias, confirmación, mismo Character, composición normal restaurada, limpieza por cierre/Escape/navegación y ausencia de valores en storage. En móvil se simula la contracción de `visualViewport` para comprobar que el botón sigue alcanzable sobre el teclado. Las capturas `keyboard` incluyen el espacio vacío que ocuparía ese teclado: no son fotos de un dispositivo físico.

## Capturas de referencia

- [Entrada desktop, oscuro ES](desktop-dark-es-motion-open.png)
- [Entrada desktop, claro EN](desktop-light-en-motion-open.png)
- [Formulario móvil claro ES](mobile-light-es-motion-open.png)
- [Errores móvil oscuro ES](mobile-dark-es-motion-validation.png)
- [Teclado simulado](mobile-dark-es-motion-keyboard.png)
- [Celebración móvil con Flower](mobile-dark-es-motion-confirmed.png)
- [Confirmación con fallo de Rive](mobile-dark-es-fallback-confirmed.png)
- [Movimiento reducido](mobile-light-en-reduced-confirmed.png)

También pasaron cuatro typechecks por proyecto, ESLint, build y Vitest: **26 archivos / 177 tests**. Detalle y límites en [task](../../task.md).

Tras la matriz se ajustó únicamente el destino del enlace «Ir al contenido»: `#page-title` corresponde al título visible del formulario y se restaura al cerrar. Build, lint, typecheck de tests, 6 tests dirigidos y un recorrido Playwright adicional de foco/Escape pasaron después del ajuste. Las capturas conservan la misma composición visual.

No se verificaron móvil físico, Safari/iOS, proveedores reales ni LCP/FPS. El incremento observado de Home JS+CSS es aproximadamente 4,59 kB gzip respecto al pulido anterior, sin dependencias nuevas. La aprobación visual del usuario permanece pendiente.
