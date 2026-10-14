
/* =========================================================
   BARRIO DIGITAL
   LECTOR DE NOTAS
   ARCHIVO PRINCIPAL app.js
========================================================= */

const $ = id => document.getElementById(id);

const imageCanvas = $("imageCanvas");
const overlay = $("overlay");

const ctx = imageCanvas.getContext("2d");
const octx = overlay.getContext("2d");

let original = null;
let rotation = 0;
let lines = [];
let nextId = 1;
let drag = null;
let worker = null;
let busy = false;


/* =========================================================
   FUNCIONES GENERALES
========================================================= */

function status(message) {

    $("status").textContent = message;

}

function escapeHTML(value) {

    return String(value).replace(
        /[&<>"']/g,
        character => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        }[character])
    );

}


/* =========================================================
   CARGAR FOTOGRAFÍA
========================================================= */

function loadImage(file) {

    if (!file) {
        return;
    }

    status("Cargando fotografía...");

    const url = URL.createObjectURL(file);

    const image = new Image();

    image.onload = () => {

        original = image;

        rotation = 0;

        lines = [];

        nextId = 1;

        // Dibujar primero la fotografía.
        drawImage();

        // Actualizar después los controles.
        render();

        URL.revokeObjectURL(url);

        status(
            "Imagen lista. Selecciona cada renglón con el dedo."
        );

    };

    image.onerror = () => {

        URL.revokeObjectURL(url);

        status(
            "No se pudo abrir la fotografía. Intenta con JPG o PNG."
        );

    };

    image.src = url;

}

$("photo").addEventListener("change", event => {

    const file = event.target.files[0];

    loadImage(file);

});


/* =========================================================
   DIBUJAR FOTOGRAFÍA
========================================================= */

function drawImage() {

    if (!original) {
        return;
    }

    const width = original.naturalWidth;

    const height = original.naturalHeight;

    const scale = Math.min(
        1,
        1400 / Math.max(width, height)
    );

    const rotated = rotation % 180 !== 0;

    imageCanvas.width = Math.round(
        (rotated ? height : width) * scale
    );

    imageCanvas.height = Math.round(
        (rotated ? width : height) * scale
    );

    overlay.width = imageCanvas.width;

    overlay.height = imageCanvas.height;

    ctx.setTransform(1, 0, 0, 1, 0, 0);

    ctx.clearRect(
        0,
        0,
        imageCanvas.width,
        imageCanvas.height
    );

    ctx.translate(
        imageCanvas.width / 2,
        imageCanvas.height / 2
    );

    ctx.rotate(
        rotation * Math.PI / 180
    );

    ctx.drawImage(
        original,
        -width * scale / 2,
        -height * scale / 2,
        width * scale,
        height * scale
    );

    ctx.setTransform(1, 0, 0, 1, 0, 0);

    drawOverlay();

}


/* =========================================================
   COORDENADAS Y SELECCIONES
========================================================= */

function rect(start, end) {

    return {

        x: Math.min(start.x, end.x),

        y: Math.min(start.y, end.y),

        w: Math.abs(start.x - end.x),

        h: Math.abs(start.y - end.y)

    };

}

function point(event) {

    const bounds = overlay.getBoundingClientRect();

    return {

        x: Math.max(
            0,
            Math.min(
                overlay.width,
                (event.clientX - bounds.left)
                * overlay.width / bounds.width
            )
        ),

        y: Math.max(
            0,
            Math.min(
                overlay.height,
                (event.clientY - bounds.top)
                * overlay.height / bounds.height
            )
        )

    };

}


/* =========================================================
   DIBUJAR RECUADROS DE SELECCIÓN
========================================================= */

