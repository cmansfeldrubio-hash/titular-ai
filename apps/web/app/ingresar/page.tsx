import { redirect } from 'next/navigation';
import { auth, googleConfigurado } from '@/auth';
import { Ingresar } from '@/componentes/pantallas/Ingresar';

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (!googleConfigurado) redirect('/');
  if (await auth()) redirect('/');
  const { error } = await searchParams;
  return <Ingresar error={error} />;
}
