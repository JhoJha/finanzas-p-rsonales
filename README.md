# Gestor Inteligente

Aplicación local y privada de finanzas personales construida con SvelteKit. Los datos se guardan en IndexedDB del navegador; no requiere conexión bancaria ni un backend.

## Funciones

- Cuentas y movimientos en distintas monedas, con una moneda base para reportes.
- Presupuestos, metas, deudas y movimientos recurrentes revisables.
- Importación CSV con vista previa, reglas de comercio y detección de duplicados.
- Suscripciones detectadas, pronóstico de flujo de caja, cierre mensual y patrimonio neto.
- Respaldo y restauración JSON, modo PWA y bloqueo con PIN local.

## Desarrollo

Requiere Node.js 22 o posterior.

```bash
npm ci
npm run dev
```

## Verificación

```bash
npm run check
npm test
npm run build
```

## Consideraciones sobre datos

- Introduce cada movimiento en la moneda de su cuenta. La conversión ocurre solo en los reportes globales.
- Configura una tasa de cambio antes de crear o usar una cuenta que no esté en la moneda base.
- La moneda base se bloquea cuando ya existen datos para evitar reinterpretar el historial.
- Para datos anteriores a la versión histórica, las cuentas, metas y deudas sin fecha de creación solo se muestran a partir del período actual; los nuevos registros incluyen esa fecha.

La automatización de GitHub Actions ejecuta las mismas verificaciones en cada push y pull request.
