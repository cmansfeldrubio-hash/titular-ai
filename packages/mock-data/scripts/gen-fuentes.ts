// Escribe en `archivos/` los XLSX y CSV de ejemplo generados con la semilla por defecto.
// Uso: pnpm gen:fuentes
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { archivosFuentes, generarEmpresa, SEMILLA_POR_DEFECTO } from '../src/index';

const destino = join(dirname(fileURLToPath(import.meta.url)), '..', 'archivos');
mkdirSync(destino, { recursive: true });
const empresa = generarEmpresa({
  semilla: SEMILLA_POR_DEFECTO,
  ahora: new Date('2026-11-25T12:00:00Z'),
});
for (const [nombre, contenido] of Object.entries(archivosFuentes(empresa))) {
  writeFileSync(join(destino, nombre), contenido);
  process.stdout.write(`escrito archivos/${nombre}\n`);
}
