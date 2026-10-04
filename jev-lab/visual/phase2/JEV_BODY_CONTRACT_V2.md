# Contrato corporal v2

`body_contract.v2.json` es la autoridad del rig de fase 2. Versiona el neutral aceptado de revisión 04 mediante hashes SHA-256 del JSON y RML originales. El contrato histórico conserva su autoridad para las animaciones existentes.

## Neutral y topología

| Elemento | Decisión |
|---|---|
| Artboard | 360 × 340; centro del cuerpo 180,170 |
| Base | Círculo 122 × 122, aproximado por 60 segmentos cúbicos |
| Ojos | Dos Ellipse 9 × 11; centros -9,0 y +9,0; blanco aprobado |
| Formas | base, estrella, cuadrado redondeado, triángulo redondeado, fantasma, flor de seis pétalos, nube |
| Contorno | 60 `CubicDetachedVertex`, cerrado, sentido horario; primer vértice arriba |
| Identidad | Cuerpo morado, dos ojos, sin boca ni extremidades |

Todos los contornos conservan cantidad, orden y objetos Rive. Se interpolan `x`, `y`, `inRotation`, `inDistance`, `outRotation` y `outDistance`, con ángulos desenvueltos respecto de la tangente base de cada vértice. Interpolar posiciones cartesianas de los manejadores daría otra curva; no es el algoritmo de este rig.

## Canales y límites

Los límites numéricos completos y el estado neutral están en el JSON. Los canales controlan propiedades disjuntas:

| Canal | Propiedad y composición |
|---|---|
| Forma y morph | Contornos, borde perimetral y coordenadas locales de las luces del cuerpo |
| Mirada x/y | Nodo compartido de los ojos; independiente de forma y deformación |
| Apertura izquierda/derecha | Escala vertical propia, 0,15–1,35 |
| Inclinación izquierda/derecha | Rotación propia, -0,5–0,5 rad |
| Parpadeo | Factor común 0–1 en nodos propios; multiplica cada apertura |
| Posición y giro corporal | Nodo exterior; traslada cuerpo, ojos y luces juntos |
| Deformación x/y | Nodo interior, 0,82–1,12; preserva contención ocular |
| Luz | Opacidad de gradientes, 0,75–1; 1 es neutral aprobado |

Jerarquía ocular: `BodyRoot > BodyDeform > Gaze > Placement > Tilt > Open > Blink > Ellipse`. Apertura e inclinación de cada ojo permanecen independientes. El parpadeo no reemplaza la apertura: al volver su factor a 1, reaparece la apertura definida para cada ojo.

Los gradientes, sombra y borde siguen el contorno del cuerpo. La base conserva colores, posiciones y parámetros de gradientes de revisión 04. El borde añadido se oculta en base; en otras formas ilumina su perímetro completo. Los halos siguen el cuerpo y permanecen circulares para conservar una caída suave.

## Neutral completo y validez

Cada muestra aplica primero el clip `neutral`, que fija todas las propiedades mutables: posiciones de vértices, cuatro propiedades de manejadores, transformaciones de cada nodo, gradientes y borde. Luego aplica forma de origen a mezcla 1, destino a mezcla `morph` y canales independientes. Una pose nunca hereda propiedades de la anterior.

Los ojos caben dentro de una envolvente circular conservadora que incluye mirada extrema, apertura máxima y cualquier inclinación. El margen mínimo requerido es 4 px locales. Los halos y el cuerpo completo caben en el artboard incluso al combinar escala, giro y posición máximos. Los colores y las dimensiones de Ellipse de los ojos son constantes del contrato.

La comprobación examina los 21 pares y 41 valores de morph por par. Para cada muestra, los coeficientes Bernstein positivos de `cross(P(t), P'(t))`, junto con una sola vuelta polar, certifican ausencia de cruces de la curva continua; el área debe ser positiva y superar 2500 px². La distancia conservadora a las envolventes de control certifica el margen ocular. Esta prueba no certifica de forma analítica todo el continuo del parámetro de morph.

Las poses de alegría, curiosidad, pensamiento y habla sólo demuestran combinaciones del rig. El contrato no define reproducción, secuencias, tiempos de acciones ni actividad ambiental. Al completar sus verificaciones, la fase permanece esperando aprobación humana.
