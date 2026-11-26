import { auth, googleConfigurado } from '@/auth';
import { Bienvenida } from '@/componentes/pantallas/Bienvenida';

/** Pantalla de transición tras ingresar con Google: saluda y lleva al panel. */
export default async function Page() {
  const sesion = googleConfigurado ? await auth() : null;
  const nombre = sesion?.user?.name?.split(' ')[0] ?? null;
  return <Bienvenida nombre={nombre} gmailConectado={Boolean(sesion?.gmailConectado)} />;
}
