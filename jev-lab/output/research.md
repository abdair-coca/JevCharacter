# Investigación previa: Mini JEV con Rive CLI y RML

La ruta disponible es Rive CLI oficial 1.3.0 para Windows x64, con una escena RML sin scripts: grupos `Node`, cuerpo `Shape`/`Rectangle`, ojos `Shape`/`Ellipse` y una única `LinearAnimation` `happy_bounce`. La CLI permite compilar, verificar, inspeccionar, capturar PNG y previsualizar con recarga automática sin iniciar sesión. No se necesita cambiar la aplicación existente ni sus dependencias.

## Evidencia del entorno y del personaje

- Fecha de consulta: 2026-10-03. `rive` no estaba en PATH; se descargó únicamente dentro de `jev-lab/output/tools`.
- Manifiesto oficial `https://releases.rive.app/cli/latest/manifest.json`: versión `1.3.0`; archivo Windows `v1.3.0/rive-windows-x64.tar.gz`.
- SHA-256 del archivo descargado y comprobado: `f83ac81a28c53668bd4193579dc636f0286bdd044cf6b3f7393a199764f5aeef`.
- `output/tools/rive.exe --version`: `rive 1.3.0`; `--help`, `docs` y `schema` ejecutados correctamente.
- `src/assets/hero.png` fue observado con `view_image`: contiene las capas del scaffold, no representa a JEV.
- El agente principal observó directamente el build local existente servido sin modificarlo: JEV es un orbe oscuro de aproximadamente 200 px, cuerpo redondeado casi negro, halo violeta/magenta y luz creciente especialmente arriba a la derecha. Dos ojos blancos, pequeños, verticales y redondeados, cercanos al centro. Sin boca ni extremidades. Impresión tranquila y minimalista.
- `src/components/Character.tsx` usa `@rive-app/react-webgl2`, `/rive/prove1.riv`, `State Machine 1`, `ViewModel1`, `state` y `trigState`, con autoplay y autoBind. `shapeType` también tiene binding. El asset `prove1.riv` existe aunque está ignorado por Git.
- `docs/rive-model.md` documenta un modelo mucho más complejo (morphs, estados, seguimiento). Sus descripciones provienen de un informe externo y el propio documento limita lo que puede afirmarse. No se trasladará esa complejidad.

## Comandos reales disponibles

Ejecutar desde la raíz del repositorio; el proyecto del experimento será `jev-lab/rive`.

```powershell
$r = './jev-lab/output/tools/rive.exe'
& $r --version
& $r docs format
& $r docs skeleton
& $r docs drawing
& $r docs transforms
& $r docs easing
& $r docs state-machines
& $r docs project/rive-yaml
& $r schema Rectangle --animatable
& $r schema Node --animatable
& $r schema LinearAnimation --all --json
& $r ./jev-lab/rive --verify --format=json
& $r inspect ./jev-lab/rive --summary
& $r inspect ./jev-lab/rive --json
& $r ./jev-lab/rive --once --format=json
& $r ./jev-lab/rive --screenshot=./jev-lab/output/neutral.png
& $r ./jev-lab/rive --screenshot=./jev-lab/output/apex.png --advance=300ms
& $r ./jev-lab/rive --screenshot=./jev-lab/output/final.png --advance=750ms
& $r ./jev-lab/rive --fit=contain
```

`--verify` no escribe `.riv`; `--once` sí. `inspect --summary` está documentado por `rive docs` aunque el help abreviado de 1.3.0 no lista ese flag. `--advance` acepta frames a 60 fps o unidades `s`/`ms`; `--frame` fue retirado. No existe un subcomando `build`; el directorio es el comando. La CLI no abre ni convierte un `.riv` existente: solo proyectos, `.rev` de editor o archivos remotos con cuenta. No se intentó cambiar los assets actuales.

El preview es el comando sin modo de build: abre una ventana y vigila el directorio, recompilando y recargando al guardar. La ventana termina al cerrarla; `p` en su terminal pausa/reanuda y `screenshot <ruta>` captura. Para repetir una animación oneShot basta reiniciar el preview; un futuro click puede añadirse con un listener y ViewModel, sin crear más animaciones. No se agrega integración web de producción.

## Sintaxis confirmada en documentación y schema empaquetados

