# Ficha técnica del modelo Rive `prove1`

Referencia para planificar una integración más interactiva. Resume el informe de inspección que compartió el usuario desde otro proyecto; no reemplaza la verificación en el editor Rive ni afirma que sus hallazgos de integración pertenezcan a este repositorio.

## Identidad y alcance

- Ruta usada por el checkout actual: `public/rive/prove1.riv` (referenciada como `/rive/prove1.riv` en `src/components/Character.tsx`).
- El archivo local coincide con el informe: 78.380 bytes; SHA-256 `98AA68170540D448DEAED0DB6FA57C11B062CEBF9036DC1CFADA4376254A8DAF`.
- Binario Rive; dos artboards, dos ViewModels y sin audio, según el informe.
- Es un asset creativo propiedad del usuario. Esta documentación no incluye ni transforma sus bytes; no agregar el `.riv` a commits, exports ni despliegues sin autorización explícita para ese destino.
- Los detalles del binario siguientes proceden del informe externo. El hash confirma identidad del archivo, no verifica independientemente cada nombre o comportamiento interno.

## Artboards y animaciones

El informe identifica `ScriptingLab` (1600 × 1200, 60 FPS; `State Machine 1`) como artboard usado y `Logo` (1330 × 330, 30 FPS) como no usado por el componente descrito.

| Artboard | Animación | Duración | Modo |
|---|---|---:|---|
| ScriptingLab | `Idle` | 540 | Loop |
| ScriptingLab | `TalkBC` | 60 | Loop |
| ScriptingLab | `Ghost` | 120 | Una ejecución |
| ScriptingLab | `Flower` | 60 | Una ejecución |
| ScriptingLab | `S-Cloud` | 60 | Una ejecución |
| ScriptingLab | `MorphTest` | 60 | Una ejecución |
| ScriptingLab | `S-Triangle` | 60 | Una ejecución |
| ScriptingLab | `S-Square` | 60 | Una ejecución |
| ScriptingLab | `TalkC` | 60 | Loop |
| ScriptingLab | `TalkB` | 60 | Loop |
| ScriptingLab | `TalkA` | 60 | Loop |
| ScriptingLab | `No` | 120 | Una ejecución |
| ScriptingLab | `Yes` | 120 | Una ejecución |
| ScriptingLab | `Think` | 60 | Loop |
| ScriptingLab | `Hello` | 60 | Loop |
| ScriptingLab | `Base` | 60 | Una ejecución |
| ScriptingLab | `Bump` | 60 | Una ejecución |
| ScriptingLab | `NoBuimp` | 60 | Una ejecución |
| ScriptingLab | `Follow Off` | 60 | Una ejecución |
| ScriptingLab | `Follow On` | 60 | Una ejecución |
| ScriptingLab | `Blink` | 180 | Loop |
| ScriptingLab | `Background` | 540 | Loop |
| Logo | `Jump` | 60 | Una ejecución |
| Logo | `Idle-Over` | 300 | Loop |
| Logo | `Idle` | 300 | Loop |
| Logo | `Blink` | 300 | Loop |

`NoBuimp` parece un typo dentro del asset; no corregir ni depender de ese nombre sin confirmarlo visualmente.

## ViewModels y contrato de estado

### `ViewModel1` / instancia `Instance`

| Propiedad exacta | Tipo | Inicial |
|---|---|---:|
| `shapeAsymetry` | Number | 0 |
| `shapeTaper` | Number | 0 |
| `shapeBulge` | Number | 0 |
| `shapeRoundness` | Number | 0 |
| `shapePressed` | Number | 0 |
| `shapeType` | Number | 0 |
| `shapeHeight` | Number | 100 |
| `shapeWidth` | Number | 100 |
| `state` | Enum | `Base` |
| `trigState` | Trigger | — |
| `xScaleboard` | Number | 0 |
| `yScaleboard` | Number | 0 |
| `xFollow` | Number | 0 |
| `yFollow` | Number | 0 |
| `followBoo` | Boolean | `false` |

El enum `characterState` reportado, en orden exacto, es:

```text
think, yes, no, talkb, talkc, square, triangle, talkbc,
idle, MorphState, Cloud, Talk, Flower, Ghost, Hello, Base
```

Las mayúsculas importan: los valores son `talkb`, `talkc`, `talkbc`, no `talkB`, `talkC`, `talkBC`.

### `VMLogo` / instancia `Instance`

| Propiedad | Tipo | Inicial |
|---|---|---|
| `LogoTrig` | Trigger | — |
| `LogoBool` | Boolean | `false` |

## Morphing y formas

El informe encontró referencias a deformación procedural de paths (`WidthPathEffect`, `activeShape`, `fromShape`, `targetShape`, `morphTime`, `morphActive`) y operaciones geométricas (`Vector`, `Path`, `moveTo`, `lineTo`, `close`, `sqrt`, `floor`). Por tanto, las variables parecen controlar algo más que una lista fija de animaciones; validar implementación y límites con el editor antes de diseñar controles.

Mapa de `shapeType` propuesto por el informe, aún pendiente de prueba visual:

| Valor | Forma reportada |
|---:|---|
| 0 | Forma original animada |
| 1 | Cuadrado redondeado |
| 2 | Diamante |
| 3 | Triángulo |
| 4 | Blob orgánico |

Preservar `shapeType = 0` como ruta para la forma original; no sustituirla por una aproximación procedural.

## Relación con este repositorio

En el checkout actual, `Character.tsx` carga el asset indicado, selecciona `State Machine 1`, enlaza `ViewModel1` y expone `state` más `trigState`. `useCharacterController` asigna el enum, espera un frame y luego activa el trigger. El controlador actual incluye `Base`, `Hello`, `Ghost`, `Flower`, `Talk` y `Cloud`; no expone aún el conjunto de propiedades de morphing.

Los problemas del informe externo describen otra integración. No asumir que sean bugs confirmados aquí:

| Hallazgo externo | Significado para una futura integración |
|---|---|
| `shapeAsymmetry` vs `shapeAsymetry` | Usar el nombre real del ViewModel; conservar la grafía exacta del asset. |
| `shapeSharpness` no aparece | No inventar esa propiedad; reinterpretar o retirar el control si existe. |
| `talkB`/`talkC`/`talkBC` vs enum en minúsculas | Respetar valores exactos y validar cada escritura en runtime. |
| `Talk` duplicado en `characterStates.ts` | Hallazgo del otro proyecto, no evidencia de duplicación aquí. |
| `Blink`, `Follow`, `Bump`, `Click`, `Ctrl-Look`, `shapeUp` aparecen como nombres | No tratarlos como inputs de state machine hasta inspeccionarlos en Rive. |
| `shapePressed` no estaba expuesto por UI | Confirmar escala y semántica antes de conectarlo a pointer-down/up. |

## Puntos para el plan posterior

1. Confirmar nombres, tipos, valores y rangos desde el editor/runtime Rive del asset que se usará.
2. Probar enum y morphing de forma aislada; registrar errores de binding sin incluir el `.riv` en cambios de código.
3. Definir límites/defaults para `shapeWidth`, `shapeHeight`, `shapeRoundness`, `shapeBulge`, `shapeTaper` y `shapeType`.
4. Tratar seguimiento, presión, bump y estados conductuales como interacciones distintas; no inferir sus inputs a partir de nombres hallados en el binario.
