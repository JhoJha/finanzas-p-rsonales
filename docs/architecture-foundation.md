# Fundación de arquitectura local-first

Fecha: 2026-08-01

## Auditoría de Fase 0

La aplicación es una PWA de SvelteKit 2 con Svelte 5. `FinanceStoreFacade` es la fachada de la lógica de aplicación: coordina movimientos, cuentas, presupuestos, metas, deudas, recurrentes, reportes, respaldos y persistencia. Los servicios en `src/lib/services/` contienen reglas deterministas para efectos de movimientos, deudas, metas, recurrencias y reportes. Los esquemas Zod de `src/lib/schema.ts` validan las entidades y los respaldos.

Los datos financieros se guardan principalmente en IndexedDB mediante `idb-keyval`. Desde la versión 6, `finances_state_v4` es un único snapshot y fuente de verdad; las claves individuales y `localStorage` solo se leen para migrar instalaciones antiguas. El repositorio rechaza snapshots corruptos o de una versión futura para evitar sobrescribirlos. Se mantienen hasta cinco copias automáticas locales y el usuario puede exportar/restaurar JSON validado.

La aplicación actual incluye captura manual y dictado del navegador, cuentas y transferencias multimoneda, importación CSV, presupuestos, metas, deudas, movimientos recurrentes, pronóstico, suscripciones, cierre mensual, patrimonio, PIN local y PWA offline. El dictado actual usa Web Speech Recognition en el cliente y solo extrae un movimiento con reglas de palabras clave.

## Mapa de datos y privacidad

| Datos | Ubicación actual | Salida del dispositivo |
| --- | --- | --- |
| Movimientos, cuentas, categorías, presupuestos, metas, deudas y ajustes | IndexedDB (`finances_state_v4`) | Exportación JSON iniciada por el usuario |
| Historial breve de respaldos | IndexedDB (`finances_backup_history`) | No |
| PIN local | `settings.security` dentro del snapshot; solo hash y sal | No |
| Tasas de cambio | Ajustes locales | Consulta directa del navegador a Frankfurter al actualizar |
| Voz | Web Speech Recognition del navegador | Depende del proveedor/navegador; no hay control de minimización todavía |

No hay Supabase, proveedor de IA, pagos ni Google Drive integrados. Por tanto no hay claves de DeepSeek expuestas ni una base remota con datos financieros. El uso de reconocimiento de voz nativo debe presentarse en Fase 3 como dependiente del navegador y con una alternativa de transcripción que pase por la API privada.

## Decisiones y contratos

1. IndexedDB continúa como fuente principal de datos financieros. Ningún cliente de IA, autenticación o pago podrá importarse desde las rutas o componentes.
2. Se añade una frontera de contratos para agentes y proveedores. El agente solo produce solicitudes estructuradas; una capa de aplicación las valida, muestra una vista previa y ejecuta la operación local confirmada.
3. Los montos existentes permanecen como `number` decimal. Migrarlos a unidades menores ahora cambiaría cada cálculo, respaldo e importación sin una necesidad demostrada. Se incorporan utilidades deterministas de unidades menores para acciones futuras y se reserva una migración explícita si el almacenamiento de montos llega a cambiar.
4. Categorías conservan sus IDs actuales para no romper relaciones. Las categorías conocidas reciben un `code` canónico estable (`food`, `transport`, `income`, etc.); las personalizadas no se adivinan ni se renombran.
5. La configuración incorpora `locale` y `timeZone` estructurales. El valor inicial es `es-PE` y `America/Lima`; `baseCurrency` se mantiene separado y usa ISO 4217.

## Migración v7

La migración es ascendente e idempotente. Para snapshots v6 o anteriores:

- agrega `code` a las categorías predeterminadas conocidas sin modificar IDs ni nombres;
- agrega `locale: es-PE` y `timeZone: America/Lima` cuando faltan;
- conserva todos los movimientos, importes, fechas ISO, cuentas y relaciones;
- serializa el resultado como versión 7 únicamente después de validarlo.

Los respaldos anteriores siguen siendo aceptados. Un snapshot de versión futura se rechaza antes de normalizarlo. No se elimina ninguna clave heredada durante esta fase.

## Brechas frente a la visión objetivo

- No existe API privada, adaptadores de autenticación/IA/cuotas ni configuración server-side de secretos.
- El flujo de voz no separa varios movimientos, no ofrece revisión estructurada ni confirmación por lote/deshacer persistente.
- No hay motor de intenciones, registro de herramientas, auditoría local ni idempotencia para acciones de agente.
- Las pantallas conservan español como idioma inicial; las categorías, formatos de moneda/fecha, CSV y la preferencia persistente ya soportan `en-US`. La traducción gradual de los demás textos no altera el modelo financiero.
- Los respaldos actuales no están cifrados ni se sincronizan con Google Drive.
- Las proyecciones existentes son deterministas, pero aún no se exponen al agente mediante herramientas.

## Plan por fases y dependencias

1. **Fase 1 (completada):** códigos canónicos de categoría, `locale`, `timeZone`, utilidades de dinero/fecha, migración v7, selector de región y formatos/categorías traducibles sin cambiar datos existentes.
2. **Fase 2 (completada):** rutas privadas de SvelteKit, contratos/adaptadores para identidad, IA, capacidades y cuotas, con configuración server-side segura y estado deshabilitado por defecto.
3. **Fase 3:** captura por voz como lote editable, confirmación y deshacer basado en una acción local registrada.
4. **Fase 4:** orquestador de intenciones y herramientas de solo lectura, simulación, propuesta y ejecución confirmada.
5. **Fase 5:** respaldo cifrado del lado cliente en `drive.appdata`, restauración versionada, integridad y recuperación.
6. **Fase 6:** ampliar las funciones financieras deterministas y conectarlas al chatbot a través de herramientas.
7. **Fase 7:** capacidades, límites de IA, suscripción y pagos.

## Riesgos a vigilar

- La fecha de movimiento se crea hoy con la zona del dispositivo; las nuevas utilidades no cambian todavía ese comportamiento para no reinterpretar historia.
- La conversión de tasas se consulta desde el navegador y requiere una política de red/privacidad antes de incorporar proveedores autenticados.
- El PIN protege la sesión local, no cifra IndexedDB; mantenerlo separado de la autenticación remota es un requisito de producto.
