'use client';

import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { Heading } from '@astryxdesign/core/Heading';
import { HStack } from '@astryxdesign/core/HStack';
import { MetadataList, MetadataListItem } from '@astryxdesign/core/MetadataList';
import { Section } from '@astryxdesign/core/Section';
import { Selector } from '@astryxdesign/core/Selector';
import { StatusDot } from '@astryxdesign/core/StatusDot';
import { Switch } from '@astryxdesign/core/Switch';
import { Table } from '@astryxdesign/core/Table';
import { Text } from '@astryxdesign/core/Text';
import { TextInput } from '@astryxdesign/core/TextInput';
import { useToast } from '@astryxdesign/core/Toast';
import { VStack } from '@astryxdesign/core/VStack';
import { crearCliente, describirError, infoModelo, MODELOS, probarClave } from '@ley/agent';
import { formatearFechaHora } from '@ley/domain';
import { useState } from 'react';
import { conectarGmail, desconectarGmail } from '@/app/acciones';
import { Encabezado, Pantalla } from '@/componentes/Encabezado';
import { useClave } from '@/lib/clave';
import { useEstado } from '@/lib/estado';

type FilaIntegracion = {
  id: string;
  nombre: string;
  sePresentaComo: string;
  tipo: 'simulado' | 'real';
  estado: 'conectado' | 'desconectado' | 'error';
  registros: string;
  ultima?: string;
};

const ESTADO = {
  conectado: { v: 'success', t: 'Conectada' },
  desconectado: { v: 'neutral', t: 'Desconectada' },
  error: { v: 'error', t: 'Con error' },
} as const;

