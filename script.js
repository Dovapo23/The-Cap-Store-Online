/* =============================================
   CAPSTORE — JAVASCRIPT
   ============================================= */

'use strict';

// =============================================
// CART STATE
// =============================================
let cart = JSON.parse(localStorage.getItem('capstore_cart') || '[]');

// =============================================
// DOM REFERENCES
// =============================================
const cartBtn      = document.getElementById('cartBtn');
const cartBadge    = document.getElementById('cartBadge');
const cartSidebar  = document.getElementById('cartSidebar');
const cartBackdrop = document.getElementById('cartBackdrop');
const cartClose    = document.getElementById('cartClose');
const cartBody     = document.getElementById('cartBody');
const cartItems    = document.getElementById('cartItems');
const cartEmpty    = document.getElementById('cartEmpty');
const cartTotal    = document.getElementById('cartTotal');
const cartFooter   = document.getElementById('cartFooter');
const clearCartBtn = document.getElementById('clearCartBtn');
const cartGoShop   = document.getElementById('cartGoShop');
const hamburger    = document.getElementById('hamburger');
const nav          = document.getElementById('nav');
const header       = document.getElementById('header');
const filterTabs   = document.getElementById('filterTabs');
const productsGrid = document.getElementById('productsGrid');
const contactForm  = document.getElementById('contactForm');
const formSuccess  = document.getElementById('formSuccess');
const toast        = document.getElementById('toast');

// =============================================
// HEADER — SCROLL EFFECT
// =============================================
window.addEventListener('scroll', () => {
  header.classList.toggle('scrolled', window.scrollY > 20);
}, { passive: true });

// =============================================
// MOBILE MENU
// =============================================
hamburger.addEventListener('click', () => {
  hamburger.classList.toggle('open');
  nav.classList.toggle('open');
});

// Close nav on link click
nav.querySelectorAll('.nav__link').forEach(link => {
  link.addEventListener('click', () => {
    hamburger.classList.remove('open');
    nav.classList.remove('open');
  });
});

// Close nav on outside click
document.addEventListener('click', (e) => {
  if (!nav.contains(e.target) && !hamburger.contains(e.target)) {
    hamburger.classList.remove('open');
    nav.classList.remove('open');
  }
});

// =============================================
// PRODUCT FILTERING
// =============================================
if (filterTabs) {
  filterTabs.addEventListener('click', (e) => {
    const tab = e.target.closest('.filter-tab');
    if (!tab) return;

    const filter = tab.dataset.filter;

    // Update active tab
    filterTabs.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');

    // Filter cards
    const cards = productsGrid.querySelectorAll('.product-card');
    cards.forEach(card => {
      const match = filter === 'all' || card.dataset.category === filter;
      card.classList.toggle('hidden', !match);
    });
  });
}

// Category card links — trigger filter on products section
document.querySelectorAll('[data-filter-link]').forEach(link => {
  link.addEventListener('click', (e) => {
    const filterValue = link.dataset.filterLink;
    setTimeout(() => {
      const targetTab = filterTabs?.querySelector(`[data-filter="${filterValue}"]`);
      if (targetTab) targetTab.click();
    }, 400);
  });
});

// =============================================
// CART HELPERS
// =============================================
function saveCart() {
  localStorage.setItem('capstore_cart', JSON.stringify(cart));
}

function getCartCount() {
  return cart.reduce((sum, item) => sum + item.qty, 0);
}

function getCartTotal() {
  return cart.reduce((sum, item) => sum + item.price * item.qty, 0);
}

function updateCartBadge() {
  const count = getCartCount();
  cartBadge.textContent = count;
  cartBadge.classList.remove('bump');
  // Force reflow for re-animation
  void cartBadge.offsetWidth;
  if (count > 0) cartBadge.classList.add('bump');
}

function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('show'), 3000);
}

// =============================================
// CART RENDERING
// =============================================
function renderCart() {
  const count = getCartCount();
  const total = getCartTotal();

  if (count === 0) {
    cartEmpty.style.display = 'flex';
    cartItems.style.display = 'none';
    cartFooter.classList.add('hidden');
  } else {
    cartEmpty.style.display = 'none';
    cartItems.style.display = 'flex';
    cartFooter.classList.remove('hidden');
  }

  cartTotal.textContent = `$${total.toLocaleString('es-MX')}`;

  cartItems.innerHTML = '';
  cart.forEach(item => {
    const li = document.createElement('li');
    li.className = 'cart-item';
    li.dataset.id = item.id;
    li.innerHTML = `
      <div class="cart-item__icon">🧢</div>
      <div class="cart-item__info">
        <p class="cart-item__name">${item.name}</p>
        <p class="cart-item__price">$${(item.price * item.qty).toLocaleString('es-MX')}</p>
      </div>
      <div class="cart-item__controls">
        <div class="cart-item__qty">
          <button class="cart-item__qty-btn" data-action="dec" data-id="${item.id}" aria-label="Reducir cantidad">−</button>
          <span class="cart-item__qty-num">${item.qty}</span>
          <button class="cart-item__qty-btn" data-action="inc" data-id="${item.id}" aria-label="Aumentar cantidad">+</button>
        </div>
        <button class="cart-item__remove" data-id="${item.id}" aria-label="Eliminar producto">✕</button>
      </div>
    `;
    cartItems.appendChild(li);
  });
}

