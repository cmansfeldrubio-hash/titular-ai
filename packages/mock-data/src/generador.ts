import {
  calcularDv,
  formatearRut,
  normalizarTexto,
  type Derecho,
  type Empresa,
  type Solicitud,
} from '@ley/domain';
import {
  AFP,
  APELLIDOS,
  CALLES,
  CARGOS,
  COMUNAS,
  DIAGNOSTICOS,
  ISAPRE,
  NOMBRES,
  PRODUCTOS,
  VENDEDORES,
} from './catalogos';
import { crearRng, type Rng } from './rng';
import type {
  EmpresaFicticia,
  FilaMarketing,
  FilaPlanilla,
  FilaRrhh,
  PersonaBase,
  RegistroCrm,
  RegistroErp,
  RegistroTienda,
} from './tipos';

export const SEMILLA_POR_DEFECTO = 21719;
export const TOTAL_PERSONAS = 60;

export const EMPRESA_FICTICIA: Empresa = {
  nombre: 'Comercial Los Aromos SpA',
  rut: formatearRut(`76543210${calcularDv('76543210')}`),
  rubro: 'Distribución de artículos de ferretería (tienda online y ventas a empresas)',
  direccion: 'Avenida Ficticia 1234, Santiago (dirección inventada)',
  encargado: {
    nombre: 'Encargada/o de cumplimiento (rol de demostración)',
    email: 'cumplimiento@aromos.example',
    cargo: 'Encargado de cumplimiento de protección de datos',
  },
};

type Fuente = 'crm' | 'erp' | 'tienda' | 'planillas' | 'marketing';
const FUENTES_CLIENTE: Fuente[] = ['crm', 'erp', 'tienda', 'planillas', 'marketing'];

const pad = (n: number, largo = 3) => String(n).padStart(largo, '0');
const slug = (s: string) => normalizarTexto(s).replace(/[^a-z]/g, '');

/** Fecha ISO determinista: `dias` antes de la fecha de referencia fija del generador. */
const REFERENCIA = Date.UTC(2026, 10, 1, 15, 0, 0);
const fechaAtras = (dias: number) =>
  new Date(REFERENCIA - dias * 86_400_000).toISOString().slice(0, 10);

function crearPersona(i: number, rng: Rng, usados: Set<string>): PersonaBase {
  let nombres = '';
  let paterno = '';
  let materno = '';
  do {
    nombres = rng.chance(0.3) ? `${rng.pick(NOMBRES)} ${rng.pick(NOMBRES)}` : rng.pick(NOMBRES);
    paterno = rng.pick(APELLIDOS);
    materno = rng.pick(APELLIDOS);
  } while (usados.has(`${nombres} ${paterno} ${materno}`) || paterno === materno);
  usados.add(`${nombres} ${paterno} ${materno}`);
  const cuerpo = rng.int(8_000_000, 24_999_999);
  const primerNombre = nombres.split(' ')[0] ?? nombres;
  return {
    id: `P${pad(i)}`,
    nombres,
    apellidoPaterno: paterno,
    apellidoMaterno: materno,
    rut: formatearRut(`${cuerpo}${calcularDv(cuerpo)}`),
    email: `${slug(primerNombre)}.${slug(paterno)}${rng.int(1, 99)}@example.com`,
    emailAlternativo: `${slug(primerNombre).slice(0, 1)}${slug(paterno)}${slug(materno).slice(0, 1)}@correo.example`,
    telefono: `+56 9 5555 ${pad(rng.int(0, 9999), 4)}`,
    direccion: `${rng.pick(CALLES)} ${rng.int(10, 2999)}, ${rng.pick(COMUNAS)}`,
    esTrabajador: i <= 4 || (i >= 20 && i <= 29),
    tieneLicenciaMedica: i <= 4 || i === 22,
  };
}

const nombreCompleto = (p: PersonaBase) => `${p.nombres} ${p.apellidoPaterno} ${p.apellidoMaterno}`;

