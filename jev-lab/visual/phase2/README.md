# Rig expresivo de JEV — fase 2

El rig conserva el neutral neón aceptado de revisión 04 y permite combinar siete formas, mirada, apertura e inclinación de cada ojo, parpadeo, deformación corporal y luz. Este preview prueba poses estáticas y transiciones muestreadas; las acciones temporales pertenecen a fases posteriores.

## Probar en local

Desde la raíz del repositorio:

```powershell
python jev-lab/validators/rig_phase2.py
```

Abre <http://127.0.0.1:4182/>. Selecciona **Desde**, **Hasta** y mueve **Transición**. Los siete nombres corresponden a geometría Bézier real en Rive. Prueba **Alegría**, **Curiosidad**, **Pensamiento**, **Habla** y **Extremos permitidos**. Modifica los ojos por separado; **Neutral completo** restaura todos los canales, contornos, manejadores, transformaciones y luces.

El factor **Parpadeo** vale **1 abierto / 0 cerrado**. Multiplica la apertura propia de cada ojo; abrir tras un parpadeo recupera su apertura previa. **Intensidad de luz** permite atenuar de 1 a 0,75; el neutral conserva la iluminación aprobada. **Guardar captura** descarga la pose visible, con el fondo elegido.

## Autoridad y composición

- [Contrato v2](JEV_BODY_CONTRACT_V2.md): límites, topología y neutral.
- [Datos v2](body_contract.v2.json): geometría completa y hashes de la revisión aprobada.
- `scene.rml`: fuente RML determinista generada; cada canal usa un clip separado.
- `web/rig.mjs`: muestrea primero el neutral completo, luego la forma de origen, la mezcla de destino y los canales disjuntos. No acumula valores de la pose anterior.

La iluminación y la sombra comparten exactamente el contorno del cuerpo. Las formas añaden un borde perimetral violeta; su opacidad es cero en base. Los halos suaves conservan su geometría circular y siguen el cuerpo. No se añade boca ni extremidades.

## Verificar

```powershell
python jev-lab/validators/rig_phase2.py --check
python jev-lab/validators/rig_phase2.py --render
python -m unittest discover -s jev-lab/tests -p 'test_*.py'
node --test jev-lab/tests/*.mjs
python jev-lab/validators/build.py --check
python jev-lab/validators/visual_phase1.py --check-preservation
git diff --check
```

`--prepare` regenera y compila sin iniciar el servidor. `--render` genera evidencia mediante una máquina de estados Rive de prueba aislada en `output/visual-phase2/harness/`; no instala ni publica nada.

Consulta `output/visual-phase2/contact-sheet.png`, `transitions.png`, `geometry-validation.json` y `render-validation.json`. Se verifican los 21 pares a 41 fracciones de morph por par, usando las rotaciones y distancias de los manejadores que Rive interpola. En cada muestra se certifica la curva Bézier continua y se prueba un margen ocular conservador para todas las combinaciones permitidas. Los renders reales muestran 25%, 50% y 75% de cada par y comparan el retorno a neutral en RGBA exacto.

La validación no es una demostración analítica continua respecto del parámetro de morph: certifica 861 muestras. El círculo Bézier aproxima la Ellipse histórica con error radial menor de 0,03 px; la igualdad exacta de retorno se mide entre neutral inicial y final del rig v2. Las fuentes, animaciones y capturas históricas se preservan por separado.
