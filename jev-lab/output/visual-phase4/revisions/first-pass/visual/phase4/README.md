# Personalidad y repertorio desde código

Fase 4 reúne 13 acciones y 18 variantes en un namespace independiente. Esta primera tanda fija el estándar expresivo con `happy_bounce`, `curious_look`, `hello`, `think` y `speech`; el resto del catálogo permanece disponible para iterarlo con el mismo patrón. Conserva cuerpo morado y dos ojos del rig v2 aprobado. Las curvas, la respiración, el bump y la recuperación se evalúan mediante clips reales de Rive.

## Probar en local

Desde la raíz del repositorio:

```powershell
python jev-lab/validators/personality_phase4.py
```

Abre `http://127.0.0.1:4184/`. Selecciona acción y variante. **Reproducir / comparar** activa la propuesta y el estado original declarado con reloj de pared común. La comparación usa fondo negro compartido, original raw intacto y cámara corporal fija: 400×400, centro 800,610 para el original; 122×122, centro 180,170 para la propuesta. Los cuerpos neutrales se muestran a 140 y 48 px CSS. No se reajusta el encuadre al moverse. Ambos usan reloj de pared; la preparación nativa del original introduce un desfase inicial aproximado de un frame (unos 17 ms observados). No se afirma sincronización exacta de fase; refinamiento de sincronización pertenece a fase 5.

1. Prueba `happy_bounce`, `curious_look`, `hello`, `think` y las variantes A/B/C/BC de `speech`.
2. En `think` o `speech`, escribe duración activa en ms o marca **Sostenida hasta cancelar**. Son opciones excluyentes. La duración usa tiempo de pared, independiente de velocidad.
3. Durante una acción, pulsa **Interrumpir** y reproduce otra. La nueva acción reemplaza a la anterior sin encolarse; el bump acompaña la entrada y la vuelta al idle.
4. El preview abre respirando: ciclo continuo de 2.8 s con expansión leve de cuerpo y ojos y una pequeña deriva de mirada. Los parpadeos duran 150 ms y aparecen con pausas deterministas de 5–12 s. **Stop** aplica neutral completo inmediatamente y desactiva la programación futura.

El diagnóstico muestra elapsed activo, `comparisonElapsedMs`, estado/variante, ownership, recuperación, cantidad de pendientes, schedule real y readback/transiciones del original. El original conserva su Bump y tiempos nativos; cambiar velocidad de la propuesta no acelera el original. `MorphState` original activa `MorphTest`; no se afirma correspondencia exacta con estrella a partir de escribir ese enum. Las formas deben reconocerse en la evidencia visual.

## Crear o ajustar acciones

Edita solamente `actions/*.json`. El compilador descubre archivos, reutiliza en lectura el compilador de fase 3 y el contrato v2, y genera `scene.rml`, `catalog.json` y `rive.yaml`. No edites esas salidas. El watcher publica catálogo/RIV como pareja inmutable únicamente después de verify, compile e inspect; errores localizados conservan la generación válida, incluso al recargar el navegador.

### Patrón de los cinco estados modelo

- `happy_bounce` estructura alegría como mirada/anticipación, squash, estiramiento, ápice, aterrizaje, pequeño rebote y settle.
- `curious_look` mueve primero los ojos, añade una pausa de duda y después inclina/estira el cuerpo; la variante `left` refleja la dirección.
- `hello` usa dos gestos corporales alternados para comunicar saludo sin boca ni extremidades.
- `think` y `speech` declaran `behavior.kind: "sustained"`: separan entrada, ciclo repetible y salida. Los dos extremos del ciclo coinciden por canal y variante.

Para un estado nuevo, parte de un solo motivo visual y escríbelo en `intent`. Define todos los canales poseídos en cada pose; ordena fases como **notice → anticipación → gesto principal → respuesta/hold → settle → neutral**. Los ojos pueden adelantarse al cuerpo, pero cada movimiento debe reforzar la intención. Usa variantes para dirección o matiz, no para cambiar la estructura temporal. Conserva una salida neutral de dos frames y prueba al menos una captura activa y otra posterior al final. Los archivos JSON son la fuente editable; catálogo, RML y RIV son productos generados.

El esquema de poses/fases/canales sigue [fase 3](../phase3/README.md). Cada pose contiene todos los canales poseídos; los valores deben ser finitos y respetar límites v2. Entrada y dos últimas poses son neutrales completos. Cada transformación tiene un único `targetShape`, fijo en todas sus variantes. Nunca se combinan tres formas ni se programa una forma ambiental.

Para pensamiento/habla, añade metadata semántica:

```json
"behavior": {
  "kind": "sustained",
  "entryEndMs": 400,
  "cycleStartMs": 400,
  "cycleEndMs": 1600,
  "exitStartMs": 2000
}
```

