# curious_look verificada sobre la misma anatomía

Estado: **PASS**. Segunda animación de Mini JEV: 800 ms, mirada a la derecha primero, respuesta corporal 100 ms después, stretch vertical del 7%, hold de 200 ms y regreso exacto a neutral. No hay cambios de anatomía ni integración con producción.

## Evidencia final

| Comprobación | Resultado real | Archivo |
|---|---|---|
| Spec antes de implementación | Intención escrita antes de crear RML | `../../specs/curious_look.json` |
| Ensamblado | `build.py --check`: PASS con curious seleccionada | `../../rive/main.rml`, `../../rive/preview.json` |
| RML | Rive CLI 1.3.0 `--verify`: exit 0, 0 errores/advertencias | `verify.json` |
| Build | `--once`: exit 0, 2332 bytes | `build.json` |
| Inspect | `problems: []`, 1 artboard, 2 animaciones, 24 pistas; coincide fuente | `inspect-summary.json`, `inspect.json` |
| Ambas animaciones | happy: 363 tiempos; curious: 387 tiempos; neutral exacto en ambas | `validation.json` |
| Secuencia curious | mirada inicia 0 ms; cuerpo 100 ms; stretch 7%; hold 200 ms; inclinación +4° | `validation.json` |
| Suite Python | 31 tests OK: los 18 previos más 13 de curiosidad | `tests.txt` |
| Suite nativa CLI | exit 0; `noTestsFound: true`, sin scripts Tests | `cli-tests.json` |
| Renders | 18 PNG reales, 360×340; ojos/cuerpo visibles en cada uno | `frames/`, `render-validation.json`, `render.log` |
| Neutral visual | 0, 800 y 1000 ms idénticos en todos los bytes de píxeles RGBA | `neutral.png`, `final.png`, `post-final.png` |
| Cambio de selección | Happy seleccionado compila/inspect válido; su frame 400 ms coincide RGBA con el render anterior | `switchback-validation.json`, `happy_switchback_400.png` |
| Anatomía visible | Neutral de curious coincide RGBA con neutral original de Mini JEV | `switchback-validation.json` |
| Watch/hot reload | Arranque y dos builds sin errores al actualizar timestamp de main | `preview.stdout.log`, `preview.stderr.log` |

## Lectura del movimiento

Se observaron personalmente `hold.png` y `contact-sheet.png`. La mirada lateral precede al cuerpo; la inclinación y el stretch son pequeños. La pausa mantiene atención sin hiperactividad y la vuelta es suave. En coordenadas de Rive, x crece a la derecha e y hacia abajo: una rotación positiva hace que la parte superior del cuerpo se incline a la derecha. El render confirma la dirección y el test comprueba ese signo.

Solo cambian tres controles: `Eyes.x`, `Jev.rotation` y `BodyTransform.scaleY`. La posición y el ancho permanecen neutrales. La escala propia de ojos y blink permanecen en 1; los ojos heredan el pequeño stretch corporal como en la anatomía estable. El GIF repite capturas para inspección; la animación Rive es `oneShot`.

El neutral se mantiene desde frame 46 hasta 48, absorbiendo el tick inicial de entrada ya observado en la primera fase. Los últimos PNG a 800 y 1000 ms prueban que no quedan residuos.

## Decisiones y límites

`catalog.json` guarda IDs y límites específicos de las dos animaciones sin alterar el contrato corporal. `preview.json` conserva la selección; ambas animaciones quedan compiladas y `--check` verifica la selección vigente. `happy_bounce` sigue primero para mantener compatibilidad con los tests previos. El ensamblador evita reescribir `body.rml` cuando no cambió.

Los tests nuevos rechazan una respuesta corporal demasiado temprana/tardía, stretch sin retraso, mirada/inclinación a la izquierda, stretch fuera de 5–10%, falta de hold, reacción adicional de tamaño en ojos, residuos, animaciones desconocidas y selección incoherente. El retraso se calcula desde el inicio del segmento interpolado que cambia, no desde el frame de llegada.

Se preservaron fragmento/spec de happy, contrato JSON, `body.rml` y los productos de la primera fase. La nueva evidencia se guarda exclusivamente aquí. El agente principal completa la comprobación independiente de hashes y alcance. No hubo staging, commits, instalación de dependencias ni cambios fuera de `jev-lab`.

La CLI continúa siendo un technical preview. Cada curva es cúbica monótona y sus valores quedan acotados por las claves. Geometría, contención y escalas compuestas se verifican mediante muestreo denso de 1/8 de frame; no es una prueba matemática exhaustiva para animaciones futuras. El preview se probó con proceso oculto, logs de arranque/reload y cierre del PID propio; las imágenes se inspeccionaron por rendering real de CLI. No se verificó publicación web/CDN.
