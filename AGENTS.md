# JEVLING — instrucciones para agentes

## Entrada y alcance

1. **Trabajo planificado:** leer [.dev/spec.md](.dev/spec.md), [.dev/plan.md](.dev/plan.md) y [.dev/task.md](.dev/task.md). `spec.md` gobierna requisitos aprobados; `plan.md`, la secuencia y seams de las cinco fases; `task.md`, fase activa, checks, evidencia y próximo paso. Implementar solo la fase activa y detenerse tras entregarla para revisión.
2. **Diseño, UI, estado compartido, animación o dependencias:** leer [design.md](design.md) antes de cambiar código. Es el contrato del rediseño; distingue reglas aprobadas de valores iniciales por validar en Home.
3. **Comportamiento o API:** leer [arquitectura](docs/architecture.md) e [interacción](docs/interaction.md). Describen el runtime actual; el código confirma los contratos efectivos.
4. **About o créditos:** leer el [relato original](docs/jev-story.md). Mantener autoría de Abdair Coca y distinguir experimentación de visión futura.
5. **Rive:** consultar [modelo y límites de evidencia](docs/rive-model.md). Consumir el asset existente desde su componente; preservar los archivos originales y evitar duplicar bytes o contenido propietario en documentación/exports.
6. **Trabajo en `jev-lab/`:** leer sus [instrucciones locales](jev-lab/AGENTS.md). El usuario lo declaró terminado, sin aprobación formal registrada; su [plan archivado](.dev/archive/jev-lab-plan-2026-10-06.md) es antecedente. `.dev/tasks.md` fue un registro histórico separado del plan activo y se retiró de la copia de trabajo.

7. **Auditoría de salud del código:** para revisar código muerto, duplicación u oportunidades de simplificación/rendimiento, seguir la [skill del proyecto](.agents/jev-code-health/SKILL.md).

Índice de contexto: [docs/README.md](docs/README.md). Ejecución y herramientas instaladas: [README.md](README.md) y `package.json`.

## Reglas de trabajo

- Conservar el Jev actual. El rediseño tiene Home, Features determinista y About; tomar sus contratos de `design.md`, no de propuestas históricas del laboratorio.
- Mantener el proyecto 2D. La web usa tokens CSS y tipos estrictos para props, eventos y estado, sin `any`; justificar cualquier supresión excepcional de TypeScript junto a su causa.
- Mantener separados UI, decisiones reales y demostraciones. Features usa secuencias/datos predefinidos y no modifica la sesión de Home.
- Verificar `package.json` antes de asumir herramientas disponibles. El stack objetivo y ESLint no se consideran instalados por estar documentados.
- Preservar trabajo previo del usuario; revisar status/diff antes de editar archivos ya modificados. Mantener las modificaciones dentro del alcance solicitado.
- Mantener claves y variables de entorno de proveedores en servidor; conservar los límites del contrato de decisión y el contexto conversacional en memoria de sesión. No incluir secretos en documentación o bundles.

## Verificación y cierre

- Aplicar la [matriz de verificación](design.md#verificación-y-evidencia): typecheck por proyecto, ESLint, Vitest, build y Playwright según la entrega. El `tsconfig.json` raíz solo referencia proyectos.
- Registrar avance, comandos, resultados, capturas y limitaciones en `.dev/task.md`; cambios aprobados de requisitos en `spec.md` y cambios en el plan de fases en `plan.md`. Una comprobación no ejecutada queda pendiente; un resumen aprobado no equivale a una entrega aprobada.
- Para cambios exclusivamente documentales, comprobar referencias, coherencia, preservación de antecedentes y alcance del diff. No presentar una línea base del runtime como verificación del rediseño.
- Mantener documentación de estado actual y diseño objetivo diferenciadas. Actualizar la primera cuando la implementación cambie.
- Tras completar todas las fases y recibir aprobación final, informar resultados primero y después vaciar el contenido de `spec.md`, `plan.md` y `task.md`; conservar los tres archivos.
