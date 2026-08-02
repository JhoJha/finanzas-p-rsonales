# Fase 2: API privada y adaptadores

La aplicación sigue siendo local-first. Esta fase crea la frontera server-side sin
enviar automáticamente datos financieros a ningún proveedor.

## Rutas

- `GET /api/v1/capabilities`: exige un bearer token validado por el adaptador de
  identidad y devuelve las capacidades de la cuenta.
- `POST /api/v1/ai/proposals`: exige identidad y la capacidad `voice_ai` o
  `chatbot`. Acepta solo texto, idioma, zona horaria, moneda y origen. Devuelve
  una propuesta validada; nunca escribe IndexedDB ni ejecuta una operación.

Todas las respuestas privadas usan `Cache-Control: no-store`. Los errores son
códigos genéricos y no incluyen transcripciones, tokens, cuerpos de proveedor ni
variables de entorno.

## Estado seguro por defecto

Sin `SUPABASE_URL` y `SUPABASE_PUBLISHABLE_KEY`, no hay identidad y las rutas
responden `UNAUTHENTICATED`. Incluso con identidad, el adaptador de capacidades
inicial las mantiene desactivadas hasta que exista almacenamiento persistente de
plan y consumo. Por ello `DEEPSEEK_API_KEY` no habilita por sí sola la IA.

Cuando se configure un proveedor de cuotas en una fase posterior, se deberá:

1. consultar capacidades y cuota en una tabla protegida por RLS;
2. reservar una **solicitud** de forma atómica antes de llamar al proveedor y liberarla si este falla;
3. conservar solo consumo y metadatos mínimos en Supabase, nunca movimientos;
4. conservar los tokens del proveedor solo como telemetría, separados de la cuota por solicitudes;
5. mantener el PIN local independiente de la sesión remota.

## Adaptadores

- `SupabaseAuthAdapter` valida el bearer token contra `/auth/v1/user`; no acepta
  claims del cliente como autorización.
- `DeepSeekAiAdapter` vive únicamente en `src/lib/server/`, pide JSON y valida
  su respuesta con Zod. Fuerza `operation: propose` y no acepta una ejecución
  originada por el modelo.
- Los adaptadores deshabilitados son el valor predeterminado, para que el backend
  pueda moverse a una VPS sin que la UI dependa de Supabase o DeepSeek.

## Variables

Consulta [`.env.example`](../.env.example). Ningún secreto utiliza el prefijo
`VITE_`; la clave de DeepSeek solo se lee desde `$env/dynamic/private`.

## Referencias de implementación

- [Supabase: elegir paquete de servidor](https://supabase.com/docs/guides/auth/choosing-a-server-package)
- [Supabase: `getUser` valida contra Auth](https://supabase.com/docs/reference/javascript/auth-getuser)
- [DeepSeek: JSON Output](https://api-docs.deepseek.com/guides/json_mode)
- [DeepSeek: Create Chat Completion](https://api-docs.deepseek.com/api/create-chat-completion)

## Verificación local en Windows

Las rutas compilan correctamente con `svelte-check` y Vite. El adaptador de Vercel
crea enlaces simbólicos para las funciones server-side; en equipos Windows sin
Developer Mode o permiso para symlinks, `npm run build` puede finalizar con
`EPERM` al adaptar esas funciones. Es una restricción del entorno de empaquetado,
no una vía para omitir las rutas ni una razón para mover secretos al cliente.
