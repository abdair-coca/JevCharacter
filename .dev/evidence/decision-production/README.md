# Decisión remota real en producción

**Verificada en [jev-bot-sigma.vercel.app](https://jev-bot-sigma.vercel.app):** Home envía «Hola Jev» y recibe HTTP 200, `source: "jev"`, acción `reaction / HELLO`; el HUD muestra origen remoto. [Resultado completo](results.json) y [captura](remote-decision.png).

## Despliegue

`vercel deploy --prod --yes`, build remoto `npm run build`, sin prebuilt. Proyecto `abdairs-projects/jev-bot`, deploy final `dpl_Dwo7XoNHxPNgMUAwCBXAVHbCV6p9`, [URL inmutable](https://jev-2j38bemo6-abdairs-projects.vercel.app), Ready. Inspector: funciones `api/decide` (35,46 kB) y `api/talk` (12,39 kB). Variables Production existentes; no se leyeron ni registraron sus valores.

La corrección de runtime del artefacto se guardó en `e8b6b3a`. El registro posterior conserva documentación y evidencia, sin cambiar el runtime desplegado.

## Verificación

```powershell
npm exec -- tsc -p api/tsconfig.json --noEmit false --noEmitOnError --outDir node_modules/.tmp/jev-node-runtime
node ".dev/evidence/decision-production/import-smoke.mjs"
node ".dev/evidence/decision-production/verify.mjs" "https://jev-bot-sigma.vercel.app"
```

- Node nativo importa/ejecuta los dos handlers compilados y obtiene 405 para GET, sin llamar a un proveedor.
- 10 checks de producción: tres rutas HTTP 200, ambas APIs validan body vacío con 400, decisión real de Home, contrato de acción/confianza, HUD remoto, un Character y cero errores.
- Typechecks app/Node/API/tests y ESLint PASS. Tests dirigidos de APIs/scheduler/morph: 4 archivos / 39 tests PASS.
- Build remoto y empaquetado de funciones PASS sin errores TypeScript.

El primer deploy falló al arrancar Node ESM por imports sin extensión. Se reprodujo con HTTP 500 y logs `ERR_MODULE_NOT_FOUND`; la corrección añade `.js` y configuración API NodeNext junto al entrypoint, manteniendo el root como referencias. El smoke final se ejecutó después de eliminar cuatro `.js` generados por un emit de prueba fallido y volver a desplegar desde fuentes TS limpias. Detalle e incidencias en [task](../../task.md).

Chromium headless de escritorio, 1440×900/ES. Una decisión real por corrida; sin fixture. No se prueba en esta entrega una respuesta de habla Groq ni móvil físico/Safari/LCP/FPS. La [publicación estática previa](../deployment/README.md) se conserva como antecedente; sus aserciones de APIs ausentes no aplican a la producción actual.
