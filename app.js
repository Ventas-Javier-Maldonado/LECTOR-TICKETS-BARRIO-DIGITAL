/* =========================================================
   BARRIO DIGITAL | LECTOR DE NOTAS
   OCR EN ESPAÑOL, REVISIÓN MANUAL Y EXPORTACIÓN
========================================================= */

const $ = id => document.getElementById(id);
const photoCanvas = $("photoCanvas");
const selectionCanvas = $("selectionCanvas");
const ctx = photoCanvas.getContext("2d");
const selectCtx = selectionCanvas.getContext("2d");

let sourceImage = null;
let angle = 0;
let selections = [];
let drawing = null;
let items = [];
let nextId = 1;
let ocrWorker = null;
let busy = false;
let cancelled = false;

function setStatus(message) {
    $("status").textContent = message;
}

function money(value) {
    return Number(value || 0).toLocaleString("es-MX", {
        style: "currency",
        currency: "MXN"
    });
}

function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, character => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;",
        '"': "&quot;", "'": "&#39;"
    }[character]));
}

function updateButtons() {
    $("rotate").disabled = !sourceImage || busy;
    $("clear").disabled = !selections.length || busy;
    $("recognize").disabled = !sourceImage || busy;
    $("cancel").disabled = !busy;
    $("photo").disabled = busy;
}

/* =========================================================
   FOTOGRAFÍA
========================================================= */

$("photo").addEventListener("change", event => {
    const file = event.target.files[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
        setStatus("Selecciona un archivo de imagen válido.");
        return;
    }

    const url = URL.createObjectURL(file);
    const image = new Image();
    setStatus("Abriendo fotografía...");

    image.onload = () => {
        sourceImage = image;
        angle = 0;
        selections = [];
        items = [];
        drawPhoto();
        renderItems();
        updateButtons();
        setStatus("Fotografía lista. Selecciona renglones o pulsa Leer nota en español.");
        URL.revokeObjectURL(url);
    };

    image.onerror = () => {
        setStatus("No se pudo abrir la imagen. Prueba con JPG o PNG.");
        URL.revokeObjectURL(url);
    };

    image.src = url;
});

function drawPhoto() {
    if (!sourceImage) return;
    const w = sourceImage.naturalWidth;
    const h = sourceImage.naturalHeight;
    const scale = Math.min(1, 1600 / Math.max(w, h));
    const sideways = angle % 180 !== 0;
    photoCanvas.width = Math.max(1, Math.round((sideways ? h : w) * scale));
    photoCanvas.height = Math.max(1, Math.round((sideways ? w : h) * scale));
    selectionCanvas.width = photoCanvas.width;
    selectionCanvas.height = photoCanvas.height;
    $("photoHint").hidden = true;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, photoCanvas.width, photoCanvas.height);
    ctx.translate(photoCanvas.width / 2, photoCanvas.height / 2);
    ctx.rotate(angle * Math.PI / 180);
    ctx.drawImage(sourceImage, -w * scale / 2, -h * scale / 2, w * scale, h * scale);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    drawSelections();
}

$("rotate").addEventListener("click", () => {
    angle = (angle + 90) % 360;
    selections = [];
    drawPhoto();
    updateButtons();
    setStatus("Fotografía girada. Las selecciones anteriores se limpiaron.");
});

$("clear").addEventListener("click", () => {
    selections = [];
    drawSelections();
    updateButtons();
});

/* =========================================================
   SELECCIÓN DE RENGLONES
========================================================= */

function position(event) {
    const bounds = selectionCanvas.getBoundingClientRect();
    return {
        x: Math.max(0, Math.min(selectionCanvas.width,
            (event.clientX - bounds.left) * selectionCanvas.width / bounds.width)),
        y: Math.max(0, Math.min(selectionCanvas.height,
            (event.clientY - bounds.top) * selectionCanvas.height / bounds.height))
    };
}

function rectangle(a, b) {
    return {
        x: Math.min(a.x, b.x),
        y: Math.min(a.y, b.y),
        w: Math.abs(a.x - b.x),
        h: Math.abs(a.y - b.y)
    };
}