// =============================================
// CART ACTIONS
// =============================================
function addToCart(id, name, price, category) {
  const numId    = Number(id);
  const numPrice = Number(price);
  const existing = cart.find(i => i.id === numId);

  if (existing) {
    existing.qty++;
  } else {
    cart.push({ id: numId, name, price: numPrice, category, qty: 1 });
  }

  saveCart();
  updateCartBadge();
  renderCart();
  showToast(`🧢 "${name}" añadido al carrito`);
}

function removeFromCart(id) {
  const numId = Number(id);
  cart = cart.filter(i => i.id !== numId);
  saveCart();
  updateCartBadge();
  renderCart();
}

function changeQty(id, delta) {
  const numId = Number(id);
  const item  = cart.find(i => i.id === numId);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) removeFromCart(id);
  else {
    saveCart();
    updateCartBadge();
    renderCart();
  }
}

function clearCart() {
  cart = [];
  saveCart();
  updateCartBadge();
  renderCart();
  showToast('Carrito vaciado');
}

// =============================================
// CART EVENT DELEGATION
// =============================================
cartItems.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action], .cart-item__remove');
  if (!btn) return;

  const id = btn.dataset.id;

  if (btn.classList.contains('cart-item__remove')) {
    removeFromCart(id);
  } else if (btn.dataset.action === 'inc') {
    changeQty(id, 1);
  } else if (btn.dataset.action === 'dec') {
    changeQty(id, -1);
  }
});

clearCartBtn.addEventListener('click', clearCart);

// =============================================
// "AGREGAR AL CARRITO" BUTTONS
// =============================================
productsGrid.addEventListener('click', (e) => {
  // Main cart button
  const cartBtnEl = e.target.closest('.btn--cart');
  if (cartBtnEl) {
    const { id, name, price, category } = cartBtnEl.dataset;
    addToCart(id, name, price, category);
    openCart();
    return;
  }

  // Quick add overlay button
  const quickAdd = e.target.closest('.product-card__quick-add');
  if (quickAdd) {
    const card     = quickAdd.closest('.product-card');
    const mainBtn  = card.querySelector('.btn--cart');
    if (mainBtn) {
      const { id, name, price, category } = mainBtn.dataset;
      addToCart(id, name, price, category);
    }
  }
});

// =============================================
// CART SIDEBAR OPEN / CLOSE
// =============================================
function openCart() {
  cartSidebar.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeCart() {
  cartSidebar.classList.remove('open');
  document.body.style.overflow = '';
}

cartBtn.addEventListener('click', openCart);
cartClose.addEventListener('click', closeCart);
cartBackdrop.addEventListener('click', closeCart);

cartGoShop?.addEventListener('click', () => {
  closeCart();
});

// Close cart on Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (cartSidebar.classList.contains('open')) closeCart();
    if (nav.classList.contains('open')) {
      hamburger.classList.remove('open');
      nav.classList.remove('open');
    }
  }
});

// =============================================
// CONTACT FORM
// =============================================
if (contactForm) {
  contactForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const submitBtn = contactForm.querySelector('[type="submit"]');
    submitBtn.textContent = 'Enviando...';
    submitBtn.disabled = true;

    setTimeout(() => {
      formSuccess.classList.add('visible');
      contactForm.reset();
      submitBtn.textContent = 'Enviar mensaje';
      submitBtn.disabled = false;
      setTimeout(() => formSuccess.classList.remove('visible'), 5000);
    }, 1200);
  });
}

// =============================================
// INTERSECTION OBSERVER — Animate on scroll
// =============================================
const observerOptions = {
  threshold: 0.1,
  rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.style.animation = 'fadeInUp 0.6s ease both';
      observer.unobserve(entry.target);
    }
  });
}, observerOptions);

// Observe product cards, category cards, about features
document.querySelectorAll('.product-card, .category-card, .about__feature, .contact__info-card').forEach((el, i) => {
  el.style.opacity = '0';
  el.style.animationDelay = `${i * 0.07}s`;
  observer.observe(el);
});

// =============================================
// ACTIVE NAV LINK — Highlight on scroll
// =============================================
const sections = document.querySelectorAll('section[id]');
const navLinks  = document.querySelectorAll('.nav__link');

const sectionObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const id = entry.target.getAttribute('id');
      navLinks.forEach(link => {
        link.style.color = '';
        link.style.background = '';
        if (link.getAttribute('href') === `#${id}`) {
          link.style.color = 'var(--color-text)';
        }
      });
    }
  });
}, { rootMargin: '-30% 0px -60% 0px' });