/** Variaciones de escritura entre fuentes (RD-04): tildes, mayúsculas, orden y apellido materno. */
function variarNombre(p: PersonaBase, rng: Rng): string {
  const completo = nombreCompleto(p);
  switch (rng.int(0, 4)) {
    case 1:
      return completo.normalize('NFD').replace(/[̀-ͯ]/g, '');
    case 2:
      return completo.toUpperCase();
    case 3:
      return `${p.apellidoPaterno} ${p.apellidoMaterno}, ${p.nombres}`;
    case 4:
      return `${p.nombres} ${p.apellidoPaterno}`;
    default:
      return completo;
  }
}

function variarRut(rut: string, rng: Rng): string {
  switch (rng.int(0, 2)) {
    case 1:
      return rut.replace(/\./g, '');
    case 2:
      return rut.replace(/[.-]/g, '');
    default:
      return rut;
  }
}

const variarEmail = (p: PersonaBase, rng: Rng) => (rng.chance(0.35) ? p.emailAlternativo : p.email);

function asignarFuentes(i: number, p: PersonaBase, rng: Rng): Set<Fuente> {
  if (i < 18) return new Set(rng.shuffle(FUENTES_CLIENTE).slice(0, rng.int(3, 4)));
  if (p.esTrabajador) return new Set(rng.chance(0.4) ? [rng.pick(FUENTES_CLIENTE)] : []);
  return new Set(rng.shuffle(FUENTES_CLIENTE).slice(0, rng.int(1, 2)));
}

export interface OpcionesGenerador {
  semilla?: number;
  /** Fecha de referencia para las solicitudes de ejemplo (por defecto, ahora). */
  ahora?: Date;
}

