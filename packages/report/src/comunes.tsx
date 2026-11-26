import { Text, View } from '@react-pdf/renderer';
import type { ReactNode } from 'react';
import { estilos, MARCA } from './estilos';

/** Marca visible en cada página (RF-24). */
export function MarcaYPie({ izquierda }: { izquierda: string }) {
  return (
    <>
      <Text style={estilos.marcaAgua} fixed>
        {MARCA}
      </Text>
      <View style={estilos.pie} fixed>
        <Text>{`${izquierda} · ${MARCA} · No es asesoría legal`}</Text>
        <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
      </View>
    </>
  );
}

export function Tabla({
  columnas,
  filas,
  anchos,
}: {
  columnas: string[];
  filas: ReactNode[][];
  anchos?: number[];
}) {
  const flex = (i: number) => ({ flex: anchos?.[i] ?? 1 });
  return (
    <View style={estilos.tabla}>
      <View style={estilos.filaCabecera} fixed>
        {columnas.map((c, i) => (
          <Text key={c} style={[estilos.celda, flex(i)]}>
            {c}
          </Text>
        ))}
      </View>
      {filas.map((f, n) => (
        <View key={n} style={estilos.fila} wrap={false}>
          {f.map((celda, i) => (
            <Text key={i} style={[estilos.celda, flex(i)]}>
              {celda}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}
