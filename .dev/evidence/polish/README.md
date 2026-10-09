# Pulido de Inicio, Features e Historia

Entrega para revisión visual de fase 4. Capturas y resultados producidos con Chromium headless contra `http://127.0.0.1:4175`, servido mediante `npm run preview -- --host 127.0.0.1 --port 4175` después de `npm run build`.

## Reproducir

```powershell
node ".dev/evidence/polish/verify.mjs" home desktop light es
node ".dev/evidence/polish/verify.mjs" features mobile dark en
node ".dev/evidence/polish/verify.mjs" story narrow light es reduced
node ".dev/evidence/polish/lifecycle.mjs"
```

Cada bloque abre/cierra su navegador, imprime cada check y guarda un JSON solo si termina correctamente. Usar bloques cortos. Las preferencias se guardan en JSON y el harness comprueba el tema/idioma realmente aplicados.

## Casos aprobados

| Ruta | Variantes (`tamaño tema idioma modo`) | Checks | Capturas |
|---|---|---:|---:|
| Home | `desktop light es motion`, `desktop dark en motion`, `mobile dark en motion`, `mobile light es reduced`, `short dark en motion` | 55 | 10 |
| Features | `desktop light es motion`, `desktop dark en motion`, `mobile dark en motion`, `mobile light es motion`, `narrow light es reduced`, `short dark en motion` | 78 | 10 |
| Story | `desktop light es motion`, `desktop dark en motion`, `mobile dark en motion`, `mobile light es motion`, `narrow light es reduced`, `short dark en motion` | 74 | 18 |
| Lifecycle | Dos recorridos Home → Features → Story → Home, alternando reduced motion en Story | 12 | — |

Total: **219 checks y 38 capturas**. Desktop: 1440×900; mobile: 390×844; narrow: 320×568; short: 390×420. Cero errores de aplicación en los reportes aprobados. APIs interceptadas; Features/Story y la navegación registraron cero solicitudes.

La corrección final afecta únicamente al min-height del input bajo 720 px de alto. Su caso `home-short-dark-en-motion` se repitió tras recompilar; las capturas principales son anteriores a ese delta CSS que no afecta a sus tamaños. No se presenta la matriz como benchmark de rendimiento ni como validación de móvil físico.

## Capturas de referencia

- [Inicio, escritorio claro ES](home-desktop-light-es-motion-rest.png)
- [Inicio, móvil oscuro EN](home-mobile-dark-en-motion-rest.png)
- [HUD, pantalla baja](home-short-dark-en-motion-hud.png)
- [Features, móvil ES](features-mobile-light-es-motion-decides.png)
- [Story: Bob, escritorio ES](story-desktop-light-es-motion-bob.png)
- [Deformación al cursor](story-desktop-light-es-motion-pointer.png)
- [Estrella, móvil ES](story-mobile-light-es-motion-star.png)
- [Revelación, móvil ES](story-mobile-light-es-motion-revealed.png)
- [Story estático, 320 px](story-narrow-light-es-reduced-static.png)

Cada JSON contiene los checks y nombres exactos de sus capturas. El resultado visual requiere revisión del usuario. Historia conserva escenario oscuro en ambos temas; el tema global sigue afectando a la cabecera.