/** Genera la empresa ficticia completa de forma determinista a partir de la semilla. */
export function generarEmpresa(opciones: OpcionesGenerador = {}): EmpresaFicticia {
  const semilla = opciones.semilla ?? SEMILLA_POR_DEFECTO;
  const ahora = opciones.ahora ?? new Date();
  const rng = crearRng(semilla);
  const usados = new Set<string>();
  const personas = Array.from({ length: TOTAL_PERSONAS }, (_, i) => crearPersona(i, rng, usados));

  // Homónimos: mismo nombre que otra persona, RUT y correo distintos (RF-13).
  for (const [n, original] of [3, 7].entries()) {
    const base = personas[original]!;
    const otra = crearPersona(TOTAL_PERSONAS + n, rng, new Set());
    personas.push({
      ...otra,
      nombres: base.nombres,
      apellidoPaterno: base.apellidoPaterno,
      apellidoMaterno: base.apellidoMaterno,
      esTrabajador: false,
      tieneLicenciaMedica: false,
      homonimoDe: base.id,
    });
  }

  const crm: RegistroCrm[] = [];
  const erp: RegistroErp[] = [];
  const tienda: RegistroTienda[] = [];
  const planillas: FilaPlanilla[] = [];
  const rrhh: FilaRrhh[] = [];
  const marketing: FilaMarketing[] = [];

  personas.forEach((p, i) => {
    const fuentes: Set<Fuente> = p.homonimoDe
      ? new Set<Fuente>(['crm', 'tienda'])
      : asignarFuentes(i, p, rng);
    if (fuentes.has('crm')) {
      crm.push({
        id: `crm-${pad(crm.length + 1, 4)}`,
        nombre_completo: variarNombre(p, rng),
        email: variarEmail(p, rng),
        telefono: p.telefono,
        etapa: rng.chance(0.7) ? 'cliente' : 'prospecto',
        propietario: rng.pick(VENDEDORES),
        creado: fechaAtras(rng.int(30, 900)),
        historial: Array.from({ length: rng.int(1, 3) }, () => ({
          fecha: fechaAtras(rng.int(1, 400)),
          tipo: rng.pick(['llamada', 'correo', 'reunión', 'cotización']),
          nota: rng.pick([
            'Consulta por precios mayoristas',
            'Solicita cotización de herramientas',
            'Seguimiento de despacho',
            'Interesado en convenio empresa',
          ]),
        })),
      });
    }
    if (fuentes.has('erp')) {
      erp.push({
        id: `erp-${pad(erp.length + 1, 4)}`,
        rut: variarRut(p.rut, rng),
        razon_social: variarNombre(p, rng),
        direccion_facturacion: p.direccion,
        giro: rng.chance(0.3) ? 'Construcción (persona natural con giro)' : 'Persona natural',
        documentos: Array.from({ length: rng.int(1, 4) }, () => ({
          tipo: rng.chance(0.7) ? ('boleta' as const) : ('factura' as const),
          folio: rng.int(10_000, 99_999),
          fecha: fechaAtras(rng.int(1, 700)),
          monto: rng.int(5, 400) * 990,
        })),
      });
    }
    if (fuentes.has('tienda')) {
      tienda.push({
        id: `shop-${pad(tienda.length + 1, 4)}`,
        cliente: { nombre: variarNombre(p, rng), email: variarEmail(p, rng), telefono: p.telefono },
        pedidos: Array.from({ length: rng.int(1, 3) }, () => ({
          numero: `#A${rng.int(100_000, 999_999)}`,
          fecha: fechaAtras(rng.int(1, 500)),
          direccion_despacho: rng.chance(0.8)
            ? p.direccion
            : `${rng.pick(CALLES)} ${rng.int(10, 999)}, ${rng.pick(COMUNAS)}`,
          total: rng.int(3, 250) * 990,
          tarjeta_ultimos4: pad(rng.int(0, 9999), 4),
          productos: rng.shuffle(PRODUCTOS).slice(0, rng.int(1, 3)),
        })),
      });
    }
    if (fuentes.has('planillas')) {
      for (let k = 0; k < rng.int(1, 2); k++) {
        planillas.push({
          Vendedor: rng.pick(VENDEDORES),
          Cliente: variarNombre(p, rng),
          RUT: variarRut(p.rut, rng),
          Correo: variarEmail(p, rng),
          Teléfono: p.telefono,
          Monto: rng.int(10, 900) * 1000,
          Fecha: fechaAtras(rng.int(1, 365)),
        });
      }
    }
    if (fuentes.has('marketing')) {
      marketing.push({
        email: variarEmail(p, rng),
        nombre: rng.chance(0.5) ? (p.nombres.split(' ')[0] ?? p.nombres) : variarNombre(p, rng),
        consentimiento: rng.chance(0.85) ? 'si' : 'no',
        fecha_suscripcion: fechaAtras(rng.int(10, 800)),
        origen: rng.pick(['checkout tienda', 'formulario web', 'feria comercial']),
      });
    }
    if (p.esTrabajador) {
      const nLicencias = p.tieneLicenciaMedica ? rng.int(1, 3) : 0;
      rrhh.push({
        id: `rh-${pad(rrhh.length + 1, 3)}`,
        nombre: variarNombre(p, rng),
        rut: variarRut(p.rut, rng),
        cargo: rng.pick(CARGOS),
        fecha_ingreso: fechaAtras(rng.int(100, 3000)),
        afp: rng.pick(AFP),
        isapre: rng.pick(ISAPRE),
        licencias_medicas: String(nLicencias),
        detalle_licencias: p.tieneLicenciaMedica
          ? rng.shuffle(DIAGNOSTICOS).slice(0, nLicencias).join('; ')
          : '',
        sueldo_base: String(rng.int(55, 180) * 10_000),
      });
    }
  });

  return {
    semilla,
    empresa: EMPRESA_FICTICIA,
    personas,
    crm,
    erp,
    tienda,
    planillas,
    rrhh,
    marketing,
    solicitudes: generarSolicitudes(personas, ahora),
  };
}

