import { DetalleSolicitud } from '@/componentes/pantallas/DetalleSolicitud';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DetalleSolicitud id={decodeURIComponent(id)} />;
}
