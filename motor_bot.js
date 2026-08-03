//Valores
const PHONE_NUMBER_ID = "1212327735304969";
const OWNER_PHONE_NUMBER = "50687551210";
const GRAPH_VERSION = "v20.0";

//Catalogo
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
//Mensaje interactivo que le muestra al cliente un botón para compartir su ubicación GPS real
function locationRequestPayload(to, bodyText) {
  return {
    messaging_product: "whatsapp", to, type: "interactive",
    interactive: { type: "location_request_message", body: { text: bodyText }, action: { name: "send_location" } }
  };
}
function summaryPayload(to, state) {
  const product = findProduct(state.productId);
  const total = product.price * state.quantity;
  const deliveryLine = state.deliveryMethod === "domicilio"
    ? `Entrega a domicilio: ${state.address}${state.addressCoords ? `\nUbicación: https://maps.google.com/?q=${state.addressCoords.latitude},${state.addressCoords.longitude}` : ""}`
    : "Entrega: recoger en tienda";
  const paymentLine = state.paymentMethod === "sinpe"
    ? "Pago: Sinpe Móvil"
    : `Pago: Efectivo (cancela con ${formatPrice(state.cashAmount)})`;
  const commentLine = state.comment ? `Comentario: ${state.comment}\n` : "";
  const summary = `*Resumen de tu pedido*\n\nProducto: ${product.title}\nCantidad: ${state.quantity}\n` +
    `Precio unitario: ${formatPrice(product.price)}\nTotal: ${formatPrice(total)}\n${deliveryLine}\n${paymentLine}\n${commentLine}\n¿Confirmas el pedido?`;
  return buttonsPayload(to, summary, [
    { id: "confirmar_pedido", title: "Confirmar" },
    { id: "cancelar_pedido", title: "Cancelar" }
  ]);
}
function paymentMethodPayload(to) {
  return buttonsPayload(to, "¿Cómo prefieres pagar?", [
    { id: "pago_sinpe", title: "Sinpe Móvil" },
    { id: "pago_efectivo", title: "Efectivo" }
  ]);
}
function deliveryMethodPayload(to) {
  return buttonsPayload(to, "¿Cómo prefieres recibir tu pedido?", [
    { id: "entrega_domicilio", title: "A domicilio" },
    { id: "entrega_recoger", title: "Recoger en tienda" }
  ]);
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

const from = message.from;
if (!staticData.conversations[from]) {
  staticData.conversations[from] = { step: "MENU" };
}
const state = staticData.conversations[from];

//Armado de mensaje
//Mensaje: saludo inicial con botones (Ver catálogo / Visitar tienda)
//Se dispara con CUALQUIER texto si la conversación está "fresca" (MENU o DONE),
//o con las palabras clave hola/menu/inicio en cualquier momento (funcionan como reinicio).
const rawText = message.text?.body?.trim().toLowerCase();
const isResetKeyword = message.type === "text" && ["hola", "menu", "inicio"].includes(rawText);
const isFreshConversation = state.step === "MENU" || state.step === "DONE";
if (message.type === "text" && (isFreshConversation || isResetKeyword)) {
  staticData.conversations[from] = { step: "MENU" };
  const payload = buttonsPayload(from, "👋 ¡Hola! Soy el asistente virtual de la Mueblería Mueble Felíz. ¿En qué puedo ayudarte?", [
    { id: "ver_catalogo", title: "Ver catálogo" },
    { id: "visitar_tienda", title: "Visitar tienda" }
  ]);
  return [{ json: { url: buildUrl(), body: payload } }];
}

let responsePayload = null;

if (message.type === "interactive") {
  const inter = message.interactive;

  if (inter.type === "button_reply") {
    const id = inter.button_reply.id;

    if (id === "ver_catalogo") {
      //Mensaje: lista de categorías
      state.step = "CATEGORY_LIST";
      responsePayload = listPayload(from, "Elige una categoría:", "Ver categorías", [
        { title: "Muebles", rows: categories.map((c) => ({ id: c.id, title: c.title, description: c.description })) }
      ]);
    } else if (id === "visitar_tienda") {
      //Mensaje: ubicación de la tienda (pin de Google Maps)
      state.step = "DONE";
      responsePayload = locationPayload(
        from,
        9.885280,
        -84.065698,
        "Mueblería Mueble Feliz",
        "San Miguel, Desamparados, frente al Maxi Palí del cruce"
      );
    } else if (id === "comment_yes") {
      //Mensaje: pedir el texto del comentario
      state.step = "COMMENT_TEXT";
      responsePayload = textPayload(from, "Escribe tu comentario:");
    } else if (id === "comment_no") {
      //Mensaje: sin comentario, continuar directo a método de entrega
      state.comment = null;
      state.step = "DELIVERY_METHOD";
      responsePayload = deliveryMethodPayload(from);
    } else if (id === "entrega_domicilio") {
      //Mensaje: solicitar ubicación GPS real (en vez de escribir la dirección)
      state.deliveryMethod = "domicilio";
      state.step = "ADDRESS";
      responsePayload = locationRequestPayload(from, "Perfecto, por favor comparte tu ubicación actual para la entrega 📍");
    } else if (id === "entrega_recoger") {
      //Mensaje: aviso de 45 minutos + preguntar método de pago (sin pedir ubicación)
      state.deliveryMethod = "recoger";
      state.step = "PAYMENT_METHOD";
      const readyPayload = textPayload(from, "Tu pedido estará listo en 45 minutos, te esperamos en nuestra tienda 🛋️");
      const paymentPayload = paymentMethodPayload(from);
      return [
        { json: { url: buildUrl(), body: readyPayload } },
        { json: { url: buildUrl(), body: paymentPayload } }
      ];
    } else if (id === "pago_sinpe") {
      //Mensaje: resumen final del pedido (pago Sinpe Móvil)
      state.paymentMethod = "sinpe";
      state.step = "SUMMARY";
      responsePayload = summaryPayload(from, state);
    } else if (id === "pago_efectivo") {
      //Mensaje: pedir el monto con el que va a cancelar, mostrando el total a pagar
      state.paymentMethod = "efectivo";
      state.step = "CASH_AMOUNT";
      const product = findProduct(state.productId);
      const total = product.price * state.quantity;
      responsePayload = textPayload(from, `El total de tu pedido es ${formatPrice(total)}. ¿Con cuánto vas a cancelar? (escribe el monto en colones, debe ser igual o mayor al total)`);
    } else if (id === "confirmar_pedido") {
      //Mensaje: confirmación al cliente + notificación al dueño
      const product = findProduct(state.productId);
      const total = product.price * state.quantity;
      const deliveryLine = state.deliveryMethod === "domicilio"
        ? `Entrega a domicilio: ${state.address}${state.addressCoords ? `\nUbicación: https://maps.google.com/?q=${state.addressCoords.latitude},${state.addressCoords.longitude}` : ""}`
        : "Entrega: recoger en tienda";
      const paymentLine = state.paymentMethod === "sinpe"
        ? "Pago: Sinpe Móvil"
        : `Pago: Efectivo (cancela con ${formatPrice(state.cashAmount)})`;
      const paymentNote = state.paymentMethod === "sinpe"
        ? "Recuerda mostrarle el comprobante de pago al repartidor."
        : `Recuerda tener listo ${formatPrice(state.cashAmount)} en efectivo para el repartidor.`;
      const commentLine = state.comment ? `Comentario: ${state.comment}\n` : "";

      const ownerNotification = `*Nuevo pedido confirmado* 🛋️\n\n` +
        `Cliente: ${from}\n` +
        `Producto: ${product.title}\n` +
        `Cantidad: ${state.quantity}\n` +
        `Total: ${formatPrice(total)}\n` +
        `${deliveryLine}\n` +
        `${paymentLine}\n` +
        `${commentLine}`;

      const customerPayload = textPayload(from, `¡Pedido confirmado! Te contactaremos para coordinar la entrega. ${paymentNote} Gracias por tu compra 🛋️`);
      const ownerPayload = textPayload(OWNER_PHONE_NUMBER, ownerNotification);

      staticData.conversations[from] = { step: "MENU" };

      return [
        { json: { url: buildUrl(), body: customerPayload } },
        { json: { url: buildUrl(), body: ownerPayload } }
      ];
    } else if (id === "cancelar_pedido") {
      //Mensaje: pedido cancelado
      responsePayload = textPayload(from, "Pedido cancelado. Escribe *menu* si quieres empezar de nuevo.");
      staticData.conversations[from] = { step: "MENU" };
    }
  } else if (inter.type === "list_reply") {
    const id = inter.list_reply.id;

    if (id.startsWith("qty_")) {
      //Mensaje: cantidad elegida -> preguntar si desea agregar comentario
      const qty = parseInt(id.replace("qty_", ""), 10);
      state.quantity = qty;
      state.step = "ASK_COMMENT";
      responsePayload = buttonsPayload(from, "¿Desea agregar algún comentario?", [
        { id: "comment_yes", title: "Sí" },
        { id: "comment_no", title: "No" }
      ]);
    } else {
      const category = findCategory(id);
      const product = findProduct(id);

      if (category) {
        //Mensaje: lista de productos de la categoría elegida
        state.categoryId = id;
        state.step = "PRODUCT_LIST";
        const items = products[id] || [];
        responsePayload = listPayload(from, `Productos en ${category.title}:`, "Ver productos", [
          { title: category.title, rows: items.map((p) => ({ id: p.id, title: p.title, description: `${formatPrice(p.price)} - ${p.description}` })) }
        ]);
      } else if (product) {
        //Mensaje: lista de cantidades (botones del 1 al 10, vía lista de WhatsApp)
        state.productId = id;
        state.step = "QUANTITY_LIST";
        responsePayload = listPayload(from, `Elegiste: ${product.title}. ¿Cuántas unidades deseas?`, "Elegir cantidad", [
          { title: "Cantidad", rows: Array.from({ length: 10 }, (_, i) => ({ id: `qty_${i + 1}`, title: `${i + 1}` })) }
        ]);
      }
    }
  }
} else if (message.type === "location") {
  //Mensaje: ubicación GPS recibida mientras se esperaba la dirección de entrega
  if (state.step === "ADDRESS") {
    const loc = message.location;
    state.address = loc.address || loc.name || `Lat: ${loc.latitude}, Lng: ${loc.longitude}`;
    state.addressCoords = { latitude: loc.latitude, longitude: loc.longitude };
    state.step = "PAYMENT_METHOD";
    responsePayload = paymentMethodPayload(from);
  } else {
    responsePayload = textPayload(from, "Escribe *menu* para ver las opciones disponibles.");
  }
} else if (message.type === "text") {
  const text = message.text.body.trim();

  if (state.step === "ADDRESS") {
    //Mensaje: se esperaba ubicación GPS, no texto
    responsePayload = textPayload(from, "Formato inválido, envía tu ubicación.");
  } else if (state.step === "CASH_AMOUNT") {
    //Mensaje: monto en efectivo guardado -> mostrar resumen final (validado contra el total)
    const amount = parseInt(text.replace(/[^0-9]/g, ""), 10);
    const product = findProduct(state.productId);
    const total = product.price * state.quantity;
    if (!Number.isInteger(amount) || amount <= 0) {
      responsePayload = textPayload(from, `Por favor escribe un monto válido en colones (ej. ${total}).`);
    } else if (amount < total) {
      responsePayload = textPayload(from, `El monto debe ser igual o mayor al total de tu pedido (${formatPrice(total)}). Por favor escribe un monto válido.`);
    } else {
      state.cashAmount = amount;
      state.step = "SUMMARY";
      responsePayload = summaryPayload(from, state);
    }
  } else if (state.step === "COMMENT_TEXT") {
    //Mensaje: comentario guardado -> continuar a método de entrega
    state.comment = text;
    state.step = "DELIVERY_METHOD";
    responsePayload = deliveryMethodPayload(from);
  } else {
    //Mensaje: texto no reconocido fuera de un paso esperado
    responsePayload = textPayload(from, "Escribe *menu* para ver las opciones disponibles.");
  }
}

if (!responsePayload) {
  //Mensaje: no se entendió el mensaje
  responsePayload = textPayload(from, "No entendí ese mensaje. Escribe *menu* para ver las opciones.");
}

return [{ json: { url: buildUrl(), body: responsePayload } }];