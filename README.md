# Agente de IA para la Ley 21.719 · prototipo académico

Aplicación web de demostración en la que un agente de IA ubica los datos de una persona en las fuentes de una empresa ficticia, redacta la respuesta a su solicitud bajo la Ley 21.719 y la deja lista para que un encargado de cumplimiento la apruebe y la envíe por correo.

> **Prototipo académico · Datos ficticios · No es asesoría legal.** «Comercial Los Aromos SpA» y todas las personas, RUT y correos son inventados (correos solo en `example.com` y `*.example`).

## Qué hace

| Pantalla      | Qué permite                                                                                                                                                                                       |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bandeja       | Solicitudes simuladas y de Gmail, con semáforo de plazo (30 días corridos, prórroga única de 30)                                                                                                  |
| Detalle       | «Investigar»: el agente busca al titular en todas las fuentes y muestra cada paso en vivo; hallazgos con confianza, revisión de coincidencias dudosas, borrador editable, aprobación, PDF y envío |
| Inventario    | «Escanear fuentes»: el agente propone el registro de actividades de tratamiento; el encargado edita y confirma                                                                                    |
| Bitácora      | Registro de solo agregar de cada evento, filtrable y exportable a CSV                                                                                                                             |
| Reportes      | Reporte de cumplimiento en PDF con métricas; exportación a XLSX                                                                                                                                   |
| Configuración | Clave de Anthropic, modelo, Gmail, panel de integraciones, empresa ficticia y preparación de la demo                                                                                              |

Sin clave de Anthropic ni Gmail, todo funciona en **modo demostración**: el razonamiento del agente está pregrabado, pero las búsquedas en las fuentes simuladas son reales.

## Arquitectura

```
ley21719-agente/
├─ apps/web/              Next.js 16 (App Router) + Astryx; única app desplegada en Vercel
│  ├─ app/api/gmail/      rutas de servidor: leer, enviar, simular y estado de Gmail
│  ├─ app/api/aprobaciones/  firma la aprobación humana que exige el envío
│  ├─ proxy.ts            CSP estricta con nonce y acceso restringido
│  └─ astryx-themes.js    tema generado por la CLI de Astryx
└─ packages/
   ├─ agent/              prompts, herramientas, bucle del agente, modo demostración, clasificación e inventario
   ├─ connectors/         interfaz Connector, seis conectores simulados y conector Gmail
   ├─ mock-data/          empresa ficticia con semilla fija; `archivos/` trae XLSX y CSV de ejemplo
   ├─ domain/             esquemas Zod, RUT, plazos, métricas
   ├─ report/             PDF (@react-pdf/renderer) y XLSX (SheetJS)
   └─ config/             tsconfig, ESLint y Prettier compartidos
```

- **El agente corre en el navegador.** La clave de Anthropic va directo del navegador a `api.anthropic.com` (SDK con `dangerouslyAllowBrowser`), vive en memoria y solo con «recordar en esta pestaña» se guarda en `sessionStorage`. Nunca se envía a rutas del proyecto.
- **El agente no puede enviar, borrar ni modificar.** Sus herramientas son `listar_fuentes`, `buscar_titular`, `obtener_registro`, `calcular_plazo` y `proponer_respuesta`. El envío lo dispara la interfaz tras la aprobación humana, y el servidor exige un identificador de aprobación firmado que cubre el destinatario y el texto exacto aprobado.
- **Minimización de datos.** Los datos sensibles de salud llegan al modelo ocultos («existe información; el detalle no se envía»). Los hallazgos se completan con los datos reales en el navegador, sin pasar por el modelo.
- **Modelo.** `claude-sonnet-5-5` por defecto, con pensamiento adaptativo, esfuerzo medio, caché de prompt y respaldo del servidor ante rechazos (`fallbacks: "default"`). Opciones económicas: `claude-haiku-4-5` (indicada en los requerimientos) y `claude-haiku-5-5` (más barata). Se muestra el uso de tokens y el costo estimado por solicitud.
- **Persistencia.** IndexedDB en el navegador: solicitudes, bitácora y registro de actividades. Cada persona ve solo su sesión.

## Requisitos

- Node.js 22 LTS o superior
- pnpm 10 (viene con Node mediante Corepack): `corepack enable`

## Instalación y uso local