/** Configuración: clave y modelo, Gmail, integraciones, empresa y preparación de la demo. */
export function Configuracion() {
  const { ajustes, cambiarAjustes, conectores, gmail, empresa, registrar, restaurar } = useEstado();
  const { clave, enmascarada, recordar, definir, borrar } = useClave();
  const toast = useToast();
  const [entrada, setEntrada] = useState('');
  const [recordarEntrada, setRecordarEntrada] = useState(recordar);
  const [prueba, setPrueba] = useState<{ ok: boolean; mensaje: string } | null>(null);
  const [semilla, setSemilla] = useState(String(ajustes.semilla));
  const [confirmarReinicio, setConfirmarReinicio] = useState(false);

  async function guardarYProbar() {
    const nueva = entrada.trim() || clave;
    if (!nueva) return;
    definir(nueva, recordarEntrada);
    setEntrada('');
    try {
      const nombre = await probarClave(crearCliente(nueva), ajustes.modelo);
      setPrueba({ ok: true, mensaje: `La clave funciona y tiene acceso a ${nombre}.` });
      await registrar({
        actor: 'persona',
        tipo: 'configuracion',
        detalle: `Configuró una clave de Anthropic (terminada en ${nueva.slice(-4)}) y la probó con éxito`,
      });
    } catch (e) {
      setPrueba({ ok: false, mensaje: describirError(e) });
    }
  }

  async function borrarClave() {
    borrar();
    setPrueba(null);
    await registrar({
      actor: 'persona',
      tipo: 'configuracion',
      detalle: 'Borró la clave de Anthropic: la app vuelve al modo demostración',
    });
  }

  async function alternarFuente(id: string, conectar: boolean) {
    const lista = conectar
      ? ajustes.fuentesDesconectadas.filter((f) => f !== id)
      : [...ajustes.fuentesDesconectadas, id];
    await cambiarAjustes({ fuentesDesconectadas: lista });
    await registrar({
      actor: 'persona',
      tipo: 'configuracion',
      detalle: `${conectar ? 'Conectó' : 'Desconectó'} la fuente ${id}`,
    });
  }

  async function reiniciar() {
    const n = Number.parseInt(semilla, 10);
    if (!Number.isFinite(n)) return;
    setConfirmarReinicio(false);
    await restaurar(n);
    toast({ body: `Demo restaurada con la semilla ${n}` });
  }

  const filas: FilaIntegracion[] = [
    ...conectores.map<FilaIntegracion>((c) => ({
      id: c.id,
      nombre: c.nombre,
      sePresentaComo: c.sePresentaComo,
      tipo: 'simulado',
      estado: c.estado,
      registros:
        c.id === 'planillas'
          ? `${empresa.planillas.length} filas`
          : `${(empresa[c.id as 'crm'] as unknown[]).length} registros`,
      ultima: c.ultimaSincronizacion,
    })),
    {
      id: 'gmail',
      nombre: 'Gmail',
      sePresentaComo: gmail.casilla ? `Casilla de prueba ${gmail.casilla}` : 'Casilla de prueba',
      tipo: 'real',
      estado: gmail.conectado ? 'conectado' : 'desconectado',
      registros: '—',
    },
  ];

  return (
    <Pantalla>
      <Encabezado
        titulo="Configuración"
        descripcion="Clave del modelo, Gmail, integraciones y preparación de la demo."
      />

      <Section>
        <VStack gap={3}>
          <Heading level={2}>Clave de API de Anthropic</Heading>
          <Text color="secondary">
            La clave va directo de tu navegador a api.anthropic.com: nunca pasa por el servidor del
            proyecto ni se guarda en él. Por defecto vive solo en memoria y se pierde al recargar la
            pestaña.
          </Text>
          <Banner
            status="info"
            title="Usa una clave exclusiva para la demo"
            description="Créala en la consola de Anthropic con un límite de gasto y una fecha de expiración, y bórrala al terminar."
          />
          <HStack gap={3} align="end" wrap="wrap">
            <TextInput
              label="Clave de API"
              type="password"
              value={entrada}
              onChange={setEntrada}
              placeholder={enmascarada ?? 'sk-ant-…'}
              autoComplete="off"
              width={360}
              description={
                enmascarada
                  ? `Configurada: ${enmascarada}`
                  : 'Sin clave: la app funciona en modo demostración.'
              }
            />
            <Button
              label={entrada ? 'Guardar y probar' : 'Probar clave'}
              variant="primary"
              clickAction={guardarYProbar}
              isDisabled={!entrada && !clave}
            />
            <Button
              label="Borrar clave"
              variant="destructive"
              clickAction={borrarClave}
              isDisabled={!clave}
            />
          </HStack>
          <Switch
            label="Recordar en esta pestaña"
            description="Guarda la clave en sessionStorage hasta cerrar la pestaña. Nunca en localStorage, cookies ni IndexedDB."
            value={recordarEntrada}
            onChange={(v) => {
              setRecordarEntrada(v);
              if (clave) definir(clave, v);
            }}
          />
          {prueba ? (
            <Banner
              status={prueba.ok ? 'success' : 'error'}
              title={prueba.ok ? 'Clave válida' : 'La clave no funcionó'}
              description={prueba.mensaje}
            />
          ) : null}
          <Selector
            label="Modelo"
            description={infoModelo(ajustes.modelo).descripcion}
            value={ajustes.modelo}
            onChange={(v) => v && void cambiarAjustes({ modelo: v })}
            options={MODELOS.map((m) => ({
              value: m.id,
              label: m.etiqueta,
              description: `US$ ${m.precio.entrada} / ${m.precio.salida} por millón de tokens (entrada / salida)`,
            }))}
            width={420}
          />
        </VStack>
      </Section>

      <Section>
        <VStack gap={3}>
          <Heading level={2}>Gmail</Heading>
          {!gmail.configurado ? (
            <Banner
              status="info"
              title="Gmail no está configurado en este despliegue"
              description="Faltan las variables de entorno de Google (ver .env.example). La bandeja muestra las solicitudes del formulario web y los envíos quedan como «no enviado»."
            />
          ) : (
            <HStack gap={3} align="center" wrap="wrap">
              <StatusDot
                variant={gmail.conectado ? 'success' : 'neutral'}
                label={gmail.conectado ? 'Conectado' : 'No conectado'}
              />
              <Text>
                {gmail.conectado
                  ? `Conectado como ${gmail.cuenta ?? ''} · casilla ${gmail.casilla ?? 'sin definir'}`
                  : 'No conectado'}
              </Text>
              <form action={gmail.conectado ? desconectarGmail : conectarGmail}>
                <Button
                  type="submit"
                  label={gmail.conectado ? 'Desconectar Gmail' : 'Conectar Gmail'}
                  variant={gmail.conectado ? 'secondary' : 'primary'}
                />
              </form>
            </HStack>
          )}
          <Text type="supporting" color="secondary">
            En modo de prueba de Google, la conexión caduca a los siete días: reconecta antes de
            cada presentación. Solo se envían correos a las cuentas autorizadas y a la casilla de
            prueba.
          </Text>
        </VStack>
      </Section>

      <Section>
        <VStack gap={3}>
          <Heading level={2}>Integraciones</Heading>
          <Table
            data={filas}
            idKey="id"
            columns={[
              {
                key: 'nombre',
                header: 'Fuente',
                renderCell: (f: FilaIntegracion) => f.nombre,
              },
              {
                key: 'como',
                header: 'Se presenta como',
                renderCell: (f: FilaIntegracion) => f.sePresentaComo,
              },
              {
                key: 'estado',
                header: 'Estado',
                renderCell: (f: FilaIntegracion) => (
                  <HStack gap={1} align="center">
                    <StatusDot variant={ESTADO[f.estado].v} label={ESTADO[f.estado].t} />
                    <Text>{ESTADO[f.estado].t}</Text>
                  </HStack>
                ),
              },
              {
                key: 'registros',
                header: 'Datos',
                renderCell: (f: FilaIntegracion) => f.registros,
              },
              {
                key: 'ultima',
                header: 'Última sincronización',
                renderCell: (f: FilaIntegracion) =>
                  f.ultima ? formatearFechaHora(f.ultima) : 'Aún no',
              },
              {
                key: 'accion',
                header: 'Conexión',
                renderCell: (f: FilaIntegracion) =>
                  f.tipo === 'simulado' ? (
                    <Switch
                      label={`Conectar ${f.nombre}`}
                      isLabelHidden
                      value={f.estado === 'conectado'}
                      onChange={(v) => void alternarFuente(f.id, v)}
                    />
                  ) : (
                    '—'
                  ),
              },
            ]}
          />
        </VStack>
      </Section>

      <Section>
        <VStack gap={3}>
          <Heading level={2}>Empresa</Heading>
          <MetadataList>
            <MetadataListItem label="Nombre">{empresa.empresa.nombre}</MetadataListItem>
            <MetadataListItem label="RUT">{empresa.empresa.rut}</MetadataListItem>
            <MetadataListItem label="Rubro">{empresa.empresa.rubro}</MetadataListItem>
            <MetadataListItem label="Encargado de cumplimiento">
              {empresa.empresa.encargado.nombre}
            </MetadataListItem>
            <MetadataListItem label="Titulares">{`${empresa.personas.length} (semilla ${ajustes.semilla})`}</MetadataListItem>
          </MetadataList>
        </VStack>
      </Section>

      <Section>
        <VStack gap={3}>
          <Heading level={2}>Preparar la demo</Heading>
          <Text color="secondary">
            La misma semilla genera siempre la misma empresa. Restaurar borra las solicitudes, el
            inventario y la bitácora de este navegador y vuelve a cargar las diez solicitudes de
            ejemplo.
          </Text>
          <HStack gap={3} align="end">
            <TextInput
              label="Semilla"
              value={semilla}
              onChange={setSemilla}
              inputMode="numeric"
              width={160}
            />
            <Button
              label="Regenerar y restaurar"
              variant="destructive"
              onClick={() => setConfirmarReinicio(true)}
            />
          </HStack>
        </VStack>
      </Section>

      <Dialog
        isOpen={confirmarReinicio}
        onOpenChange={setConfirmarReinicio}
        purpose="required"
        width={460}
      >
        <VStack gap={3}>
          <DialogHeader title="¿Restaurar el estado inicial?" />
          <Text>{`Se borrarán las solicitudes, el inventario y la bitácora de este navegador, y se generará la empresa con la semilla ${semilla}.`}</Text>
          <HStack gap={2} justify="end">
            <Button label="Cancelar" variant="ghost" onClick={() => setConfirmarReinicio(false)} />
            <Button label="Restaurar" variant="destructive" clickAction={reiniciar} />
          </HStack>
        </VStack>
      </Dialog>
    </Pantalla>
  );
}
