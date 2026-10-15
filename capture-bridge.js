/* BARRIO DIGITAL | PUENTE REUTILIZABLE DE CAPTURA
   El CRM o sistema administrativo define window.BarrioCapture.onReceive.
   Este archivo no altera inventario, caja ni registros por sí solo. */
(function () {
    "use strict";
    const api = {
        onReceive: null,
        async entregar(datos) {
            if (!datos || !Array.isArray(datos.renglones)) {
                throw new Error("Formato de captura inválido");
            }
            const evento = new CustomEvent("barrio:capture", {
                detail: datos, cancelable: true
            });
            window.dispatchEvent(evento);
            if (typeof api.onReceive !== "function") {
                return { entregado: false };
            }
            await api.onReceive(structuredClone(datos));
            return { entregado: true };
        }
    };
    window.BarrioCapture = api;
})();