sections.forEach(s => sectionObserver.observe(s));

// =============================================
// SMOOTH SCROLL for anchor links
// =============================================
document.querySelectorAll('a[href^="#"]').forEach(link => {
  link.addEventListener('click', (e) => {
    const target = document.querySelector(link.getAttribute('href'));
    if (target) {
      e.preventDefault();
      const offset = 80;
      const top = target.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: 'smooth' });
    }
  });
});

// =============================================
// INIT
// =============================================
function init() {
  updateCartBadge();
  renderCart();
  console.log('%c🧢 CapStore JS loaded', 'color: #f5a623; font-weight: bold; font-size: 14px;');
}

init();

// Botón hero "Haz tu pedido aquí" → abre el chatbot
document.getElementById('heroChatBtn').addEventListener('click', function () {
  document.getElementById('chatbotToggle').click();
});

// =============================================
// IMAGE ZOOM / LIGHTBOX
// =============================================
(function () {
  const overlay  = document.getElementById('imgZoom');
  const zoomImg  = document.getElementById('imgZoomImg');
  const closeBtn = document.getElementById('imgZoomClose');

  function openZoom(src, alt) {
    zoomImg.src = src;
    zoomImg.alt = alt || '';
    overlay.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }

  // Añadir botón lupa a cada tarjeta de producto
  document.querySelectorAll('.product-card__img').forEach(function (wrap) {
    const img = wrap.querySelector('img');
    if (!img) return;

    const btn = document.createElement('button');
    btn.className = 'product-card__zoom';
    btn.setAttribute('aria-label', 'Ampliar imagen');
    btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>';
    wrap.appendChild(btn);

    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      openZoom(img.src, img.alt);
    });
    img.addEventListener('click', function () { openZoom(img.src, img.alt); });
  });

  // Zoom en imágenes del mosaico del hero
  document.querySelectorAll('.cap-mosaic img').forEach(function (img) {
    img.style.cursor = 'zoom-in';
    img.addEventListener('click', function () { openZoom(img.src, img.alt); });
  });

  function closeZoom() {
    overlay.style.display = 'none';
    document.body.style.overflow = '';
    zoomImg.src = '';
  }

  closeBtn.addEventListener('click', closeZoom);
  overlay.addEventListener('click', function (e) {
    if (e.target === overlay) closeZoom();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && overlay.style.display !== 'none') closeZoom();
  });
}());

