'use client';

import { Avatar } from '@astryxdesign/core/Avatar';
import { Button } from '@astryxdesign/core/Button';
import { DropdownMenu } from '@astryxdesign/core/DropdownMenu';
import { desconectarGmail } from '@/app/acciones';
import type { EstadoGmail } from '@/lib/estado';

/** Usuario conectado con Google, con su foto; al hacer clic ofrece cerrar sesión. */
export function UsuarioMenu({ gmail, compacto }: { gmail: EstadoGmail; compacto: boolean }) {
  if (!gmail.configurado || !gmail.cuenta) return null;
  const nombre = gmail.nombre ?? gmail.cuenta;
  const avatar = <Avatar src={gmail.imagen ?? undefined} name={nombre} size="sm" tooltip={false} />;
  return (
    <DropdownMenu
      placement="above"
      hasChevron={false}
      menuWidth={260}
      renderTrigger={(props) => (
        <Button
          {...props}
          variant="ghost"
          label={nombre}
          icon={avatar}
          isIconOnly={compacto}
          tooltip={compacto ? nombre : undefined}
          width={compacto ? undefined : '100%'}
        />
      )}
      items={[
        {
          type: 'section',
          title: gmail.cuenta,
          items: [
            {
              label: 'Cerrar sesión',
              variant: 'destructive',
              onClick: () => void desconectarGmail(),
            },
          ],
        },
      ]}
    />
  );
}
