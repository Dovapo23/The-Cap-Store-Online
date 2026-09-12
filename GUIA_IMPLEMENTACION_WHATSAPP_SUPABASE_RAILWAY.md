# Guía paso a paso: Base de datos + Hosting del bot + WhatsApp (Meta)

> Registro de lo que se implementó en **The Cap Store Online** (2026-09-05),
> escrito como checklist replicable para el próximo proyecto (ej. tienda de
> loción). Para el detalle fino de cada paso, gotchas y errores exactos que
> aparecen en pantalla, ver la guía genérica:
> `C:\Users\darovapo\.claude\skills\whatsapp-cloud-supabase-railway\SKILL.md`
> (se actualiza sola cada vez que se repite este patrón en un proyecto nuevo).
> El estado técnico detallado de este proyecto específico vive en
> [CLAUDE.md](CLAUDE.md), sección "Bot de WhatsApp".

## Idea general del stack

Tres piezas que se instalan **en este orden** (cada una depende de que la
anterior ya exista):

1. **Base de datos (Supabase)** — dónde queda cada pedido, sea del canal que sea.
2. **Hosting del bot (Railway)** — dónde vive el servidor Node que atiende WhatsApp.
3. **WhatsApp (Meta Cloud API)** — el canal que recibe/envía los mensajes.

Decisión ya tomada y validada: **Meta Cloud API directa, no Twilio.** Twilio
Trial exige plantillas de contenido hasta para texto libre — se pierde tiempo.
Ir directo a Meta desde el día uno.

---

## 1. Base de datos (Supabase)

1. Crear proyecto en supabase.com (o reutilizar uno existente).
2. Diseñar la tabla de pedidos pensando en **más de un canal desde el
   principio** — en CapStore se tuvo que agregar después una columna `canal`
   porque el diseño original solo contemplaba el pedido web. Para el próximo
   proyecto, incluir desde el `CREATE TABLE` inicial:
   - `canal VARCHAR(10) CHECK (canal IN ('web','whatsapp'))`
   - Si un pedido puede tener varios productos: decidir de una vez si la tabla
     es "una fila por producto" (lo que se usó aquí, `numero_pedido` se repite,
     sin `UNIQUE`) o "una fila por pedido completo" con el detalle en JSON/tabla
     hija. Cambiar esto a mitad de proyecto obliga a migraciones SQL correctivas.
3. Antes de asumir que el esquema en el repo (`db/schema.sql`) coincide con la
   tabla real: verificar en Supabase → SQL Editor:
   ```sql
   SELECT column_name, data_type FROM information_schema.columns
   WHERE table_name = 'nombre_tabla';
   ```
4. Dos tipos de API key (esquema nuevo de Supabase):
   - `publishable` (`sb_publishable_...`) — para el navegador/widget web.
   - `secret` (`sb_secret_...`) — solo en variables de entorno del backend
     (Railway), nunca en el código ni en el repo. Bypasea RLS.
5. Si el canal web inserta directo desde el navegador con la `publishable` key,
   necesita una policy RLS de solo-INSERT para el rol `anon`.

## 2. Hosting del bot (Railway)

1. El backend del bot es un repo Git propio (puede ser una carpeta separada
   del sitio web, como `chatbot/` en este proyecto).
2. Railway → New Project → Deploy from GitHub repo.
3. **Antes de tocar Meta**, confirmar que el servicio ya responde:
   - Settings → Networking → anotar el **Target Port** (normalmente `8080`).
   - La variable de entorno que define el puerto de escucha de la app (ej.
     `API_PORT` o `PORT`) **debe tener ese mismo valor** en Railway → Variables.
     Si no coincide, las peticiones se cuelgan 30s y devuelven 499 sin dejar
     rastro en los logs — es el error más fácil de perder tiempo con.
4. Variables de entorno: se configuran aparte en Railway → Variables (Railway
   **no lee el `.env` del repo**). Después de editarlas, dar clic en
   **"Deploy"** para aplicar el cambio pendiente.
5. Settings → Deploy → confirmar que **"Enable Serverless" esté desactivado**
   mientras se prueba el flujo de WhatsApp — si el contenedor se duerme, Meta
   no espera el cold start y da el webhook por fallido.
