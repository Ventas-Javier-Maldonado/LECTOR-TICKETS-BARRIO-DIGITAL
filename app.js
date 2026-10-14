
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