const TEXTO_DERECHO: Record<Derecho, string> = {
  acceso:
    'Solicito acceder a todos los datos personales que Comercial Los Aromos tiene sobre mí, indicando su origen, finalidad y con quién se han compartido.',
  rectificacion:
    'Mi dirección y mi teléfono cambiaron. Solicito rectificar mis datos: nueva dirección Calle Nueva 456, Ñuñoa; nuevo teléfono +56 9 5555 0000.',
  supresion:
    'Solicito la supresión de todos mis datos personales, ya que no mantengo relación comercial con ustedes.',
  oposicion:
    'Me opongo al tratamiento de mis datos personales para fines de marketing y envío de publicidad.',
  portabilidad:
    'Solicito una copia de mis datos personales en un formato estructurado y de uso común, para entregarla a otro proveedor.',
  bloqueo:
    'Solicito el bloqueo temporal de mis datos mientras se resuelve un reclamo que presenté por un cobro indebido.',
};

/** Diez solicitudes de ejemplo con los seis derechos y fechas cercanas al vencimiento (RD-07). */
function generarSolicitudes(personas: PersonaBase[], ahora: Date): Solicitud[] {
  const plan: { persona: number; derecho: Derecho; diasAtras: number }[] = [
    { persona: 0, derecho: 'acceso', diasAtras: 2 },
    { persona: 3, derecho: 'acceso', diasAtras: 27 },
    { persona: 5, derecho: 'supresion', diasAtras: 21 },
    { persona: 1, derecho: 'rectificacion', diasAtras: 12 },
    { persona: 7, derecho: 'oposicion', diasAtras: 29 },
    { persona: 9, derecho: 'portabilidad', diasAtras: 8 },
    { persona: 2, derecho: 'bloqueo', diasAtras: 24 },
    { persona: 11, derecho: 'acceso', diasAtras: 5 },
    { persona: 13, derecho: 'supresion', diasAtras: 15 },
    { persona: 15, derecho: 'oposicion', diasAtras: 1 },
  ];
  return plan.map(({ persona, derecho, diasAtras }, n) => {
    const p = personas[persona]!;
    const rutMostrado = n % 2 === 0 ? p.rut : p.rut.replace(/\./g, '');
    const recibida = new Date(ahora.getTime() - diasAtras * 86_400_000 - (n + 1) * 3_600_000);
    const correo = correoDeTitular(p, derecho, rutMostrado);
    return {
      id: `SOL-${pad(n + 1)}`,
      titular: { nombre: nombreCompleto(p), rut: rutMostrado, email: p.email },
      derecho,
      recibidaEn: recibida.toISOString(),
      canal: 'simulada' as const,
      asunto: correo.asunto,
      mensaje: correo.mensaje,
      estado: 'nueva' as const,
      clasificadaPor: 'semilla' as const,
      revisiones: {},
      versionBorrador: 0,
    };
  });
}

const DERECHO_TEXTO: Record<Derecho, string> = {
  acceso: 'acceso',
  rectificacion: 'rectificación',
  supresion: 'supresión',
  oposicion: 'oposición',
  portabilidad: 'portabilidad',
  bloqueo: 'bloqueo',
};

/** Correo de un titular ficticio que ejerce un derecho; se usa en las solicitudes de ejemplo. */
export function correoDeTitular(
  p: PersonaBase,
  derecho: Derecho,
  rut = p.rut,
): { asunto: string; mensaje: string } {
  const nombre = nombreCompleto(p);
  return {
    asunto: `Solicitud de ${DERECHO_TEXTO[derecho]} de datos personales (Ley 21.719)`,
    mensaje: `Estimados:

Mi nombre es ${nombre}, RUT ${rut}. ${TEXTO_DERECHO[derecho]}

Pueden responderme a ${p.email}.

Saludos cordiales,
${nombre}`,
  };
}

export { nombreCompleto };
