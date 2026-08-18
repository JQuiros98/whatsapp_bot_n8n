//Constantes
let PHONE_NUMBER_ID = "1226249207242918";
const OWNER_PHONE_NUMBER = "50687551210";
const GRAPH_VERSION = "v20.0";
const MENU_IMAGE_MEDIA_ID = "TU_MEDIA_ID_AQUI"; //reemplaza esto con el ID que obtengas al subir la imagen del menu a Meta

//Horario de atencion
const BUSINESS_HOURS = { openHour: 8, openMinute: 0, closeHour: 20, closeMinute: 59 };
const CLOSED_DAYS = [1]; // 0=domingo, 1=lunes, 2=martes, 3=miercoles, 4=jueves, 5=viernes, 6=sabado

function isWithinBusinessHours(message) {
  const timestampSeconds = parseInt(message.timestamp, 10);
  if (!Number.isInteger(timestampSeconds)) return true;
  const crMs = timestampSeconds * 1000 - 6 * 60 * 60 * 1000; //Zona horaria
  const crDate = new Date(crMs);
  const crDay = crDate.getUTCDay();
  if (CLOSED_DAYS.includes(crDay)) return false; //Dia libre
  const nowMinutes = crDate.getUTCHours() * 60 + crDate.getUTCMinutes();
  const openMinutes = BUSINESS_HOURS.openHour * 60 + BUSINESS_HOURS.openMinute;
  const closeMinutes = BUSINESS_HOURS.closeHour * 60 + BUSINESS_HOURS.closeMinute;
  return nowMinutes >= openMinutes && nowMinutes < closeMinutes;
}

//Catálogo
const categories = [
  { id: "cat_salas", title: "Muebles de Sala", description: "Reclinables, sillones, mesas de centro" },
  { id: "cat_comedores", title: "Comedores", description: "Mesas y sillas" },
  { id: "cat_dormitorios", title: "Dormitorios", description: "Camas, closets, comodas" },
  { id: "cat_cocina", title: "Cocina", description: "Alacenas, fregaderos, desayunadores"}
];

const products = {
  cat_salas: [
    { id: "prod_sofa_3p", title: "Sofa 3 puestos", price: 150000, description: "Tela gris, patas de madera" },
    { id: "prod_sillon", title: "Sillon individual", price: 18000, description: "Reclinable, cuero sintetico" },
    { id: "prod_mesa_centro", title: "Mesa de centro", price: 17000, description: "Vidrio templado y metal" }
  ],
  cat_comedores: [
    { id: "prod_mesa_6p", title: "Mesa 6 puestos", price: 16000, description: "Madera solida, incluye sillas" },
    { id: "prod_mesa_4p", title: "Mesa 4 puestos", price: 18500, description: "Compacta, ideal apartamentos" },
    { id: "prod_silla_comedor", title: "Silla de comedor (c/u)", price: 8000, description: "Tapizada, estructura de metal" }
  ],
  cat_dormitorios: [
    { id: "prod_cama_queen", title: "Cama Queen", price: 20000, description: "Con cabecero tapizado" },
    { id: "prod_closet", title: "Closet 3 puertas", price: 21500, description: "MDF, espejo integrado" },
    { id: "prod_comoda", title: "Comoda 5 gavetas", price: 22000, description: "Madera laminada" }
  ],
  cat_cocina: [
    { id: "prod_alacena", title: "Alacena madera", price: 23000, description: "Alacena 6 estantes" }, 
    { id: "prod_fregadero", title: "Fregadero cocina", price: 23500, description: "Fregadero de acero inoxidable para cocina"},
    { id: "prod_desayunador_4p", title: "Desayunador 4 puestos", price: 24000, description: "Desayunador para 4 personas"}
  ]
};

function findCategory(id) { return categories.find((c) => c.id === id) || null; }
function findProduct(id) {
  for (const catId of Object.keys(products)) {
    const found = products[catId].find((p) => p.id === id);
    if (found) return found;
  }
  return null;
}
function formatPrice(amount) { return `₡${amount.toLocaleString("es-CR")}`; }