6. Anotar la URL pública del servicio (`https://<servicio>.up.railway.app`) —
   se necesita en el paso de Meta como `PUBLIC_BASE_URL`.

## 3. WhatsApp Business (Meta Cloud API)

### 0. ¿Cuenta propia o de un cliente? (definir esto ANTES de crear nada)

En CapStore no aplicó porque es tu propio negocio: se creó todo con tu cuenta
personal de Facebook, sin fricción. **Para un proyecto de un cliente, el
patrón cambia:**

- **No hace falta una Página de Facebook tradicional.** Lo que Meta exige es
  un **Business Portfolio** (antes "Business Manager") — se crea gratis y sin
  verificación de documentos para empezar a desarrollar. El "perfil de
  WhatsApp Business" (nombre, foto, descripción) se llena directo dentro del
  flujo de Meta for Developers, es otra cosa distinta de una Página de
  Facebook clásica.
- **El dueño de los activos (Business Portfolio, WABA, número, app) debe ser
  el cliente, no tú.** Si construyes todo bajo tu propia cuenta, el día que
  el cliente quiera cambiarse de desarrollador o administrar el bot él mismo,
  todo queda atado a tu cuenta personal — mala práctica para trabajo con
  terceros.
- **Verificación de negocio** (subir RUT/cámara de comercio, factura de
  servicios; tarda 2–10 días hábiles) no es obligatoria desde el día 1, pero
  Meta la recomienda para subir los límites de mensajería. Si aplica, debe
  hacerla el cliente con sus propios documentos legales, no tú con los tuyos.

### 0.1 Cómo compartir los activos — paso a paso

Nota: Meta reordena estos menús con cierta frecuencia; si un nombre de botón
no coincide exactamente, buscar el concepto ("Partners" / "Socios",
"Solicitar acceso") dentro de Configuración del negocio — el flujo de fondo
es estable aunque la ubicación exacta cambie.

**Paso 1 — el cliente crea su Business Portfolio (si no tiene uno ya):**
1. El cliente entra a `business.facebook.com` con su propia cuenta personal
   de Facebook (no la tuya) e inicia sesión.
2. **"Crear portfolio comercial"** → nombre del portfolio (debe coincidir con
   el nombre público del negocio) → completar nombre legal, sitio web, país.
3. Con esto ya existe el Business Portfolio del cliente — todavía no tiene
   nada de WhatsApp adentro, eso se crea después (Paso 3).

**Paso 2 — tú (el desarrollador) también necesitas tu propio Business
Portfolio** (uno solo sirve para todos tus clientes, se crea una vez): mismo
proceso del Paso 1, pero con tu cuenta.

**Paso 3 — pedir/dar acceso entre los dos portfolios** (dos caminos
equivalentes, usar el que resulte más simple según quién está más cómodo
haciendo clics):

- **Camino A — tú pides acceso (recomendado, tú controlas el texto de la
  solicitud):**
  1. Pide al cliente su **Business Manager ID** (lo encuentra en su propio
     Business Portfolio → Configuración → **Información de la empresa**, es
     un número).
  2. En **tu** Business Portfolio → Configuración del negocio → **Socios**
     ("Partners") en el panel izquierdo → **Agregar** → **"Solicitar acceso a
     los activos de un socio"**.
  3. Pega el Business Manager ID del cliente → **Siguiente**.
  4. Describe qué activos necesitas (marcar "Apps" y, si ya existe, la cuenta
     de WhatsApp) y con qué nivel de permiso (administrar) → agregar una nota
     breve explicando para qué es → **Enviar solicitud**.
  5. El cliente recibe una notificación en su propio Business Portfolio y
     decide qué compartir y con qué permiso — sin este paso de aprobación no
     hay acceso.
- **Camino B — el cliente comparte directo (si el cliente ya tiene la WABA
  creada, p.ej. porque otra agencia se la dejó):**
  1. Cliente → Meta Business Suite → ícono de engranaje (Configuración) →
     **Cuentas → Cuentas de WhatsApp**.
  2. Seleccionar la WABA → botón **"Administrador de WhatsApp"** → opción de
     compartir con un socio → pegar tu Business Manager ID.