Cada archivo RML tiene raíz `<Rive version="1" kind="fragment">`. Los IDs son pares numéricos únicos en TODO el proyecto (`0:12`); nunca nombres, `0:0` ni ceros a la izquierda. Varias fuentes `.rml` en cualquier subcarpeta se compilan juntas en orden de ruta. Los IDs permiten referencias entre archivos. No se encontró una API oficial de `<Include>`, macros, variables o constantes RML; no inventarlas. La división del cuerpo/animación mediante referencias explícitas se someterá a una prueba local antes de recomendarla como verificada.

| Concepto | Elemento/propiedad real | propertyKey | Unidad |
|---|---|---:|---|
| Transform x/y | `Node.x`, `Node.y` | 13 / 14 | px locales |
| Rotación | `Node.rotation` | 15 | radianes |
| Escala | `Node.scaleX`, `Node.scaleY` | 16 / 17 | factor |
| Ancho/alto corporal | `Rectangle.width`, `Rectangle.height` | 20 / 21 | px |
| Redondez | `Rectangle.cornerRadiusTL` | 31 | px; `linkCornerRadius=true` enlaza cuatro esquinas |
| Ojos mirar | grupo `Node` x/y | 13 / 14 | px locales |
| Tamaño de ojos | `Node.scaleX`, `scaleY` | 16 / 17 | factor |
| Parpadeo | grupo separado `Node.scaleY` | 17 | factor visual; concepto blink = 1 - scaleY |

Un `Node` no dibuja; transforma a sus hijos. `Shape` contiene geometría y `Fill` con `SolidColor`. El primer hermano dibuja encima del siguiente (orden inverso a SVG/HTML). Dejar `Artboard.originX/originY` en 0: cambiarlos a 0.5 cambia el espacio de coordenadas y puede sacar el personaje del frame.

Las claves se expresan con `KeyedObject.objectId` y `KeyedProperty.propertyKey`. Los doubles usan `KeyFrameDouble`; no usar ese tipo para color/bool/uint. Una `LinearAnimation` usa `fps=60`, `duration` en frames y `loopValue=oneShot` para mantener la pose final. Propuesta 45 frames = 750 ms, dentro del objetivo. Cada pista tendrá un frame 0 y frame 45 con valores neutrales exactamente iguales, además de claves de anticipación, despegue, aterrizaje y settle.

Easing real:

```xml
<KeyedProperty propertyKey="14">
  <KeyFrameDouble frame="0" value="0" interpolationType="cubic">
    <CubicEaseInterpolator x1="0.42" y1="0" x2="0.58" y2="1"/>
  </KeyFrameDouble>
  <KeyFrameDouble frame="8" value="8" interpolationType="linear"/>
</KeyedProperty>
```

El interpolador pertenece a la clave INICIAL del segmento. Omitir interpolationType produce hold/saltos. `CubicInterpolator` es abstracto: escribir `CubicEaseInterpolator`. Curvas con controles y entre 0 y 1 permanecen dentro del rango de claves, útil para asegurar límites. No usar elastic ni cubicValue en esta prueba: pueden exceder límites entre claves.

La reproducción automática requiere `Artboard.defaultStateMachineId`, `StateMachine`, `StateMachineLayer`, `EntryState` con `StateTransition stateToId`, y `AnimationState animationId` que apunte a happy_bounce. Las states no aceptan `name`. AnyState/ExitState son requeridos por runtime, la CLI los agrega si faltan; escribirlos con IDs y posiciones evita cambios automáticos de identidad. `LayoutComponentStyle` enlazado por `styleId` evita artboard-without-style. Escribir IDs explícitos en todos los elementos evita el write-back automático de IDs.

## Constantes y validación: decisión mínima

Centralizar anatomía, IDs, neutrales y límites en un JSON pequeño dentro de `rive/character`. Los validadores pueden leer ese contrato y comparar fuente RML e inspect. Si el generador necesita sustituir valores centralizados, debe producir RML real completo y claramente documentar que el ensamblado es código propio; no presentarlo como una función nativa de RML. La alternativa más pequeña es RML explícito, contrato central de validación y ninguna macro.

`--verify` y `inspect` cubren cuestiones diferentes. Ninguno verifica píxeles, límites anatómicos ni que un KeyFrameDouble se haya usado sobre la propiedad correcta. Inspeccionar escena/animación/pistas, validar todas las claves, muestrear easing y geometría, comparar pose final con neutral y renderizar varios tiempos. Una sola imagen neutral no demuestra animación.

## Límites actuales