function drawOverlay() {

    octx.clearRect(
        0,
        0,
        overlay.width,
        overlay.height
    );

    octx.lineWidth = Math.max(
        2,
        overlay.width / 450
    );

    for (const line of lines) {

        octx.strokeStyle = "#087a65";

        octx.fillStyle = "#087a6530";

        octx.fillRect(
            line.rect.x,
            line.rect.y,
            line.rect.w,
            line.rect.h
        );

        octx.strokeRect(
            line.rect.x,
            line.rect.y,
            line.rect.w,
            line.rect.h
        );

    }

    if (drag) {

        const selection = rect(
            drag.start,
            drag.end
        );

        octx.strokeStyle = "#ff9d1e";

        octx.strokeRect(
            selection.x,
            selection.y,
            selection.w,
            selection.h
        );

    }

}


/* =========================================================
   SELECCIONAR RENGLONES
========================================================= */

overlay.addEventListener("pointerdown", event => {

    if (!original || busy) {
        return;
    }

    overlay.setPointerCapture(
        event.pointerId
    );

    drag = {

        start: point(event),

        end: point(event)

    };

    drawOverlay();

});

overlay.addEventListener("pointermove", event => {

    if (!drag) {
        return;
    }

    drag.end = point(event);

    drawOverlay();

});

overlay.addEventListener("pointerup", event => {

    if (!drag) {
        return;
    }

    drag.end = point(event);

    const selection = rect(
        drag.start,
        drag.end
    );

    drag = null;

    if (
        selection.w > 20 &&
        selection.h > 8
    ) {

        lines.push({

            id: nextId++,

            rect: selection,

            text: "",

            amount: ""

        });

        render();

    }

    drawOverlay();

});

overlay.addEventListener("pointercancel", () => {

    drag = null;

    drawOverlay();

});


/* =========================================================
   GIRAR FOTOGRAFÍA
========================================================= */

for (
    const [buttonId, delta]
    of [
        ["left", -90],
        ["right", 90]
    ]
) {

    $(buttonId).addEventListener("click", () => {

        if (!original || busy) {
            return;
        }

        rotation = (
            rotation + delta + 360
        ) % 360;

        lines = [];

        drawImage();

        render();

        status(
            "Imagen girada. Selecciona nuevamente los renglones."
        );

    });

}


/* =========================================================
   QUITAR SELECCIONES
========================================================= */

$("reset").addEventListener("click", () => {

    if (busy) {
        return;
    }

    lines = [];

    render();

    drawOverlay();

});


/* =========================================================
   RECORTAR RENGLÓN
========================================================= */

function cropData(selection) {

    const canvas = document.createElement("canvas");

    const marginX = Math.min(
        18,
        Math.round(selection.w * 0.06)
    );

    const marginY = Math.min(
        12,
        Math.round(selection.h * 0.12)
    );

    const x = Math.max(
        0,
        Math.floor(selection.x - marginX)
    );

    const y = Math.max(
        0,
        Math.floor(selection.y - marginY)
    );

    const width = Math.min(
        imageCanvas.width - x,
        Math.ceil(selection.w + 2 * marginX)
    );

    const height = Math.min(
        imageCanvas.height - y,
        Math.ceil(selection.h + 2 * marginY)
    );

    const scale = Math.min(
        3,
        1400 / Math.max(width, height)
    );

    canvas.width = Math.max(
        1,
        Math.round(width * scale)
    );

    canvas.height = Math.max(
        1,
        Math.round(height * scale)
    );

    const context = canvas.getContext("2d");

    context.fillStyle = "white";

    context.fillRect(
        0,
        0,
        canvas.width,
        canvas.height
    );

    context.imageSmoothingQuality = "high";

    context.drawImage(
        imageCanvas,
        x,
        y,
        width,
        height,
        0,
        0,
        canvas.width,
        canvas.height
    );

    return canvas.toDataURL("image/png");

}


/* =========================================================
   MOSTRAR RENGLONES
========================================================= */

