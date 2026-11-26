'use client';

import { Badge } from '@astryxdesign/core/Badge';
import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { HStack } from '@astryxdesign/core/HStack';
import { Switch } from '@astryxdesign/core/Switch';
import { Table } from '@astryxdesign/core/Table';
import { Text } from '@astryxdesign/core/Text';
import { TextArea } from '@astryxdesign/core/TextArea';
import { TextInput } from '@astryxdesign/core/TextInput';
import { useToast } from '@astryxdesign/core/Toast';
import { VStack } from '@astryxdesign/core/VStack';
import {
  crearCliente,
  describirError,
  infoModelo,
  leerFuentes,
  proponerActividadesConModelo,
  proponerActividadesPorReglas,
} from '@ley/agent';
import type { ActividadTratamiento } from '@ley/domain';
import { exportarRegistroXlsx } from '@ley/report';
import { useState } from 'react';
import { Encabezado, Pantalla } from '@/componentes/Encabezado';
import { useClave } from '@/lib/clave';
import { useEstado } from '@/lib/estado';
import { descargar, fechaArchivo, NOMBRE_FUENTE, usd, XLSX_MIME } from '@/lib/utiles';

/** Inventario de datos personales y registro de actividades de tratamiento (RF-04 a RF-06). */
export function Inventario() {
  const { conectores, actividades, guardarActividades, registrar, ajustes, solicitudes } =
    useEstado();
  const { clave } = useClave();
  const toast = useToast();
  const [progreso, setProgreso] = useState<string[]>([]);
  const [escaneando, setEscaneando] = useState(false);
  const [editando, setEditando] = useState<ActividadTratamiento | null>(null);

  async function escanear() {
    setEscaneando(true);
    setProgreso([]);
    try {
      const fuentes = await leerFuentes(conectores, (t) => setProgreso((p) => [...p, t]));
      let nuevas: ActividadTratamiento[];
      let detalle: string;
      if (clave) {
        setProgreso((p) => [
          ...p,
          `El agente (${infoModelo(ajustes.modelo).etiqueta}) analiza esquemas y muestras…`,
        ]);
        const r = await proponerActividadesConModelo(crearCliente(clave), ajustes.modelo, fuentes);
        nuevas = r.actividades;
        detalle = `El agente propuso ${nuevas.length} actividades a partir de ${fuentes.length} fuentes (costo estimado ${usd(r.uso.costoUsd)})`;
      } else {
        nuevas = proponerActividadesPorReglas(fuentes);
        detalle = `Modo demostración: se propusieron ${nuevas.length} actividades a partir de ${fuentes.length} fuentes`;
      }
      // Lo que el encargado ya confirmó se conserva.
      const confirmadas = actividades.filter((a) => a.estado === 'confirmado');
      const final = [
        ...confirmadas,
        ...nuevas.filter((n) => !confirmadas.some((c) => c.fuenteId === n.fuenteId)),
      ];
      await guardarActividades(final);
      await registrar({ actor: clave ? 'agente' : 'sistema', tipo: 'inventario', detalle });
      setProgreso((p) => [...p, 'Listo.']);
    } catch (e) {
      toast({ body: `No se pudo escanear: ${describirError(e)}`, type: 'error' });
    } finally {
      setEscaneando(false);
    }
  }

  async function confirmar(a: ActividadTratamiento) {
    await guardarActividades(
      actividades.map((x) => (x.id === a.id ? { ...a, estado: 'confirmado' } : x)),
    );
    await registrar({
      actor: 'persona',
      tipo: 'inventario',
      detalle: `Confirmó la actividad «${a.nombre}»`,
    });
  }

  async function guardarEdicion() {
    if (!editando) return;
    await guardarActividades(actividades.map((x) => (x.id === editando.id ? editando : x)));
    await registrar({
      actor: 'persona',
      tipo: 'inventario',
      detalle: `Editó la actividad «${editando.nombre}» (${editando.estado === 'confirmado' ? 'confirmada' : 'sugerida'})`,
    });
    setEditando(null);
  }

  return (
    <Pantalla>
      <Encabezado
        titulo="Inventario de datos"
        descripcion="El agente recorre los esquemas y muestras de cada fuente y propone el registro de actividades de tratamiento."
        acciones={
          <>
            <Button
              label="Exportar XLSX"
              isDisabled={actividades.length === 0}
              onClick={() =>
                descargar(
                  exportarRegistroXlsx(actividades, solicitudes, NOMBRE_FUENTE),
                  `registro-actividades-${fechaArchivo()}.xlsx`,
                  XLSX_MIME,
                )
              }
            />
            <Button
              label="Escanear fuentes"
              variant="primary"
              clickAction={escanear}
              isLoading={escaneando}
            />
          </>
        }
      />
      {progreso.length > 0 ? (
        <VStack gap={0.5}>
          {progreso.map((p, i) => (
            <Text key={i} type="supporting" color="secondary">
              {p}
            </Text>
          ))}
        </VStack>
      ) : null}
      {actividades.length === 0 ? (
        <EmptyState
          title="Aún no hay registro de actividades"
          description="Escanea las fuentes para que el agente proponga una actividad de tratamiento por cada una."
          actions={
            <Button
              label="Escanear fuentes"
              variant="primary"
              clickAction={escanear}
              isLoading={escaneando}
            />
          }
        />
      ) : (
        <>
          {actividades.some((a) => a.estado === 'sugerido') ? (
            <Banner
              status="info"
              title="Hay filas sugeridas por el agente"
              description="Revisa, edita y confirma cada fila. Lo no confirmado queda marcado como sugerido."
            />
          ) : null}
          <Table
            data={actividades}
            idKey="id"
            verticalAlign="top"
            columns={[
              {
                key: 'fuente',
                header: 'Fuente',
                renderCell: (a: ActividadTratamiento) => NOMBRE_FUENTE[a.fuenteId] ?? a.fuenteId,
              },
              {
                key: 'categorias',
                header: 'Categorías de datos',
                renderCell: (a: ActividadTratamiento) => a.categorias.join(', '),
              },
              {
                key: 'sensibles',
                header: 'Sensibles',
                renderCell: (a: ActividadTratamiento) =>
                  a.datosSensibles ? <Badge variant="warning" label="Sí: salud" /> : 'No',
              },
              {
                key: 'finalidad',
                header: 'Finalidad probable',
                renderCell: (a: ActividadTratamiento) => a.finalidad,
              },
              {
                key: 'accesos',
                header: 'Quién accede',
                renderCell: (a: ActividadTratamiento) => a.accesos,
              },
              {
                key: 'conservacion',
                header: 'Conservación sugerida',
                renderCell: (a: ActividadTratamiento) => a.conservacion,
              },
              {
                key: 'estado',
                header: 'Estado',
                renderCell: (a: ActividadTratamiento) => (
                  <VStack gap={1}>
                    {a.estado === 'confirmado' ? (
                      <Badge variant="success" label="Confirmado" />
                    ) : (
                      <Badge variant="info" label="Sugerido por el agente" />
                    )}
                    <HStack gap={1}>
                      <Button
                        size="sm"
                        variant="ghost"
                        label="Editar"
                        onClick={() => setEditando(a)}
                      />
                      {a.estado === 'sugerido' ? (
                        <Button size="sm" label="Confirmar" clickAction={() => confirmar(a)} />
                      ) : null}
                    </HStack>
                  </VStack>
                ),
              },
            ]}
          />
        </>
      )}

      <Dialog
        isOpen={editando !== null}
        onOpenChange={(o) => !o && setEditando(null)}
        purpose="form"
        width={560}
      >
        {editando ? (
          <VStack gap={3}>
            <DialogHeader
              title={`Editar: ${NOMBRE_FUENTE[editando.fuenteId] ?? editando.fuenteId}`}
              onOpenChange={(o) => !o && setEditando(null)}
            />
            <TextInput
              label="Nombre de la actividad"
              value={editando.nombre}
              onChange={(v) => setEditando({ ...editando, nombre: v })}
            />
            <TextInput
              label="Categorías de datos (separadas por coma)"
              value={editando.categorias.join(', ')}
              onChange={(v) =>
                setEditando({
                  ...editando,
                  categorias: v
                    .split(',')
                    .map((x) => x.trim())
                    .filter(Boolean),
                })
              }
            />
            <Switch
              label="Contiene datos sensibles"
              value={editando.datosSensibles}
              onChange={(v) => setEditando({ ...editando, datosSensibles: v })}
            />
            <TextArea
              label="Finalidad"
              value={editando.finalidad}
              onChange={(v) => setEditando({ ...editando, finalidad: v })}
              rows={2}
            />
            <TextInput
              label="Quién accede"
              value={editando.accesos}
              onChange={(v) => setEditando({ ...editando, accesos: v })}
            />
            <TextInput
              label="Plazo de conservación"
              value={editando.conservacion}
              onChange={(v) => setEditando({ ...editando, conservacion: v })}
            />
            <Switch
              label="Confirmada por el encargado"
              value={editando.estado === 'confirmado'}
              onChange={(v) => setEditando({ ...editando, estado: v ? 'confirmado' : 'sugerido' })}
            />
            <HStack gap={2} justify="end">
              <Button label="Cancelar" variant="ghost" onClick={() => setEditando(null)} />
              <Button label="Guardar" variant="primary" clickAction={guardarEdicion} />
            </HStack>
          </VStack>
        ) : null}
      </Dialog>
    </Pantalla>
  );
}
