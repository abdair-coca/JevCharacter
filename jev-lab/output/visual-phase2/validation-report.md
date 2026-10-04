# Fase 2 — evidencia de entrega

El rig independiente está implementado y listo para aprobación humana. Conserva el neutral de revisión 04 como autoridad, suma siete contornos Bézier estables y compone mirada, apertura e inclinación de cada ojo, parpadeo multiplicativo, transformaciones, deformación corporal y luz. No se implementaron fases 3–5.

## Resultado comprobado

| Verificación | Resultado |
|---|---|
| Rive CLI 1.3.0 | `--verify --format=json`, `--once --format=json` e `inspect --json`: PASS; cero problemas |
| Runtime local | WebGL2 2.42.2; servidor <http://127.0.0.1:4182/> |
| Geometría | 7 formas × 60 vértices compartidos; 21 pares, 41 muestras por par, 861 muestras PASS |
| Curvas | Coeficientes Bernstein positivos y una vuelta polar: curva continua sin cruces en cada muestra |
| Contención ocular | Envolvente de todas las combinaciones permitidas: radio 26,710 px; margen mínimo conservador 6,290 px |
| Límites del artboard | Extensión máxima conservadora 145,52 px desde centro; artboard 360 × 340 |
| Renders reales | 105 capturas CLI; 25%, 50%, 75% de cada par, extremos y cuatro poses |
| Retorno a neutral | 28 comparaciones RGBA exactamente iguales a neutral inicial v2 |
| Python | 51 tests PASS |
| Node | 29 tests PASS |
| Historia | `build.py --check` PASS; 134 referencias y original intactos |
| Diff | `git diff --check` PASS; aplicación existente preservada |

La revisión visual del agente principal comprobó carga real, siete formas reconocibles, controles independientes y ausencia de errores de consola. En navegador, neutral → extremos → neutral recuperó una captura idéntica; parpadeo 1 → 0 → 1 conservó la apertura e inclinación definida para cada ojo. La evidencia de navegador se registra en `browser-validation.json` por el agente principal.

## Evidencia revisable

- `contact-sheet.png`: siete formas, cuatro poses ilustrativas, tres extremos y neutral.
- `transitions.png`: los 21 pares a 25%, 50% y 75%.
- `geometry-validation.json`, `inspect-summary.json`, `render-validation.json`, `render-log.json`: medidas, inventario y comandos de captura.
- `renders/`: 105 capturas originales; `docs/`: documentación y schemas consultados del CLI.
- `python-tests.txt`, `node-tests.txt`, `historical-build-check.txt`, `preservation-check.txt`, `diff-check.txt`: registros de las verificaciones.

El RML de prueba y sus builds quedan en `harness/`, ignorado por Git. La inspección completa queda local en `inspect.json`, también ignorada; su resumen mantiene conteos, nombres de clips y problemas. El RML materializado de producción vive exclusivamente en `visual/phase2/scene.rml`.

## Límites

La verificación de morph certifica 861 muestras, no todo el continuo del parámetro de mezcla de forma analítica. Cada muestra sí certifica la curva Bézier continua. El círculo v2 tiene error radial menor de 0,03 px frente al círculo ideal; el raster del neutral v2 puede diferir ligeramente del Ellipse histórico. La igualdad RGBA exacta se exige entre neutral inicial y final del propio rig.

Las poses son pruebas estáticas. No hay reproducción, secuencias ni actividad ambiental. La descarga opcional del botón de captura no se verificó: el evento de descarga del navegador integrado agotó su espera; las capturas CLI y sus comprobaciones sí están completas.

Entrega ordinaria `unmanaged`, sin consulta ni activación de receipt-driven development, commits ni despliegue. La fase queda esperando aprobación humana.