Los cuatro tiempos identifican fases existentes. Entrada termina donde empieza el ciclo; ambos extremos del ciclo deben coincidir en **cada canal y variante**. Curvas cúbicas de segmentos sostenidos usan tangentes planas en extremos (`y1=0`, `y2=1`). La salida autorada gobierna reproducción finita por defecto. Duración explícita o cancelación a mitad del ciclo congela exactamente la muestra actual y recupera mediante envelope nativo durante 150 ms; no salta a un punto fijo del ciclo. El bump es un clip de 150 ms en un transformador contenedor de fase 4; así escala el personaje sin sustituir los canales corporales de la acción.

`behavior.json` conserva el contrato de reposo, bump y tiempos de takeover/recovery. El ciclo respiratorio se repite sin pausa; sus clips disjuntos mueven escala corporal, altura, mirada y apertura ocular. El blink se agenda por separado con semilla estable. Rive evalúa deltas respecto de neutral; se componen sobre la base numérica guardada y se limitan al contrato. Los canales no poseídos por una acción permanecen disponibles.

## Interface de seis comandos

```javascript
import { createController } from './web/controller.mjs';
const controller = createController({
  runtime, artboard, contract, catalog,
  now: () => performance.now(),
  subscribe(tick) {
    // El dueño del render invoca tick antes de dibujar.
    return () => { /* retirar suscripción */ };
  }
});
const handle = controller.play('think', { durationMs: 2400, speed: 1.4 });
const speech = controller.play('speech', { variant: 'bc', loop: true });
handle.cancel(); // Handle antiguo: no afecta al sucesor.
speech.cancel();
controller.sequence(['hello', { action: 'speech', durationMs: 1600 }, 'yes']);
controller.lookAt(-5, 3);
controller.setAmbient({ bodyY: 4, light: 0.8 });
controller.setAmbient({ enabled: true, seed: 731 });
controller.stop();
controller.dispose();
```

| Comando | Contrato |
|---|---|
| `play(id, options)` | Valida antes de mutar. Intensidad 0–1, velocidad 0.1–4, variante descubierta. `durationMs` 1–3600000 o `loop:true` sólo en acciones sostenidas. Default finito. Duración activa más recuperación de 150 ms; velocidad modifica ritmo, no duración explícita. |
| `sequence(items)` | 1–100 ids u objetos. Valida toda la cadena antes de reemplazar. Rechaza `loop:true`; admite duración finita. Conserva excedente temporal a través de acción, recuperación y siguiente ítem. |
| `lookAt(x,y)` | Mirada estática dentro de límites v2. Mientras se posee el canal, queda guardada para liberación suave. |
| `setAmbient(values)` | Canales numéricos reemplazan base estática como en fase 3. Comandos sólo `enabled`/`seed` conservan esa base. `setAmbient({})` la limpia. Ninguna forma ambiental. Seed uint32, enabled booleano estricto. |
| `stop()` | Cancela orden/pending/recovery; limpia mirada/base, desactiva reposo y restaura neutral inmediato. Frames posteriores siguen neutrales hasta otro comando. |
| `dispose()` | Idempotente. Cancela orden, restaura neutral, retira suscripción y elimina cada instancia creada una vez. Artboard/archivo/renderer siguen siendo propiedad del llamador. |

`finished` resuelve `{status, reason, completedItems, totalItems}`; nunca rechaza por cancelación. `status` es `completed` o `cancelled`; reason es `completed`, `replaced`, `handle`, `stopped` o `disposed`. El resultado se conserva en el Promise del handle aunque una orden posterior ya esté activa.

La recuperación congela pose, tiempo/intensidad de clip y base mostrada. Un Node no visible `PlaybackEnvelope`, fuera de BodyRoot, produce peso 1→0 mediante curva Rive con extremos planos. Reemplazar durante recuperación cancela el pending anterior y conserva la misma recuperación: no reinicia fade ni apila capas salientes. A peso cero se descarta el saliente; sólo después entra la última orden. Ownership toma y libera base/gaze/ambient con el mismo envelope nativo. **Stop** es excepción explícita de neutral inmediato. No se afirma continuidad C1 perfecta en cualquier orden.

## Verificación reproducible

```powershell
python jev-lab/validators/personality_phase4.py --prepare
python jev-lab/validators/personality_phase4.py --check
python jev-lab/validators/personality_phase4.py --render
python -m unittest discover -s jev-lab/tests
node --test jev-lab/tests/*.mjs
```

CLI 1.3.0 y runtime/WASM 2.42.2 locales permanecen fijados; no se añaden dependencias. Node carga WASM con `setWasmBinary` y ejecuta el RIV compilado realmente. [Evidencia](../../output/visual-phase4/) incluye logs de compilación/tests, poses numéricas y mediciones de seams, 1000 órdenes rápidas, duración independiente de speed, ocupación/quietud determinista, lifecycle y renders CLI de todas las variantes/formas con neutral RGBA exacto.

Las capturas CLI de interrupción muestran una transición de máquina nativa de 150 ms; recuperación congelada del controlador se prueba por separado en `native-validation.json` y navegador. El inventario original viene del runtime, no de CLI inspect, que rechaza ese binario. Las muestras finitas no certifican analíticamente todo el continuo, ni prueban superioridad subjetiva; aceptación visual corresponde al desarrollador. Fase 5 permanece pendiente.
