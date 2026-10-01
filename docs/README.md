# JEVLING: guía para agentes

JEVLING es una criatura digital interactiva, no un chatbot de conversación libre. El usuario puede darle contexto; el sistema convierte un estado acotado en una decisión estructurada y una respuesta visual, con instinto local cuando el servicio no está disponible.

Esta carpeta orienta a personas y modelos de lenguaje sobre el comportamiento observable y la arquitectura. La fuente es la autoridad para detalles de implementación; estas notas no describen internas de animación ni garantizan un despliegue activo.

## Lectura rápida

- [Arquitectura](architecture.md): runtime, responsabilidades de módulos, estado y camino de decisión.
- [Interacción](interaction.md): pointer, entradas explícitas, disparadores de decisión y estados Rive.
- [Modelo Rive prove1](rive-model.md): artboards, animaciones, ViewModels, nombres exactos y límites de la inspección.

## Contexto del proyecto

- `src/main.tsx` monta `App`; la interfaz reúne criatura, ambiente, indicadores y controles de contexto/diagnóstico.
- React compone la experiencia; TypeScript define contratos; Vite sirve el desarrollo y prepara el build. Rive presenta el personaje. Jev puede producir decisiones estructuradas mediante `POST /api/decide`; existe también una ruta de fallback local.
- Decisión describe reacción, confianza, probabilidades, intensidad ambiental e intención de atención. No genera una respuesta textual para mostrar como chat.
- Pointer-follow y lecturas de sensor ocurren localmente. No confundir movimiento del cursor con una solicitud al modelo ni con el `CreatureWorldState` enviado al endpoint.
- El contexto y hasta cuatro intercambios completos viven solo en memoria de sesión. La personalidad sí se guarda en `localStorage`; nada se sincroniza entre dispositivos.

## Límites de evidencia

- Vite ejecuta `api/decide.ts` y `api/talk.ts` como middleware local. Carga las claves Jev/Groq solo en el servidor; `/api/talk` llama a Groq únicamente tras una acción contextual `talk`.
- `Character` depende de un asset Rive propiedad del usuario, cargado desde la ruta configurada en la fuente. No duplicar bytes, extraer, incrustar ni describir contenido propietario de Rive o de otros medios en documentación o exports. La ruta y los archivos locales pueden cambiar.
- No incluir valores de `.env`, claves ni secretos.

## Desarrollo

Requisitos y comandos están en el [README del proyecto](../README.md). Scripts disponibles: `npm run dev`, `npm run typecheck`, `npm run build`, `npm run lint` y `npm run preview`.
