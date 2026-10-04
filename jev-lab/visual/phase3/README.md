# Autoría rápida y reproducción desde código

Añade una definición JSON para crear una acción completa: el compilador descubre archivos, genera clips RML y máquinas reales de Rive y publica un catálogo. El controlador compone esos clips sobre el rig v2 aprobado. Las fuentes y capturas de fases anteriores se conservan.

## Probar en local

Desde la raíz del repositorio:

```powershell
python jev-lab/validators/author_phase3.py
```

Abre `http://127.0.0.1:4183/`. Selecciona acción, variante, intensidad y velocidad. Reproduce, encadena el catálogo, interrumpe con curiosidad y pulsa **Stop** para restaurar geometría, ojos, cuerpo y luz. Mirada y luz ambiental son poses estáticas.

Edita un valor en `actions/curious_look.json`, por ejemplo `poses.observe.gazeX`. El watcher revisa archivos cada 500 ms; el navegador revisa estado cada 700 ms. El nuevo preview aparece después de verificar, compilar y cargar el build completo. Un error muestra archivo y JSON pointer; un error de sintaxis incluye línea y columna. El personaje y catálogo válidos anteriores continúan disponibles. Corregir el archivo permite recuperación automática.

```powershell
python jev-lab/validators/author_phase3.py --prepare
python jev-lab/validators/author_phase3.py --check
python jev-lab/validators/author_phase3.py --render
python -m unittest discover -s jev-lab/tests
node --test jev-lab/tests/*.mjs
```

`--prepare` verifica y compila sin servidor; `--check` comprueba igualdad determinista de fuentes generadas; `--render` captura máquinas reales de Rive. CLI 1.3.0 y WebGL2/WASM 2.42.2 permanecen fijados.

## Crear una acción con un solo archivo

`actions/attention_pulse.json` es la demostración nueva: mirada arriba seguida de una transformación suave a flor. Sus variantes `soft` y `full` modifican poses en la misma definición. Para crear otra acción, copia ese archivo dentro de `actions/`, asigna un `id` único y cambia intención, poses o fases. El watcher añade automáticamente opciones, clips y máquinas. No edites `scene.rml`, `catalog.json` ni el controlador: son salida generada o implementación compartida. La prueba del compilador añade un archivo temporal y comprueba descubrimiento y máquina sin modificar otras fuentes.

Esquema mínimo completo:

```json
{
  "schema": 1,
  "id": "tiny_glance",
  "intent": "Mirar brevemente arriba y volver a quietud.",
  "durationMs": 500,
  "channels": ["gazeY"],
  "poses": {"neutral": {"gazeY": 0}, "look": {"gazeY": -3}},
  "phases": [
    {"name": "entry", "timeMs": 0, "pose": "neutral", "curve": [0.42, 0, 0.58, 1]},
    {"name": "notice", "timeMs": 150, "pose": "look", "curve": [0.42, 0, 0.58, 1]},
    {"name": "neutral_return", "timeMs": 450, "pose": "neutral", "curve": [0.42, 0, 0.58, 1]},
    {"name": "neutral_hold", "timeMs": 500, "pose": "neutral", "curve": [0.42, 0, 0.58, 1]}
  ],
  "variants": {"gentle": {"look": {"gazeY": -1.5}}}
}
```

| Campo | Significado y validación |
|---|---|
| `id` | Identificador único: letra minúscula inicial, letras/números/underscore, máximo 64 caracteres. `__` se reserva para nombres generados. |
| `intent` | Intención legible, no vacía. |
| `durationMs` | 100–10000 ms; debe terminar exactamente en frame de 60 fps. |
| `channels` | Lista única de canales poseídos. Cada pose declara todos ellos; no admite campos ajenos. |
| `poses` | Nombres semánticos, valores finitos dentro del contrato v2. La pose de entrada y las dos últimas fases son neutrales completos en canales poseídos. |
| `phases` | Nombres únicos, tiempos crecientes, pose existente y curva saliente. Tiempos se redondean a frames; fases que colapsan al mismo frame se rechazan. Último hold neutral ocupa al menos dos frames. |
| `curve` | `[x1,y1,x2,y2]` de `CubicEaseInterpolator`: controles entre 0 y 1, `x1 ≤ x2`, `y1 ≤ y2`. Rive evalúa la curva del inicio de cada segmento; última curva no produce otro segmento. |
| `targetShape` | Obligatorio al poseer `morph`: una forma v2 distinta de base, fija para toda la definición y sus variantes. Cada acción mezcla solamente base y ese destino. |
| `variants` | Overrides parciales por nombre de pose. Conservan canales, tiempos, destino y entrada/hold neutrales. `default` es implícito. |

Canales numéricos: `gazeX`, `gazeY`, `leftOpen`, `rightOpen`, `leftTilt`, `rightTilt`, `blink`, `bodyX`, `bodyY`, `bodyRotation`, `bodyScaleX`, `bodyScaleY`, `light`; además `morph` entre 0 y 1. Posición/mirada usan píxeles de artboard; giros usan radianes; escalas y apertura son factores. Los límites exactos y el neutral viven en `../phase2/body_contract.v2.json`. Los clips sólo animan propiedades derivadas de sus canales; iluminación geométrica acompaña `morph`, intensidad lumínica pertenece a `light`.

