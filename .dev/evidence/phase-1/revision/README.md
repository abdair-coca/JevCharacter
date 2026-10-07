# Revisión de Home — input, HUD y preferencias

Se restauró la integración CSS indicada por el usuario: `prove1.riv`, un canvas directo, máscara original y escala `1.72`. Input centrado debajo de Jev, HUD a la derecha en escritorio y arriba a la derecha en móvil. Tema con botón sol/luna y ES/EN con indicador animado. La aprobación visual sigue pendiente en [task.md](../../../task.md).

**Límite visible:** `prove1.riv` conserva su fondo interno; la máscara no lo elimina en tema claro. No hay procesamiento JS de píxeles ni una segunda capa de canvas. El usuario eligió mantener ese asset tras discutir esta limitación.

| Pantalla | Claro ES | Oscuro ES | Claro EN | Oscuro EN |
|---|---|---|---|---|
| 1440×900 | [Ver](desktop-light-es.png) | [Ver](desktop-dark-es.png) | [Ver](desktop-light-en.png) | [Ver](desktop-dark-en.png) |
| 390×844 | [Ver](mobile-light-es.png) | [Ver](mobile-dark-es.png) | [Ver](mobile-light-en.png) | [Ver](mobile-dark-en.png) |

## Comprobaciones

[Resultados](results.json): 76 checks, cero errores, cuatro avisos WebGL al capturar. Emulación Chromium, API interceptada; no es prueba de móvil físico, servicios reales ni rendimiento. Typechecks por proyecto, ESLint, 46 tests y build pasan; comandos completos en el ledger.

```powershell
npm run build
npm run preview -- --host 127.0.0.1 --port 5174
```

En otra terminal desde la raíz:

```powershell
node ".dev/evidence/phase-1/revision/verify.mjs"
```

Las imágenes `before-light.png` y `mask-trial.png` son ensayos descartados de diagnóstico, no el resultado final. El harness anterior de fase 1 se conserva como antecedente: esperaba un selector de sistema/claro/oscuro que esta revisión reemplaza.
