# Spec: rediseño de JEVLING

**Estado:** producto y alcance aprobados el 2026-10-06. Fases 1–3 aceptadas; fase 4 activa tras «perfecto, aora continua con la siguiente fase, esta ya esta aprobada» (2026-10-07, host local).

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

### Decisión remota en producción — autorizada el 2026-10-09

Después de la publicación estática, el usuario pidió activar el modelo en producción y autorizó «hazlo tu, las variables ya estan en vercel.com». Se autoriza un nuevo despliegue ordinario de `jev-bot`, con las funciones existentes y las variables Production configuradas por el usuario, y la comprobación de una decisión real desde Home. La restricción anterior «sin backend aún» corresponde a la publicación previa. La demo UATF sigue local; las revisiones visuales y las puertas del rediseño permanecen pendientes.

### Publicación frontend — autorizada el 2026-10-09

El usuario pidió «quiero que microcomitees y lo desplegues en vercel, sin backend aun». Se autoriza organizar el trabajo pendiente en microcommits y publicar un artefacto estático en Vercel: Home con decisiones locales sin requests API, Features/About y demo UATF disponibles, sin funciones ni claves de proveedores. Esta publicación es una tarea independiente de las puertas de revisión del rediseño; no declara aprobadas las entregas pendientes ni abre la fase 5.

### Demo visual de inscripción UATF — especificación aprobada

**Aprobación:** el usuario respondió «aprobado» a la especificación consolidada después de diez decisiones de descubrimiento, «hazlo» al resumen de una única fase y «si apruebo» al plan completo. Esta ampliación conserva el historial y la revisión pendiente del rediseño.

#### Objetivo y audiencia

Añadir en Inicio una experiencia visual para interesados en Ingeniería Informática de la Universidad Autónoma Tomás Frías (UATF). Jev abre un formulario, acompaña el llenado y celebra la aceptación local. Es una demostración: no realiza una inscripción oficial ni guarda o envía datos.

#### Recorrido y contenido

1. El usuario escribe en el input actual una intención como «quiero inscribirme», «quiero registrarme», «quiero estudiar informática» o «me interesa la carrera». La detección local admite mayúsculas, tildes y puntuación; una negación como «no quiero inscribirme» no abre la experiencia. La UI y las expresiones equivalentes se localizan ES/EN.
2. Una reacción del Jev existente, su desplazamiento suave y una estela breve de partículas descubren un formulario minimalista «Ingeniería Informática · UATF». Los dos campos aparecen juntos; el formulario no espera a que termine la animación para poder usarse.
3. **Nombre completo:** obligatorio, con tildes y nombres compuestos. **Celular:** ocho dígitos, `+591` opcional; se toleran espacios/guiones de formato. Validación local, mensajes junto al campo y conservación del texto para corregir errores.
4. **Confirmar datos** valida y produce una reacción celebratoria del repertorio actual de Jev, partículas breves y el mensaje **Datos completados**. Una indicación discreta identifica la demostración sin envío. **Volver a Jev** cierra suavemente la experiencia.
5. Cerrar o abandonar Inicio descarta los datos; reabrir comienza vacío. Cambiar tema/idioma mientras el formulario permanece abierto conserva su llenado.

#### Composición y límites

- Alcance acotado a añadir esta experiencia en Inicio. Preservar las otras secciones, apariencia normal de Home, trabajo local y asset Rive actuales.
- Móvil: Jev encima del formulario, más compacto al aparecer el teclado; campos y confirmación accesibles en viewport estrecho/bajo.
- Teclado, foco, etiquetas, errores accesibles, ES/EN y ambos temas. Movimiento reducido con presentación estática funcional.
- Si Jev tarda en cargar o la animación falla, el formulario y su confirmación siguen disponibles.
- Datos exclusivamente en memoria temporal de esta experiencia: sin base de datos, localStorage/sessionStorage, APIs, proveedores IA ni registro de valores personales en logs.
- Reutilizar el mismo Character/controlador. Suspender la actividad conversacional durante la experiencia para que una respuesta pendiente no interrumpa la escena; recuperar Inicio al cerrar.
- Sin nueva ruta, cuentas, integración institucional, WhatsApp, nuevas dependencias ni cambios del personaje para esta entrega.

#### Criterios de aceptación

- Una intención compatible abre un único formulario y una negación no lo abre. Los otros mensajes siguen su camino normal.
- Ambos campos están disponibles simultáneamente; errores corregibles y confirmación solo con datos válidos.
- Entrada, aceptación y regreso suaves; ninguna espera de animación bloquea el formulario.
- Cerrar o salir de Inicio limpia los datos; cambio de tema/idioma conserva el formulario abierto.
- Ningún valor del formulario llega a servicios remotos, almacenamiento persistente o historial conversacional.
- Jev conserva una sola instancia; sus reacciones de formulario no compiten con decisiones/habla previas. Suspensión, desmontaje y movimiento reducido cancelan la decoración correspondiente.
- Funcionamiento comprobado con teclado, ES/EN, claro/oscuro, escritorio, móvil y alternativa sin Rive.
- Typecheck por proyecto, ESLint, Vitest, build y Playwright con capturas de esta entrega. La aceptación visual es independiente de los checks automáticos.

