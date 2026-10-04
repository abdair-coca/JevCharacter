# Anatomía estable de Mini JEV

La autoridad numérica es [`rive/character/body_contract.json`](rive/character/body_contract.json): IDs, medidas, paleta, neutral, límites y muestreo. El cuerpo es un rectángulo redondeado oscuro con luz violeta y halo; dos ojos blancos verticales. No tiene boca ni extremidades. `validators/build.py` materializa esa anatomía en `body.rml` y la ensambla en `main.rml`.

## Controles y representación real

| Concepto | RML / propiedad | Unidad |
|---|---|---|
| Transform x, y | `Jev` (`Node`) x, y | px del artboard |
| Transform rotation | `Jev.rotation` | radianes; contrato en grados |
| Transform scale | `Jev.scaleX`, `scaleY` | factor |
| Body width, height | `Rectangle` identificado por `ids.bodyGeometry`: width, height | px; escala corporal multiplica su tamaño |
| Body scale / squash | `BodyTransform` (`Node`) scaleX, scaleY | factor; afecta cuerpo, halo y ojos juntos |
| Body roundness | `Rectangle.cornerRadiusTL`, con `linkCornerRadius=true` | px |
| eyeX, eyeY | `Eyes` (`Node`) x, y | px locales antes de squash |
| eyeScale | `Eyes.scaleX = Eyes.scaleY` | factor uniforme |
| blink | `Blink.scaleY = 1 - blink` | 0 abierto, 1 cerrado |

`happy_bounce` anima solo transformaciones, mirada, tamaño uniforme de ojos y cierre parcial. Los controles de geometría están permitidos para futuras pruebas dentro de los mismos límites; no necesitan un editor ni un runtime de controles.

## Límites

Dimensiones corporales: 70–140% del tamaño base, incluyendo transformación compuesta. Escalas de `Jev` y `BodyTransform`: 0.75–1.30, tanto individualmente como su producto. Rotación: ±25°. Ojos: escala 0.7–1.3; blink 0–1; desplazamiento dentro del rango JSON **y** dentro de la cara redondeada con margen. Redondez: 80–100% de la mitad de la dimensión menor. El artboard debe contener cuerpo, halo y ojos completos.

La spec de `happy_bounce` estrecha escala máxima a 1.2, rotación a ±8° y duración a 600–850 ms. `curious_look` conserva esta misma anatomía, mantiene tamaño/parpadeo de ojos y limita stretch vertical a 5–10%, escala máxima a 1.1, inclinación derecha a 6° y duración a 700–900 ms. Ninguna excepción está declarada.

## Invariantes verificadas

La estructura, dos ojos, colores y geometría base coinciden con el contrato. Solo la lista explícita de pistas del validador puede animarse; añadir una propiedad exige revisar su schema y ampliar el validador conscientemente. Todas las pistas tienen inicio y final exactamente neutrales. Los últimos dos frames mantienen neutral para absorber el tick de entrada de la state machine observado en la CLI. `oneShot` conserva esa pose después de terminar.

Un agente conserva silueta, identidad y anatomía; una animación temporal devuelve cada propiedad a neutral. Los números de RML son implementación explícita comprobada contra JSON. Cambiar JSON es un cambio deliberado de contrato, no una forma de admitir silenciosamente una deformación.