**Paso 4 — crear la app y la WABA dentro del portfolio del cliente, no en el
tuyo:** una vez aprobado el acceso, al entrar a `developers.facebook.com` (o
al desplegable de portfolios en Meta Business Suite) debe aparecer el
portfolio del cliente como opción seleccionable. Crear la app de WhatsApp
(sección 1 más abajo) **estando parado en el portfolio del cliente**, no en
el tuyo — así la app y la WABA quedan de su propiedad desde el origen, y tú
solo operas con el acceso que te compartieron.

**Paso 5 — el usuario del sistema (token permanente) también va dentro del
portfolio del cliente:** al llegar a la sección de token permanente (más
abajo), crear el "Usuario del sistema" en el Business Settings del **cliente**
(no en el tuyo) — si tienes rol de administrador vía el acceso compartido,
puedes hacerlo tú mismo desde ahí.

### 0.2 Caso más simple y más probable: el cliente no tiene NADA creado (ej. negocio de un amigo/conocido)

El escenario de 0.1 (Socios/Partners, pedir el "Business Manager ID") asume
que el cliente **ya tiene su propio Business Portfolio** separado del tuyo y
sabe moverse solo. Para un negocio chico que arranca de cero (sin Página, sin
Portfolio, sin experiencia en esto), el mecanismo correcto es otro: **no
"Socios" sino "Personas"** — tú te vuelves colaborador dentro del único
portfolio del cliente, en vez de conectar dos portfolios distintos.

**Por qué importa el orden — quién hace clic primero:**
La recomendación consistente (de varias fuentes de agencias) es que **el
cliente debe ser quien crea el Business Portfolio con su propia cuenta desde
el principio**, no tú. Si tú lo creas con tu cuenta de Facebook y luego
intentas "pasárselo", la propiedad de los activos no se transfiere de forma
limpia entre portfolios — queda enredado y es más trabajo arreglarlo después
que hacerlo bien desde el inicio. Tu rol aquí es **guiarlo paso a paso
mientras él hace los clics** (compartiendo pantalla o mandándole capturas),
no hacerlo tú con tu propia cuenta "para ahorrar pasos".

**Paso a paso:**
1. Si el negocio no tiene un correo propio (ej. `malulociones@gmail.com`),
   crear uno antes de empezar — evita que todo el negocio quede atado a la
   cuenta personal de Facebook de una sola persona (útil si algún día alguien
   más del negocio necesita entrar).
2. El cliente entra a `business.facebook.com` **con su propia cuenta de
   Facebook** (personal está bien, no hace falta Página) → **"Crear
   portfolio comercial"** → nombre del negocio (ej. "Malú Lociones") →
   completar datos básicos (nombre legal si lo tiene, país). No pide
   verificación de documentos para este paso.
3. Con el portfolio ya creado, el cliente te agrega a ti como colaborador:
   Configuración del negocio → **Usuarios → Personas** (panel izquierdo) →
   **Agregar** → tu correo electrónico → elegir rol:
   - **Administrador**: control total, incluye poder agregar/quitar a otras
     personas — es lo que necesitas para hacer todo el trabajo técnico
     (crear la app, el usuario del sistema, etc.) sin pedirle permiso a cada
     paso.
   - **Empleado**: solo ve lo que se le asigna explícitamente — más
     conservador, pero puede quedarse corto si necesitas crear activos nuevos
     (apps, WABA) y no solo administrar los existentes.
   - Empezar con el rol más limitado que te permita hacer el trabajo, y
     ampliarlo si hace falta — el propio cliente puede subirte a Administrador
     después sin rehacer nada.
4. Te llega una invitación por correo — hasta que la aceptas, el acceso no
   queda activo.
5. Con ese acceso, sigues con la sección 1 de abajo (crear la app de
   WhatsApp) **entrando a developers.facebook.com ya con acceso al portfolio
   del cliente** (aparece seleccionable si tu cuenta tiene acceso) — la app y
   la WABA quedan de una vez bajo su portfolio, sin pasos extra de transferir
   nada.

**Alternativa más simple para el futuro — Embedded Signup:** Meta ofrece un
flujo llamado **Embedded Signup**, un botón que se integra en tu propia
web/panel de onboarding: el cliente hace clic, inicia sesión con su propia
cuenta y Meta crea automáticamente su Business Portfolio + WABA + número, ya
enlazados a tu app, sin que tengas que pedir ni pasar IDs a mano. Requiere más
configuración inicial de tu lado (registrar el flujo en tu app de Meta), por
eso no se usó en CapStore (proyecto de una sola cuenta propia), pero vale la
pena evaluarlo si vas a repetir esto con varios clientes.

