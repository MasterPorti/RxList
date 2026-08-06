# RXList · Resumen operativo para otra IA

## Qué es este proyecto

RXList es una aplicación web de operación hospitalaria para doctores, enfermería y administración. El frontend y el backend viven en el mismo proyecto Next.js usando App Router y rutas API. Maneja pacientes, camas, pisos, enfermeras, turnos, medicamentos, tareas, autenticación y un asistente operativo.

Repositorio principal: `https://github.com/MasterPorti/RxList`

Repositorio independiente de transcripción: `https://github.com/MasterPorti/whisperapi`

## Stack

- Next.js 15.5 con React 19 y TypeScript.
- Node.js 22.x en producción (`package.json` exige `>=22 <23`).
- API Routes de Next.js bajo `app/api`.
- Persistencia mediante el store definido en `lib/store.ts`; no asumir una base de datos externa salvo que las variables/configuración del entorno lo indiquen.
- Gemini para el asistente conversacional.
- Whisper remoto con FastAPI + `faster-whisper` para dictado de voz.
- Coolify despliega RXList y Whisper como aplicaciones separadas.

## Estructura importante

- `app/doctor/page.tsx`: dashboard del doctor, chat, propuestas y formulario de paciente.
- `app/nurse/`: vistas y tareas de enfermería.
- `app/admin/`: administración.
- `app/api/chat/propose/route.ts`: recibe solicitudes del doctor, enruta al proveedor, normaliza propuestas y asigna camas libres.
- `app/api/chat/confirm/route.ts`: valida revisión y aplica operaciones después de la confirmación del doctor.
- `app/api/transcribe/route.ts`: proxy autenticado de RXList hacia Whisper; recibe multipart `audio` y reenvía `WHISPER_API_KEY`.
- `lib/prompt-gateway.ts`: decide entre respuesta local, AGY o contexto remoto.
- `lib/gemini.ts`: llamadas normales y streaming SSE a Gemini; convierte la salida JSON en `Plan`.
- `lib/agy.ts`: prompts, normalización y validación del flujo AGY/local.
- `lib/types.ts`: esquemas de `Plan`, pacientes, pisos, enfermeras y operaciones.
- `components/whisper-voice.tsx`: grabación desde navegador, indicador “Escuchando…” y estado “Transcribiendo…”.
- `whisperapi/`: repositorio Git anidado independiente; no mezclar sus commits con RXList.

## Cómo iniciar RXList en local

Requisitos: Node.js 22 y npm.

```bash
npm install
npm run dev
```

El script `dev` usa `scripts/dev.mjs`; si se necesita iniciar Next directamente:

```bash
npm run dev:next
```

Comprobaciones disponibles:

```bash
npm run build
npm run test
```

El build puede requerir que las dependencias de desarrollo estén instaladas. Si aparece un error indicando que falta ESLint, ejecutar `npm install` antes de volver a validar.

## Variables de entorno de RXList

Configuración mínima para usar Gemini y Whisper remoto:

```env
WHISPER_URL=https://whisper.julio.cloud
WHISPER_API_KEY=la-misma-clave-configurada-en-whisperapi
API_GEMINI=clave-de-gemini
```

Variables relacionadas que pueden existir según el entorno:

- `GEMINI_API_KEY`: alternativa a `API_GEMINI`.
- `GEMINI_MODEL`: modelo de Gemini; si se omite, el código usa su valor por defecto.
- `GEMINI_TIMEOUT_MS`: timeout de Gemini.
- `NEXT_PUBLIC_DEFAULT_PROVIDER`: proveedor inicial del selector (`gemini` o `agy`).
- `AGY_TIMEOUT_MS`: timeout del proveedor AGY.

Nunca escribir claves reales en el repositorio ni en archivos versionados.

## Cómo funciona el dictado

1. El doctor pulsa el micrófono en `/doctor`.
2. El navegador graba `audio/webm`, `audio/mp4` u `audio/ogg`.
3. `components/whisper-voice.tsx` envía el archivo a `/api/transcribe`.
4. RXList verifica la sesión y reenvía el archivo a `${WHISPER_URL}/transcribe`.
5. Si existe `WHISPER_API_KEY`, se envía en `X-Whisper-Api-Key`.
6. Whisper devuelve `text`; RXList lo coloca en el textarea del chat.
7. Mientras espera, la interfaz muestra “Transcribiendo…”.

## Variables de entorno de Whisper API

