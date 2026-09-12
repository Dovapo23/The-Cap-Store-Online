# Guía Maestra del Stack Técnico — Tienda online + Bot de WhatsApp

> Version en texto plano de `Guia_Stack_Tecnico_CapStore.pdf` (mismo directorio),
> pensada para que otro modelo de IA (Codex, otra sesión de Claude, etc.) la lea
> barato en tokens sin parsear un PDF. Si el contenido diverge, el PDF es el que
> se comparte con humanos; este `.md` es la fuente editable.
>
> Reemplaza a `GUIA_IMPLEMENTACION_WHATSAPP_SUPABASE_RAILWAY.md` (fusionado aquí,
> ampliado con GitHub, Resend, costos y bitácora de errores). Para el detalle fino
> de cada gotcha de Meta/Railway, ver también la guía genérica reutilizable:
> `C:\Users\darovapo\.claude\skills\whatsapp-cloud-supabase-railway\SKILL.md`.
>
> Todas las claves/tokens de este documento son **placeholders**. Ninguna
> credencial real del proyecto está incluida.

## Índice
0. [Cómo usar esta guía](#0-cómo-usar-esta-guía)
1. [Punto de partida: correo y WhatsApp](#1-punto-de-partida-un-correo-y-un-whatsapp-nada-más)
2. [GitHub](#2-github--control-de-versiones-y-sitio-web)
3. [Supabase](#3-supabase--base-de-datos)
4. [Railway](#4-railway--hosting-del-backend)
5. [Meta WhatsApp Cloud API](#5-meta-whatsapp-cloud-api)
6. [Resend](#6-resend--correo-de-notificaciones)
7. [Arquitectura del bot](#7-arquitectura-del-bot-máquina-de-estados)
8. [Pruebas end-to-end](#8-pruebas-y-verificación-de-punta-a-punta)
9. [Costos y límites gratuitos](#9-costos-y-límites-gratuitos-resumen)
10. [Bitácora real de errores](#10-bitácora-real-de-errores-y-soluciones)
11. [Checklist maestro](#11-checklist-maestro-para-el-próximo-proyecto)

---

## 0. Cómo usar esta guía

Documenta, con evidencia real (no genérica), cómo se construyó el stack completo
de **The Cap Store Online**: sitio web + bot de pedidos por WhatsApp. Cada sección
cubre una plataforma: qué es, cómo se crea, cómo se conecta con las demás, qué
falló durante la implementación real y cómo se resolvió, y qué parte es gratuita.

El valor de este documento es que los errores de la sección 10 (tokens vencidos,
puertos que no coinciden, RLS mal configurado, SMTP bloqueado) **ya ocurrieron una
vez en producción real** — evitarlos la segunda vez es el objetivo.

---

## 1. Punto de partida: un correo y un WhatsApp, nada más

Cada proyecto nuevo arranca de exactamente estas dos cosas, antes de tocar
cualquier plataforma:

- **Un correo propio del negocio** (Gmail nuevo, ej. `minegocio@gmail.com`). No usar
  el correo personal del dueño: GitHub, Supabase, Railway, Meta Business y Resend
  se registran todos con este correo, para que el negocio sea dueño de sus propios
  activos desde el día uno.
- **Un número de WhatsApp**. Puede ser el que ya usa el cliente. No hace falta
  comprar uno nuevo: Meta da un número de **prueba** gratuito para desarrollar; el
  número real solo se conecta al final (sección 5.7).

> ⚠️ **Riesgo**: migrar el número real a la Cloud API desconecta ese número de la
> app móvil de WhatsApp Business de forma **irreversible** (se pierde el historial
> de chats de esa app). Confirmar explícitamente con el dueño del negocio antes de
> hacerlo.

Orden recomendado (validado en este proyecto): **GitHub → Supabase → Railway →
Meta WhatsApp → Resend**. Construir base de datos y hosting antes de tocar Meta
evita configurar un webhook que apunte a un servidor que todavía no existe.

---

## 2. GitHub — control de versiones y sitio web

### 2.1 Crear cuenta y repositorio
- Crear la cuenta en github.com con el correo del proyecto.
- Crear un repositorio (público si se usará GitHub Pages gratis).
- **Clonar con `git clone` desde el primer commit**, no subir archivos manualmente
  desde la interfaz web.

> ⚠️ En este proyecto el repo del sitio se inició con el botón "Add files via
> upload" de GitHub (visible en los primeros commits del historial), sin git local.
> Funciona para publicar rápido, pero complica el historial ordenado y dificulta
> usar herramientas de terminal sobre el proyecto después. **Para el próximo
> proyecto: clonar con git desde el día 1**, aunque sea un solo `index.html`.

### 2.2 Publicar con GitHub Pages (gratis)
- Settings → Pages → Source: rama `main`, carpeta raíz.
- Queda en `https://<usuario>.github.io/<repo>/`.
- Esta URL sirve también como URL de política de privacidad que Meta exige para
  publicar la app de WhatsApp (sección 5.4).

### 2.3 Si el bot es un backend Node aparte: SEGUNDO repositorio
Si el bot corre en Railway como servidor separado, crear un **segundo repositorio**
dedicado (en este proyecto: `chatbot-server-CapStore`). Railway despliega
exactamente el contenido de ese repo y **nada fuera de él** (ver gotcha en
sección 10). Todo archivo que el código lea en tiempo de ejecución (imágenes,
catálogos) debe vivir dentro de ese mismo repo, nunca en una carpeta hermana.

---

## 3. Supabase — base de datos

### 3.1 Crear el proyecto
- supabase.com → New Project, con el correo del proyecto.
- Región más cercana al mercado del negocio; contraseña de base de datos fuerte
  (distinta de las API keys).

> ✅ **Gratis**: el nivel free de Supabase alcanza para un proyecto chico/mediano
> (Postgres, Auth, Storage, API REST/Realtime). Confirmar límites vigentes en
> supabase.com/pricing.

### 3.2 Diseñar la tabla pensando en más de un canal desde el inicio
Lección real: la tabla se diseñó solo para el canal web y hubo que agregar después
una columna `canal` con migración correctiva (`db/migration_001_canal_unificado.sql`).
Incluir desde el `CREATE TABLE` inicial:
```sql
canal VARCHAR(10) NOT NULL DEFAULT 'web' CHECK (canal IN ('web', 'whatsapp'))
```
También decidir de una vez si la tabla es **"una fila por producto"** (usado aquí:
`numero_pedido` se repite, sin `UNIQUE`) o **"una fila por pedido completo"** con
detalle en JSON/tabla hija. Cambiarlo a mitad de proyecto obliga a migraciones
correctivas.

### 3.3 Esquema real (`registro_chat`)
```sql
CREATE TABLE IF NOT EXISTS registro_chat (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  referencia      VARCHAR(20),
  nombre_producto VARCHAR(200),
  coleccion       VARCHAR(20)  CHECK (coleccion IN ('agropecuario','colombia','luxury')),
  precio          INTEGER,
  nombre          VARCHAR(100),
  celular         VARCHAR(15),
  direccion       TEXT,
  ciudad          VARCHAR(100),
  departamento    VARCHAR(100),
  correo          VARCHAR(150),
  canal           VARCHAR(10)  NOT NULL DEFAULT 'web' CHECK (canal IN ('web','whatsapp')),
  estado          VARCHAR(12)  NOT NULL CHECK (estado IN ('pendiente','confirmado','cancelado')),
  numero_pedido   VARCHAR(20),                 -- sin UNIQUE: varias filas comparten uno
  pago            VARCHAR(60)  DEFAULT 'Contra entrega en efectivo'
);
```
Regla de negocio: cada fila es un evento de compra o intento con datos de
contacto. Sin registro si el usuario solo exploró. `confirmado` implica
`numero_pedido` presente; `cancelado` implica que ya había datos capturados.

### 3.4 Seguridad: RLS y las dos claves de API

| Clave | Uso | Dónde va |
|---|---|---|
| `publishable` (`sb_publishable_...`) | Equivalente a la vieja "anon". Pública. | Frontend/navegador |
| `secret` (`sb_secret_...`) | Equivalente a "service_role". Bypasea RLS. | SOLO variables de entorno del backend (Railway), nunca en el repo |

```sql
ALTER TABLE registro_chat ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_insert_registro"
  ON registro_chat FOR INSERT TO anon WITH CHECK (true);
-- La clave pública SOLO puede insertar, nunca leer ni modificar.
```

> 🔴 **Fallo real corregido el 2026-09-12**: una vista (`pedidos_confirmados`)
> creada para consultar pedidos desde el panel corría con los permisos de su
> DUEÑO (rol `postgres`), **ignorando el RLS** de la tabla base. La clave pública
> `anon` (la misma del sitio web) podía leer nombre/celular/dirección de TODOS los
> pedidos confirmados a través de la vista. Confirmado con una prueba real
> (insert + lectura con la clave pública) antes de corregir:
> ```sql
> ALTER VIEW pedidos_confirmados SET (security_invoker = true);
> REVOKE ALL ON pedidos_confirmados FROM anon, authenticated;
> ```
> **Lección permanente**: toda vista sobre una tabla con RLS necesita
> `security_invoker = true` explícito, o hereda los permisos del dueño y expone
> los datos igual que si el RLS no existiera.

### 3.5 Verificar el esquema real antes de asumir
El `.sql` del repo puede no coincidir con la tabla real si alguna columna se
agregó a mano desde el panel. Verificar siempre antes de migrar:
```sql
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'registro_chat';
```

---

## 4. Railway — hosting del backend

### 4.1 Desplegar
- railway.app → New Project → Deploy from GitHub repo → elegir el repo del backend.
- Railway detecta `package.json` y corre `npm install && npm start` automáticamente.

### 4.2 El puerto tiene que coincidir (gotcha real — costo: horas de debugging)
> ⚠️ Railway asigna un **Target Port** fijo al dominio público (Settings →
> Networking), normalmente `8080`. Si la variable de entorno que define el puerto
> de escucha (`API_PORT`, `PORT`, etc.) tiene un valor distinto, las peticiones se
> cuelgan hasta el timeout: status **499**, duración **~30s**, y **nada** en los
> logs de la app (el request nunca llega al código). Solución: igualar la
> variable al Target Port real.

### 4.3 Variables de entorno
Railway **no lee el `.env` del repo**. Se cargan en la pestaña **Variables**
("Raw Editor" para pegar varias de una vez). Tras guardar, dar clic explícito en
**"Deploy"**.

### 4.4 Desactivar "Enable Serverless" mientras se prueba WhatsApp
> ⚠️ Escala el contenedor a cero tras inactividad. Railway encola peticiones
> mientras duerme, pero **Meta no espera el cold start** y da el webhook por
> fallido. Mantener el servicio siempre activo mientras se depura.

### 4.5 Anotar la URL pública
`https://<servicio>.up.railway.app` es el `PUBLIC_BASE_URL` que necesita el
webhook de Meta y las URLs de imágenes.

---

## 5. Meta WhatsApp Cloud API

### 5.1 Por qué Meta directo y no Twilio
> ✅ Se evaluó Twilio y se descartó: las cuentas **Trial** exigen plantillas de
> contenido (`ContentSid`) incluso para texto libre dentro de la ventana de 24h
> (error real: **21654 "ContentSid Required"**), y bloquean Settings/Templates/Logs
> tras un muro de "agregar saldo". Meta Cloud API directa es gratis para
> desarrollo y no tiene esa restricción.

### 5.2 Cuenta propia vs. cuenta de un cliente
Si el negocio es propio, todo se crea con la cuenta personal de Facebook. **Si es
para un tercero:**
- No hace falta Página de Facebook clásica: Meta exige un **Business Portfolio**
  (antes "Business Manager"), gratis y sin verificación de documentos para
  desarrollar.
- Los activos (Business Portfolio, WABA, número, app) deben quedar a nombre del
  **cliente**, no del desarrollador.
- Caso más común (negocio chico sin nada creado): el cliente crea su propio
  Business Portfolio y agrega al desarrollador como colaborador en
  `Configuración del negocio → Usuarios → Personas` (rol Administrador). La app y
  la WABA se crean parado en el portfolio del cliente.
- Caso con dos portfolios ya existentes: `Socios → Solicitar acceso a los activos
  de un socio`, pidiendo el Business Manager ID del cliente.

### 5.3 Crear la app en developers.facebook.com
- "Mis apps" → "Crear app". El nombre **no puede contener "WhatsApp"** ni otras
  marcas de Meta (Face, Book, Insta, Gram) — se rechaza con error. Usar algo como
  `<Negocio> Bot Pedidos`.
- Caso de uso: "Conectarte con los clientes a través de WhatsApp".
- Crear/usar Business Portfolio; "Verificar más tarde" cuando lo pida (solo hace
  falta verificar para publicar datos de terceros, no para desarrollo).

### 5.4 Número de prueba, token temporal y webhook
`Casos de uso → Personalizar → "Conectar en WhatsApp" → "Integrar con la API"`
(no "Convertirte en socio", eso es para agencias/BSP).

- "Paso 1. Pruébalo" da número de prueba gratis, `Phone Number ID`, `WABA ID` y un
  token **siempre temporal (~23-24h)**, sin importar cuántas veces se regenere.
- El número de prueba solo envía a **hasta 5 destinatarios verificados**.

Configurar webhook (`Conectar en WhatsApp` → "Otras herramientas" → "Herramientas",
o "Paso 2: Configuración de producción → Configurar webhooks"):
```
URL de devolución de llamada:  {PUBLIC_BASE_URL}/whatsapp/webhook
Token de verificación:         cadena inventada por ti, debe coincidir con META_VERIFY_TOKEN
```
```js
// Verificación GET que exige Meta al guardar el webhook
api.get('/whatsapp/webhook', (req, res) => {
  const { 'hub.mode': mode, 'hub.verify_token': token, 'hub.challenge': challenge } = req.query;
  if (mode === 'subscribe' && token === process.env.META_VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  res.sendStatus(403);
});

// Mensajes entrantes
api.post('/whatsapp/webhook', express.json(), async (req, res) => {
  res.sendStatus(200); // responder rápido, procesar aparte
  const message = req.body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
  if (!message) return; // puede ser evento de "status", no de mensaje
});
```

### 5.5 Gotcha: mensajes entregados (✓✓) pero el webhook nunca dispara
> 🔴 Si el destinatario ve el mensaje entregado, pero Railway no recibe ningún
> POST, y ya se descartó lo obvio, revisar en orden:
> 1. **App sin publicar** — Meta no entrega webhooks reales a apps no publicadas
>    (icono 1024x1024, categoría, URL de política de privacidad).
> 2. **App no suscrita al WABA a nivel de cuenta** (distinto del campo `messages`
>    a nivel de app):
> ```
> GET  https://graph.facebook.com/v20.0/{WABA_ID}/subscribed_apps?access_token={TOKEN}
> POST https://graph.facebook.com/v20.0/{WABA_ID}/subscribed_apps?access_token={TOKEN}
> ```

### 5.6 Token permanente (System User) — obligatorio para producción
> ⚠️ El token temporal vence cada ~24h. Si el bot deja de responder de un día
> para otro sin cambios de código, revisar Deploy Logs buscando
> `Meta API 401 ... code 190 ... OAuthException` antes de asumir otra causa.

1. `business.facebook.com/settings → Usuarios → Usuarios del sistema → Agregar`.
   Nombre estricto (rechaza demasiados guiones/mayúsculas seguidas: `capstore-bot-
   system-user` falla, `Capstorebotsystem` funciona). Rol: Administrador.
2. "Agregar activos": tipo **Apps** (permiso "Administrar app") y tipo **Cuentas
   de WhatsApp** (permiso "Todo"). No hereda acceso a WABAs nuevas automáticamente.
3. "Generar nuevo token" **desde esta página** (no desde "Paso 1. Pruébalo").
   Scopes: `whatsapp_business_management` + `whatsapp_business_messaging`.
   Expiración: "Nunca".
4. Verificar:
```
GET https://graph.facebook.com/debug_token?input_token={TOKEN}&access_token={TOKEN}
# Debe devolver: "type":"SYSTEM_USER", "expires_at":0
```

### 5.7 Migrar al número real del negocio (irreversible)
> 🔴 Confirmar explícitamente con el dueño antes: el número debe desconectarse
> por completo de la app móvil para registrarse en la Cloud API, con pérdida
> irreversible del historial de chats de esa app. Validar todo primero con el
> número de prueba.

1. "Paso 2: Configuración de producción" → "Agregar número nuevo".
2. Si dice "ya registrado con una cuenta de WhatsApp": eliminar la cuenta desde
   la app móvil (Configuración → Cuenta → "Eliminar mi cuenta"), esperar ~3 min,
   reintentar.
3. Esto crea una **WABA nueva** — repetir suscripción (5.5) y acceso del usuario
   del sistema (5.6), nada se hereda.
4. Registrar con código SMS/llamada. Activar "Suscribir webhooks" junto al número.
5. Actualizar `META_PHONE_NUMBER_ID` en Railway → Deploy. Probar con mensaje real.

---

## 6. Resend — correo de notificaciones

### 6.1 Por qué no Gmail/SMTP directo (costo real: una tarde de debugging)
> 🔴 Primer intento: nodemailer contra Gmail por SMTP (puertos 465 y 587).
> Railway **bloquea las conexiones salientes por SMTP** — ambos puertos daban
> "Connection timeout" en producción (funcionaban en local). Solución: reemplazar
> SMTP por la **API HTTP de Resend** (resend.com), que no depende de un puerto
> SMTP saliente.

### 6.2 Crear cuenta y API key
- resend.com → crear cuenta con el correo del proyecto.
- API Keys → crear una nueva → `RESEND_API_KEY` en variables de entorno del
  backend, nunca en el código ni el repo.

> ✅ **Gratis**: se puede enviar usando el dominio de pruebas
> `onboarding@resend.dev` sin verificar dominio propio — suficiente para
> notificaciones internas. Para enviar como `pedidos@tunegocio.com` hace falta
> verificar el dominio propio (DNS). Revisar límites vigentes en
> resend.com/pricing.

### 6.3 Uso en el código (fire-and-forget)
```js
const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);

async function sendOrderEmail(order) {
  // Sin await desde el flujo del pedido, para no bloquear la respuesta al cliente.
  const { error } = await resend.emails.send({
    from: 'Mi Negocio <onboarding@resend.dev>',
    to: 'notificaciones@minegocio.com',
    subject: `Nuevo pedido de ${order.cliente.nombre}`,
    html: '...',
  });
  if (error) throw new Error(error.message);
}
```
El correo de notificación llega al mismo buzón del negocio sin importar el canal
(web o WhatsApp) por el que entró el pedido.

---

## 7. Arquitectura del bot: máquina de estados

Cada conversación activa (por número de WhatsApp) vive en un `Map` en memoria:
```js
sessions[chatId] = {
  state: 'menu' | 'collection' | 'viewing_product' | 'cart_view' |
         'datos_nombre' | 'datos_telefono' | ... | 'confirmacion' | 'mayoreo_*',
  collection: null | '<categoria>',
  currentProduct: null | { id, name, image, price },
  cart: [ { id, name, price, collection } ],
  datos: { nombre, telefono, direccion, ciudad, depto, correo },
  referencia: null | 'PREFIJO-XXXXXX',
  prevState: null | string,
}
```

### 7.1 Reglas que evitaron bugs reales
- Escribir "menu"/"hola"/"inicio" vuelve al menú **sin perder el carrito**
  (`volverAlMenu()`). Vaciar todo (`resetSession()`) queda reservado para pedido
  confirmado, cancelado, o la palabra explícita "vaciar".
- Dentro de un estado de captura de datos, las palabras de reinicio exigen
  coincidencia **exacta**, no `startsWith` — evita que "Hipódromo, Bogotá..."
  dispare un reinicio por empezar con "hi".
- Todas las comparaciones de texto se normalizan (minúsculas, sin tildes) antes
  de comparar contra listas fijas de respuestas sí/no.

### 7.2 Persistencia de pedidos
Cada pedido confirmado inserta **una fila por producto del carrito** en
Supabase, todas con el mismo `numero_pedido`. Duplicados se detectan
consultando Supabase por teléfono + últimos 10 minutos (no un JSON local).

### 7.3 Limitación conocida, sin resolver: sesiones solo en memoria
> ⚠️ Un pedido a medio armar se pierde por completo si Railway reinicia el
> proceso (p.ej. al desplegar código), porque nada se persiste hasta que el
> cliente confirma. Si se vuelve recurrente, la solución de fondo es persistir
> el estado de sesión en Supabase en vez de en el `Map` del proceso.

---

## 8. Pruebas y verificación de punta a punta

### 8.1 Orden recomendado
- [ ] Supabase: credenciales listas + esquema real verificado con `information_schema`.
- [ ] Backend: variables de entorno completas en Railway, push a GitHub, deploy activo.
- [ ] Railway: puerto de la variable = Target Port.
- [ ] Meta: webhook apuntando al dominio de Railway **ya activo** (no antes).
- [ ] Probar con el número de PRUEBA antes de tocar el número real.

### 8.2 Cómo se verificó realmente
Un pedido real de principio a fin por WhatsApp, confirmado directamente en
Supabase (`registro_chat`, filtrando `canal='whatsapp'`) — no solo "el bot
respondió bien".

> ✅ El fallo de seguridad de la sección 3.4 se descubrió exactamente así: una
> prueba real de insert + lectura con la clave pública, no una revisión visual
> del SQL. Para cualquier tabla con RLS, la única verificación confiable es
> intentar leer/escribir con la clave que usaría un atacante real.

### 8.3 Señales de fallo y dónde mirar

| Síntoma | Causa probable | Dónde revisar |
|---|---|---|
| Status 499, ~30s de espera | Puerto de la variable ≠ Target Port | Railway → Network Logs |
| Entregado (✓✓) pero webhook no dispara | App sin publicar o WABA no suscrita | Meta → Configurar webhooks / subscribed_apps |
| Bot deja de responder de un día para otro | Token temporal vencido (~24h) | Railway → Deploy Logs, buscar "code 190" |
| 404/401 al pedir una imagen pública | Asset fuera del repo que Railway despliega | `curl -I` a la URL pública de la imagen |
| Correo de notificación no llega | `RESEND_API_KEY` ausente o SMTP bloqueado | Deploy Logs, log de éxito/error del envío |

---

## 9. Costos y límites gratuitos (resumen)

| Plataforma | Qué se usó | Costo en este proyecto |
|---|---|---|
| GitHub | Repo público + GitHub Pages | Gratis |
| Supabase | Proyecto free tier (Postgres + API) | Gratis (verificar límites vigentes) |
| Railway | Un servicio Node desplegado | Plan de pago por uso — revisar el plan activo |
| Meta WhatsApp Cloud API | Número de prueba + real, integración directa | Gratis para desarrollo; conversaciones de negocio con costo según política vigente de Meta |
| Resend | Dominio de pruebas `onboarding@resend.dev` | Gratis dentro del límite del plan free |

> ⚠️ Los precios y límites cambian con frecuencia. Esta tabla documenta qué
> **tier** se usó, no cifras exactas — confirmar siempre el límite vigente antes
> de presupuestar un proyecto nuevo.

---

## 10. Bitácora real de errores y soluciones

**Twilio Trial exige plantillas hasta para texto libre**
Qué pasó: error 21654 "ContentSid Required" al responder texto libre dentro de
la ventana de 24h; Settings/Templates/Logs bloqueados tras muro de "upgrade".
Solución: se abandonó Twilio y se migró a Meta Cloud API directa (sección 5).

**Fotos de producto nunca llegaban por WhatsApp**
Qué pasó: el código buscaba imágenes en una carpeta hermana (`../images`) fuera
del repo que Railway realmente despliega. Nunca funcionó desde que existía el bot.
Solución: imágenes movidas dentro del propio repo del bot (`chatbot/images/`),
sincronizadas desde la carpeta del sitio con un script.

**El carrito se vaciaba sin avisar**
Qué pasó: escribir "menu"/"hola"/"0" llamaba a `resetSession()`, que borra
también el carrito.
Solución: se separó "volver al menú" (preserva carrito) de "vaciar todo" (acción
explícita). Ver sección 7.1.

**Webhook de Meta no disparaba pese a mensajes entregados**
Qué pasó: la suscripción al campo "messages" es a nivel de APP, pero falta
suscribir la app al WABA a nivel de CUENTA (no documentado en la UI normal de Meta).
Solución: POST manual a `/{WABA_ID}/subscribed_apps`, confirmado con GET. Ver 5.5.

**Bot dejó de responder tras ~24h sin cambios de código**
Qué pasó: token temporal en uso (vence ~24h). Log: `Meta API 401, code 190,
OAuthException`.
Solución: usuario del sistema con token permanente (`expires_at: 0`). Ver 5.6.

**Puerto de Railway no coincidía**
Qué pasó: variable de entorno del puerto ≠ Target Port de Railway → Networking.
Solución: igualar la variable al Target Port real. Síntoma: status 499 sin nada
en logs de la app. Ver 4.2.

**SMTP (Gmail) fallaba con "Connection timeout" en producción**
Qué pasó: Railway bloquea conexiones salientes por SMTP (465 y 587), aunque
funcionaba en local.
Solución: nodemailer/SMTP reemplazado por la API HTTP de Resend. Ver 6.1.

**Vista de Supabase exponía datos de pedidos a la clave pública**
Qué pasó: la vista `pedidos_confirmados` corría con permisos de su dueño
(postgres), ignorando el RLS de la tabla base.
Solución: `security_invoker = true` + `REVOKE ALL` a anon/authenticated.
Confirmado con prueba real. Ver 3.4.

**Número real ya "registrado" al migrar de la app móvil**
Qué pasó: Meta rechaza registrar un número activo en la app móvil; no hay
"coexistencia" sin un BSP.
Solución: se eliminó la cuenta desde la app móvil (irreversible, con
consentimiento previo) y se reintentó tras ~3 minutos. Ver 5.7.

---

## 11. Checklist maestro para el próximo proyecto

**Antes de crear nada**
- [ ] Correo propio del negocio creado (no el personal del dueño).
- [ ] Definido si el proyecto es cuenta propia o de un cliente/tercero (5.2).

**GitHub**
- [ ] Cuenta y repositorio(s) creados con el correo del proyecto.
- [ ] Clonado con git desde el día 1 (no "Add files via upload").
- [ ] GitHub Pages activado si el sitio es estático.
- [ ] Si el bot es backend separado: repo propio con TODOS los assets necesarios dentro.

**Supabase**
- [ ] Tabla diseñada con columna "canal" desde el `CREATE TABLE` inicial.
- [ ] Decidido el modelo de filas (una por producto vs. una por pedido) desde el inicio.
- [ ] RLS activado; policy de solo INSERT para "anon".
- [ ] Toda vista sobre tabla con RLS tiene `security_invoker = true` + `REVOKE ALL`.
- [ ] Clave `secret` SOLO en variables de entorno del backend, nunca en el repo.

**Railway**
- [ ] Variable de puerto de la app = Target Port (Settings → Networking).
- [ ] Variables de entorno cargadas en la pestaña Variables (no en `.env` del repo).
- [ ] "Enable Serverless" desactivado mientras se prueba el flujo de WhatsApp.
- [ ] URL pública anotada como `PUBLIC_BASE_URL`.

**Meta WhatsApp Cloud API**
- [ ] App creada (nombre sin "WhatsApp" ni otras marcas de Meta).
- [ ] Webhook configurado y verificado, apuntando a Railway ya activo.
- [ ] App suscrita al WABA a nivel de CUENTA (`POST subscribed_apps`), no solo el campo "messages".
- [ ] App publicada (ícono, categoría, URL de política de privacidad).
- [ ] Token permanente de usuario del sistema generado y cargado en Railway.
- [ ] Flujo probado end-to-end con el número de prueba.
- [ ] Número real migrado SOLO con confirmación explícita del dueño, y probado con mensaje real.

**Resend (correo)**
- [ ] Cuenta creada con el correo del proyecto, API key en variables de entorno.
- [ ] Confirmado que el envío funciona en Railway (no solo en local).

**Verificación final**
- [ ] Un pedido real de punta a punta, confirmado directamente en Supabase.
- [ ] Prueba de seguridad: leer datos sensibles con la clave pública del sitio y confirmar que RLS/vistas lo bloquean.

---

*Fuentes: `CLAUDE.md` del proyecto, `SKILL.md` (whatsapp-cloud-supabase-railway),
código real (`mailer.js`, `schema.sql`, `migration_001_canal_unificado.sql`) e
historial de git de ambos repositorios (sitio y bot).*
