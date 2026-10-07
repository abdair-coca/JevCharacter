---
name: jev-code-health
description: "Trigger: código muerto, duplicación, refactor, cleanup, optimización. Audita la salud del código de JEVLING con evidencia del runtime y sus fases."
license: Apache-2.0
metadata:
  author: "abdair-coca"
  version: "1.0"
---

# JEVLING — auditoría de salud del código

## Activation Contract

Activa esta skill cuando pidan revisar código muerto o duplicado, complejidad innecesaria, oportunidades de refactor o rendimiento en este repositorio.

## Hard Rules

- Audita y reporta; modifica o elimina código solo si el usuario también solicita implementar los hallazgos.
- Antes de revisar, inspecciona `git status` y el diff pertinente. Conserva cambios locales y limita la revisión al alcance pedido.
- Trata el código y la configuración ejecutables como autoridad del comportamiento actual. Lee [spec](../../.dev/spec.md), [plan](../../.dev/plan.md) y [task activa](../../.dev/task.md) para no clasificar como muerto lo reservado a una fase aprobada; consulta [arquitectura](../../docs/architecture.md) e [interacción](../../docs/interaction.md) para entender runtime y contratos. Para UI, animación, estado compartido o dependencias, consulta también [design](../../design.md).
- Confirma ausencia de uso buscando imports, exports, rutas, lazy/dynamic imports, registros, referencias por string, configuración, scripts, pruebas y fases planeadas. Una búsqueda textual aislada no demuestra código muerto.
- Considera duplicación solo cuando coincidan responsabilidad e invariantes. Prefiere reutilización local clara a abstracciones genéricas o fusiones de flujos parecidos pero distintos.
- Propón optimización de rendimiento con un mecanismo y beneficio verificables; separa mediciones de hipótesis. No inspecciones, copies ni extraigas contenido del asset Rive.
- Verifica herramientas y comandos en `package.json`; informa checks ejecutados y omite los no ejecutados.

## Decision Gates

| Caso | Criterio |
|---|---|
| Alcance | Revisa solo los archivos señalados o el área conectada; amplía al repositorio únicamente si se pide una auditoría general. |
| Candidato a eliminar | Exige evidencia de no alcanzabilidad en runtime y de que no es requisito de configuración, prueba o fase futura. |
| Refactor u optimización | Recomienda solo cuando reduzca complejidad/coste sin cambiar contratos observables; indica cualquier incertidumbre. |

## Execution Steps

1. Identifica alcance, estado local y restricciones de la fase activa.
2. Sigue los puntos de entrada y límites de módulos desde la arquitectura hasta sus consumidores; busca todas las referencias de cada candidato.
3. Clasifica cada hallazgo como código muerto, duplicación, complejidad o rendimiento; descarta falsos positivos y anota evidencia verificable con ruta y líneas.
4. Prioriza impacto y confianza. Para comprobaciones necesarias, usa solo scripts/herramientas disponibles y relevantes al alcance.

## Output Contract

Devuelve primero un resumen breve. Para cada hallazgo incluye categoría, severidad, confianza, archivo y líneas, evidencia concreta, impacto y recomendación acotada. Si no hay hallazgos accionables, dilo y delimita qué se revisó; distingue claramente “sin problemas encontrados” de áreas no inspeccionadas.

## References

- [SDD activo](../../.dev/task.md) y [plan por fases](../../.dev/plan.md).
- [Arquitectura del runtime](../../docs/architecture.md) y [contratos de interacción/API](../../docs/interaction.md).
- [Diseño y matriz de verificación](../../design.md).