function render() {

    const list = $("lineList");

    list.innerHTML = lines.map((line, index) => {

        return `
            <div class="line">

                <img
                    src="${cropData(line.rect)}"
                    alt="Renglón ${index + 1}"
                >

                <div>

                    <label>
                        Renglón ${index + 1}
                        · texto reconocido (editable)
                    </label>

                    <input
                        type="text"
                        data-id="${line.id}"
                        data-kind="text"
                        value="${escapeHTML(line.text)}"
                        placeholder="Pendiente de reconocer"
                    >

                </div>

                <div class="linebuttons">

                    <button
                        class="danger"
                        data-delete="${line.id}"
                        ${busy ? "disabled" : ""}
                    >
                        Quitar renglón
                    </button>

                </div>

            </div>
        `;

    }).join("");

    $("empty").hidden = lines.length > 0;

    $("read").disabled = !lines.length || busy;

    $("stop").disabled = !busy;

    list.querySelectorAll("[data-delete]")
        .forEach(button => {

            button.addEventListener("click", () => {

                lines = lines.filter(
                    line =>
                        line.id !== Number(
                            button.dataset.delete
                        )
                );

                render();

                drawOverlay();

            });

        });

    list.querySelectorAll(
        "input[data-kind=text]"
    ).forEach(input => {

        input.addEventListener("input", () => {

            const line = lines.find(
                item =>
                    item.id === Number(
                        input.dataset.id
                    )
            );

            if (line) {

                line.text = input.value;

                renderAmounts();

            }

        });

    });

    renderAmounts();

    $("selectionHint").textContent = lines.length
        ? `${lines.length} renglón(es) seleccionados.`
        : "Selecciona un renglón arrastrando sobre la imagen.";

}


/* =========================================================
   REVISAR IMPORTES
   CONSERVA EL DISEÑO VERTICAL
========================================================= */

function renderAmounts() {

    const container = $("amounts");

    const focus = document.activeElement;

    const focusedId = focus?.dataset?.amount;

    const selection =
        focus && "selectionStart" in focus
            ? focus.selectionStart
            : null;

    container.innerHTML = lines.map((line, index) => {

        return `
            <div
                style="
                    display:flex;
                    flex-direction:column;
                    gap:10px;
                    margin-bottom:14px;
                    padding:15px;
                    border:1px solid #d7e1eb;
                    border-radius:12px;
                    width:100%;
                    box-sizing:border-box;
                "
            >

                <div>

                    <label>
                        Renglón ${index + 1}
                    </label>

                    <p
                        style="
                            margin:6px 0;
                            overflow-wrap:anywhere;
                        "
                    >
                        ${escapeHTML(
                            line.text || "Sin lectura"
                        )}
                    </p>

                </div>

                <div>

                    <label>
                        Importe ($)
                    </label>

                    <input
                        type="number"
                        min="0"
                        step=".01"
                        data-amount="${line.id}"
                        value="${escapeHTML(line.amount)}"
                        placeholder="0.00"
                        style="
                            width:100%;
                            box-sizing:border-box;
                        "
                    >

                </div>

            </div>
        `;

    }).join("");

    container
        .querySelectorAll("[data-amount]")
        .forEach(input => {

            input.addEventListener("input", () => {

                const line = lines.find(
                    item =>
                        item.id === Number(
                            input.dataset.amount
                        )
                );

                if (line) {

                    line.amount = input.value;

                    updateTotal();

                }

            });

        });

    if (focusedId) {

        const next = container.querySelector(
            `[data-amount="${focusedId}"]`
        );

        if (next) {

            next.focus();

            if (selection !== null) {

                try {

                    next.setSelectionRange(
                        selection,
                        selection
                    );

                } catch (error) {

                    // Los campos numéricos no admiten
                    // selección de texto en todos
                    // los navegadores.

                }

            }

        }

    }

    updateTotal();

}


/* =========================================================
   CALCULAR TOTAL
========================================================= */

function updateTotal() {

    const total = lines.reduce(
        (sum, line) =>
            sum + (Number(line.amount) || 0),
        0
    );

    $("total").textContent =
        `Total revisado: ${total.toLocaleString(
            "es-MX",
            {
                style: "currency",
                currency: "MXN"
            }
        )}`;

}


