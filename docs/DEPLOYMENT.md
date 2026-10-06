# Publicar una instancia de pruebas de AUREX

El código está en GitHub, rama `main`. La aplicación todavía no tiene un enlace
público verificado. La validación local no implica que el despliegue remoto haya pasado.

## 1. Crear la base de datos

En https://supabase.com/dashboard inicia sesión y crea un proyecto nuevo llamado
`AUREX-STAGING`. Usa una contraseña única y guárdala en tu gestor de contraseñas.
Elige una región cercana. El proyecto incluye PostgreSQL y autenticación.

Comparte únicamente la URL del proyecto o su identificador para continuar.
No publiques contraseñas, connection strings ni claves en el chat o GitHub.
La creación y el acceso a la cuenta requieren intervención del titular; este
entorno no tiene una sesión ni credenciales para administrar Supabase o Vercel.

Para inicializar un proyecto vacío desde el navegador, abre `docs/SETUP_DATABASE.sql`
en GitHub, pulsa Raw, copia el contenido completo y ejecútalo en SQL Editor del
proyecto AUREX-STAGING. El archivo reúne las diez migraciones en una transacción,
registra sus versiones y rechaza una segunda inicialización. No incluye usuarios,
contraseñas ni datos DEMO. Si falla, comparte únicamente el mensaje de error.
Se verificó localmente en una base PostgreSQL vacía con el esquema Auth real:
diez versiones registradas, repetición rechazada y health SQL anon correcto.
Esto todavía no acredita aplicación en el proyecto administrado del usuario.
Se regenera desde las migraciones mediante `node scripts/staging-sql.mjs`.

En Authentication / Users crea tu usuario con email confirmado. Después ejecuta
`docs/SETUP_OWNER.sql` en una nueva consulta del SQL Editor. Esta inicialización
exige exactamente un usuario confirmado y una base sin tenant ni memberships;
crea AUREX STAGING, asigna Owner activo y registra ocho definiciones KPI sin
inventar métricas ni cargar usuarios DEMO. Rechaza usuarios ambiguos, email sin
confirmar e inicialización repetida. Fue probada en PostgreSQL local con el esquema
Auth real. Falta comprobar el acceso efectivo y MFA desde la web administrada.

Antes del primer acceso web hay que configurar las URLs de autenticación. No ejecutes `supabase/seed.sql` ni
`scripts/demo.mjs` contra esa base: son exclusivamente locales.

## 2. Preparar la web en Vercel

En https://vercel.com inicia sesión con GitHub, elige Add New / Project e importa
`Luis710adrian/AUREX-V1`. Autoriza acceso solo al repositorio necesario.

Configuración del proyecto:

| Campo                                       | Valor                     |
| ------------------------------------------- | ------------------------- |
| Framework Preset                            | Next.js                   |
| Root Directory                              | `apps/web`                |
| Include source files outside Root Directory | Activado                  |
| Node.js Version                             | 24.x                      |
| Install Command                             | `cd ../.. && npm ci`      |
| Build Command                               | `npm run build`           |
| Output Directory                            | Predeterminado de Next.js |

El build de este workspace se comprobó localmente con
`npm run build --workspace @aurex/web`. La configuración remota debe verificarse
en el primer deployment; no hay un deployment Vercel realizado todavía.

Configura estas variables en Vercel, usando valores del proyecto administrado:

| Variable                        | Uso                                                     |
| ------------------------------- | ------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | URL HTTPS del proyecto                                  |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave anon pública del proyecto                         |
| `SUPABASE_SERVICE_ROLE_KEY`     | Clave service_role, solo servidor; marcar como sensible |

No copies las claves del entorno Docker local. `DATABASE_URL`,
`AUREX_DEMO_PASSWORD` y los secretos Docker no se necesitan en Vercel.
No despliegues como producto listo hasta preparar y probar la base administrada.

## 3. Verificar antes de dar acceso

Configura Site URL y redirect permitido `/invite` en Supabase según el dominio real.
Verifica el proveedor de correo y sus restricciones antes de enviar invitaciones;
la prueba local de Mailpit no acredita entrega de correo administrado.

Con la instancia staging preparada, comprueba `/api/health` (Auth y SQL), login,
MFA Owner, pertenencia al tenant, ciclo comercial/financiero, aislamiento de roles,
invitación/activación y persistencia después de un redeploy.
Publica el resultado y el enlace únicamente después de comprobarlos.

Estado actual: código en GitHub; build del workspace probado localmente;
el usuario confirmó proyecto Supabase creado y `AUREX schema ready` en SQL Editor.
Usuario Auth creado según su confirmación. Asignación Owner, proyecto Vercel,
variables/redirects y validación web remota todavía pendientes.
