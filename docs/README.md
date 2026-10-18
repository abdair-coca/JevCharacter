# JEVLING: guía para agentes

JEVLING es una criatura digital interactiva, no un chatbot de conversación libre. El usuario puede darle contexto; el sistema convierte un estado acotado en una decisión estructurada y una respuesta visual, con instinto local cuando el servicio no está disponible.

Esta carpeta orienta a personas y modelos de lenguaje sobre el comportamiento observable y la arquitectura. La fuente es la autoridad para detalles de implementación; estas notas no describen internas de animación ni garantizan un despliegue activo.

## Lectura rápida

- [Instrucciones raíz para agentes](../AGENTS.md): qué documento consultar según el trabajo y cómo registrar evidencia.
- Los SDD de la feature ([spec](../.dev/spec.md), [plan por fases](../.dev/plan.md) y [tarea](../.dev/task.md)) se vaciaron tras la aprobación final de la fase 5 el 2026-10-18; su historial está en git. Fases 1–4 aceptadas o aprobadas; la fase 5 (integración, accesibilidad, rendimiento y voz de Jev) quedó aprobada.
- [Contrato de diseño](../design.md): reglas visuales, tokens, ES/EN, temas, animación 2D, accesibilidad y verificación.
- [Historia de JEV](jev-story.md): relato original del usuario y autoría para About.
- [Arquitectura](architecture.md): runtime, responsabilidades de módulos, estado y camino de decisión.
- [Interacción](interaction.md): pointer, entradas explícitas, disparadores de decisión y estados Rive.
- [Modelo Rive prove1](rive-model.md): artboards, animaciones, ViewModels, nombres exactos y límites de la inspección.

## Estado del rediseño

Fases 1–4 fueron aceptadas o aprobadas, y la fase 5 se aprobó el 2026-10-18. Home conserva sesión en memoria suspendida al ocultarse; la [producción actual verificó decisión remota real](../.dev/evidence/decision-production/README.md), mientras `build:frontend` sigue disponible como alternativa local. Features presenta ocho escenas deterministas; [evidencia de fase 3](../.dev/evidence/phase-3/README.md). About narra el recorrido de Abdair Coca con partículas 2D; [evidencia inicial de fase 4](../.dev/evidence/phase-4/README.md) y [pulido vigente](../.dev/evidence/polish/README.md). Inicio incorpora la [demo local UATF](../.dev/evidence/enrollment/README.md), sin aprobación visual registrada. Jev tiene voz sintetizada en Inicio y Capacidades, e Historia tiene banda sonora. La integración final está en [evidencia de fase 5](../.dev/evidence/phase-5/README.md); su evidencia de sonido describe la voz anterior y queda pendiente de regenerar.

El usuario declaró terminado JEV Lab y pidió reemplazar su plan activo, aclarando que no había registrado aprobación formal. El [plan anterior](../.dev/archive/jev-lab-plan-2026-10-06.md) conserva íntegro su estado histórico. Las instrucciones locales del laboratorio siguen en [jev-lab/AGENTS.md](../jev-lab/AGENTS.md).

## Contexto del proyecto

- `src/main.tsx` monta `App`, que gobierna cabecera, preferencias y rutas; `HomePage` reúne criatura, indicadores y controles de contexto/diagnóstico.
- React compone la experiencia; TypeScript define contratos; Vite sirve el desarrollo y prepara el build. Rive presenta el personaje. Jev puede producir decisiones estructuradas mediante `POST /api/decide`; existe también una ruta de fallback local.
- Decisión describe reacción, confianza, probabilidades, intensidad ambiental e intención de atención. No genera una respuesta textual para mostrar como chat.
- Pointer-follow y lecturas de sensor ocurren localmente. No confundir movimiento del cursor con una solicitud al modelo ni con el `CreatureWorldState` enviado al endpoint.
- El contexto y hasta dos intercambios completos viven solo en memoria de sesión (`SPEECH_HISTORY_LIMIT=2`). Navegar dentro de la web los conserva; recargar o borrar la conversación los elimina. La personalidad sí se guarda en `localStorage`; nada se sincroniza entre dispositivos.

## Límites de evidencia

- Vite ejecuta `api/decide.ts` y `api/talk.ts` como middleware local. Carga las claves Jev/Groq solo en el servidor; `/api/talk` llama a Groq únicamente tras una acción contextual `talk`.
- `Character` depende de un asset Rive propiedad del usuario, cargado desde la ruta configurada en la fuente. No duplicar bytes, extraer, incrustar ni describir contenido propietario de Rive o de otros medios en documentación o exports. La ruta y los archivos locales pueden cambiar.
- No incluir valores de `.env`, claves ni secretos.

## Desarrollo

Requisitos y comandos están en el [README del proyecto](../README.md). `package.json` es la fuente de scripts disponibles. Para verificar una entrega, aplicar la matriz de [design.md](../design.md#verificación-y-evidencia).