En Coolify, aplicación `whisperapi`:

```env
WHISPER_MODEL=small
WHISPER_LANGUAGE=es
WHISPER_API_KEY=una-clave-larga-y-segura
CORS_ORIGINS=https://rxlist.julio.cloud
```

Opcionales:

- `WHISPER_DEVICE=cpu` por defecto; `cuda` sólo con GPU compatible.
- `WHISPER_COMPUTE_TYPE=int8` por defecto.
- `MAX_AUDIO_MB=20` por defecto.
- `WHISPER_DOWNLOAD_ROOT=/models` por defecto.

Whisper expone el puerto `8000`, tiene healthcheck y guarda el modelo en `/models`. Coolify debe tener **Ports Exposes = `8000`**, no `3000`, y el dominio `https://whisper.julio.cloud`.

Endpoints:

- `GET /health`: debe devolver `{"ok":true,"model":"small"}` cuando el modelo terminó de cargar.
- `GET /docs`: documentación Swagger.
- `POST /transcribe`: multipart con campo `audio`; requiere `X-Whisper-Api-Key` si `WHISPER_API_KEY` está configurada.

## Flujo del asistente

El asistente no aplica cambios inmediatamente:

1. `/api/chat/propose` recibe el mensaje.
2. Gemini/AGY devuelve un `Plan` JSON con `type`, `intent`, `message`, `missing` y `operations`.
3. RXList normaliza nombres de campos y valida el plan.
4. Para operaciones incompletas de pacientes se abre un formulario parcial.
5. El doctor confirma.
6. `/api/chat/confirm` valida la revisión (`revision`) y aplica el cambio.

Operaciones relevantes:

- `create_patient`: requiere nombre, fecha, motivo, alergias, contacto, teléfono y piso; la cama se asigna automáticamente.
- `assign_patient`: usa `floor`.
- `move_patient`: usa `to` como piso destino; la normalización convierte `floor` a `to` cuando Gemini lo devuelve con ese nombre.
- `create_nurse`, `update_floor`, `create_shift`, `create_medication` y `create_task`.

Si una propuesta visible dice “piso 2” pero confirmar devuelve `patient_floor_required`, revisar primero que `move_patient.to` esté presente en la respuesta normalizada.

## Despliegue en Coolify

### RXList

- Repositorio: `MasterPorti/RxList`.
- Rama: `main`.
- Build pack según la configuración existente del proyecto.
- Configurar las variables de RXList indicadas arriba.
- Hacer redeploy después de cada push.

### Whisper API

- Repositorio: `MasterPorti/whisperapi`.
- Rama: `main`.
- Build pack: `Dockerfile`.
- Base directory: `/`.
- Ports Exposes: `8000`.
- Static site: desactivado.
- Dominio: `https://whisper.julio.cloud`.
- Mantener un volumen persistente montado en `/models` para no descargar el modelo en cada redeploy.

DNS: crear un registro `A` para `whisper.julio.cloud` apuntando a la IP pública del VPS. HTTPS lo gestiona Coolify/Proxy cuando el DNS ya resuelve.

## Diagnóstico rápido

### Whisper

```bash
curl https://whisper.julio.cloud/health
```

- `200` con `ok:true`: servicio listo.
- `502 Bad Gateway`: revisar `Ports Exposes = 8000`, dominio y redeploy.
- `415`: revisar el MIME del audio; el backend acepta parámetros como `audio/webm;codecs=opus`.
- `ModuleNotFoundError: requests`: revisar `requirements.txt`; `requests==2.32.3` debe estar instalado.

### RXList

- `503 transcription_unavailable`: revisar `WHISPER_URL`, DNS, HTTPS, health de Whisper y timeout.
- `401`: revisar la sesión del doctor o `WHISPER_API_KEY`.
- `patient_floor_required`: revisar la operación `move_patient.to`.
- Formulario de paciente vacío: revisar `draftFromMessages` y que el flujo streaming aplique el fallback local.

## Reglas para futuras modificaciones

- Leer `AGENTS.md` antes de tocar código.
- Mantener separados los commits de RXList y `whisperapi`.
- No agregar secretos al repositorio.
- Después de cambiar código, ejecutar al menos `npm run build` o la prueba específica relacionada.
- Tras hacer push, redeployar el servicio correspondiente en Coolify.
- No declarar una operación como aplicada hasta que el doctor confirme y `/api/chat/confirm` responda correctamente.