```bash
corepack enable
pnpm install
pnpm dev              # http://localhost:3000 en modo demostración
```

Otras tareas:

```bash
pnpm turbo run lint typecheck test   # calidad en todos los paquetes
pnpm build                           # build de producción
pnpm test:e2e                        # Playwright: recorrido completo en modo demostración (requiere build)
pnpm gen:fuentes                     # regenera packages/mock-data/archivos con la semilla por defecto
```

## Gmail (opcional)

1. En Google Cloud: crear un proyecto y habilitar la Gmail API.
2. Pantalla de consentimiento externa en **modo de prueba**, con usuarios de prueba solo del equipo y la casilla de demostración.
3. Cliente OAuth de tipo aplicación web con redirecciones `http://localhost:3000/api/auth/callback/google` y `https://<dominio-de-producción>/api/auth/callback/google`.
4. Scopes: `openid email profile gmail.readonly gmail.send`.
5. Copiar `.env.example` a `apps/web/.env.local` y completar las seis variables (`npx auth secret` genera `AUTH_SECRET`).

Con Google configurado, solo pueden ingresar las cuentas de `ALLOWED_EMAILS`, y los correos solo salen hacia esas cuentas y `DEMO_INBOX_ADDRESS`. En modo de prueba, los tokens caducan a los siete días: **reconectar Gmail antes de cada presentación**.

## Despliegue en Vercel

| Ajuste         | Valor                                                    |
| -------------- | -------------------------------------------------------- |
| Root Directory | `apps/web`                                               |
| Build          | `turbo run build --filter=web` (detectado desde la raíz) |
| Node.js        | 22.x                                                     |
| Variables      | las seis de `.env.example`, en Production y Development  |
| Protección     | Deployment Protection activa en las vistas previas       |
| Dominio        | uno fijo, registrado en Google como URI de redirección   |

Las vistas previas operan en modo simulado salvo que tengan un dominio fijo registrado en Google.

## Guion de la demo (menos de 3 minutos)

1. **Configuración → Preparar la demo → Regenerar y restaurar** (semilla 21719). Si hay Gmail, reconectarlo.
2. Pegar la clave exclusiva para la demo y pulsar **Guardar y probar** (sin clave, la demo corre en modo demostración).
3. **Bandeja**: mostrar el semáforo; abrir **SOL-002** (urgente, tiene un homónimo).
4. **Investigar**: el agente recorre las seis fuentes, reintenta ante errores simulados y vuelve a buscar con el teléfono que encontró.
5. **Hallazgos**: descartar los homónimos dudosos; mostrar el aviso de datos de salud ocultos al modelo.
6. Editar una línea del borrador y **Aprobar**: se genera el PDF (y se envía por Gmail si la solicitud vino de la casilla).
7. **Bitácora** y **Reportes**: descargar el reporte de cumplimiento.

Para una solicitud real por Gmail: **Bandeja → Simular solicitud** (envía a la casilla el correo de un titular ficticio) → **Leer Gmail** → investigar → aprobar y enviar en el mismo hilo.

## Seguridad

- CSP estricta en `proxy.ts`: scripts solo con nonce (más `'wasm-unsafe-eval'` para el generador de PDF), `connect-src` limitado al propio dominio y `api.anthropic.com`, sin scripts de terceros ni analítica.
- Tokens de Google solo en la cookie cifrada de Auth.js; el navegador ve únicamente si Gmail está conectado.
- Ningún secreto en el repositorio (`.env*` ignorado); CI con escaneo de secretos (gitleaks), inventario de licencias y Dependabot.
- Astryx está en beta: versión fijada y actualización manual con `npx @astryxdesign/cli upgrade`.

## Decisiones abiertas

| Decisión             | Estado en el código                                                                                                                 |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Estado y bitácora    | IndexedDB (recomendado); cada persona ve solo su sesión                                                                             |
| Nombre de la empresa | «Comercial Los Aromos SpA»: falta confirmar que no exista una empresa real con ese nombre                                           |
| Tema visual          | Tema neutral de Astryx; el tema con colores de la Universidad Mayor se genera con `npx @astryxdesign/cli experimental theme editor` |
| Modelo por defecto   | Sonnet 5.5 para la demo; Haiku para desarrollo                                                                                      |
| Casilla de prueba    | Cuenta Gmail nueva y exclusiva (recomendado)                                                                                        |
