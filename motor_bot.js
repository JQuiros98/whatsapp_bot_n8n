//Valores
const PHONE_NUMBER_ID = "1212327735304969";
const OWNER_PHONE_NUMBER = "50684837251";
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
function summaryPayload(to, state) {
  const product = findProduct(state.productId);
  const total = product.price * state.quantity;
  const deliveryLine = state.deliveryMethod === "domicilio"
    ? `Entrega a domicilio: ${state.address}`
    : "Entrega: recoger en tienda";
  const summary = `*Resumen de tu pedido*\n\nProducto: ${product.title}\nCantidad: ${state.quantity}\n` +
    `Precio unitario: ${formatPrice(product.price)}\nTotal: ${formatPrice(total)}\n${deliveryLine}\n\n¿Confirmas el pedido?`;
  return buttonsPayload(to, summary, [
    { id: "confirmar_pedido", title: "Confirmar" },
    { id: "cancelar_pedido", title: "Cancelar" }
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
const rawText = message.text?.body?.trim().toLowerCase();
if (message.type === "text" && ["hola", "menu", "inicio"].includes(rawText)) {
  staticData.conversations[from] = { step: "MENU" };
  const payload = buttonsPayload(from, "¡Hola! Soy el asistente de la mueblería. ¿En qué puedo ayudarte?", [
    { id: "ver_catalogo", title: "Ver catálogo" },
    { id: "hablar_asesor", title: "Hablar con asesor" }
  ]);
  return [{ json: { url: buildUrl(), body: payload } }];
}

let responsePayload = null;

if (message.type === "interactive") {
  const inter = message.interactive;

  if (inter.type === "button_reply") {
    const id = inter.button_reply.id;

    if (id === "ver_catalogo") {
      state.step = "CATEGORY_LIST";
      responsePayload = listPayload(from, "Elige una categoría:", "Ver categorías", [
        { title: "Muebles", rows: categories.map((c) => ({ id: c.id, title: c.title, description: c.description })) }
      ]);
    } else if (id === "hablar_asesor") {
      state.step = "DONE";
      responsePayload = textPayload(from, "Un asesor se pondrá en contacto contigo en breve. ¡Gracias por escribir!");
    } else if (id === "entrega_domicilio") {
      state.deliveryMethod = "domicilio";
      state.step = "ADDRESS";
      responsePayload = textPayload(from, "Perfecto, ¿cuál es la dirección de entrega?");
    } else if (id === "entrega_recoger") {
      state.deliveryMethod = "recoger";
      state.step = "SUMMARY";
      responsePayload = summaryPayload(from, state);
    } else if (id === "confirmar_pedido") {
      //Envio mensaje dueño
      const product = findProduct(state.productId);
      const total = product.price * state.quantity;
      const deliveryLine = state.deliveryMethod === "domicilio"
        ? `Entrega a domicilio: ${state.address}`
        : "Entrega: recoger en tienda";

      const ownerNotification = `*Nuevo pedido confirmado* 🛋️\n\n` +
        `Cliente: ${from}\n` +
        `Producto: ${product.title}\n` +
        `Cantidad: ${state.quantity}\n` +
        `Total: ${formatPrice(total)}\n` +
        `${deliveryLine}`;

      const customerPayload = textPayload(from, "¡Pedido confirmado! Te contactaremos para coordinar el pago. Gracias por tu compra 🛋️");
      const ownerPayload = textPayload(OWNER_PHONE_NUMBER, ownerNotification);

      staticData.conversations[from] = { step: "MENU" };

      return [
        { json: { url: buildUrl(), body: customerPayload } },
        { json: { url: buildUrl(), body: ownerPayload } }
      ];
    } else if (id === "cancelar_pedido") {
      responsePayload = textPayload(from, "Pedido cancelado. Escribe *menu* si quieres empezar de nuevo.");
      staticData.conversations[from] = { step: "MENU" };
    }
  } else if (inter.type === "list_reply") {
    const id = inter.list_reply.id;
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
      state.productId = id;
      state.step = "QUANTITY";
      responsePayload = textPayload(from, `Elegiste: ${product.title}. ¿Cuántas unidades deseas? (escribe un número)`);
    }
  }
} else if (message.type === "text") {
  const text = message.text.body.trim();

  if (state.step === "QUANTITY") {
    const qty = parseInt(text, 10);
    if (!Number.isInteger(qty) || qty <= 0) {
      responsePayload = textPayload(from, "Por favor escribe un número válido de unidades (ej. 1, 2, 3...).");
    } else {
      state.quantity = qty;
      state.step = "DELIVERY_METHOD";
      responsePayload = buttonsPayload(from, "¿Cómo prefieres recibir tu pedido?", [
        { id: "entrega_domicilio", title: "A domicilio" },
        { id: "entrega_recoger", title: "Recoger en tienda" }
      ]);
    }
  } else if (state.step === "ADDRESS") {
    state.address = text;
    state.step = "SUMMARY";
    responsePayload = summaryPayload(from, state);
  } else {
    responsePayload = textPayload(from, "Escribe *menu* para ver las opciones disponibles.");
  }
}

if (!responsePayload) {
  responsePayload = textPayload(from, "No entendí ese mensaje. Escribe *menu* para ver las opciones.");
}

return [{ json: { url: buildUrl(), body: responsePayload } }];