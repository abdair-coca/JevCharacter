# Comparar la identidad neutral de JEV

[Captura de las 12 vistas](../../output/visual-phase1/comparison.png) · [Original neutral sin recorte](../../output/visual-phase1/original-neutral-raw.png) · [Evidencia técnica](../../output/visual-phase1/validation-report.md)

Abre las tres versiones al mismo ancho corporal para decidir la dirección visual. La **revisión 02** responde al feedback del 2026-10-04: cuerpo esférico, ojos más centrales y redonditos, morado más luminoso y luz detrás con sombras suaves del estilo original. La aceptación visual sigue pendiente; esta entrega cubre únicamente la fase 1 del plan activo.

## Abrir y comparar

Desde la raíz del repositorio, en PowerShell:

```powershell
python ./jev-lab/validators/visual_phase1.py
```

Abre [Comparador local](http://127.0.0.1:4181/). El servidor compila los dos proyectos RML separados, comprueba referencias y usa el runtime WebGL2 **2.42.2 ya instalado**. No instala dependencias. Si el puerto está ocupado: `python ./jev-lab/validators/visual_phase1.py --port 4182`.

1. Confirma el estado «Tres versiones listas» y mira las filas normal y pequeña: **140 y 48 px de cuerpo**.
2. Alterna **Oscuro** y **Claro**. Compara presencia del morado, contorno, volumen y lectura de ojos.
3. Pulsa **Descargar comparación PNG** para guardar ambos fondos y tamaños en una sola captura de resolución doble.
4. En **Medición y referencia original**, muestra o descarga el artboard original completo para contrastar el aislamiento con la fuente.

Las tres versiones están congeladas. El original enlaza `ViewModel1/Instance`, fija `state=Base` y `followBoo=false`, aplica el clip `Base` en `t=0` y avanza el artboard cero segundos. No reproduce state machines ni acciones. Cambiar de fondo o redimensionar sólo vuelve a dibujar esa pose.

## Cómo se igualan las versiones

Se escala el **cuerpo**, conservando sus proporciones, y se centra en el mismo viewport de cada fila. Igualar únicamente artboards daría una comparación falsa: el original mide 1600×1200 y el laboratorio 360×340. El halo queda fuera de la medida corporal. El archivo `comparison.json` registra los centros y tamaños usados por el renderer y la captura.

| Versión | Neutral de referencia | Fondo y aislamiento |
|---|---|---|
| Original | `ScriptingLab`, Base t=0; círculo 400×400 centrado en 800,610 | Render completo WebGL2; interior circular opaco intacto. En el exterior se reconstruye la luz sobre el matte negro. |
| Laboratorio actual | Cuerpo 122×114; centro 180,207; ojos 4.5×13 | Copia aislada de la fuente preservada. Sólo se separa el `Fill` del fondo del artboard. |
| Propuesta · revisión 02 | Esfera `Ellipse` 122×122; centro 180,170; ojos 9×11 separados 18, a altura central | Contraluz violeta/rosa detrás, borde luminoso, reflejo suave superior derecho y sombra frontal púrpura. Capas RML reales, sin fondo opaco. |

El original tiene un fondo negro incluido en el artboard. La API instalada no ofrece acceso documentado a la opacidad de esas capas sin nombre. La extracción preserva cada píxel del interior corporal; fuera calcula `alpha=max(R,G,B)/255` y deshace la premultiplicación sobre negro. Al recomponer sobre negro reproduce el RGB exterior dentro de un byte. Es una reconstrucción del halo para la comparación, no la transparencia original del asset: esa transparencia no se puede recuperar de forma única desde un render opaco. La vista **sin recorte** conserva la prueba visual original. Todos los paneles usan WebGL2 para respetar el feathering de su iluminación.

## Fuentes y pruebas

- `proposal/visual.json` es la autoridad visual nueva: medidas de esfera/ojos y capas de iluminación ordenadas de delante hacia atrás; `proposal/scene.rml` es el RML generado. La fuente histórica y su contrato corporal permanecen intactos.
- La propuesta y captura anteriores quedan preservadas por checksum en `output/visual-phase1/revisions/revision-01/`. Esta carpeta permite comparar el cambio solicitado sin perder la primera entrega.
- `reference-source/` conserva fuentes de anatomía, animaciones, specs, preview y documentación; `reference-manifest.json` registra SHA-256 de **134 archivos** históricos y del original. Los renders anteriores permanecen en sus rutas y se comprueba su hash.
- `current-reference/` contiene la copia preparada para comparar. No modifica `rive/main.rml`, `rive/character/body.rml` ni la selección histórica.
- `output/visual-phase1/` contiene builds locales, PNG, pruebas y evidencia de sintaxis. Builds y JS/WASM copiados se excluyen de Git. Nunca se copia el `.riv` original.

```powershell
python ./jev-lab/validators/visual_phase1.py --prepare
python ./jev-lab/validators/visual_phase1.py --check-preservation
python -m unittest discover -s ./jev-lab/tests -v
node --test ./jev-lab/tests/test_controller.mjs ./jev-lab/tests/test_action.mjs ./jev-lab/tests/test_visual_geometry.mjs ./jev-lab/tests/test_visual_matte.mjs
python ./jev-lab/validators/build.py --check
git diff --check
```

La primera orden verifica y compila ambos proyectos con Rive CLI 1.3.0; el original se verifica cargándolo en el navegador, porque esa CLI trabaja con proyectos RML y no inspecciona el binario aislado. El servidor acepta sólo rutas explícitas, rechaza directorios y traversal, y lee el original desde su ruta exacta. El preview histórico de puerto 4180 conserva su funcionamiento.

La siguiente decisión corresponde al desarrollador: aceptar o pedir ajustes de esta apariencia neutral. Las fases 2–5 siguen pendientes.