function buildUrl() {
  return `https://graph.facebook.com/${GRAPH_VERSION}/${PHONE_NUMBER_ID}/messages`;
}
function textPayload(to, body) {
  return { messaging_product: "whatsapp", to, type: "text", text: { body } };
}
function templatePayload(to, templateName, languageCode, params) {
  return {
    messaging_product: "whatsapp", to, type: "template",
    template: {
      name: templateName,
      language: { code: languageCode },
      components: [
        { type: "body", parameters: params.map((p) => ({ type: "text", text: p })) }
      ]
    }
  };
}
function buttonsPayload(to, bodyText, buttons) {
  return {
    messaging_product: "whatsapp", to, type: "interactive",
    interactive: { type: "button", body: { text: bodyText },
      action: { buttons: buttons.map((b) => ({ type: "reply", reply: { id: b.id, title: b.title } })) } }
  };
}
function listPayload(to, bodyText, buttonLabel, sections) {
  return {
    messaging_product: "whatsapp", to, type: "interactive",
    interactive: { type: "list", body: { text: bodyText }, action: { button: buttonLabel, sections } }
  };
}
function locationPayload(to, latitude, longitude, name, address) {
  return {
    messaging_product: "whatsapp", to, type: "location",
    location: { latitude, longitude, name, address }
  };
}
function imagePayload(to, mediaId, caption) {
  return {
    messaging_product: "whatsapp", to, type: "image",
    image: { id: mediaId, caption }
  };
}

//Botón de menú/imagen que se agrega a los mensajes de botones que tengan espacio (máx 3 botones por mensaje en WhatsApp)
const CATALOG_BUTTON = { id: "ver_fotos", title: "Menú" };
function withCatalogButton(buttons) {
  return buttons.length < 3 ? [...buttons, CATALOG_BUTTON] : buttons;
}

//Calcula el total del carrito completo
function cartTotal(cart) {
  return cart.reduce((sum, item) => {
    const product = findProduct(item.productId);
    return sum + product.price * item.quantity;
  }, 0);
}

//Arma la lista de lineas "Producto x cantidad = subtotal" para el carrito, con comentario por articulo si lo hay
function cartLines(cart) {
  return cart
    .map((item) => {
      const product = findProduct(item.productId);
      const subtotal = product.price * item.quantity;
      const commentPart = item.comment ? ` (Comentario: ${item.comment})` : "";
      return `• ${product.title} x${item.quantity} = ${formatPrice(subtotal)}${commentPart}`;
    })
    .join("\n");
}

//Arma la lista de lineas del carrito en una sola linea (los parametros de un Message Template
//NO pueden contener saltos de linea, por eso aqui se separan con " | " en vez de "\n")
function cartLinesForTemplate(cart) {
  return cart
    .map((item) => {
      const product = findProduct(item.productId);
      const subtotal = product.price * item.quantity;
      const commentPart = item.comment ? ` (Comentario: ${item.comment})` : "";
      return `${product.title} x${item.quantity} = ${formatPrice(subtotal)}${commentPart}`;
    })
    .join(" | ");
}

function categoryListPayload(to, introText) {
  return listPayload(to, introText, "Ver categorías", [
    { title: "Muebles", rows: categories.map((c) => ({ id: c.id, title: c.title, description: c.description })) }
  ]);
}

function addMorePayload(to) {
  return buttonsPayload(to, "¿Deseas agregar otro producto a tu pedido?", withCatalogButton([
    { id: "add_more_yes", title: "Sí" },
    { id: "add_more_no", title: "No" }
  ]));
}

