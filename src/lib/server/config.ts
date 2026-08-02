import { env } from '$env/dynamic/private';
import { parseServerConfig, type ServerConfig } from '$lib/server/config.schema';

/** Se evalúa en el servidor; no se importa desde rutas o componentes del cliente. */
export function loadServerConfig(): ServerConfig {
	return parseServerConfig(env);
}