function drawSelections() {
    selectCtx.clearRect(0, 0, selectionCanvas.width, selectionCanvas.height);
    selectCtx.lineWidth = Math.max(2, selectionCanvas.width / 500);
    for (const rect of selections) {
        selectCtx.fillStyle = "rgba(8, 122, 101, .14)";
        selectCtx.strokeStyle = "#087a65";
        selectCtx.fillRect(rect.x, rect.y, rect.w, rect.h);
        selectCtx.strokeRect(rect.x, rect.y, rect.w, rect.h);
    }
    if (drawing) {
        const rect = rectangle(drawing.start, drawing.end);
        selectCtx.strokeStyle = "#f39a23";
        selectCtx.strokeRect(rect.x, rect.y, rect.w, rect.h);
    }
}

selectionCanvas.addEventListener("pointerdown", event => {
    if (!sourceImage || busy) return;
    selectionCanvas.setPointerCapture(event.pointerId);
    drawing = { start: position(event), end: position(event) };
    drawSelections();
});

selectionCanvas.addEventListener("pointermove", event => {
    if (!drawing) return;
    drawing.end = position(event);
    drawSelections();
});

selectionCanvas.addEventListener("pointerup", event => {
    if (!drawing) return;
    drawing.end = position(event);
    const rect = rectangle(drawing.start, drawing.end);
    drawing = null;
    if (rect.w > 20 && rect.h > 8) selections.push(rect);
    drawSelections();
    updateButtons();
    setStatus(`${selections.length} renglón(es) seleccionado(s).`);
});

selectionCanvas.addEventListener("pointercancel", () => {
    drawing = null;
    drawSelections();
});

function crop(rect) {
    const padX = Math.min(16, rect.w * .05);
    const padY = Math.min(12, rect.h * .15);
    const x = Math.max(0, Math.floor(rect.x - padX));
    const y = Math.max(0, Math.floor(rect.y - padY));
    const w = Math.min(photoCanvas.width - x, Math.ceil(rect.w + 2 * padX));
    const h = Math.min(photoCanvas.height - y, Math.ceil(rect.h + 2 * padY));
    const canvas = document.createElement("canvas");
    const scale = Math.min(3, 1600 / Math.max(w, h));
    canvas.width = Math.max(1, Math.round(w * scale));
    canvas.height = Math.max(1, Math.round(h * scale));
    const context = canvas.getContext("2d");
    context.fillStyle = "white";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(photoCanvas, x, y, w, h, 0, 0, canvas.width, canvas.height);
    return canvas;
}

/* =========================================================
   OCR EN ESPAÑOL (TESSERACT.JS)
   Mejor con texto impreso; manuscrito requiere revisión.
========================================================= */

$("recognize").addEventListener("click", async () => {
    if (!sourceImage || busy) return;
    if (typeof Tesseract === "undefined") {
        setStatus("No se pudo cargar el motor OCR. Comprueba tu conexión a internet.");
        return;
    }

    busy = true;
    cancelled = false;
    updateButtons();
    setStatus("Preparando el reconocimiento en español...");

    try {
        ocrWorker = await Tesseract.createWorker("spa", 1, {
            logger: message => {
                if (!cancelled && message.status) {
                    const percentage = typeof message.progress === "number"
                        ? ` ${Math.round(message.progress * 100)}%` : "";
                    setStatus(`${message.status}${percentage}`);
                }
            }
        });

        if (cancelled) return;
        const areas = selections.length ? selections : [null];
        const recognized = [];

        for (let i = 0; i < areas.length; i++) {
            if (cancelled) break;
            setStatus(`Leyendo ${i + 1} de ${areas.length}...`);
            const image = areas[i] ? crop(areas[i]) : photoCanvas;
            const result = await ocrWorker.recognize(image);
            if (cancelled) break;
            const text = (result.data.text || "").trim();
            const rows = text.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
            for (const row of rows) recognized.push(parseRow(row));
        }

        if (!cancelled) {
            items = recognized;
            renderItems();
            setStatus(items.length
                ? `Lectura terminada: ${items.length} renglón(es). Revisa y corrige los resultados.`
                : "No se reconoció texto. Puedes agregar renglones manualmente.");
        }
    } catch (error) {
        if (!cancelled) setStatus(`Error de reconocimiento: ${error.message}`);
    } finally {
        const current = ocrWorker;
        ocrWorker = null;
        if (current) {
            try { await current.terminate(); } catch (_) {}
        }
        busy = false;
        updateButtons();
    }
});