- CLI se publicó como technical preview: no asumir estabilidad de APIs futuras; fijar la versión usada.
- Crear, preview, verify, once e imágenes funcionan sin cuenta. `.rev`, push y publish requieren login. No se usa ninguno de estos modos.
- Scripts locales sin firmar se rechazan en runtimes web/CDN. Esta prueba usa exclusivamente RML y por ello evita esa dependencia.
- `inspect` contiene árbol resuelto, no una lectura de transformaciones animadas a tiempo t. `--data-dump` lee ViewModels, no automáticamente todas las transformaciones internas. Los límites y residuales deben comprobarse con un validador de pistas/interpoladores y evidencia de renders; no afirmar que inspect prueba por sí solo el comportamiento final.
- El preview oficial con hot reload es la vía local adecuada. El código de producción permanece aislado.

## Fuentes primarias

- [Descargas oficiales](https://www.rive.app/downloads).
- [Getting Started, repositorio oficial](https://github.com/rive-app/rive-docs/blob/main/cli/getting-started.mdx): instalación, permisos y flujo local.
- [Referencia de comandos, repositorio oficial](https://github.com/rive-app/rive-docs/blob/main/cli/reference/commands.mdx): modos, avance temporal, capturas e inspect.
- [Configuración del proyecto](https://github.com/rive-app/rive-docs/blob/main/cli/reference/project-config.mdx).
- [Anuncio oficial del technical preview](https://community.rive.app/c/announcements/introducing-the-rive-cli-and-rml).
- Evidencia autoritativa de la versión instalada: `output/tools/docs/{format,skeleton,drawing,transforms,easing,state-machines}.md`, `output/tools/docs/project/rive-yaml.md` y salida real de `rive schema`.

## Prueba mínima ejecutada: resultado y ruta definitiva

Se crearon únicamente fuentes desechables bajo `output/tools/probe`, después de redactar este registro. Resultado decisivo: no basta con repartir un Node y una LinearAnimation como raíces con `parentId`/`artboardId`. Aunque `inspect --summary` devuelve `problems: []`, `--verify` falla porque dichos objetos no se exportan: `KeyedObject objectId="0:20" targets a Node that is not exported.` El esquema admite esas referencias pero la exportación exige el árbol bajo el artboard.

Ruta verificada: `character/body.rml` y `animations/happy_bounce.rml` son fragmentos XML reales con raíz Rive; un ensamblador propio importa sus hijos al Artboard de `main.rml`, elimina las referencias redundantes parentId/artboardId, y guarda una escena completa. `rive.yaml` contiene `exclude: [character, animations]` (en forma de lista YAML) para que la CLI compile solo el resultado `main.rml`. Esto es ensamblado local explícito, no sintaxis nativa Include. El writer puede escoger JSON central + plantilla real XML y regenerar main; debe documentar exactamente el flujo y verificar que la salida generada coincide con sus fuentes.

Comandos ejecutados sobre el probe ensamblado:

```powershell
& ./jev-lab/output/tools/rive.exe ./jev-lab/output/tools/probe --verify --format=json
& ./jev-lab/output/tools/rive.exe inspect ./jev-lab/output/tools/probe --summary
& ./jev-lab/output/tools/rive.exe ./jev-lab/output/tools/probe --once --format=json
& ./jev-lab/output/tools/rive.exe ./jev-lab/output/tools/probe --screenshot=./jev-lab/output/tools/probe/probe.png --advance=300ms
```

Resultados reales: verify exit 0, `success: true`, `problems: []`, cero errores y advertencias. Inspect exit 0, un Artboard `Probe`, un Node, un Rectangle, una LinearAnimation, una KeyedProperty y tres KeyFrameDouble, dos CubicEaseInterpolator. Build exit 0: `probe.riv` 292 bytes. Screenshot exit 0: PNG 320×320; inspección visual confirma rectángulo violeta redondeado visible sobre fondo oscuro a la altura del salto. El probe NO es Mini JEV final: prueba únicamente sintaxis, ensamblado, reproducción y rendering disponibles.

Configuración definitiva sugerida: proyecto en `jev-lab/rive`, output.dir `../output/build`, `main: MiniJev`; excluir carpetas `character` y `animations` del scanner si contienen los fragmentos para ensamblar. Así todos los productos y fuentes permanecen dentro de jev-lab. El hot reload nativo vigila main.rml; si un agente modifica fragmentos, primero ejecuta el ensamblador para actualizar main.

No se comprobaron límites anatómicos ni calidad de happy_bounce en este probe. Es responsabilidad de implementación y su validador. Investigación terminada: hay una ruta reproducible con CLI/RML real, sin blocker externo.
