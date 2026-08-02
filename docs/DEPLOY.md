# Desplegar RXList

RXList es una aplicación Next.js estándar. Vercel detecta Next.js automáticamente y usa `npm run build`.

## Variables mínimas para una demo

Configúralas en el panel del proveedor, no en el repositorio:

```env
SESSION_SECRET=un-secreto-largo-y-aleatorio
API_GEMINI=tu-api-key-de-gemini
GEMINI_MODEL=gemini-3.1-flash-lite
NEXT_PUBLIC_DEFAULT_PROVIDER=gemini
DEMO_MODE=true
ALLOW_DEMO_LOGIN=true
PUBLIC_DEMO=true
NEXT_PUBLIC_DEMO_MODE=true
RESET_DEMO_ON_START=false
```

Con `DEMO_MODE=true`, si la base está vacía RXList crea automáticamente un admin, la Dra. Erika, enfermeros, pacientes, medicamentos, tareas y signos vitales de demostración. Los accesos demo usan la contraseña `1234`.

## Persistencia con JSON

RXList usará `data/rxlist.json` por defecto. En Vercel el sistema de archivos es efímero, por lo que los cambios se reinician al desplegar o cambiar de instancia; para la presentación usa los datos demo y evita modificar la base durante la demostración.

En producción cambia `DEMO_MODE=false`, `ALLOW_DEMO_LOGIN=false`, `PUBLIC_DEMO=false` y `NEXT_PUBLIC_DEMO_MODE=false`.

## Vercel

1. Importa el repositorio en Vercel.
2. Framework preset: `Next.js`.
3. Build command: `npm run build`.
4. Agrega las variables de `.env.production.example` en Settings → Environment Variables para Preview y Production.
5. Usa Redis externo si quieres que pacientes y tareas sobrevivan a nuevos despliegues.
6. La transcripción de voz queda fuera de este despliegue; configura tu servicio externo por separado cuando lo tengas listo.

## Seguridad

`API_GEMINI` y `REDIS_URL` son variables privadas del servidor. No uses `NEXT_PUBLIC_` para ellas. Solo las variables explícitamente prefijadas con `NEXT_PUBLIC_` se envían al navegador.
