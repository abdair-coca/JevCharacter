# Storytelling de partículas — evidencia anterior al pulido

El [agregado conservado](particles-results.json), fechado el 2026-10-09, registra **11 bloques, 219 checks y 26 capturas**, sin errores inesperados. Es un antecedente local; la revisión posterior de composición, inercia y deformación al cursor está en [pulido](../polish/README.md).

## Capturas

- [Bob, escritorio ES](particles-desktop-light-es-bob.png)
- [TitiEdu, escritorio ES](particles-desktop-light-es-titi.png)
- [Machine learning, escritorio ES](particles-desktop-light-es-learning.png)
- [Estrella, móvil ES](particles-mobile-light-es-star.png)
- [Revelación de Jev, móvil EN](particles-mobile-dark-en-reveal.png)
- [Movimiento reducido](particles-reduced-static.png) y [fallo de imagen](particles-fallback-static.png).

## Reproducir

Con el preview de producción local en `127.0.0.1:5174`, ejecutar bloques individuales:

```powershell
node ".dev/evidence/phase-4/verify-particles.mjs" desktop-light-es images
node ".dev/evidence/phase-4/verify-particles.mjs" mobile-dark-en finale
```

Estos comandos corresponden al runtime anterior con controles de diapositivas; para el runtime actual usar el harness de [pulido](../polish/README.md). Consultar [task](../../task.md) para el estado de revisión. Este resumen se reconstruyó desde el reporte existente al preparar los microcommits; no representa una ejecución nueva del harness ni validación del despliegue. Chromium de escritorio con viewport/touch/reduced motion emulados; sin móvil físico, Safari, LCP ni proveedores reales.