$("cancel").addEventListener("click", () => {
    cancelled = true;
    setStatus("Cancelando lectura...");
    // La operación activa puede tardar un momento en finalizar.
    if (ocrWorker) ocrWorker.terminate().catch(() => {});
});



/* =========================================================
   INTERPRETACIÓN DE RENGLONES
   CANTIDAD · UNIDAD · PRODUCTO · IMPORTE
========================================================= */

function parseRow(raw) {

    let text = String(raw || "")
        .replace(/\s+/g, " ")
        .trim();

    let amount = "";
    let quantity = "";
    let unit = "";

    // 1. Detectar precios con símbolo $
    // o palabras como total e importe.

    let amountMatch = text.match(
        /(?:\$\s*|(?:total|importe)\s*:?\s*)(\d[\d,.]*)(?:\s*(?:mxn|pesos))?\s*$/i
    );

    // 2. Detectar precios al final del renglón
    // aunque no tengan símbolo $.
    // Solo cuando hay texto antes del precio.

    if (!amountMatch) {

        amountMatch = text.match(
            /\s+(\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{2})?|\d+(?:[.,]\d{1,2})?)\s*$/
        );

    }

    if (amountMatch) {

        let candidate = amountMatch[1];

        // Normalizar formatos de moneda.
        if (
            candidate.includes(",") &&
            candidate.includes(".")
        ) {

            candidate = candidate.replace(/,/g, "");

        } else if (
            /^\d+,\d{1,2}$/.test(candidate)
        ) {

            candidate = candidate.replace(",", ".");

        } else if (
            /^\d{1,3}(?:,\d{3})+$/.test(candidate)
        ) {

            candidate = candidate.replace(/,/g, "");

        }

        if (
            /^\d+(?:\.\d{1,2})?$/.test(candidate)
        ) {

            amount = candidate;

            text = text.slice(
                0,
                amountMatch.index
            ).trim();

        }

    }

    // 3. Detectar cantidad y unidad.
    // Exigir unidad o texto adicional para
    // evitar confundir una cifra con un producto.

    const quantityMatch = text.match(
        /^(\d+(?:[.,]\d+)?)\s*(kg|kilos?|g|gr|gramos?|pzas?|piezas?|lts?|litros?|ml)\b\s*/i
    );

    if (quantityMatch) {

        quantity = quantityMatch[1]
            .replace(",", ".");

        unit = quantityMatch[2];

        text = text.slice(
            quantityMatch[0].length
        ).trim();

    }

    // 4. Conservar el texto original.
    // No inventar productos ni importes.

    return {

        id: nextId++,

        raw: raw,

        product: text,

        quantity: quantity,

        unit: unit,

        amount: amount

    };

}


/* =========================================================
   REVISIÓN Y TOTALES
========================================================= */

function addBlankRow() {
    items.push({ id: nextId++, raw: "", product: "", quantity: "", unit: "", amount: "" });
    renderItems();
}

$("add").addEventListener("click", addBlankRow);