## Controlador: seis comandos

`web/controller.mjs` exporta `createController`. Recibe runtime Rive avanzado, artboard, contrato y catálogo de la misma generación. El dueño del canvas suministra reloj monotónico en milisegundos y suscripción de frames. El preview incluye este adaptador; los tests inyectan reloj y tick deterministas.

```javascript
import { createController } from "./controller.mjs";

let tick;
const controller = createController({
  runtime, artboard, contract, catalog,
  now: () => performance.now(),
  subscribe(callback) {
    tick = callback;
    return () => { tick = null; };
  },
  onChange: event => { /* diagnóstico opcional */ }
});
// El dueño del render llama tick?.() antes de artboard.draw(renderer).
const handle = controller.play("happy_bounce", {
  intensity: 0.7, speed: 1.2, variant: "gentle"
});
const result = await handle.finished;
// {status: "completed" | "cancelled", reason, completedItems, totalItems}

controller.lookAt(-6, 0);
controller.setAmbient({light: 0.8});
const chain = controller.sequence([
  {action: "curious_look", variant: "left", speed: 1},
  "attention_pulse"
]);
chain.cancel();
controller.stop();
controller.dispose();
```

| Comando | Comportamiento |
|---|---|
| `play(id, options)` | Reemplaza acción/secuencia anterior. Opciones: `intensity` finita 0–1 (default 1), `speed` finita 0.1–4 (default 1), `variant` conocida (default `default`). Intensidad cero mantiene duración sin deformación. |
| `sequence(items)` | 1–100 ids o `{action, intensity, speed, variant}`. Valida todos antes de reemplazar. Procesa frames tardíos atravesando varios ítems, conserva tiempo excedente. |
| `lookAt(x,y)` | Actualiza mirada estática dentro de límites v2; no cancela reproducción. |
| `setAmbient(values)` | Reemplaza configuración estática numérica: escala, ojos, posición, giro, mirada o luz. Formas ambientales no se admiten. `lookAt` tiene precedencia sobre mirada ambiental. |
| `stop()` | Cancela toda orden, borra mirada/ambiente y aplica neutral completo inmediatamente; frames siguientes permanecen neutrales. |
| `dispose()` | Cancela orden, restaura neutral, libera todos sus `LinearAnimationInstance` y la suscripción; idempotente. Artboard, renderer y archivo son propiedad del dueño del preview. |

Mientras una acción posee un canal, la base de ese canal es neutral y el clip Rive toma el control; actualizaciones ambientales siguen disponibles al terminar y componen inmediatamente en canales no poseídos. Intensidad mezcla el clip hacia neutral sin extrapolar. Nueva orden pasa por un puente neutral inmediato, seguro para geometría; continuidad más refinada corresponde a fase 4. Un comando inválido deja la orden válida intacta.

Los handles resuelven siempre; no rechazan por cancelación. `reason` es `completed`, `replaced`, `handle`, `stopped` o `disposed`. Cancelar un handle antiguo nunca afecta al sucesor. `completedItems` cuenta ítems terminados; se inicia en 0. El diagnóstico del preview muestra acción, fase temporal, canales poseídos y resultados recientes.

## Adaptación y evidencia

- `happy_bounce`: 45 frames/750 ms; mirada antes del cuerpo, anticipación, stretch, ápice, aterrizaje, settle y neutral final. El salto histórico de 52 px se reduce explícitamente a **10 px** para respetar `bodyY` v2 `[-10,10]`; la intención y duración permanecen. Variante `gentle` reduce desplazamiento vertical a la mitad.
- `curious_look`: 48 frames/800 ms; mirada 7 px a la derecha, cuerpo empieza 100 ms después, giro 4° positivo y stretch vertical 1.07, hold 300–500 ms y neutral desde frame 46. Apertura y blink permanecen intactos. Variante `left` invierte mirada/giro.
- Cada acción/variante genera máquina de entrada, reproducción con `reset`, transición al 100% y neutral. `RigNeutral` conserva máquina por defecto. El módulo Python reutiliza `rig_phase2.build_scene` y `pose_properties`; no ejecuta `compile_rig` ni escribe fase 2.

`output/visual-phase3/compile-validation.json` registra verify/compile/inspect sin problemas. `render-validation.json` y `contact-sheet.png` registran renders reales de acciones, variantes e interrupción con retorno RGBA exactamente igual al neutral del rig. El harness CLI de interrupción usa transición inmediata de máquina a 200 ms; comandos y puente neutral del controlador se prueban separadamente y con runtime del navegador.

El servidor sólo escucha localhost y sirve rutas explícitas, sin listado ni traversal. Publica recursos `/generation/<hash>/catalog.json` y `actions.riv` inmutables como pareja; un navegador carga ambos y prepara controlador/artboard nuevos antes de liberar los anteriores. `/status.json` comunica revisión, generación válida y error localizado. Renombrados transitorios del editor conservan preview y reintentan. Builds, runtime y harness son salida local ignorada.

Respiración, parpadeo automático, repertorio completo, editor de timeline e integración en la aplicación corresponden a fases posteriores.
