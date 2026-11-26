import Anthropic from '@anthropic-ai/sdk';

/**
 * Cliente de Anthropic que corre en el navegador con la clave del propio usuario (RK-04).
 * `dangerouslyAllowBrowser` agrega el encabezado `anthropic-dangerous-direct-browser-access`.
 * La clave viaja directo a api.anthropic.com y nunca a rutas del proyecto (RK-05).
 */
export function crearCliente(apiKey: string): Anthropic {
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 3 });
}

/** Prueba la clave consultando el modelo elegido; no consume tokens. */
export async function probarClave(cliente: Anthropic, modelo: string): Promise<string> {
  const info = await cliente.models.retrieve(modelo);
  return info.display_name;
}

/** Traduce los errores del SDK a mensajes claros en español. */
export function describirError(error: unknown): string {
  if (error instanceof Anthropic.APIError) {
    // Organizaciones con Zero Data Retention no admiten llamadas desde el navegador (RK-08).
    // La API no tiene un código específico para esto, así que se reconoce por el mensaje.
    if (/CORS requests are not allowed/i.test(error.message)) {
      return 'Tu organización de Anthropic no admite llamadas desde el navegador (CORS requests are not allowed for this Organization). Ocurre en organizaciones con Zero Data Retention: usa una clave de otra organización o el modo demostración.';
    }
  }
  if (error instanceof Anthropic.AuthenticationError)
    return 'La clave de API no es válida o fue revocada.';
  if (error instanceof Anthropic.PermissionDeniedError)
    return 'La clave no tiene permiso para usar este modelo.';
  if (error instanceof Anthropic.NotFoundError)
    return 'El modelo elegido no existe o no está disponible para esta clave.';
  if (error instanceof Anthropic.RateLimitError)
    return 'Se alcanzó el límite de uso de la clave. Espera un momento o revisa el límite de gasto.';
  if (error instanceof Anthropic.BadRequestError)
    return `La API rechazó la petición: ${error.message}`;
  if (error instanceof Anthropic.InternalServerError)
    return 'La API de Anthropic tuvo un error interno. Vuelve a intentarlo.';
  if (error instanceof Anthropic.APIConnectionError) {
    return 'No se pudo conectar con la API de Anthropic. Revisa la conexión; si persiste, puede ser una organización con Zero Data Retention, que bloquea las llamadas desde el navegador.';
  }
  if (error instanceof Anthropic.APIError)
    return `Error de la API (${error.status ?? 'sin estado'}): ${error.message}`;
  if (error instanceof Error) return error.message;
  return 'Error desconocido';
}

export { Anthropic };