function renderItems() {
    $("empty").hidden = items.length > 0;
    $("items").innerHTML = items.map((item, index) => `
        <div class="item" data-id="${item.id}">
            <div class="itemtop">
                <strong>Renglón ${index + 1}</strong>
                <button class="danger" data-remove="${item.id}" type="button">Eliminar</button>
            </div>
            <div class="itemgrid">
                <div class="product">
                    <label>Producto o concepto</label>
                    <input type="text" data-field="product" value="${escapeHTML(item.product)}" placeholder="Ej. Camarón">
                </div>
                <div>
                    <label>Cantidad</label>
                    <input type="text" data-field="quantity" value="${escapeHTML(item.quantity)}" placeholder="2">
                </div>
                <div>
                    <label>Unidad</label>
                    <input type="text" data-field="unit" value="${escapeHTML(item.unit)}" placeholder="kg">
                </div>
                <div>
                    <label>Importe ($)</label>
                    <input type="number" min="0" step="0.01" data-field="amount" value="${escapeHTML(item.amount)}" placeholder="0.00">
                </div>
            </div>
            ${item.raw ? `<p class="raw">Lectura original: ${escapeHTML(item.raw)}</p>` : ""}
        </div>
    `).join("");

    $("items").querySelectorAll("input[data-field]").forEach(input => {
        input.addEventListener("input", () => {
            const parent = input.closest(".item");
            const item = items.find(x => x.id === Number(parent.dataset.id));
            if (!item) return;
            item[input.dataset.field] = input.value;
            updateTotal();
        });
    });

    $("items").querySelectorAll("[data-remove]").forEach(button => {
        button.addEventListener("click", () => {
            items = items.filter(x => x.id !== Number(button.dataset.remove));
            renderItems();
        });
    });

    updateTotal();
}

function totalValue() {
    return items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
}

function updateTotal() {
    $("total").textContent = `Total revisado: ${money(totalValue())}`;
}

function report() {
    return {
        version: "1.0",
        origen: "barrio-digital-smart-capture",
        estado: "revisado-por-usuario",
        aplicacion: "Lector de Notas Barrio Digital",
        fecha: new Date().toISOString(),
        requiereRevisionHumana: true,
        renglones: items.map(item => ({
            producto: item.product,
            cantidad: item.quantity,
            unidad: item.unit,
            importe: item.amount === "" ? null : Number(item.amount),
            lecturaOriginal: item.raw
        })),
        totalRevisado: totalValue()
    };
}

$("download").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(report(), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "nota-barrio-digital.json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
});

$("copy").addEventListener("click", async () => {
    const text = items.map((item, index) =>
        `${index + 1}. ${item.quantity} ${item.unit} ${item.product} | ${item.amount === "" ? "Sin importe" : money(item.amount)}`
    ).join("\n") + `\nTOTAL REVISADO: ${money(totalValue())}`;

    try {
        await navigator.clipboard.writeText(text);
        setStatus("Nota copiada.");
    } catch (_) {
        setStatus("No se pudo copiar. Utiliza Exportar JSON.");
    }
});

$("reset").addEventListener("click", () => {
    if (busy) return;
    sourceImage = null;
    selections = [];
    items = [];
    angle = 0;
    $("photo").value = "";
    photoCanvas.width = 300;
    photoCanvas.height = 0;
    selectionCanvas.width = 300;
    selectionCanvas.height = 0;
    $("photoHint").hidden = false;
    renderItems();
    updateButtons();
    setStatus("Listo para una nueva nota.");
});

photoCanvas.width = 300;
photoCanvas.height = 0;
selectionCanvas.width = 300;
selectionCanvas.height = 0;
renderItems();
updateButtons();

/* =========================================================
   ENTREGA AL SISTEMA ADMINISTRATIVO
   No registra movimientos por sí mismo.
========================================================= */

$("send").addEventListener("click", async () => {
    if (busy) return;
    if (!items.length) {
        setStatus("Agrega o reconoce al menos un renglón antes de enviarlo.");
        return;
    }
    const invalid = items.some(item => !item.product.trim() ||
        item.amount === "" || !Number.isFinite(Number(item.amount)) ||
        Number(item.amount) < 0);
    if (invalid) {
        setStatus("Revisa cada concepto e importe antes de enviarlo a administración.");
        return;
    }
    const payload = report();
    if (!window.confirm("¿Confirmas que revisaste los datos y deseas enviarlos a administración?")) return;
    try {
        const result = await window.BarrioCapture.entregar(payload);
        if (result?.entregado) {
            setStatus("Datos enviados al sistema administrativo para su clasificación.");
        } else {
            setStatus("No hay administración conectada. Descarga el JSON para importarlo después.");
        }
    } catch (error) {
        setStatus(`No se pudo enviar: ${error.message}. Los datos permanecen en pantalla.`);
    }
});