// =============================================
// CHATBOT WIDGET
// =============================================
(function () {
  'use strict';

  // ===========================================
  // CONFIGURACIÓN SUPABASE
  // Reemplaza estos valores con los de tu proyecto en https://supabase.com
  // Project Settings → API → Project URL y anon/public key
  // ===========================================
  const SUPABASE_URL = 'https://etrqibfkhagwfdtvvmna.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_zNe4uPad4KNy46E7f1wyQg_nd9KB5Cw';

  let db = null;
  if (
    SUPABASE_URL !== 'TU_SUPABASE_URL' &&
    typeof window !== 'undefined' &&
    window.supabase
  ) {
    db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  }

  // ===========================================
  // CONFIGURACIÓN EMAILJS — notificaciones de pedidos
  // 1. Crea una cuenta gratuita en https://www.emailjs.com
  // 2. Conecta tu Gmail (thecapstoreonline@gmail.com) como Email Service
  // 3. Crea un Email Template con las variables indicadas abajo
  // 4. Reemplaza los tres valores con los de tu cuenta
  // ===========================================
  const EMAILJS_PUBLIC_KEY  = 'TU_PUBLIC_KEY';    // Account → API Keys
  const EMAILJS_SERVICE_ID  = 'TU_SERVICE_ID';    // Email Services → Service ID
  const EMAILJS_TEMPLATE_ID = 'TU_TEMPLATE_ID';   // Email Templates → Template ID

  if (
    typeof window !== 'undefined' &&
    window.emailjs &&
    EMAILJS_PUBLIC_KEY !== 'TU_PUBLIC_KEY'
  ) {
    window.emailjs.init({ publicKey: EMAILJS_PUBLIC_KEY });
  }

  async function enviarNotificacionEmail(numeroPedido, datosCliente, producto, coleccion, precio) {
    if (
      typeof window === 'undefined' ||
      !window.emailjs ||
      EMAILJS_PUBLIC_KEY === 'TU_PUBLIC_KEY'
    ) return;
    try {
      await window.emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
        order_number:   numeroPedido,
        client_name:    datosCliente.nombre,
        client_phone:   datosCliente.celular,
        client_address: datosCliente.direccion,
        client_city:    datosCliente.ciudad,
        client_dept:    datosCliente.depto,
        client_email:   datosCliente.correo !== '—' ? datosCliente.correo : '(no indicado)',
        product_name:   producto.name,
        product_ref:    producto.id,
        collection:     coleccion,
        total:          precio,
        payment_method: 'Contra entrega en efectivo',
      });
      console.log('📧 Notificación de pedido enviada:', numeroPedido);
    } catch (e) {
      console.warn('EmailJS:', e);
    }
  }

  // ===========================================
  // CATÁLOGO — nombres y IDs idénticos a los de la página web
  // ===========================================
  const CATALOG = {
    agropecuario: {
      nombre: 'Colección 100% Agropecuario 2026',
      emoji: '🌾',
      products: [
        { id: '1', name: 'Agropecuario Negro Clásico'    },
        { id: '2', name: 'Agropecuario Gris Bandera'     },
        { id: '3', name: 'Agropecuario Camel Suede'      },
        { id: '4', name: 'Agropecuario Negro Neon Rojo'  },
        { id: '5', name: 'Agropecuario Rosa Suede'       },
        { id: '6', name: 'Agropecuario Borgoña y Negro'  },
        { id: '7', name: 'Agropecuario Negro Total Suede'},
      ],
    },
    colombia: {
      nombre: 'República de Colombia',
      emoji: '🇨🇴',
      products: [
        { id: '15', name: 'Colombia Negra Escudo Dorado'   },
        { id: '16', name: 'Colombia Blanca Escudo Dorado'  },
        { id: '17', name: 'Colombia Verde Militar'         },
        { id: '18', name: 'Colombia Roja Escudo Dorado'    },
        { id: '19', name: 'Colombia Edición Especial'      },
        { id: '20', name: 'Colombia Clásica Bordado Dorado'},
        { id: '62', name: 'Colombia Café Escudo'           },
        { id: '63', name: 'Colombia Blanca Bordada'        },
        { id: '64', name: 'Colombia Tricolor Especial'     },
        { id: '65', name: 'Colombia Premium Dorada'        },
        { id: '66', name: 'Colombia Edición Limitada'      },
      ],
    },
    luxury: {
      nombre: 'Beisboleras Edición Especial',
      emoji: '⚾',
      products: [
        { id: '8',  name: 'Anaheim Ducks 30th Anniversary'  },
        { id: '9',  name: 'LA Dodgers 60th Anniversary'     },
        { id: '10', name: 'LA Dodgers Roses Edition'        },
        { id: '11', name: 'NY Yankees 1999 World Series'    },
        { id: '40', name: 'Mets Crema Verde'                 },
        { id: '41', name: 'Yankees Negra Llamas'            },
        { id: '42', name: 'Yankees Azul Celeste'            },
        { id: '43', name: 'Red Sox Negra Rosas'             },
        { id: '44', name: 'White Sox Camel'                 },
        { id: '45', name: 'Yankees Negra Clásica'           },
        { id: '46', name: 'Mighty Ducks Crema'              },
        { id: '47', name: 'Yankees Gris New York'           },
        { id: '48', name: 'Giants Camel'                    },
        { id: '49', name: 'White Sox Negra'                 },
        { id: '50', name: 'Red Sox Negra'                   },
        { id: '51', name: 'Yankees Negra USA'               },
        { id: '52', name: 'Dodgers Negra Los Angeles'       },
        { id: '53', name: "Oakland A's Verde"               },
        { id: '54', name: 'Charlotte Hornets Gris'          },
        { id: '55', name: 'Dodgers Roja World Series'       },
        { id: '56', name: 'Dodgers Roja Viva Los Dodgers'   },
        { id: '57', name: 'Angels Negra World Champions'    },
        { id: '58', name: "Oakland A's World Series"        },
        { id: '59', name: 'Red Sox Negra Llamas'            },
        { id: '60', name: 'Dodgers Negra Cupido'            },
        { id: '61', name: 'Yankees Crema Rosas'             },
      ],
    },
  };

  // ===========================================
  // DOM REFS
  // ===========================================
  const toggle      = document.getElementById('chatbotToggle');
  const chatLabel   = document.getElementById('chatbotLabel');
  const window_  = document.getElementById('chatbotWindow');
  const closeBtn = document.getElementById('chatbotClose');
  const messages = document.getElementById('chatbotMessages');
  const input    = document.getElementById('chatbotInput');
  const sendBtn  = document.getElementById('chatbotSend');
  const qrDiv    = document.getElementById('chatbotQuickReplies');
  const badge    = document.getElementById('chatbotBadge');

  // ===========================================
  // ESTADO DE LA SESIÓN
  // estados: 'menu' | 'collection' | 'datos_nombre' | 'datos_direccion'
  //          | 'datos_celular' | 'datos_correo' | 'confirmacion'
  // ===========================================
  let isOpen            = false;
  let hasShown          = false;
  let state             = 'menu';
  let currentCollection = null;   // clave en CATALOG
  let selectedProduct   = null;   // { id, name }
  let datos             = { nombre: '', direccion: '', ciudad: '', depto: '', celular: '', correo: '' };
  let procesandoPedido  = false;  // evita confirmaciones duplicadas

  function resetSession() {
    state             = 'menu';
    currentCollection = null;
    selectedProduct   = null;
    procesandoPedido  = false;
    datos             = { nombre: '', direccion: '', ciudad: '', depto: '', celular: '', correo: '' };
  }

  // ===========================================
  // TEMPORIZADOR DE INACTIVIDAD — 15 minutos
  // ===========================================
  const INACTIVITY_MS = 15 * 60 * 1000;
  let inactivityTimer = null;

  function resetInactivityTimer() {
    clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(handleTimeout, INACTIVITY_MS);
  }

  function handleTimeout() {
    resetSession();
    if (isOpen) {
      appendMsg('La conversación se cerró por inactividad (15 min). ¡Escríbenos cuando quieras! 👋', 'bot');
      setQuickReplies(['Iniciar nueva conversación']);
    }
  }

  // ===========================================
  // CAPA DE BASE DE DATOS (Supabase)
  // Una sola función — inserta UNA fila solo cuando hay datos útiles
  // ===========================================

  // Guarda un registro solo si el usuario proporcionó al menos su nombre.
  // estado: 'confirmado' | 'cancelado'
  // numeroPedido: string (solo confirmados) | null
  async function dbGuardarRegistro(estado, numeroPedido) {
    if (!db) return;
    if (!datos.nombre) return; // sin datos de contacto, no interesa guardar

    try {
      // ⚠️ Asegúrate de que la tabla registro_chat tenga las columnas: ciudad, departamento
      await db.from('registro_chat').insert({
        // Producto
        referencia:      selectedProduct ? selectedProduct.id   : null,
        nombre_producto: selectedProduct ? selectedProduct.name : null,
        coleccion:       currentCollection  || null,
        precio:          selectedProduct    ? (currentCollection === 'luxury' ? 70000 : 75000) : null,
        // Contacto
        nombre:          datos.nombre    || null,
        celular:         datos.celular   || null,
        direccion:       datos.direccion || null,
        ciudad:          datos.ciudad    || null,
        departamento:    datos.depto     || null,
        correo:          (datos.correo && datos.correo !== '—') ? datos.correo : null,
        // Resultado
        estado:          estado,
        numero_pedido:   numeroPedido    || null,
        pago:            estado === 'confirmado' ? 'Contra entrega en efectivo' : null,
      });
    } catch (e) {
      console.warn('CapsStore DB:', e.message);
    }
  }

  // ===========================================
  // HELPERS UI
  // ===========================================

  function norm(str) {
    return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  }

  function isGlobalReset(t) {
    return /^(hola|hi|buenas|menu|inicio|start)/.test(t) ||
      t === 'menu principal' || t === 'cancelar pedido' || t === 'iniciar nueva conversacion';
  }

  function scrollBottom() {
    messages.scrollTop = messages.scrollHeight;
  }

  function appendMsg(text, role) {
    const wrap = document.createElement('div');
    wrap.className = 'chatbot__msg chatbot__msg--' + role;
    if (role === 'bot') {
      const av = document.createElement('div');
      av.className = 'chatbot__msg-avatar';
      av.textContent = '🧢';
      wrap.appendChild(av);
    }
    const bubble = document.createElement('div');
    bubble.className = 'chatbot__msg-bubble';
    bubble.textContent = text;
    wrap.appendChild(bubble);
    messages.appendChild(wrap);
    scrollBottom();
  }

  function showTyping() {
    const wrap = document.createElement('div');
    wrap.className = 'chatbot__msg chatbot__msg--bot';
    wrap.id = 'chatTyping';
    const av = document.createElement('div');
    av.className = 'chatbot__msg-avatar';
    av.textContent = '🧢';
    const dots = document.createElement('div');
    dots.className = 'chatbot__typing';
    dots.innerHTML = '<span></span><span></span><span></span>';
    wrap.appendChild(av);
    wrap.appendChild(dots);
    messages.appendChild(wrap);
    scrollBottom();
  }

  function hideTyping() {
    const el = document.getElementById('chatTyping');
    if (el) el.remove();
  }

  function botReply(text, qrs, delay) {
    delay = delay === undefined ? 600 : delay;
    showTyping();
    setTimeout(function () {
      hideTyping();
      appendMsg(text, 'bot');
      setQuickReplies(qrs || []);
    }, delay);
  }

  function setQuickReplies(options) {
    qrDiv.innerHTML = '';
    options.forEach(function (label) {
      const btn = document.createElement('button');
      btn.className = 'chatbot__quick-reply';
      btn.textContent = label;
      btn.addEventListener('click', function () { handleUserInput(label); });
      qrDiv.appendChild(btn);
    });
  }

  // ===========================================
  // LÓGICA DE COLECCIONES
  // ===========================================

  function showCollection(key) {
    const col = CATALOG[key];
    currentCollection = key;
    state = 'collection';
    const list = col.products.map(function (p, i) {
      return (i + 1) + '. ' + p.name;
    }).join('\n');
    return {
      text: col.emoji + ' ' + col.nombre + ' — ' + col.products.length + ' modelos:\n\n' +
        list + '\n\n💬 Escribe el número del modelo que deseas pedir.',
      qr: ['Ver otra colección', 'Menú principal'],
    };
  }

  // ===========================================
  // FLUJO DE PEDIDO (máquina de estados)
  // ===========================================

  function startOrder(product) {
    selectedProduct = product;
    state = 'datos_nombre';
    const precio = currentCollection === 'luxury' ? '$70.000' : '$75.000';
    return {
      text: '¡Excelente elección! 🧢\n\n' + product.name + ' — ' + precio + '\n\n' +
        'Para formalizar tu pedido necesito algunos datos.\n\n👤 ¿Cuál es tu nombre completo?',
      qr: ['Cancelar pedido'],
    };
  }

  function handleDatosNombre(raw) {
    if (raw.length < 3) {
      return { text: 'Por favor escribe tu nombre completo (mínimo 3 caracteres).', qr: ['Cancelar pedido'] };
    }
    datos.nombre = raw;
    state = 'datos_direccion';
    return {
      text: '📍 ¿Cuál es tu dirección de entrega?\n(Calle, número y barrio — ej: Cra 50 #23-10, Kennedy)',
      qr: ['Cancelar pedido'],
    };
  }

  function handleDatosDireccion(raw) {
    if (raw.length < 8) {
      return { text: 'Por favor escribe una dirección más completa (calle, número y barrio).', qr: ['Cancelar pedido'] };
    }
    datos.direccion = raw;
    state = 'datos_ciudad';
    return {
      text: '🏙️ ¿En qué ciudad vives?\n(Solo el nombre de la ciudad)',
      qr: ['Cancelar pedido'],
    };
  }

  function handleDatosCiudad(raw) {
    if (raw.trim().length < 2) {
      return { text: 'Por favor escribe el nombre de tu ciudad.', qr: ['Cancelar pedido'] };
    }
    datos.ciudad = raw.trim();
    state = 'datos_depto';
    return {
      text: '🗺️ ¿En qué departamento te encuentras?\n(Ej: Antioquia, Valle del Cauca, Bogotá D.C.)',
      qr: ['Cancelar pedido'],
    };
  }

  function handleDatosDepto(raw) {
    if (raw.trim().length < 3) {
      return { text: 'Por favor escribe el nombre del departamento.', qr: ['Cancelar pedido'] };
    }
    datos.depto = raw.trim();
    state = 'datos_celular';
    return {
      text: '📱 ¿Cuál es tu número de celular / WhatsApp?\n(Solo dígitos, ej: 3001234567)',
      qr: ['Cancelar pedido'],
    };
  }

  function handleDatosCelular(raw) {
    const digits = raw.replace(/\s/g, '');
    if (!/^\d{7,15}$/.test(digits)) {
      return { text: 'El número debe tener entre 7 y 15 dígitos. Intenta de nuevo.', qr: ['Cancelar pedido'] };
    }
    datos.celular = digits;
    state = 'datos_correo';
    return {
      text: '📧 ¿Cuál es tu correo electrónico?\n(Escribe "no" si prefieres no darlo)',
      qr: ['No tengo correo', 'Cancelar pedido'],
    };
  }

  function handleDatosCorreo(raw) {
    const t = norm(raw);
    if (t === 'no' || t === 'no tengo correo' || t === 'no tengo') {
      datos.correo = '—';
    } else if (raw.includes('@') && raw.includes('.')) {
      datos.correo = raw.trim();
    } else {
      return {
        text: 'Escribe un correo válido (ej: nombre@correo.com) o escribe "no" para omitirlo.',
        qr: ['No tengo correo', 'Cancelar pedido'],
      };
    }
    state = 'confirmacion';
    const precio = currentCollection === 'luxury' ? '$70.000' : '$75.000';
    const summary =
      '📋 Resumen de tu pedido:\n\n' +
      '🧢 ' + selectedProduct.name + '\n' +
      '🔖 Ref: ' + selectedProduct.id + '\n' +
      '💰 Precio: ' + precio + '\n' +
      '💳 Pago: Contra entrega en efectivo\n\n' +
      '👤 Nombre: '       + datos.nombre    + '\n' +
      '📍 Dirección: '    + datos.direccion + '\n' +
      '🏙️ Ciudad: '      + datos.ciudad    + '\n' +
      '🗺️ Departamento: ' + datos.depto     + '\n' +
      '📱 Celular: '      + datos.celular   + '\n' +
      '📧 Correo: '       + datos.correo    + '\n\n' +
      '¿Confirmas el pedido?';
    return { text: summary, qr: ['✅ Sí, confirmar', '❌ No, cancelar'] };
  }

  function handleConfirmacion(t) {
    const afirmativo = /^(si|s|yes|dale|claro|ok|okay|sip|yep|confirmar)/.test(t) || t.includes('confirmar');
    const negativo   = /^(no|n|nope|nel|cancelar)/.test(t) || t.includes('cancelar');

    if (afirmativo) {
      // Evitar doble confirmación en la misma sesión
      if (procesandoPedido) {
        return { text: '⏳ Tu pedido ya está siendo procesado, un momento...', qr: [] };
      }
      procesandoPedido = true;

      const numeroPedido    = 'CS-WEB-' + Date.now().toString(36).toUpperCase();
      const celularGuardado = datos.celular;
      const precio          = currentCollection === 'luxury' ? '$70.000' : '$75.000';
      const datosSnap       = { ...datos };        // copia antes del reset
      const productoSnap    = { ...selectedProduct };
      const coleccionSnap   = currentCollection;

      dbGuardarRegistro('confirmado', numeroPedido);
      // Notificación por correo (fire-and-forget)
      enviarNotificacionEmail(numeroPedido, datosSnap, productoSnap, coleccionSnap, precio);

      resetSession();
      return {
        text: '🎉 ¡Pedido confirmado! Muchas gracias.\n\n' +
          'Número de pedido: ' + numeroPedido + '\n\n' +
          'Nos contactaremos al ' + celularGuardado + ' para coordinar la entrega. ¡Disfruta tu gorra! 🧢',
        qr: ['Ver colecciones', 'Menú principal'],
      };
    }

    if (negativo) {
      dbGuardarRegistro('cancelado', null);
      resetSession();
      return {
        text: 'Pedido cancelado. No hay problema 😊 ¿En qué más te puedo ayudar?',
        qr: ['Ver colecciones', 'Menú principal'],
      };
    }

    return { text: 'Escribe "sí" para confirmar o "no" para cancelar.', qr: ['✅ Sí, confirmar', '❌ No, cancelar'] };
  }

  // ===========================================
  // LÓGICA PRINCIPAL DE RESPUESTA
  // ===========================================

  function getReply(raw) {
    const t = norm(raw);

    // Reset global — cancela cualquier estado activo
    if (isGlobalReset(t)) {
      // Si el usuario tenía datos parciales y cancela, guardar registro
      if (state !== 'menu' && state !== 'collection' && datos.nombre) {
        dbGuardarRegistro('cancelado', null);
      }
      resetSession();
      return {
        text: '¡Hola! 👋 Soy el asistente de The Cap Store Online. ¿En qué te puedo ayudar?',
        qr: ['Ver colecciones', 'Precios', '¿Cómo comprar?', 'Contacto WhatsApp'],
      };
    }

    // ---- Estados del flujo de pedido ----
    if (state === 'collection') {
      const num = parseInt(raw, 10);
      const col = CATALOG[currentCollection];
      if (!isNaN(num) && num >= 1 && num <= col.products.length) {
        return startOrder(col.products[num - 1]);
      }
    }

    if (state === 'datos_nombre')    return handleDatosNombre(raw);
    if (state === 'datos_direccion') return handleDatosDireccion(raw);
    if (state === 'datos_ciudad')    return handleDatosCiudad(raw);
    if (state === 'datos_depto')     return handleDatosDepto(raw);
    if (state === 'datos_celular')   return handleDatosCelular(raw);
    if (state === 'datos_correo')    return handleDatosCorreo(raw);
    if (state === 'confirmacion')    return handleConfirmacion(t);

    // ---- Respuestas informativas ----

    if (/colecciones?|catalogo|modelos|que tienen|que gorras|ver otra/.test(t)) {
      state = 'menu';
      const total = Object.values(CATALOG).reduce(function (s, c) { return s + c.products.length; }, 0);
      return {
        text: 'Tenemos ' + total + ' gorras en 3 colecciones. ¿Cuál te interesa?',
        qr: ['🌾 Agropecuario', '🇨🇴 Colombia', '💎 New Era Luxury'],
      };
    }

    if (/agropecuario|agro/.test(t) || raw.includes('🌾'))  return showCollection('agropecuario');
    if (/colombia|tricolor|escudo|bandera/.test(t) || raw.includes('🇨🇴')) return showCollection('colombia');
    if (/luxury|new era|yankees|dodgers|bulls|lakers|red sox|cubs|mets|heat|celtics|astros|braves|giants|white sox|mlb|nba|edicion limitada/.test(t) || raw.includes('💎')) return showCollection('luxury');

    if (/precio|cuanto|vale|cuesta|costa|valor|cuanto sale/.test(t)) {
      return {
        text: 'Todas nuestras gorras tienen un precio fijo de $65.000 pesos colombianos 🏷️\n\nEl pago es contra entrega en efectivo.',
        qr: ['Ver colecciones', 'Menú principal'],
      };
    }

    if (/como comprar|proceso|pedido|pedir|ordenar|compra/.test(t)) {
      return {
        text: '¡Es muy fácil! 🛒\n\n1. Escoge tu colección y el número del modelo\n2. El asistente captura tus datos\n3. Confirmas el pedido\n4. Te contactamos para coordinar la entrega\n5. Pagas al recibir — ¡sin riesgo!',
        qr: ['Ver colecciones', 'Menú principal'],
      };
    }

    if (/disponible|stock|hay|tienen|agotad|inventario/.test(t)) {
      return {
        text: '✅ Todas las gorras mostradas están disponibles.',
        qr: ['Ver colecciones', 'Menú principal'],
      };
    }

    if (/envio|entrega|domicilio|delivery|shipping|llega|despacho/.test(t)) {
      return {
        text: '🚚 Envíos a todo Colombia.\n\nPago contra entrega — pagas cuando recibes.\n\nTiempos:\n• Bogotá: 1-2 días hábiles\n• Resto del país: 3-5 días hábiles',
        qr: ['Ver colecciones', 'Menú principal'],
      };
    }

    if (/whatsapp|contacto|telefono|llamar|escribir/.test(t)) {
      return {
        text: '📱 Puedes contactarnos por WhatsApp. El número aparece en la sección Contacto de la página.',
        qr: ['Ir a contacto', 'Ver colecciones'],
      };
    }

    if (/ir a la tienda|ver productos/.test(t) || raw === 'Ir a la tienda') {
      setTimeout(function () {
        const el = document.getElementById('tienda');
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 400);
      return { text: 'Te llevo a la tienda 🏪', qr: ['Menú principal'] };
    }

    if (/ir a contacto/.test(t) || raw === 'Ir a contacto') {
      setTimeout(function () {
        const el = document.getElementById('contacto');
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 400);
      return { text: 'Te llevo a contacto 📍', qr: ['Menú principal'] };
    }

    if (/gracias|perfecto|genial|excelente|chao|adios/.test(t)) {
      return { text: '¡De nada! 😊 ¡Que disfrutes tu gorra! 🧢', qr: ['Ver colecciones', 'Menú principal'] };
    }

    if (state === 'collection') {
      const col = CATALOG[currentCollection];
      return {
        text: 'Escribe el número del modelo (1-' + col.products.length + ') para pedirlo.',
        qr: ['Ver otra colección', 'Menú principal'],
      };
    }

    return {
      text: 'No entendí bien tu consulta 😅 ¿En qué te puedo ayudar?',
      qr: ['Ver colecciones', 'Precios', '¿Cómo comprar?', 'Contacto WhatsApp'],
    };
  }

  function handleUserInput(raw) {
    raw = raw.trim();
    if (!raw) return;
    appendMsg(raw, 'user');
    setQuickReplies([]);
    input.value = '';
    resetInactivityTimer();
    const reply = getReply(raw);
    botReply(reply.text, reply.qr);
  }

  // ===========================================
  // OPEN / CLOSE
  // ===========================================

  function openChat() {
    isOpen = true;
    window_.classList.add('chatbot__window--open');
    window_.setAttribute('aria-hidden', 'false');
    toggle.querySelector('.chatbot__toggle-icon').style.display = 'none';
    toggle.querySelector('.chatbot__toggle-close').style.display = '';
    if (chatLabel) chatLabel.classList.add('hidden');
    badge.style.display = 'none';
    input.focus();

    if (!hasShown) {
      hasShown = true;
      resetInactivityTimer();
      botReply(
        '¡Hola! 👋 Soy el asistente de The Cap Store Online. Puedo ayudarte a ver nuestros productos y tomar tu pedido.',
        ['Ver colecciones', 'Precios', '¿Cómo comprar?', 'Contacto WhatsApp'],
        600
      );
    }
  }

  function closeChat() {
    isOpen = false;
    window_.classList.remove('chatbot__window--open');
    window_.setAttribute('aria-hidden', 'true');
    toggle.querySelector('.chatbot__toggle-icon').style.display = '';
    toggle.querySelector('.chatbot__toggle-close').style.display = 'none';
    if (chatLabel) chatLabel.classList.remove('hidden');
  }

  // ===========================================
  // EVENTOS
  // ===========================================

  toggle.addEventListener('click', function () {
    if (isOpen) closeChat(); else openChat();
  });
  if (chatLabel) chatLabel.addEventListener('click', openChat);
  closeBtn.addEventListener('click', closeChat);
  sendBtn.addEventListener('click', function () { handleUserInput(input.value); });
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') handleUserInput(input.value);
  });

  // Badge de notificación si el usuario no ha abierto el chat
  setTimeout(function () {
    if (!hasShown) badge.style.display = 'flex';
  }, 3000);
}());