/* =========================================================
   CONTROL DE RECONOCIMIENTO
========================================================= */

function setBusy(value) {

    busy = value;

    render();

}


/* =========================================================
   RECONOCER RENGLONES
========================================================= */

$("read").addEventListener("click", () => {

    if (busy || !lines.length) {
        return;
    }

    try {

        worker = new Worker(
            "./ocr-worker.js",
            {
                type: "module"
            }
        );

    } catch (error) {

        status(
            `No se pudo iniciar el lector: ${error.message}`
        );

        return;

    }

    setBusy(true);

    status("Iniciando reconocimiento...");

    worker.onmessage = ({ data }) => {

        if (
            data.type === "status" ||
            data.type === "progress"
        ) {

            status(data.message);

        }

        if (data.type === "result") {

            const line = lines.find(
                item => item.id === data.id
            );

            if (line) {

                line.text = data.text;

                render();

            }

        }

        if (data.type === "done") {

            status(
                "Lectura terminada. Revisa y corrige cada renglón y sus importes."
            );

            finish();

        }

        if (data.type === "error") {

            status(
                `No se pudo completar el reconocimiento: ${data.message}`
            );

            finish();

        }

        if (data.type === "cancelled") {

            status(
                "Reconocimiento cancelado."
            );

            finish();

        }

    };

    worker.onerror = error => {

        status(
            `Error del lector: ${
                error.message ||
                "No se pudo iniciar el modelo"
            }`
        );

        finish();

    };

    worker.postMessage({

        type: "read",

        lines: lines.map(line => ({

            id: line.id,

            data: cropData(line.rect)

        }))

    });

});


/* =========================================================
   FINALIZAR RECONOCIMIENTO
========================================================= */

function finish() {

    if (worker) {

        worker.terminate();

        worker = null;

    }

    setBusy(false);

}


/* =========================================================
   CANCELAR RECONOCIMIENTO
========================================================= */

$("stop").addEventListener("click", () => {

    if (worker) {

        worker.terminate();

        worker = null;

    }

    setBusy(false);

    status(
        "Reconocimiento detenido. Los renglones ya leídos permanecen disponibles."
    );

});


/* =========================================================
   PREPARAR REPORTE
========================================================= */

function report() {

    return {

        aplicacion: "Lector de Notas Barrio Digital",

        fechaExportacion: new Date().toISOString(),

        requiereRevision: true,

        renglones: lines.map(line => ({

            texto: line.text,

            importe:
                line.amount === ""
                    ? null
                    : Number(line.amount)

        })),

        totalRevisado: lines.reduce(
            (sum, line) =>
                sum + (Number(line.amount) || 0),
            0
        )

    };

}


/* =========================================================
   EXPORTAR JSON
========================================================= */

$("download").addEventListener("click", () => {

    const data = JSON.stringify(
        report(),
        null,
        2
    );

    const blob = new Blob(
        [data],
        {
            type: "application/json"
        }
    );

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");

    link.href = url;

    link.download = "nota-revisada.json";

    link.click();

    setTimeout(() => {

        URL.revokeObjectURL(url);

    }, 1000);

});


/* =========================================================
   COPIAR TEXTO REVISADO
========================================================= */

$("copy").addEventListener("click", async () => {

    const data = report();

    const text = data.renglones.map(
        (line, index) => {

            const amount = line.importe === null
                ? "sin importe"
                : "$" + line.importe.toFixed(2);

            return `${
                index + 1
            }. ${
                line.text || "(sin lectura)"
            } | ${
                amount
            }`;

        }
    ).join("\n") +
    `\nTOTAL REVISADO: $${
        data.totalRevisado.toFixed(2)
    }`;

    try {

        await navigator.clipboard.writeText(text);

        status(
            "Texto revisado copiado."
        );

    } catch (error) {

        status(
            "No se pudo copiar automáticamente. Usa Exportar revisión."
        );

    }

});


/* =========================================================
   INICIAR APLICACIÓN
========================================================= */

render();
