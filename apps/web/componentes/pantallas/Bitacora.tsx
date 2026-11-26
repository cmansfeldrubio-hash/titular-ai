'use client';

import { Button } from '@astryxdesign/core/Button';
import { HStack } from '@astryxdesign/core/HStack';
import { Selector } from '@astryxdesign/core/Selector';
import { Table } from '@astryxdesign/core/Table';
import { Text } from '@astryxdesign/core/Text';
import { TextInput } from '@astryxdesign/core/TextInput';
import { formatearFechaHora, TIPOS_EVENTO, type EventoBitacora } from '@ley/domain';
import { bitacoraCsv } from '@ley/report';
import { useMemo, useState } from 'react';
import { Encabezado, Pantalla } from '@/componentes/Encabezado';
import { useEstado } from '@/lib/estado';
import { descargar, fechaArchivo } from '@/lib/utiles';

const ACTOR = { agente: 'Agente', persona: 'Encargado', sistema: 'Sistema' } as const;

/** Bitácora de solo agregar, filtrable y exportable a CSV (RF-18, RF-19). */
export function Bitacora() {
  const { bitacora, registrar } = useEstado();
  const [actor, setActor] = useState('todos');
  const [tipo, setTipo] = useState('todos');
  const [buscar, setBuscar] = useState('');

  const filtrada = useMemo(() => {
    const q = buscar.trim().toLowerCase();
    return [...bitacora]
      .reverse()
      .filter((e) => actor === 'todos' || e.actor === actor)
      .filter((e) => tipo === 'todos' || e.tipo === tipo)
      .filter(
        (e) =>
          !q ||
          e.detalle.toLowerCase().includes(q) ||
          (e.solicitudId ?? '').toLowerCase().includes(q),
      );
  }, [bitacora, actor, tipo, buscar]);

  async function exportar() {
    descargar(
      bitacoraCsv(filtrada.slice().reverse()),
      `bitacora-${fechaArchivo()}.csv`,
      'text/csv;charset=utf-8',
    );
    await registrar({
      actor: 'persona',
      tipo: 'reporte',
      detalle: `Exportó la bitácora a CSV (${filtrada.length} eventos)`,
    });
  }

  return (
    <Pantalla>
      <Encabezado
        titulo="Bitácora"
        descripcion="Registro de solo agregar: cada recepción, búsqueda, herramienta, borrador, edición, aprobación y envío."
        acciones={<Button label="Exportar CSV" variant="primary" clickAction={exportar} />}
      />
      <HStack gap={3} wrap="wrap" align="end">
        <Selector
          label="Actor"
          value={actor}
          onChange={(v) => setActor(v ?? 'todos')}
          options={[
            { value: 'todos', label: 'Todos' },
            ...Object.entries(ACTOR).map(([value, label]) => ({ value, label })),
          ]}
          width={200}
        />
        <Selector
          label="Tipo de evento"
          value={tipo}
          onChange={(v) => setTipo(v ?? 'todos')}
          options={[
            { value: 'todos', label: 'Todos' },
            ...TIPOS_EVENTO.map((t) => ({ value: t, label: t.replace(/_/g, ' ') })),
          ]}
          width={240}
        />
        <TextInput
          label="Buscar"
          type="search"
          value={buscar}
          onChange={setBuscar}
          placeholder="Solicitud o texto"
          width={280}
        />
        <Text color="secondary">{`${filtrada.length} de ${bitacora.length} eventos`}</Text>
      </HStack>
      <Table
        data={filtrada}
        idKey="id"
        density="compact"
        verticalAlign="top"
        columns={[
          {
            key: 'fecha',
            header: 'Fecha y hora',
            width: { type: 'pixel', value: 150 },
            renderCell: (e: EventoBitacora) => formatearFechaHora(e.fecha),
          },
          {
            key: 'actor',
            header: 'Actor',
            width: { type: 'pixel', value: 110 },
            renderCell: (e: EventoBitacora) => ACTOR[e.actor],
          },
          {
            key: 'tipo',
            header: 'Tipo',
            width: { type: 'pixel', value: 150 },
            renderCell: (e: EventoBitacora) => e.tipo.replace(/_/g, ' '),
          },
          {
            key: 'solicitud',
            header: 'Solicitud',
            width: { type: 'pixel', value: 120 },
            renderCell: (e: EventoBitacora) => e.solicitudId ?? '—',
          },
          { key: 'detalle', header: 'Detalle', renderCell: (e: EventoBitacora) => e.detalle },
        ]}
      />
    </Pantalla>
  );
}
