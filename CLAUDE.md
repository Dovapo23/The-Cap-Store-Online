# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# CapsStore — Instrucciones del Proyecto

## Descripción
Tienda online de gorras colombianas. Construida con HTML + CSS + JavaScript puro, sin frameworks externos. No hay paso de build — abrir `index.html` directamente en el navegador es suficiente para desarrollar.

## Archivos principales
- [index.html](index.html) — página principal
- [styles.css](styles.css) — todos los estilos (variables CSS, esquema dark navy #0d1117 + gold #f5a623)
- [script.js](script.js) — carrito de compras, filtros por colección y animaciones

## Imágenes
- `images/agropecuario/` — Colección 100% Agropecuario 2026
- `images/luxury/` — New Era Colección Luxury (gorras de equipos MLB, ediciones limitadas)
- `images/colombia/` — República de Colombia (gorras con escudo nacional bordado)

## Arquitectura de JavaScript

`script.js` obtiene referencias a todos los IDs del DOM al inicio del archivo (sin guardarlos en funciones). Si se agrega un elemento nuevo que necesite lógica JS, su `id` debe existir en el HTML antes de que el script corra.

Patrones clave:
- **Filtros**: el tab activo compara `tab.dataset.filter` contra `card.dataset.category` (delegation sobre `productsGrid`). El valor `'all'` muestra todo.
- **Category cards → filtro**: los links de colección usan `data-filter-link="<categoria>"` para disparar el tab correspondiente con un `setTimeout` de 400 ms (espera el scroll).
- **No hay carrito de compras.** El pedido completo (selección de producto, datos de entrega, confirmación) ocurre dentro del widget de chat embebido — ver sección siguiente. El grid de productos (`.product-card`) es solo catálogo visual con filtro por categoría, no dispara ninguna acción de compra por sí mismo.

### Estructura de una tarjeta de producto
Solo necesita estos `data-*` para el filtro (no hay botón de "Agregar al carrito"):
```html
<article class="product-card" data-category="agropecuario|luxury|colombia" data-id="<número único>">
  ...
  <span class="product-card__price">$75.000</span>
</article>
```

## Colecciones y categorías
Los productos usan `data-category` con estos valores exactos:
- `agropecuario` — Colección 100% Agropecuario 2026
- `luxury` — New Era Colección Luxury
- `colombia` — República de Colombia

## Precios
- Agropecuario y República de Colombia: **$75.000**. Beisboleras Edicion Especial (luxury): **$70.000**. (Corregido 2026-09-12: esta nota decía antes que todo costaba $75.000 parejo; el HTML y `script.js` ya eran consistentes entre sí en $70.000 para luxury, solo esta documentación estaba desactualizada.)
- Formato de precio en HTML: `$75.000` / `$70.000` (con punto como separador de miles, dentro de `.product-card__price`)
- No existe un `data-price` — el precio real usado en pedidos vive en `chatbot/products.js` (catálogo del bot) y en la lógica del widget de chat

## Widget de pedidos (chat embebido, `#chatbotWindow`)
- Reemplaza por completo al antiguo carrito con `localStorage` (`capstore_cart`, ya no existe en el código).
- El botón hero "Haz tu pedido aquí" abre el widget (`#chatbotToggle`); también se abre por `#chatbotLabel`.
- `dbGuardarRegistro(estado, numeroPedido)` (`script.js`) inserta directo en Supabase, tabla `registro_chat`, con `canal: 'web'` — sin pasar por el backend Node. Se llama con `estado: 'confirmado'` al cerrar el pedido y `'cancelado'` si el usuario abandona.
- Las notificaciones por correo del canal web se piden a `chatbot-server-capstore-production.up.railway.app/enviar-correo` (mismo backend del bot de WhatsApp, reutilizado como API de correo).

## CSS — Variables y convenciones
Las variables están en `:root` en [styles.css](styles.css). Paleta principal:
- `--color-bg` / `--color-bg-2` / `--color-bg-3` — fondos en capas
- `--color-accent` (#f5a623) — dorado, usado para highlights e interacciones
- `--color-text` / `--color-text-muted` — tipografía principal y secundaria
- `--transition` — cubic-bezier estándar para animaciones

## Estándares de código
- Indentación: 2 espacios
- Todo el texto visible al usuario en **español**
- No agregar frameworks, librerías externas ni dependencias npm
- Las imágenes de productos usan `loading="lazy"` y atributo `alt` descriptivo

## Lo que NO hacer
- No renombrar `index.html` a otro nombre
- No cambiar el esquema de colores sin consultar
- No agregar precios distintos a $65.000 sin autorización
- No usar imágenes externas (todas están en la carpeta `images/`)

---

## Bot de WhatsApp (`chatbot/`)

Migrado de `whatsapp-web.js` (sesión QR, solo corría en Windows con Chrome local)
a **WhatsApp Cloud API de Meta directamente** (sin BSP intermediario) — sin navegador,
sin QR, corre en cualquier host Node estándar (Railway). Se evaluó Twilio primero,
pero la cuenta Trial exigía Content Templates incluso para respuestas de texto libre
dentro de la ventana de 24h (error 21654 `ContentSid Required`) y bloqueaba Settings/
Templates/Logs tras un muro de "upgrade" — se optó por ir directo a Meta.

### Comandos
```bash
cd chatbot
npm install   # instala @supabase/supabase-js (usa fetch nativo de Node, sin SDK de WhatsApp)
npm start     # arranca el servidor Express (webhook Meta + /enviar-correo)
```

Variables de entorno requeridas en `.env` (ver plantilla con comentarios en el propio archivo):
`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `META_ACCESS_TOKEN`, `META_PHONE_NUMBER_ID`,
`META_VERIFY_TOKEN`, `PUBLIC_BASE_URL` — además de las ya existentes `MAIL_USER`,
`MAIL_PASS`, `API_PORT`, `API_KEY`.

En el panel de Meta for Developers (App → WhatsApp → Configuration), el webhook debe
apuntar a `{PUBLIC_BASE_URL}/whatsapp/webhook`, con el mismo valor de `META_VERIFY_TOKEN`
puesto en el campo "Verify token" (Meta hace un GET de verificación al guardar).

### Arquitectura
- **[chatbot/index.js](chatbot/index.js)** — `metaApiCall()` (fetch nativo a la Graph API de Meta) + webhook Express (GET de verificación + POST de mensajes) + máquina de estados por conversación
- **[chatbot/db.js](chatbot/db.js)** — persistencia de pedidos en Supabase (`registro_chat`), reemplaza el JSON local
- **[chatbot/products.js](chatbot/products.js)** — catálogo de gorras con rutas absolutas a `chatbot/images/` (servidas como estático en `/images` para que Meta las descargue). **Ojo:** `chatbot/` es su propio repo git, separado del resto del proyecto — las imágenes tienen que vivir DENTRO de `chatbot/images/`, una carpeta hermana `../images` fuera del repo del bot no existe en Railway (así estuvo roto desde el principio hasta 2026-09-05, ver sesión más abajo)
- **[chatbot/mailer.js](chatbot/mailer.js)** — notificaciones por correo (Gmail/nodemailer), sin cambios

### Máquina de estados (por `chatId`, ahora `whatsapp:+57...`)
Cada conversación activa tiene un objeto en el `Map` `sessions` con:
```
state: 'menu' | 'collection' | 'viewing_product' | 'more_products' | 'cart_view' |
       'datos_nombre' | 'datos_telefono' | 'datos_direccion' | 'datos_ciudad' |
       'datos_depto' | 'datos_correo' | 'confirmacion' |
       'mayoreo_intro' | 'mayoreo_nombre' | 'mayoreo_telefono' | 'mayoreo_cantidad' |
       'mayoreo_coleccion' | 'mayoreo_correo' | 'mayoreo_confirmar' | 'consulta_ciudad'
collection: null | 'agropecuario' | 'luxury' | 'colombia'
currentProduct: null | { id, name, image, price }   // producto en foco
cart: [{ id, name, price, collection }]
datos: { nombre, telefono, direccion, ciudad, depto, correo }
datosMayoreo: { nombre, telefono, cantidad, coleccion, correo }
referencia: null | string   // 'CS-WA-XXXXXX', generado al mostrar el resumen
prevState: null | string    // estado a restaurar tras un desvío (mayoreo/consulta_ciudad)
ciudadCandidatos: null | array  // candidatos cuando `findCity` es ambiguo
```
- Escribir `menu`, `hola` o `inicio` vuelve al menú desde cualquier estado — **sin perder el carrito** (usa `volverAlMenu()`, no `resetSession()`; ver sesión 2026-09-05 más abajo). `resetSession()` (vacía todo, incluido el carrito) queda solo para cuando el pedido ya se confirmó, se canceló, o el cliente escribió `vaciar` explícitamente.
- Dentro de un estado de captura de datos (`datos_*`, `confirmacion`, `mayoreo_*`) esas palabras de reinicio exigen coincidencia **exacta**, no con `startsWith` — evita que una dirección como "Hipódromo, Bogotá..." dispare un reinicio accidental por empezar con "hi".
- `more_products` es el estado post-compra: pregunta "¿ver más gorras?" → sí vuelve a `collection`, no inicia el flujo de datos de entrega.
- Todas las comparaciones de texto usan `norm()` (minúsculas + sin tildes). Las respuestas afirmativas/negativas aceptadas están en los arrays `ES_SI` / `ES_NO` en `index.js`.
- Los IDs de producto del bot (`agro-1`, `col-1`, `lux-1`) son independientes de los IDs numéricos del widget web — los dos sistemas no comparten catálogo, pero desde esta migración **sí comparten tabla de pedidos** (`registro_chat`, columna `canal` distingue el origen).

### Persistencia de pedidos (Supabase, tabla `registro_chat`)
- `saveOrder(order)` (`chatbot/db.js`) inserta **una fila por producto del carrito**, todas con el mismo `numero_pedido` — `registro_chat` está diseñada como "un evento de compra por fila", no una fila por pedido completo (ver comentario en `db/schema.sql`).
- `isDuplicateOrder(telefono, cart)` consulta Supabase (celular + últimos 10 min), ya no lee un JSON local.
- Antes de esta migración, `numero_pedido` era `UNIQUE` en el esquema original — se quitó en `db/migration_001_canal_unificado.sql` precisamente para permitir varias filas por pedido.

### Para agregar un producto nuevo
1. Agregar la imagen en `images/<coleccion>/` (la carpeta de la raíz del proyecto, no `chatbot/images/` directamente)
2. Correr `py optimize_images.py` desde la raíz — comprime la imagen nueva y sincroniza automáticamente `chatbot/images/` (no reprocesa las que ya estaban optimizadas, ver manifiesto `images/.optimize_manifest.json`)
3. Agregar el objeto `{ id, name, image, price }` al array correspondiente en `products.js`
4. No tocar `index.js` — el listado y la navegación son dinámicos
5. Dentro de `chatbot/`: `git add images products.js && git commit ... && git push` para que Railway despliegue las imágenes nuevas (es un repo separado, el push de la raíz del proyecto no lo toca)

### Despliegue (Railway) — estado y gotchas

- Repo del bot: `Dovapo23/chatbot-server-CapStore` en GitHub, servicio Railway
  `chatbot-server-CapStore` (proyecto `dynamic-renewal`). La carpeta `chatbot/`
  local es su propio repo git (no comparte historial con la raíz del proyecto).
- El puerto público del servicio en Railway (Settings → Networking) está fijo en
  **8080** — la variable `API_PORT` en Railway **debe ser `8080`**, no la que
  tenga el `.env` local. Si no coincide, las peticiones al webhook se cuelgan
  30s y devuelven 499 sin dejar rastro en los logs de la app.
- Las variables de entorno se configuran aparte en Railway → pestaña
  **Variables** (no lee el `.env` del repo). Tras editarlas, hay que darle
  **"Deploy"** al cambio pendiente ("Apply N changes").
- App de Meta: `CapStore Bot Pedidos` (portfolio comercial "The Cap Store
  Online", sin verificar — no hace falta para desarrollo). Webhook configurado
  en Meta → Casos de uso → Conectar en WhatsApp → Herramientas → Configurar
  webhooks, apuntando a `{PUBLIC_BASE_URL}/whatsapp/webhook` con
  `META_VERIFY_TOKEN`.
- **RESUELTO (2026-09-05 noche):** se migró el número real del negocio
  (`+57 313 211 5765`) de la app móvil WhatsApp Business a la Cloud API.
  Pasos que funcionaron (integración directa, sin BSP/partner):
  1. En developers.facebook.com → app → WhatsApp → "Paso 2: Configuración
     de producción" → "Agregar número nuevo" → llenar info de negocio
     (nombre, sitio web `https://dovapo23.github.io/The-Cap-Store-Online/`,
     país Colombia) y perfil de WhatsApp Business.
  2. Al intentar verificar el número dio error "ya está registrado con una
     cuenta de WhatsApp" (esperado, porque seguía activo en la app móvil).
     Para integración directa (no hay opción de "Coexistence" sin un BSP) la
     única salida es **eliminar la cuenta en la app móvil**: WhatsApp
     Business app → Configuración → Cuenta → "Eliminar mi cuenta" — esto
     borra el historial de chats de esa app de forma irreversible (aceptado
     conscientemente antes de proceder).
  3. Tras eliminar la cuenta (~3 min de espera), se reintentó "Agregar
     número" sin error. **Importante**: esto creó una **WABA nueva**
     (`1017087908034500`, distinta de la de prueba `1053607910986130`) bajo
     el mismo portfolio comercial.
  4. Se registró el número con el código SMS de 6 dígitos → quedó
     "Registrado", `phone_number_id` = `1358426530678661`.
  5. Se activó el toggle **"Suscribir webhooks"** junto al número en esa
     misma pantalla — esto sustituye al `POST subscribed_apps` manual;
     confirmado con `GET /1017087908034500/subscribed_apps` (ya aparecía
     `CapStore Bot Pedidos` suscrita).
  6. Se le dio acceso al usuario del sistema `Capstorebotsystem` sobre esta
     WABA nueva (Business Settings → Usuarios del sistema → Asignar activos
     → Cuentas de WhatsApp → seleccionar todas → acceso total) — necesario
     porque el token de system user solo tiene los activos que se le asignen
     explícitamente, no hereda acceso a WABAs nuevas automáticamente.
  7. Se actualizó `META_PHONE_NUMBER_ID` en Railway → Variables a
     `1358426530678661` y se hizo Deploy.
  8. **Confirmado funcionando**: mensaje real a `+57 313 211 5765` recibido
     y respondido por el bot.
- Ver también la guía general reutilizable en
  `C:\Users\darovapo\.claude\skills\whatsapp-cloud-supabase-railway\SKILL.md`
  para el patrón completo (Meta + Railway + Supabase) aplicable a otros proyectos.

### Debugging de webhook real (sesión 2026-09-05, RESUELTO)

Los mensajes reales enviados por WhatsApp al número de prueba (`+1 555 657
1762`) se entregaban (doble check ✓✓) pero **no disparaban el webhook** hacia
Railway — confirmado con Network Logs → HTTP (vacío). Se descartaron, en
este orden:
1. Config del webhook (URL/token) — correcta, "Verificar y guardar" OK.
2. Suscripción al campo `messages` — ya estaba "Suscritos".
3. Test manual del botón "Probar" en Campos del webhook → si llega (200 OK,
   confirma que Railway/código funcionan bien).
4. App sin publicar — se completó Configuración básica (ícono generado en
   `images/app-icon-1024.png`, categoría, URL de privacidad en
   `privacidad.html` publicada vía GitHub Pages) y se publicó la app
   (estado "Publicada" en Meta). Tampoco resolvió.
5. Railway "Enable Serverless" (Settings → Deploy) estaba activo — el
   contenedor se dormía y Meta no espera el cold start. Se desactivó.
   Tampoco resolvió (confirmado con el servicio en estado "Active"/"Online").

**Causa raíz encontrada:** la suscripción al campo `messages` (paso 2) es a
nivel de **app**, pero falta un paso adicional a nivel de **cuenta (WABA)**:
la app debe suscribirse explícitamente al WABA vía
`POST https://graph.facebook.com/v20.0/{waba-id}/subscribed_apps?access_token=...`
(token temporal de "Paso 1. Pruébalo"). Se confirmó el diagnóstico con un
`GET` al mismo endpoint: solo aparecía suscrita otra app
(`WA DevX Webhook Events 1P App`), no `CapStore Bot Pedidos`. Tras el `POST`,
`GET` mostró ambas apps suscritas y el siguiente mensaje real ya llegó a
Railway (`POST /whatsapp/webhook` → 200 en Network Logs).

**Nota para cuando se migre al número real de producción:** repetir este
mismo `POST subscribed_apps` sobre el WABA de producción — es un paso que no
queda documentado en la UI de configuración normal de Meta y es fácil
saltárselo de nuevo.

**Segundo bug encontrado en la misma sesión, también resuelto:** tras arreglar
la suscripción, el webhook ya recibía los mensajes (200 OK) pero el bot no
respondía. Deploy Logs de Railway mostraron `Meta API 401: Authentication
Error, code 190, type OAuthException` — el `META_ACCESS_TOKEN` configurado en
Railway (variable de entorno) era un token temporal de "Paso 1. Pruébalo" ya
vencido (duran ~23-24h). Se generó un token nuevo, se actualizó la variable
`META_ACCESS_TOKEN` en Railway → Variables, se le dio "Deploy" al cambio
pendiente, y el bot volvió a responder con normalidad.

**RESUELTO (2026-09-05 noche):** se creó el usuario del sistema
`Capstorebotsystem` (Business Settings → Usuarios del sistema, rol
Administrador) en el portfolio comercial "The Cap Store Online", con acceso
total asignado a la app `CapStore Bot Pedidos` y a la cuenta de WhatsApp
Business (Test WhatsApp Business Account). Se generó su token (permisos
`whatsapp_business_management` + `whatsapp_business_messaging`) desde la
propia página del usuario del sistema en Business Suite — **no** desde
"Paso 1. Pruébalo" de developers.facebook.com, que sigue dando temporales.
Se verificó con `GET /debug_token`: `type: SYSTEM_USER`, `expires_at: 0`
(no vence). Se actualizó `META_ACCESS_TOKEN` en Railway → Variables → Deploy,
y el bot respondió correctamente. **Nota:** el token de system user está
ligado al WABA de prueba actual — al migrar al número real de producción,
habrá que asignarle también acceso a ese WABA nuevo en Business Settings
(no genera un token nuevo automáticamente, solo hay que añadir el activo).

### Sesión 2026-09-05 (segunda parte, noche) — bugs del bot y optimización de imágenes

Con el bot ya funcionando en producción (sesión anterior), se hizo un barrido
de calidad (rendimiento del sitio + revisión del flujo del bot) y luego se
verificó con un pedido real de principio a fin. Hallazgos y fixes, todos ya
en producción (repo `chatbot-server-CapStore`, commits `ab1cecd`, `86902f6`,
`88b73e1`, `883397a`):

- **Las fotos de producto nunca llegaban por WhatsApp.** Causa: el código
  buscaba las imágenes en `../images` (carpeta hermana de `chatbot/`), pero
  el repo que Railway despliega es *solo* el contenido de `chatbot/` — esa
  carpeta hermana nunca existió ahí. Nunca funcionó desde que existe el bot.
  Fix: las imágenes ahora viven en `chatbot/images/`, sincronizadas desde la
  carpeta `images/` de la raíz por `optimize_images.py` (ver script en la
  raíz del proyecto). Lección para otros proyectos: si el bot vive en un
  repo git separado del resto, **todo lo que el bot necesita leer en tiempo
  de ejecución tiene que estar dentro de ese mismo repo** — no asumir que
  puede alcanzar archivos de una carpeta hermana.
- **El carrito se vaciaba sin avisar.** Escribir "0" para volver al menú (o
  "menu"/"hola" en cualquier punto) llamaba a `resetSession()`, que borra
  todo — incluido el carrito con productos ya elegidos. Fix: se separó
  "volver al menú" (`volverAlMenu()`, preserva el carrito) de "vaciar todo"
  (`resetSession()`, reservado para pedido confirmado/cancelado o `vaciar`
  explícito). Además, la opción "*4* — Ver mi carrito" del menú ahora se
  resalta con la cantidad y el total cuando hay productos pendientes, para
  que no haya que adivinar que el carrito sigue ahí.
- Otros ajustes menores: reinicio accidental por prefijo ("hi"/"buenas" al
  inicio de una dirección ya no dispara reinicio dentro de estados de
  captura de datos), aviso cuando el bot no reconoce la opción del menú,
  opción para quitar un producto puntual del carrito (`quitar 2`), limpieza
  de sesiones inactivas por más de 24h, y respuesta cuando el cliente manda
  audio/foto en vez de texto.
- **Limitación de fondo que sigue sin resolver** (documentada, no arreglada):
  las sesiones de conversación viven solo en memoria (`Map` en `index.js`).
  Un pedido a medio armar (carrito con productos, sin confirmar todavía) se
  pierde por completo si el proceso de Railway se reinicia (por ejemplo, al
  desplegar un cambio de código) — no hay nada persistido hasta que el
  cliente llega a "confirmar" el pedido completo. Si esto se vuelve un
  problema recurrente, la solución sería persistir la sesión en Supabase en
  vez de en memoria.
- Se verificó un pedido real de punta a punta consultando directamente
  Supabase (`registro_chat`, `canal='whatsapp'`) — llegó completo y bien
  etiquetado.
- **Pendiente para la próxima sesión:** confirmar si el correo de
  notificación a `thecapstoreonline@gmail.com` (`chatbot/mailer.js`,
  `sendOrderEmail`) realmente llegó para ese pedido de prueba — revisar la
  bandeja (incluido spam) y, si no aparece, los Deploy Logs de Railway
  buscando `📧 Notificación enviada` o `❌ Error al enviar correo de
  notificación`.
- Aprovechando el mismo barrido, se optimizaron las 47 imágenes del catálogo
  con `optimize_images.py` (14.73 MB → 7.41 MB) y se limpiaron del proyecto
  `PLAN_MIGRACION_SUPABASE_TWILIO.md` (obsoleto, ya superado) y
  `chatbot/data/customers.json` (vestigio de antes de Supabase). Se creó
  una guía con el paso a paso completo, pensada como plantilla para el
  próximo proyecto (tienda de loción) — ver nota más abajo, luego
  reemplazada/ampliada el 2026-09-12.

### Documentación del stack completo (sesión 2026-09-12)

Se reemplazó `GUIA_IMPLEMENTACION_WHATSAPP_SUPABASE_RAILWAY.md` (checklist
parcial, solo BD+hosting+WhatsApp) por dos documentos hermanos que cubren
el stack completo (GitHub, Supabase, Railway, Meta WhatsApp Cloud API,
Resend), con bitácora real de errores/soluciones y tabla de costos/límites
gratuitos:

- [Guia_Stack_Tecnico_CapStore.pdf](Guia_Stack_Tecnico_CapStore.pdf) — versión
  para lectura humana (portada, índice, formato).
- [GUIA_MAESTRA_STACK_TECNICO.md](GUIA_MAESTRA_STACK_TECNICO.md) — mismo
  contenido en texto plano, pensado para que otro modelo de IA (Codex, otra
  sesión de Claude) lo consuma barato en tokens sin parsear el PDF. Si el
  contenido diverge entre ambos, actualizar primero el `.md` y regenerar el
  PDF a partir de él.

Ninguno de los dos incluye credenciales reales — todo valor de ejemplo es
un placeholder.
