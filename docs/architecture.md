# Arquitectura

La aplicación separa percepción local, decisión conductual y presentación. La decisión no es texto de chatbot: es un contrato pequeño que guía reacción, ambiente y atención.

## Runtime

`src/main.tsx` monta `App` dentro de React. `App` compone `Character`, `AmbientStage`, `ContextWhisper`, `BrainHUD` y `DebugPanel`; conecta el sensor pointer con `useCreatureBrain` y el controlador del personaje.

| Área | Responsabilidad |
|---|---|
| `creature/sensors/pointerSensor.ts` | Mide pointer, actividad, proximidad, clicks y ausencia en cliente; actualiza variables CSS para seguimiento visual. |
| `hooks/useCreatureBrain.ts` | Reúne el estado de mundo, contexto y personalidad; conecta scheduler, storage y reacción Rive. |
| `creature/brain/decisionScheduler.ts` | Controla causas de solicitud, espera, deduplicación, caché, límites, validación y fallback. |
| `creature/brain/fallbackBrain.ts` | Produce decisión local cuando endpoint no está disponible o límite local impide consultar. |
| `api/decide.ts` | Implementa endpoint opcional: valida estado, limita solicitudes y, si hay configuración, llama al SDK TypeSafe. |
| `creature/rive/riveReactionAdapter.ts` y `character/useCharacterController.ts` | Mapean reacción a enum y trigger del controlador; temporizan estados transitorios. |
| `components/AmbientStage.tsx` y `BrainHUD.tsx` | Presentan intensidad, atención, reacción, confianza, probabilidades y personalidad. |

## Camino de datos

1. Sensor mantiene `SensorSnapshot` solo en cliente. Escribe posición normalizada en propiedades CSS; permite movimiento visual inmediato sin esperar a una decisión.
2. Para una decisión, `useCreatureBrain` arma `CreatureWorldState`: contexto, inactividad/retorno/ausencia, reacción previa, tiempo desde reacción, personalidad y duración de sesión. No incluye posición, distancia ni velocidad del cursor.
3. Contexto enviado explícitamente solicita una decisión contextual. El scheduler también puede solicitarla al volver tras una ausencia suficiente, una vez cumplido el cooldown.
4. Scheduler puede reutilizar caché; limita ritmo, aborta reemplazos/tiempos agotados y valida respuesta. Si falla o endpoint informa `unavailable`, recurre a `fallbackBrain`.
5. La decisión coherida actualiza estado e interfaz. Adaptador traduce reacción a estado Rive; intensidad y atención alimentan el escenario.

## Servicio y persistencia

El middleware de desarrollo de Vite simula `POST /api/decide` con respuesta `unavailable`, por lo que la app demuestra el fallback local. El archivo `api/decide.ts` define una ruta de servidor opcional que requiere configuración server-side para usar Jev. Código y configuración local no prueban despliegue.

Contexto (`jevling.context`) y personalidad (`jevling.personality`) se guardan localmente con validación de versión y forma. No hay base de datos indicada por este flujo; borrar el almacenamiento del navegador elimina esos datos locales.

## Stack y comandos

React 19, TypeScript 6, Vite 8, Rive React y `@typesafe-ai/sdk`. Scripts del proyecto: `dev`, `typecheck`, `build`, `lint` y `preview` mediante npm. Ver [entrada para agentes](README.md) e [interacción](interaction.md).

## Límite del asset

`Character` consume un asset Rive propiedad del usuario desde la ruta que configura la fuente. Documentar solo esa dependencia: no copiar, extraer, incrustar ni describir el contenido propietario del asset o de medios exclusivos. Ruta local no constituye contrato estable.
