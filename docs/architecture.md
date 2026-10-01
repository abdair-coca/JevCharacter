# Arquitectura

La aplicación separa percepción local, decisión conductual y presentación. La decisión no es texto de chatbot: es un contrato pequeño que guía reacción, ambiente y atención.

## Runtime

`src/main.tsx` monta `App` dentro de React. `App` compone `Character`, `AmbientStage`, `ContextWhisper`, `BrainHUD` y `DebugPanel`; conecta el sensor pointer con `useCreatureBrain` y el controlador del personaje.

| Área | Responsabilidad |
|---|---|
| `creature/sensors/pointerSensor.ts` | Mide pointer, actividad, proximidad, clicks y ausencia en cliente; actualiza variables CSS para seguimiento visual. |
| `hooks/useCreatureBrain.ts` | Reúne estado de mundo y personalidad; aplica acciones Jev, cancela respuestas y mantiene hasta cuatro turnos solo en memoria de sesión. |
| `creature/brain/decisionScheduler.ts` | Controla causas de solicitud, espera, deduplicación, caché, límites, validación y fallback. |
| `creature/brain/speechClient.ts` | Lee SSE de `/api/talk`, cancela por `AbortSignal` y limita el texto mostrado a una frase breve. |
| `creature/brain/fallbackBrain.ts` | Produce decisión local cuando endpoint no está disponible o límite local impide consultar. |
| `api/decide.ts` | Implementa endpoint opcional: valida estado, limita solicitudes y, si hay configuración, llama al SDK TypeSafe. |
| `api/talk.ts` | Llama a Groq solo tras acción contextual `talk`; valida el texto y transmite una frase de hasta 120 caracteres. |
| `creature/rive/riveReactionAdapter.ts` y `character/useCharacterController.ts` | Mapean reacción a enum y trigger del controlador; temporizan estados transitorios. |
| `components/AmbientStage.tsx` y `BrainHUD.tsx` | Presentan intensidad, atención, reacción, confianza, probabilidades y personalidad. |

## Camino de datos

1. Sensor mantiene `SensorSnapshot` solo en cliente. Escribe posición normalizada en propiedades CSS; permite movimiento visual inmediato sin esperar a una decisión.
2. Para una decisión, `useCreatureBrain` arma `CreatureWorldState`: contexto, inactividad/retorno/ausencia, reacción previa, tiempo desde reacción, personalidad y duración de sesión. No incluye posición, distancia ni velocidad del cursor.
3. Contexto enviado explícitamente solicita una decisión contextual. El scheduler también puede solicitarla al volver tras una ausencia suficiente, una vez cumplido el cooldown.
4. Scheduler puede reutilizar caché; limita ritmo, aborta reemplazos/tiempos agotados y valida respuesta. Si falla o endpoint informa `unavailable`, recurre a `fallbackBrain`.
5. La decisión coherida actualiza estado e interfaz. Adaptador traduce reacción a estado Rive; intensidad y atención alimentan el escenario.
6. Si la acción contextual es `talk`, Jev termina primero. `think` sigue hasta que llegue el primer texto de Groq; un único rótulo recibe los fragmentos y desaparece al cabo de unos 5 s.

## Servicio y persistencia

El middleware de Vite carga `TYPESAFE_API_KEY`, `JEV_MODEL`, `GROQ_API_KEY` y `GROQ_MODEL` desde `.env` al entorno server-side y delega `POST /api/decide` y `POST /api/talk` a sus handlers reales. La segunda ruta transmite SSE y solo consulta Groq tras una acción contextual `talk`. Las claves no se incluyen en el bundle del navegador. Vercel limita la ruta de habla a 10 s. El build local no prueba despliegue ni disponibilidad del proveedor.

Los mensajes y respuestas no se guardan en `localStorage`: el contexto actual y los últimos cuatro intercambios completos viven en memoria de la página y se pierden al recargar. Al iniciar se elimina el antiguo valor `jevling.context`. La personalidad sigue en `jevling.personality`, con validación local. No hay base de datos indicada por este flujo.

## Stack y comandos

React 19, TypeScript 6, Vite 8, Rive React y `@typesafe-ai/sdk`. Scripts del proyecto: `dev`, `typecheck`, `build`, `lint` y `preview` mediante npm. Ver [entrada para agentes](README.md) e [interacción](interaction.md).

## Límite del asset

`Character` consume un asset Rive propiedad del usuario desde la ruta que configura la fuente. Documentar solo esa dependencia: no copiar, extraer, incrustar ni describir el contenido propietario del asset o de medios exclusivos. Ruta local no constituye contrato estable.
