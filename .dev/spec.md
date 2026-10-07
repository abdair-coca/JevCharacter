# Spec: rediseño de JEVLING

**Estado:** producto y alcance aprobados el 2026-10-06. Fases 1 y 2 aceptadas al autorizar continuar; fase 3 activa desde la solicitud «ahora continua con la fase 3» (2026-10-07).

**Fuentes:** [contrato visual](../design.md), [relato de About](../docs/jev-story.md), [plan de implementación](plan.md), [tarea activa y handoff](task.md).

Estos tres archivos SDD son registros temporales de ejecución de esta feature: permanecen durante todo el trabajo y se vacían, sin borrarlos, solo después de completar/aprobar todas las fases y recibir aprobación final explícita.

## Problema y resultado

JEVLING debe presentarse como una criatura digital que percibe, reacciona y toma decisiones, no como un chatbot con un avatar. La web debe explicarse principalmente mediante las acciones de Jev, con textos breves, interacción sencilla e impacto visual. Diseñar para público general y personas interesadas en el diseño/desarrollo del proyecto.

El usuario debe poder probar Jev en Home, comprender capacidades actuales mediante demostraciones reproducibles en Features y conocer origen, creador y visión en About.

## Audiencia y contexto

- Público general que descubre a Jev por primera vez y necesita entender cómo interactuar sin leer instrucciones largas.
- Diseñadores y desarrolladores interesados en las respuestas visuales y la construcción de una interfaz viva.
- Personas que evalúan el proyecto y desean conocer su proceso y autoría.

La interfaz general es sencilla. Los detalles técnicos o narrativos se ofrecen como contenido opcional y progresivo.

## Alcance

### Navegación

Tres vistas independientes con navegación persistente y enlaces directos:

| Ruta | Propósito |
|---|---|
| `/` — Home | Probar e interactuar con el Jev existente. |
| `/features` — Features | Recorrido determinista que muestra las capacidades disponibles mediante Jev. |
| `/about` — About | Presentación scrollytelling del origen, proceso, creador y visión. |

Las rutas deben soportar carga directa, recarga y navegación atrás/adelante. La navegación no debe destruir accidentalmente la sesión de Home.

Fase 2: el usuario confirmó que regresar desde Features/About solo reanuda la sesión, sin consultar IA. La reacción tras ausencia real de pestaña/ventana se conserva por separado.

### Home

- Mantener el personaje Rive actual y sus animaciones.
- Conservar entrada de texto, interacción pointer/touch, respuestas, diagnóstico y HUD.
- Hacer el input evidente y el texto de bienvenida breve.
- Revisión de fase 1: input debajo de Jev centrado respecto al eje de la página, HUD a su derecha sin desplazarlo. En móvil, HUD compacto encima del input y alineado a la derecha (confirmado por el usuario).
- Integración de Jev: render directo en un solo canvas y máscara radial CSS original, sin procesamiento de píxeles por frame. Tras probar la exportación `prove2.riv` aportada por el usuario, este confirmó que funciona bien y pidió aumentar ligeramente al personaje: escala actual `1.9` (aproximadamente +10 % frente a `1.72`). Las exportaciones anteriores se conservan intactas.
- Mantener siempre visibles la decisión elegida y su confianza; desplegar el resto de métricas del HUD a demanda.
- Revisión de controles: input y HUD con aspecto orgánico conectado visualmente con Jev, feedback expresivo y animación suave también en reposo, vinculada al estado real. Mantener posiciones acordadas, accesibilidad, pausa fuera de vista y movimiento reducido.
- Revisión solicitada el 2026-10-07: detalles del HUD hacia arriba, superpuestos sin desplazar el input. En móvil, botón minimalista pequeño a la derecha encima del input; pulsarlo abre/cierra las métricas. Home debe ocupar una sola pantalla sin scroll en escritorio/móvil, también con HUD abierto.
- Si la decisión remota no está disponible, mantener reacciones locales y marcar brevemente el modo local.
- «Borrar contexto» vacía también los intercambios de conversación guardados en memoria y cancela la respuesta actual; conserva preferencias y personalidad local (confirmado en fase 2).

### Features

Recorrido con scroll y controles accesibles de avanzar, retroceder y repetir. El mismo contenido y las mismas acciones deben reproducirse sin red, de forma determinista y sin cambiar estado real de Home.

Capítulos aprobados:

1. **Percibe:** seguimiento/respuesta representados mediante una escena de ejemplo.
2. **Reacciona:** saludo y reacciones visuales disponibles.
3. **Decide:** situación predefinida → acción tipada y presentación del HUD.
4. **Responde:** demostraciones visuales sí/no.
5. **Habla:** pensamiento, gesto de habla y una frase escrita de ejemplo.
6. **Se transforma:** formas que el runtime actual pueda reproducir y validar.
7. **Se adapta:** personalidad, contexto temporal y retorno tras ausencia, simulados con datos fijos.
8. **Sigue contigo:** fallback local ante indisponibilidad remota.

Features no presenta datos sintéticos como lecturas actuales de Jev. El usuario puede seleccionar/repetir una secuencia; una ejecución siempre usa la misma acción, texto, tiempos y datos para el mismo idioma/progreso lógico.