function summaryPayload(to, state) {
  const total = cartTotal(state.cart);
  const deliveryLine = state.deliveryMethod === "domicilio"
    ? "Entrega a domicilio (el repartidor te contactará para solicitar tu ubicación)"
    : "Entrega: recoger en tienda";
  const paymentLine = state.deliveryMethod === "recoger"
    ? "Pago: se gestiona en la tienda al recoger el pedido"
    : state.paymentMethod === "tarjeta"
      ? "Pago: Tarjeta (datáfono)"
      : `Pago: Efectivo (cancela con ${formatPrice(state.cashAmount)})`;
  const summary = `*Resumen de tu pedido*\n\n${cartLines(state.cart)}\n\nTotal: ${formatPrice(total)}\n${deliveryLine}\n${paymentLine}\n\n¿Confirmas el pedido?`;
  return buttonsPayload(to, summary, withCatalogButton([
    { id: "confirmar_pedido", title: "Confirmar" },
    { id: "corregir_pedido", title: "Corregir" },
    { id: "cancelar_pedido", title: "Cancelar" }
  ]));
}
function paymentMethodPayload(to) {
  return buttonsPayload(to, "¿Cómo prefieres pagar?", withCatalogButton([
    { id: "pago_tarjeta", title: "Tarjeta (datáfono)" },
    { id: "pago_efectivo", title: "Efectivo" }
  ]));
}
function deliveryMethodPayload(to) {
  return buttonsPayload(to, "¿Cómo prefieres recibir tu pedido?", withCatalogButton([
    { id: "entrega_domicilio", title: "A domicilio" },
    { id: "entrega_recoger", title: "Recoger en tienda" }
  ]));
}

//Estado ejecuciones
const staticData = $getWorkflowStaticData("global");
if (!staticData.conversations) staticData.conversations = {};

//Extracción mensaje entrante
const input = $input.first().json;
const message = input.messages?.[0]
  || input.entry?.[0]?.changes?.[0]?.value?.messages?.[0]
  || input;

if (!message || !message.from) {
  return [];
}

//Usa el numero real que recibio el mensaje (no el fijo) para que el bot responda
//desde el MISMO numero al que le escribio el cliente, aunque tengas varios numeros activos.
const metadata = input.metadata || input.entry?.[0]?.changes?.[0]?.value?.metadata;
if (metadata?.phone_number_id) {
  PHONE_NUMBER_ID = metadata.phone_number_id;
}

const from = message.from;
if (!staticData.conversations[from]) {
  staticData.conversations[from] = { step: "MENU", cart: [] };
}
const state = staticData.conversations[from];

//Fuera de horario (o lunes): responde con aviso y no continua el flujo normal
if (!isWithinBusinessHours(message)) {
  const closedPayload = textPayload(from, "🕐 Actualmente estamos cerrados. Nuestro horario de atención es de martes a domingo, de 1:00 pm a 9:00 pm. Los lunes permanecemos cerrados. Por favor escríbenos dentro de ese horario y con gusto te atenderemos. ¡Gracias por preferirnos!");
  return [{ json: { url: buildUrl(), body: closedPayload } }];
}

//Ignora mensajes duplicados (Meta reintenta el mismo webhook varias veces si tarda en responder)
if (!staticData.processedMessageIds) staticData.processedMessageIds = [];
if (message.id) {
  if (staticData.processedMessageIds.includes(message.id)) {
    return [];
  }
  staticData.processedMessageIds.push(message.id);
  if (staticData.processedMessageIds.length > 200) {
    staticData.processedMessageIds = staticData.processedMessageIds.slice(-200);
  }
}

//Armado de mensaje
const rawText = message.text?.body?.trim().toLowerCase();
const isResetKeyword = message.type === "text" && ["hola", "menu", "inicio"].includes(rawText);
const isFreshConversation = state.step === "MENU" || state.step === "DONE";
if (message.type === "text" && (isFreshConversation || isResetKeyword)) {
  staticData.conversations[from] = { step: "MENU", cart: [] };
  const payload = buttonsPayload(from, "👋 ¡Hola! Soy el asistente virtual de compra de la Mueblería Mueble Feliz. ¿En qué puedo ayudarte?", withCatalogButton([
    { id: "ver_catalogo", title: "Hacer pedido" },
    { id: "visitar_tienda", title: "Ubicación Mueblería" }
  ]));
  return [{ json: { url: buildUrl(), body: payload } }];
}

let responsePayload = null;

