# Resultado verificado de Mini JEV

Estado: **PASS**. Una escena `MiniJev`, una animación `happy_bounce` de 750 ms, Rive CLI oficial 1.3.0. Sin integración de producción ni cambios fuera del laboratorio realizados por la implementación.

## Evidencia técnica final

| Comprobación | Resultado real | Evidencia |
|---|---|---|
| Ensamblado actualizado | `build.py --check`: PASS | Fuentes `body.rml` y `main.rml` coinciden con contrato/fragmento. |
| RML válido | `--verify`: exit 0, success true, 0 errores, 0 advertencias | `verify.json` |
| Compilación | `--once`: exit 0, 1745 bytes, 0 errores, 0 advertencias | `build.json`, `build/mini_jev.riv` |
| Inspect resuelto | `problems: []`, un artboard, una LinearAnimation, 12 pistas | `inspect-summary.json`, `inspect.json` |
| Contrato/neutral | PASS; 363 tiempos, 12 pistas, 750 ms | `validation.json` |
| Tests negativos y positivos | 18 tests, OK | `tests.txt` |
| Tests nativos Rive | exit 0, `noTestsFound: true`; no hay scripts Tests | `cli-tests.json` |
| Renders reales | 17 capturas de 360×340, cuerpo y ojos visibles en todas | `frames/`, `render.log`, `render-validation.json` |
| Neutral visual | Todos los bytes de píxeles RGBA iguales entre 0, 750 y 1000 ms | `neutral.png`, `final.png`, `post-final.png` |
| Preview nativo | Arrancó, compiló y mostró `MiniJev`; recompiló al actualizar fecha de main | `preview.stdout.log`, `preview.stderr.log` |

Valores observados: escala compuesta máxima 1.09; rotación máxima 2.005352°; desplazamiento de mirada máximo 4 px. El validador compara cada atributo runtime explícito con `inspect`, tolerando únicamente el redondeo float del runtime. Las coordenadas del diagrama de la state machine no se exportan en inspect y se validan en la fuente.

Los tests rechazan escala excesiva, escalas locales ilegales que se cancelan, deformación compuesta, cuerpo expandido fuera del artboard, ojos fuera de la cara, escala de ojos no uniforme, easing no admitido o con overshoot, NaN, frames duplicados, duración incorrecta, pistas desconocidas/ausentes, cambios de anatomía, divergencia del inspect y residuos en neutral/hold.

## Evaluación visual y reproducción

Se observaron personalmente `neutral.png`, `apex.png` y `contact-sheet.png`. La mirada empieza antes del movimiento corporal; anticipación pequeña, stretch moderado, salto controlado, compresión de aterrizaje y settle legible. El cuerpo conserva iluminación violeta, ojos blancos mínimos y carácter tranquilo. El GIF está compuesto únicamente de capturas reales de CLI; su repetición sirve para inspección, sin cambiar `oneShot`.

La primera prueba visual detectó que capturar exactamente a 750 ms todavía mostraba una pose cercana al final: la entrada de la state machine consume un tick. La implementación final mantiene neutral desde frame 43 (aproximadamente 717 ms) hasta frame 45. Capturas finales a 750 y 1000 ms confirman igualdad RGBA exacta con neutral.

Para el smoke de preview se inició solo el ejecutable local, oculto y sin bloquear. El log registra `watching`, `showing MiniJev` y dos builds sin errores, antes y después de actualizar únicamente el timestamp de `main.rml`. Se cerró ese proceso específico. Esto confirma arranque y recarga del watcher; no afirma una inspección interactiva manual de la ventana. El comando de README abre el preview visible para el usuario.

## Límites de la evidencia

La CLI es un technical preview. Exportación local sin firmar y renders están verificados; compatibilidad con runtimes web/CDN no está verificada. El ensamblado XML es propio, no una API Include de RML. La anatomía se fija en JSON y materializa en RML real; no existe generación dinámica ni sistema de emociones.

Cada curva cúbica tiene controles monótonos entre 0 y 1, lo que acota sus valores entre claves. Los límites geométricos, productos de escala y contención se evalúan a intervalos de 1/8 de frame; esto es una comprobación densa, no una prueba matemática exhaustiva para todas las combinaciones futuras. La validación es deliberadamente cerrada para este personaje: una nueva propiedad exige revisar y ampliar su allowlist.

La revisión de Git debe distinguir los cambios preexistentes del usuario de la carpeta nueva. El agente principal conserva los hashes de baseline y completa `scope-validation.json`; esta implementación solo escribió dentro de `jev-lab`. No hubo commits, staging ni cambios en dependencias/configuración raíz.
