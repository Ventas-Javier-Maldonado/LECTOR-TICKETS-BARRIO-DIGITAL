# BARRIO DIGITAL | Smart Capture

Módulo de captura reutilizable en repositorios GitHub Pages. Sin Supabase.

## Instalación
Sube los archivos juntos a la raíz del repositorio y habilita GitHub Pages. Para incrustarlo en una aplicación existente, conserva el módulo en una carpeta `lector/` y ábrelo desde un botón del administrador. No sustituye el almacenamiento de tu aplicación.

## Integración
La función `window.BarrioCapture.entregar(datos)` valida el formato y llama `window.BarrioCapture.onReceive` si existe. El sistema anfitrión debe definir su adaptador para registrar el dato en su propio almacenamiento y clasificarlo. El lector no hace escrituras administrativas. Si se abre en una página separada o iframe, el `onReceive` no cruza automáticamente de una ventana a otra; debe integrarse con el código anfitrión, o importar el JSON.

Ejemplo, en la misma página antes de pulsar «Enviar»: 

```js
window.BarrioCapture.onReceive = async (captura) => {
  // Revisar, clasificar y guardar con las funciones reales del administrador.
  console.log(captura);
};
```

## OCR y offline
OCR en español con Tesseract.js 5 por CDN. La interfaz se almacena mediante service worker, pero **el OCR no está garantizado offline**: requiere descargar librería y modelos y que permanezcan disponibles en caché. Funciona mejor con texto impreso; manuscrito requiere revisión. Para OCR realmente offline hay que distribuir localmente los archivos del motor y el modelo de idioma español y probarlos en cada dispositivo.

## Seguridad de datos
El lector no registra inventario, ingresos o egresos por sí mismo. El usuario revisa y confirma antes de enviar. Exportar JSON permite respaldar los datos. No almacena automáticamente fotografías.