### 1. Crear la app

1. `developers.facebook.com` → Crear app (nombre **sin** "WhatsApp" ni otras
   marcas de Meta) → caso de uso "Conectarte con los clientes a través de
   WhatsApp" → crear/usar un portfolio comercial (no requiere verificación
   para desarrollo).
2. Dentro de la app → **Conectar en WhatsApp** → "Integrar con la API" →
   **Paso 1. Pruébalo**: da número de prueba, `Phone Number ID`, `WABA ID` y
   un token temporal (~24h, solo para probar).
3. Configurar el **webhook** (Herramientas → Configurar webhooks):
   - URL: `{PUBLIC_BASE_URL}/whatsapp/webhook`
   - Verify token: cualquier cadena inventada, debe coincidir con la que
     compara el código en el `GET` de verificación.
   - Suscribir el campo `messages`.
4. **Paso que casi siempre falta y no está documentado en la UI normal**:
   suscribir la app al WABA a nivel de cuenta (distinto de suscribir el campo
   `messages` a nivel de app):
   ```
   POST https://graph.facebook.com/v20.0/{WABA_ID}/subscribed_apps?access_token={TOKEN}
   ```
   Confirmar con el `GET` al mismo endpoint que la app aparece en la lista.
5. **Publicar la app** (Configuración básica: ícono 1024x1024, categoría, URL
   de política de privacidad — puede ser una página simple en GitHub Pages) —
   necesario para que lleguen mensajes reales, no solo el payload de prueba.
6. **Token permanente (obligatorio para producción)**, el temporal de 24h no
   sirve para dejar el bot andando solo:
   - Business Settings → Usuarios del sistema → Agregar (rol Administrador).
   - Agregarle como activos: la app (permiso "Administrar app") y la(s)
     WABA(s) (permiso "Todo").
   - Generar el token **desde la página del usuario del sistema** (no desde
     "Paso 1. Pruébalo"), scopes `whatsapp_business_management` +
     `whatsapp_business_messaging`, expiración "Nunca".
   - Verificar con `GET /debug_token`: debe decir `SYSTEM_USER` y
     `expires_at: 0`.
   - Poner ese token en `META_ACCESS_TOKEN` de Railway → Deploy.
7. Probar el flujo completo con el número de prueba (hasta 5 destinatarios
   verificados) **antes** de tocar el número real del negocio.
8. **Migrar al número real** (solo cuando todo lo anterior ya funcione):
   - Confirmar con el usuario que acepta perder el historial de chats de la
     app móvil — es irreversible.
   - "Paso 2: Configuración de producción" → Agregar número → si da error de
     "ya registrado", eliminar la cuenta desde la app móvil de WhatsApp
     Business (Configuración → Cuenta → Eliminar mi cuenta) y esperar ~3 min.
   - Esto crea una **WABA nueva** — repetir en ella los pasos 4 (suscripción)
     y 6 (dar acceso al usuario del sistema sobre esta WABA nueva) — el token
     no hereda acceso a WABAs nuevas automáticamente.
   - Actualizar `META_PHONE_NUMBER_ID` en Railway → Deploy.
   - Confirmar con un mensaje real antes de dar por cerrada la migración.

---

## Checklist rápido para el próximo proyecto (loción)

- [ ] Definido si el negocio es propio o de un cliente — si es de un cliente, activos (Business Portfolio, WABA, app) a su nombre, tú como Partner
- [ ] Tabla de Supabase diseñada con `canal` y estructura de pedido desde el inicio
- [ ] Backend desplegado en Railway, puerto de la variable = Target Port
- [ ] Variables de entorno cargadas en Railway (no en `.env` del repo)
- [ ] "Enable Serverless" desactivado durante pruebas
- [ ] App de Meta creada, webhook configurado y verificado
- [ ] App suscrita al WABA a nivel de cuenta (`POST subscribed_apps`)
- [ ] App publicada (ícono, categoría, política de privacidad)
- [ ] Token permanente de usuario del sistema generado y puesto en Railway
- [ ] Flujo probado end-to-end con número de prueba
- [ ] Número real migrado (con confirmación explícita del usuario) y probado
