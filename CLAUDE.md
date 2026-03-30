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
- **Event delegation**: los clics de "Agregar al carrito" se manejan en `productsGrid`, no en cada botón individual. Los controles del carrito (incrementar, decrementar, eliminar) usan delegation en `cartItems`.
- **Filtros**: el tab activo compara `tab.dataset.filter` contra `card.dataset.category`. El valor `'all'` muestra todo.
- **Category cards → filtro**: los links de colección usan `data-filter-link="<categoria>"` para disparar el tab correspondiente con un `setTimeout` de 400 ms (espera el scroll).

### Estructura requerida de una tarjeta de producto
Para que el carrito funcione, el botón `.btn--cart` debe tener estos `data-*`:
```html
<button class="btn--cart"
  data-id="<número único>"
  data-name="<nombre del producto>"
  data-price="65000"
  data-category="agropecuario|luxury|colombia">
  Agregar al carrito
</button>
```
El overlay de "quick add" (`.product-card__quick-add`) delega al `.btn--cart` de su tarjeta padre — no necesita sus propios data attributes.

## Colecciones y categorías
Los productos usan `data-category` con estos valores exactos:
- `agropecuario` — Colección 100% Agropecuario 2026
- `luxury` — New Era Colección Luxury
- `colombia` — República de Colombia

## Precios
- Todos los productos cuestan **$65.000 pesos colombianos**
- Formato de precio en HTML: `$65.000` (con punto como separador de miles)
- Formato en `data-price`: `65000` (sin puntos ni signos)
- El total se formatea con `toLocaleString('es-MX')`

## Carrito de compras
- Estado guardado en `localStorage` con clave `capstore_cart`
- Cada ítem: `{ id, name, price, category, qty }`
- `id` y `price` se convierten a `Number` en `addToCart()` — en el HTML son strings

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

### Comandos
```bash
cd chatbot
npm install   # primera vez (descarga Chromium ~170 MB)
npm start     # arranca el bot y muestra QR para vincular WhatsApp
```

### Arquitectura
- **[chatbot/index.js](chatbot/index.js)** — cliente whatsapp-web.js + máquina de estados por conversación
- **[chatbot/products.js](chatbot/products.js)** — catálogo de gorras con rutas absolutas a `images/`
- **[chatbot/data/customers.json](chatbot/data/customers.json)** — pedidos guardados (se crea automático)

### Máquina de estados (por `chatId`)
Cada conversación activa tiene un objeto en el `Map` `sessions` con:
```
state: 'menu' | 'collection' | 'viewing_product' | 'more_products' |
       'cart_view' | 'datos_nombre' | 'datos_telefono' |
       'datos_direccion' | 'datos_correo' | 'confirmacion'
collection: null | 'agropecuario' | 'luxury' | 'colombia'
currentProduct: null | { id, name, image, price }   // producto en foco
cart: [{ id, name, price, collection }]
datos: { nombre, telefono, direccion, correo }
```
- Escribir `menu`, `hola` o `inicio` reinicia la sesión desde cualquier estado.
- `more_products` es el estado post-compra: pregunta "¿ver más gorras?" → sí vuelve a `collection`, no inicia el flujo de datos de entrega.
- Todas las comparaciones de texto usan `norm()` (minúsculas + sin tildes). Las respuestas afirmativas/negativas aceptadas están en los arrays `ES_SI` / `ES_NO` en `index.js`.
- Los IDs de producto del chatbot (`agro-1`, `col-1`, `lux-1`) son independientes de los IDs numéricos del carrito web — los dos sistemas no se sincronizan.

### Archivos generados en tiempo de ejecución (gitignoreados)
- `chatbot/.wwebjs_auth/` — sesión de WhatsApp (evita re-escanear QR)
- `chatbot/.wwebjs_cache/` — caché de Chromium
- `chatbot/data/customers.json` — pedidos guardados

### Para agregar un producto nuevo
1. Agregar la imagen en `images/<coleccion>/`
2. Agregar el objeto `{ id, name, image, price }` al array correspondiente en `products.js`
3. No tocar `index.js` — el listado y la navegación son dinámicos

### Datos capturados por pedido
```json
{ "id": 1, "fecha": "...", "cliente": { "nombre", "telefono", "whatsapp", "direccion", "correo" },
  "productos": [...], "total": 65000, "pago": "Contra entrega en efectivo", "estado": "pendiente" }
```