if (message.type === "interactive") {
  const inter = message.interactive;

  if (inter.type === "button_reply") {
    const id = inter.button_reply.id;

    if (id === "ver_fotos") {
      //No cambia el 'step': el cliente sigue exactamente donde estaba en su pedido
      responsePayload = imagePayload(from, MENU_IMAGE_MEDIA_ID, "Aquí tienes nuestro menú 📷");
    } else if (id === "ver_catalogo") {
      state.step = "CATEGORY_LIST";
      responsePayload = categoryListPayload(from, "Elige una categoría:");
    } else if (id === "visitar_tienda") {
      state.step = "DONE";
      responsePayload = locationPayload(
        from, 9.885280, -84.065698,
        "Mueblería Mueble Feliz",
        "San Miguel, Desamparados, frente al Maxi Palí del cruce"
      );
    } else if (id === "add_more_yes") {
      state.step = "CATEGORY_LIST";
      responsePayload = categoryListPayload(from, "Elige otra categoría:");
    } else if (id === "add_more_no") {
      state.step = "DELIVERY_METHOD";
      responsePayload = deliveryMethodPayload(from);
    } else if (id === "item_comment_yes") {
      state.step = "ITEM_COMMENT_TEXT";
      responsePayload = textPayload(from, "Escribe tu comentario para este artículo:");
    } else if (id === "item_comment_no") {
      state.cart.push({ productId: state.pendingProductId, quantity: state.pendingQuantity, comment: null });
      state.pendingProductId = null;
      state.pendingQuantity = null;
      state.step = "ADD_MORE";
      responsePayload = addMorePayload(from);
    } else if (id === "entrega_domicilio") {
      state.deliveryMethod = "domicilio";
      state.step = "PAYMENT_METHOD";
      const noticePayload = textPayload(from, "Una vez el pedido esté listo, nuestro repartidor te contactará para solicitar tu ubicación.");
      const paymentPayload = paymentMethodPayload(from);
      return [
        { json: { url: buildUrl(), body: noticePayload } },
        { json: { url: buildUrl(), body: paymentPayload } }
      ];
    } else if (id === "entrega_recoger") {
      state.deliveryMethod = "recoger";
      state.paymentMethod = null;
      state.step = "SUMMARY";
      const readyPayload = textPayload(from, "Tu pedido estará listo en 45 minutos, te esperamos en nuestra tienda 🛋️");
      const locationMsgPayload = locationPayload(
        from, 9.885280, -84.065698,
        "Mueblería Mueble Feliz",
        "San Miguel, Desamparados, frente al Maxi Palí del cruce"
      );
      const summaryMsgPayload = summaryPayload(from, state);
      return [
        { json: { url: buildUrl(), body: readyPayload } },
        { json: { url: buildUrl(), body: locationMsgPayload } },
        { json: { url: buildUrl(), body: summaryMsgPayload } }
      ];
    } else if (id === "pago_tarjeta") {
      state.paymentMethod = "tarjeta";
      state.step = "SUMMARY";
      responsePayload = summaryPayload(from, state);
    } else if (id === "pago_efectivo") {
      state.paymentMethod = "efectivo";
      state.step = "CASH_AMOUNT";
      const total = cartTotal(state.cart);
      responsePayload = textPayload(from, `El total de tu pedido es ${formatPrice(total)}. ¿Con cuánto vas a cancelar? (escribe el monto en colones, debe ser igual o mayor al total)`);
    } else if (id === "corregir_pedido") {
      state.cart = [];
      state.deliveryMethod = null;
      state.paymentMethod = null;
      state.cashAmount = null;
      state.step = "CATEGORY_LIST";
      responsePayload = categoryListPayload(from, "Empecemos de nuevo con tu pedido. Elige una categoría:");
    } else if (id === "confirmar_pedido") {
      const total = cartTotal(state.cart);
      const deliveryLine = state.deliveryMethod === "domicilio"
        ? "Entrega a domicilio (contactar al cliente para pedir su ubicación)"
        : "Entrega: recoger en tienda";
      const paymentLine = state.deliveryMethod === "recoger"
        ? "Pago: se gestiona en la tienda al recoger el pedido"
        : state.paymentMethod === "tarjeta"
          ? "Pago: Tarjeta (datáfono)"
          : `Pago: Efectivo (cancela con ${formatPrice(state.cashAmount)})`;
      const paymentNote = state.deliveryMethod === "recoger"
        ? ""
        : state.paymentMethod === "tarjeta"
          ? "El repartidor llevará el datáfono para cobrarte."
          : `Recuerda tener listo ${formatPrice(state.cashAmount)} en efectivo para el repartidor.`;

      const customerPayload = textPayload(from, [
        "¡Pedido confirmado! Te contactaremos para coordinar la entrega.",
        paymentNote,
        "Gracias por tu compra 🛋️"
      ].filter(Boolean).join(" "));
      const ownerPayload = templatePayload(OWNER_PHONE_NUMBER, "nuevo_pedido_confirmado", "es", [
        from,
        cartLinesForTemplate(state.cart),
        formatPrice(total),
        deliveryLine,
        paymentLine
      ]);

      staticData.conversations[from] = { step: "MENU", cart: [] };

      return [
        { json: { url: buildUrl(), body: customerPayload } },
        { json: { url: buildUrl(), body: ownerPayload } }
      ];
    } else if (id === "cancelar_pedido") {
      responsePayload = textPayload(from, "Pedido cancelado. Escribe *menu* si quieres empezar de nuevo.");
      staticData.conversations[from] = { step: "MENU", cart: [] };
    }
  } else if (inter.type === "list_reply") {
    const id = inter.list_reply.id;

    if (id.startsWith("qty_")) {
      const qty = parseInt(id.replace("qty_", ""), 10);
      state.pendingQuantity = qty;
      state.step = "ITEM_COMMENT";
      responsePayload = buttonsPayload(from, "¿Deseas agregar un comentario para este artículo?", withCatalogButton([
        { id: "item_comment_yes", title: "Sí" },
        { id: "item_comment_no", title: "No" }
      ]));
    } else {
      const category = findCategory(id);
      const product = findProduct(id);

      if (category) {
        state.categoryId = id;
        state.step = "PRODUCT_LIST";
        const items = products[id] || [];
        responsePayload = listPayload(from, `Productos en ${category.title}:`, "Ver productos", [
          { title: category.title, rows: items.map((p) => ({ id: p.id, title: p.title, description: `${formatPrice(p.price)} - ${p.description}` })) }
        ]);
      } else if (product) {
        state.pendingProductId = id;
        state.step = "QUANTITY_LIST";
        responsePayload = listPayload(from, `Elegiste: ${product.title}. ¿Cuántas unidades deseas?`, "Elegir cantidad", [
          { title: "Cantidad", rows: Array.from({ length: 10 }, (_, i) => ({ id: `qty_${i + 1}`, title: `${i + 1}` })) }
        ]);
      }
    }
  }
} else if (message.type === "text") {
  const text = message.text.body.trim();

  if (state.step === "CASH_AMOUNT") {
    const amount = parseInt(text.replace(/[^0-9]/g, ""), 10);
    const total = cartTotal(state.cart);
    if (!Number.isInteger(amount) || amount <= 0) {
      responsePayload = textPayload(from, `Por favor escribe un monto válido en colones (ej. ${total}).`);
    } else if (amount < total) {
      responsePayload = textPayload(from, `El monto debe ser igual o mayor al total de tu pedido (${formatPrice(total)}). Por favor escribe un monto válido.`);
    } else {
      state.cashAmount = amount;
      state.step = "SUMMARY";
      responsePayload = summaryPayload(from, state);
    }
  } else if (state.step === "ITEM_COMMENT_TEXT") {
    state.cart.push({ productId: state.pendingProductId, quantity: state.pendingQuantity, comment: text });
    state.pendingProductId = null;
    state.pendingQuantity = null;
    state.step = "ADD_MORE";
    responsePayload = addMorePayload(from);
  } else {
    responsePayload = textPayload(from, "Escribe *menu* para ver las opciones disponibles.");
  }
}

if (!responsePayload) {
  responsePayload = textPayload(from, "No entendí ese mensaje. Escribe *Menú* para ver las opciones.");
}

return [{ json: { url: buildUrl(), body: responsePayload } }];