**Dirección visual confirmada durante fase 3:** recorrido abierto sin tarjetas ni marco alrededor de Jev. Las explicaciones se alternan izquierda/derecha; Jev atraviesa los espacios libres con el scroll, en sentido opuesto al texto. En móvil se adapta la trayectoria y la separación vertical para conservar esa libertad. Decisión, confianza y otras métricas se explican en su capítulo, no como un HUD/etiqueta persistente. Los ejemplos se identifican de forma contextual, evitando rótulos repetidos sobre el personaje.

### About

Narrativa de cinco escenas, con texto conciso y detalles ampliables:

1. La pregunta: «¿Qué pasaría si una IA no viviera dentro de una caja de chat?»
2. El experimento de crear un personaje 2D que mira, reacciona y cambia de forma.
3. La evolución desde Rive hacia comportamiento, personalidad y decisiones.
4. Abdair Coca, estudiante de Ingeniería Informática y creador de JEV; experimentación con Rive, React e IA.
5. La visión futura, claramente identificada como visión, y cierre “Tiny creature. Big decisions.”

Usar el relato original en `docs/jev-story.md`. No inventar fechas, hitos, imágenes personales ni capacidades entregadas. La historia debe separar el trabajo experimental de lo que funciona hoy.

## Idioma y tema

- Toda la interfaz, navegación, texto accesible, Features y About están disponibles en español e inglés.
- Las respuestas nuevas de habla de Jev usan el idioma ES/EN elegido, validado en cliente y servidor. Al cambiar el idioma durante una respuesta, cancelar la generación anterior para impedir mezcla de idiomas.
- Continuación confirmada: si cambia el idioma durante una generación de habla, descartar sus fragmentos y regenerar automáticamente para el mismo mensaje en el idioma nuevo, sin duplicar el intercambio en el historial. Al ocultar Home se cancela sin reanudar respuestas obsoletas.
- Primera visita: idioma del navegador si es ES/EN; en otro caso español. Guardar una preferencia manual.
- Primera visita: tema del sistema. Guardar una elección manual y no sustituirla con cambios posteriores del sistema.
- El control visible es un botón claro/oscuro con feedback interactivo; «Sistema» no es una tercera opción. ES/EN muestra ambas opciones con indicador animado de selección.
- Cambiar idioma o tema conserva ruta y progreso. Preferencias no reinician Home ni remontan el personaje.

## Identidad visual aprobada

- Estilo minimalista expresivo: espacio libre, tipografía con carácter, jerarquía inmediata, Jev como foco.
- Paleta exacta indicada por el usuario y tokens efectivos: [design.md, sección de color](../design.md#paleta-indicada-durante-fase-1--2026-10-06).
- Prohibido verde y lima en cualquier estado/acento.
- Conservar el Jev actual; no integrar el personaje de `jev-lab`.
- Contrato responsive, motion, 2D, tokens, contraste y bundle: [design.md](../design.md).

La composición revisada de Home es la referencia aceptada al autorizar el usuario pasar a la fase siguiente. Conservarla durante fase 2. Las comprobaciones físicas pendientes siguen registradas en `task.md`; la aprobación no convierte emulación en evidencia física.

## Estado real y separación de sistemas

- Home usa servicios reales donde están disponibles, contexto acotado en memoria de sesión y fallback local.
- Features es un guion de demostración fijo; no consume servicios remotos, sensores reales ni randomización, y no modifica personalidad/contexto de Home.
- About presenta historial y visión, no una lista ficticia de capacidades actuales.
- Las claves de proveedores siguen exclusivamente server-side.
- El stack objetivo de UI es React/TypeScript strict/Vite, Tailwind v4, shadcn/ui, Motion y Zustand; XState y GSAP/ScrollTrigger/Lenis se incorporan en fases de presentación. Consultar `package.json` para comprobar herramientas instaladas.

## Criterios globales de aceptación

- Home clara, usable y aprobada visualmente por el usuario en escritorio y móvil, con ambos temas.
- Navegación con rutas directas y teclado, sin pérdida accidental de estado.
- ES/EN correcto para UI, estados y nuevas respuestas de Jev.
- Features reproducible, navegable por scroll/controles/teclado y desacoplada del estado real.
- About fiel al relato, accesible sin depender de animación y con autoría clara.
- Movimiento reducido, foco visible, contraste verificable, alternativas textuales y layout móvil.
- Typecheck por proyecto, ESLint, Vitest, build y Playwright completados según fase; rendimiento medido con condiciones declaradas.
- Cada entrega requiere revisión explícita; la aprobación de plan o tests no implica aprobación visual.

## Fuera de alcance

- Rediseñar o reemplazar el personaje, el rig o las animaciones originales Rive.
- Añadir escena 3D, WebGL 3D, three.js, R3F o drei.
- Conectar Features a IA o convertir About en promesa de capacidades futuras.
- Introducir persistencia remota, sincronización de usuario o base de datos.
- Publicar/desplegar la web como parte de estas fases.

## Aprobaciones

- [x] Objetivo, público, tres vistas, tema, ES/EN, paleta sin verde/lima, Home funcional, Features determinista y relato de About: aprobados el 2026-10-06.
- [x] Cinco resúmenes de fase y plan inicial: aprobados el 2026-10-06.
- [x] Fase 1 aceptada al solicitar el usuario «continua con la siguiente fase» tras la entrega de controles orgánicos.
- [x] Fase 2, incluida revisión del HUD/Home sin scroll: aceptada al solicitar continuar con fase 3.
- [ ] Aprobación de entregas de fases 3–5: pendientes por fase.
