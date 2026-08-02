# Fase 3: dictado con revisión local

El registro por voz mantiene el enfoque local-first. La página `/registro` usa
Web Speech Recognition disponible en el navegador y procesa el texto con reglas
deterministas del cliente; esta fase no llama a la API de IA ni transmite la
transcripción desde la aplicación.

## Flujo

1. La persona dicta o corrige la transcripción en el cuadro de texto.
2. `parseSpeechBatch` separa los montos detectados y propone categoría, tipo y
   fecha. Por ejemplo, “Hoy gasté 30 soles en hotel, 12 en comida y 20 en
   pasajes” produce tres borradores.
3. La persona puede editar o quitar cada importe, tipo, categoría, detalle y
   fecha, además de elegir la cuenta del lote.
4. Solo el botón **Confirmar** crea los movimientos.
5. El último lote confirmado muestra **Deshacer**, que revierte únicamente sus
   movimientos y sus efectos sobre los saldos.

El parser solo admite números con contexto monetario: ignora fechas, cantidades
como "2 pasajes" y separadores de miles. Evalúa el tipo en el segmento de cada
monto, soporta vocabulario `es-PE` y `en-US`, y usa la categoría explícita
**Por clasificar** cuando no puede inferirla. Esos borradores exigen una selección
manual de tipo o categoría antes de confirmarse.

## Garantías del lote

`FinanceStoreFacade.addTransactionBatch` valida todos los movimientos antes de
modificar el estado. Si uno no es válido, no se agrega ninguno. Un identificador
de operación en memoria evita que un segundo clic o reintento de la misma
confirmación duplique el lote durante la sesión.

Los lotes de voz no aceptan movimientos ligados a metas o deudas: esas acciones
mantienen sus flujos individuales, donde las reglas de sus entidades se pueden
validar y revertir con precisión. La idempotencia y la auditoría persistentes
para acciones de un agente quedan para la Fase 4.

## Privacidad y disponibilidad

El reconocimiento nativo depende del navegador y de su proveedor; la interfaz
lo comunica como una función de voz del navegador. Si no está disponible, el
registro manual sigue funcionando. El texto de la transcripción y los borradores
no se persisten: se descartan al cancelar y solo los movimientos explícitamente
confirmados se guardan en el snapshot local.