### Pulido solicitado — 2026-10-08

Revisión explícita de la entrega actual, empezando por Inicio, dentro de la fase 4 abierta. Sustituye los requisitos anteriores de controles orgánicos prominentes y navegación tipo diapositivas:
- Home: Jev considerablemente mayor; título discreto, input/HUD compactos sin miniaturas/logos, sin introducción, pie promocional ni textos de ayuda/contexto redundantes. Conservar acción/confianza, conversación y diagnóstico.
- Features y Story: retirar numeración, barras de presentación y anterior/repetir/siguiente. Retirar «Cómo funciona» y «Un poco más de historia». Conservar lectura semántica y navegación por scroll/teclado nativo.
- «Ver escena» y «Revelar a Jev» recorren el scroll suavemente. Jev sigue el scroll con retardo/inercia y deriva vertical, no pegado al progreso instantáneo.
- Partículas: deformación local al cursor con retorno elástico, corrientes/estelas más expresivas; mantener Canvas 2D, pausa, presupuesto adaptable y reduced motion.
- Móvil: ilustración protagonista en la zona superior/media y texto separado debajo; evitar personaje permanentemente pegado al fondo.

Esta solicitud autoriza el delta de implementación; no implica aprobación final de fase 4 ni inicio de fase 5.

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
- Integración de Jev: render directo en un solo canvas, sin procesamiento de píxeles por frame. Tras probar la exportación `prove2.riv` aportada por el usuario, este confirmó que funciona bien y pidió aumentar ligeramente al personaje: escala actual `1.9` (aproximadamente +10 % frente a `1.72`). El 2026-10-07 pidió retirar únicamente la máscara radial CSS: la exportación ya es transparente y el desvanecimiento ovalado recortaba las acciones amplias. Las exportaciones anteriores se conservan intactas.
- Mantener siempre visibles la decisión elegida y su confianza; desplegar el resto de métricas del HUD a demanda.
- Revisión de controles: input y HUD con aspecto orgánico conectado visualmente con Jev, feedback expresivo y animación suave también en reposo, vinculada al estado real. Mantener posiciones acordadas, accesibilidad, pausa fuera de vista y movimiento reducido.
- Revisión solicitada el 2026-10-07: detalles del HUD hacia arriba, superpuestos sin desplazar el input. En móvil, botón minimalista pequeño a la derecha encima del input; pulsarlo abre/cierra las métricas. Home debe ocupar una sola pantalla sin scroll en escritorio/móvil, también con HUD abierto.
- Si la decisión remota no está disponible, mantener reacciones locales y marcar brevemente el modo local.
- «Borrar contexto» vacía también los intercambios de conversación guardados en memoria y cancela la respuesta actual; conserva preferencias y personalidad local (confirmado en fase 2).
- `QUESTION` es una reacción remota de Home para comentarios claramente raros/juzgables o preguntas incómodas (ejemplos del usuario: «¿eres gay?» y «¿te gusta el FOMO?»), no para preguntas neutras. Muestra brevemente la duda divertida de ceja elevada y vuelve a `Base`; ante ambigüedad usa una reacción normal. Disponible también en diagnóstico y localizada ES/EN; el fallback local no la elige.

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

**Revisión aprobada el 2026-10-08:** About amplía el relato al recorrido real de Abdair: presentación → Bob (primer gran proyecto, robot de cartón con IA, reconocimiento, seguimiento de caras, habla, expresión emocional y memoria persistente) → TitiEdu (enseñanza de POO, IA/RAG y juegos HTML/CSS/JS) → machine-learning-App (algoritmos y ejecución con Pyodide) → JEV/visión futura. El orden intermedio es editorial, sin fechas ni causalidades inventadas. `public/story/bob.jpeg`, `curiousTiti.webp` y `housingML.svg` forman imágenes de partículas, con el gráfico de ML como foco y texto HTML legible. Escenario oscuro cinematográfico en ambos temas, partículas violeta/magenta, espiral, estelas, profundidad aparente 2D y composición móvil. Cierre: estrella de cinco puntas enteramente de partículas, hold reconocible y apertura reversible por scroll para revelar el Jev existente. Lectura ES/EN, detalles, reduced motion, pausa y errores siguen disponibles. Usuario aprobó alcance/plan y pidió implementarlo; fase 4 continúa abierta.

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
- Publicar/desplegar la web como parte de estas fases; las publicaciones autorizadas arriba son tareas separadas.

## Aprobaciones

- [x] Objetivo, público, tres vistas, tema, ES/EN, paleta sin verde/lima, Home funcional, Features determinista y relato de About: aprobados el 2026-10-06.
- [x] Cinco resúmenes de fase y plan inicial: aprobados el 2026-10-06.
- [x] Fase 1 aceptada al solicitar el usuario «continua con la siguiente fase» tras la entrega de controles orgánicos.
- [x] Fase 2, incluida revisión del HUD/Home sin scroll: aceptada al solicitar continuar con fase 3.
- [x] Fase 3, incluida retirada del cursor decorativo de Percibe: aprobada con «perfecto, aora continua con la siguiente fase, esta ya esta aprobada».
- [ ] Aprobación de entregas de fases 4–5: pendientes por fase.
