# RXList - Documentación técnica y operativa

**Versión analizada:** 0.1.0  
**Fecha de análisis:** 1 de agosto de 2026  
**Tipo de sistema:** MVP web para operación de enfermería por pisos

## 1. Resumen ejecutivo

RXList es una aplicación web para organizar la operación de enfermería de un hospital pequeño o mediano. Permite:

- administrar doctores y accesos de enfermería;
- registrar, ubicar, trasladar y dar de alta pacientes;
- organizar enfermeras por piso y turno;
- crear medicamentos y tareas de cuidado;
- registrar signos vitales al completar tareas;
- consultar pacientes, camas, personal y medicamentos mediante un chat;
- dictar instrucciones por voz con Whisper;
- conservar una bitácora de auditoría de cambios relevantes.

La regla principal del producto es: **la IA propone, el servidor valida y el doctor confirma**. Una instrucción del chat nunca modifica el estado por sí sola.

## 2. Arquitectura general

### Tecnologías

- **Frontend y backend:** Next.js 15 con React 19 y TypeScript.
- **API:** Route Handlers de Next.js bajo `app/api`.
- **Persistencia:** archivo JSON local `data/rxlist.json` o Redis si existe `REDIS_URL`.
- **Sesiones:** JWT firmado con `jose`, guardado en cookie HTTP-only.
- **Contraseñas:** `scryptSync` con salt por usuario.
- **IA de operaciones:** CLI externo AGY, configurable mediante `AGY_BIN`, `AGY_MODEL` y `AGY_TIMEOUT_MS`.
- **Voz:** servicio separado FastAPI + `faster-whisper`.
- **Pruebas:** Vitest.
- **Despliegue:** Docker Compose y Caddy como reverse proxy.

### Componentes principales

```text
Navegador
  |
  | HTTPS / HTTP
  v
Caddy
  |
  v
Next.js (web + API)
  |-- sesiones y autorización
  |-- reglas de dominio
  |-- persistencia JSON o Redis
  |-- gateway local / AGY
  |
  +--> Whisper FastAPI (audio -> texto)
  +--> AGY CLI (texto -> propuesta JSON)
```

### Estructura del repositorio

| Carpeta | Responsabilidad |
|---|---|
| `app/` | Páginas, layouts y endpoints HTTP de Next.js. |
| `app/api/` | API autenticada para usuarios, pacientes, turnos, chat y tareas. |
| `components/` | Componentes visuales reutilizables del chat, voz y modales. |
| `lib/` | Tipos, reglas de negocio, autenticación, almacenamiento y gateway de IA. |
| `scripts/` | Carga de datos demo, ajuste de personal y utilidades. |
| `whisper/` | Microservicio de transcripción de audio. |
| `public/` | Recursos estáticos, incluida la imagen de la doctora. |
| `Dockerfile` | Imagen multietapa para producción del servicio web. |
| `docker-compose.yml` | Servicios `web` y `whisper` para demo/despliegue. |
| `Caddyfile` | Proxy inverso y headers básicos de seguridad. |

## 3. Roles y permisos

### Administrador

El administrador entra a `/` y es enviado a `/admin`. Puede:

- crear doctores;
- editar nombre y correo de doctores;
- restablecer contraseñas de doctores;
- eliminar doctores;
- crear accesos de enfermería asociados a un doctor;
- asignar piso inicial a una enfermera.

### Doctor

El doctor entra a `/doctor`. Puede:

- usar el asistente conversacional;
- confirmar propuestas de cambios;
- consultar y administrar pacientes;
- administrar enfermeras de su propio equipo;
- asignar turnos;
- crear medicamentos y tareas;
- cambiar contraseñas de accesos de enfermería;
- consultar el dashboard operativo y la auditoría visible para su contexto.

### Enfermera

La enfermera entra a `/nurse`. Puede:

- ver su perfil y sus tareas asignadas;
- ver pacientes del piso asociado;
- completar o saltar una tarea;
- registrar signos vitales al completar una tarea;
- cambiar su contraseña si el acceso es temporal.

El servidor comprueba el rol en cada endpoint. La interfaz no es la capa de seguridad.

## 4. Inicio de sesión y sesiones

1. El usuario envía correo y contraseña a `POST /api/auth/login`.
2. El servidor busca el correo ignorando mayúsculas y minúsculas.
3. La contraseña se verifica con `scrypt` y el hash guardado.
4. Se firma un JWT HS256 con `id`, `role`, fecha de emisión y expiración de 8 horas.
5. El JWT se guarda en la cookie `rxlist_session` con `httpOnly`, `sameSite=lax` y `secure` en producción.
6. `currentContext()` lee la cookie, valida el token y recupera el usuario desde el store.

El endpoint `POST /api/auth/logout` elimina la cookie. El cambio de contraseña reemplaza el hash; en cuentas de enfermería también desactiva `mustChangePassword`.

## 5. Persistencia y modelo de datos

El store tiene esta forma general:

```ts
{
  schemaVersion: 2,
  revision: number,
  users: User[],
  floors: FloorRecord[],
  patients: Patient[],
  shifts: Shift[],
  medications: MedicationOrder[],
  tasks: CareTask[],
  vitals: VitalRecord[],
  audit: AuditEvent[],
  chatHistory: Record<string, string[]>
}
```

### Entidades

- **User:** administrador, doctor o cuenta de enfermera.
- **Doctor:** usuario doctor con su colección de enfermeras.
- **Nurse:** persona de enfermería, piso, estado, correo, teléfono, fecha de nacimiento y turnos.
- **FloorRecord:** piso, nombre, descripción y número de camas.
- **Patient:** identidad, motivo, alergias, contacto de emergencia, piso, cama, estado e ingreso/alta.
- **Shift:** enfermera, piso, tipo de turno y horario fijo.
- **MedicationOrder:** medicamento, dosis, horarios, fechas, piso y enfermera sugerida.
- **CareTask:** tarea de cuidado asociada a paciente y, opcionalmente, medicamento.
- **VitalRecord:** temperatura, presión, frecuencia cardiaca, saturación y notas.
- **AuditEvent:** actor, rol, acción, entidad, entidad afectada, detalles y fecha.

### Store local y Redis

Si `REDIS_URL` existe, el store se guarda como JSON en la clave `rxlist:store`. Si no existe, se usa `data/rxlist.json` dentro del directorio de trabajo.

`migrate()` completa campos faltantes para mantener compatibilidad con el esquema actual. `completeNurseEmails()` crea correos para enfermeras antiguas que no los tengan.

La variable `revision` aumenta después de cada modificación. Se utiliza como control optimista para evitar aplicar una propuesta sobre datos que cambiaron desde que fue generada.

## 6. Flujo del chat y la IA

### Paso 1: solicitud

El doctor escribe una instrucción en `/doctor`. El frontend envía el texto a `POST /api/chat/propose`.

El endpoint:

1. valida la sesión y exige rol doctor;
2. limita el mensaje a 1,000 caracteres;
3. recupera hasta seis líneas recientes del historial;
4. envuelve el mensaje en las etiquetas internas de historial y mensaje actual;
5. llama a `routePrompt()`.

### Paso 2: gateway local

`lib/prompt-gateway.ts` resuelve sin IA las consultas seguras y deterministas, por ejemplo:

- contacto de emergencia;
- medicamentos activos;
- lista de pacientes;
- camas disponibles;
- enfermeras por piso;
- continuación de un alta de paciente cuando falta el piso y la cama.

Si detecta una mutación, la deriva a AGY. El contexto se compacta para enviar solo pisos, pacientes relevantes, turnos, medicamentos y tareas necesarias.

### Paso 3: propuesta AGY

`lib/agy.ts` llama al binario configurado en `AGY_BIN`. El prompt exige JSON con:

- `type`: `proposal`, `clarification`, `rejected` o `no_change`;
- `intent`;
- `message`;
- `missing`;
- `operations`.

Las operaciones permitidas son:

`update_floor`, `create_nurse`, `create_patient`, `assign_patient`, `move_patient`, `discharge_patient`, `create_shift`, `create_medication` y `create_task`.

El módulo normaliza respuestas antiguas, elimina UUIDs del mensaje visible, convierte bloques de enfermeras a tablas Markdown, vuelve a intentar si AGY devuelve JSON inválido y aplica correcciones para casos sensibles como:

- no confundir un paciente existente con un paciente nuevo;
- no convertir automáticamente una orden ambigua en alta de paciente;
- respetar la corrección "como enfermera";
- trasladar todas las enfermeras a "sin piso";
- exigir causa de alta;
- no permitir inventar datos fuera del contexto.

### Paso 4: camas automáticas

Antes de mostrar la propuesta, `assignFreeBeds()` busca la primera cama libre del piso para operaciones `create_patient`. Si no hay cama, devuelve una aclaración y no presenta una operación aplicable.

### Paso 5: confirmación

El doctor revisa la tarjeta y pulsa **Aceptar cambio**. El frontend envía la propuesta y la `revision` a `POST /api/chat/confirm`.

El servidor:

1. valida que la propuesta tenga el esquema `Plan`;
2. exige rol doctor;
3. compara `revision` con el store actual;
4. valida cada operación contra el estado actual;
5. ejecuta el lote;
6. crea eventos de auditoría;
7. aumenta la revisión;
8. guarda el store;
9. devuelve el doctor actualizado y los accesos temporales creados.

Si la revisión cambió o una enfermera ya no está en el piso esperado, el lote se rechaza con conflicto y no se aplica parcialmente.

## 7. Operaciones de negocio

### Enfermeras

`createNurseUser()` exige nombre completo, crea un UUID de persona y otro de cuenta, genera correo, genera contraseña temporal, guarda el hash y marca `mustChangePassword=true`. El doctor puede mover la enfermera de piso desde el chat o editarla desde la interfaz.

Reglas relevantes:

- no se permiten nombres duplicados ignorando acentos y mayúsculas;
- una enfermera puede quedar `unassigned`;
- una enfermera inactiva no se considera candidata para tareas;
- el correo se genera como `nombre.apellido.numero@rxlist.com`.

### Pacientes

Un paciente nuevo necesita nombre completo, fecha de nacimiento, motivo, alergias, contacto de emergencia y teléfono. El ingreso requiere piso y cama cuando se usa el endpoint directo; por chat, la cama puede ser asignada automáticamente.

La función `floorHasRoom()` comprueba que la cama sea entera, positiva, no exceda la capacidad y no esté ocupada por otro paciente no dado de alta.

Dar de alta a un paciente:

- exige motivo de alta;
- cambia el estado a `discharged`;
- quita piso y cama;
- guarda fecha y motivo de alta;
- cancela medicamentos activos;
- marca como `skipped` tareas pendientes o en progreso;
- agrega auditoría.

### Turnos

Los turnos son fijos:

- **Día:** 05:00 a 17:00.
- **Noche:** 17:00 a 05:00.

No se permite más de un turno programado por enfermera ni más de una enfermera cubriendo el mismo piso y tipo de turno.

### Medicamentos y tareas

`medicationTimes()` acepta horarios explícitos `HH:mm` o frecuencias como `cada 8 horas` y `tres veces al día`. Al crear un medicamento se generan tareas de administración para cada horario.

Una tarea general necesita paciente, título y hora programada. `nurseForTask()` intenta asignar la tarea a una enfermera activa del piso con turno compatible; si no encuentra turno, usa una enfermera candidata del piso o la preferida.

La enfermera solo puede modificar una tarea cuyo `nurseId` coincida con su cuenta. Al completarla puede enviar signos vitales, que se guardan como `VitalRecord`.

## 8. API disponible

| Método | Ruta | Acceso | Función |
|---|---|---|---|
| POST | `/api/auth/login` | Público | Inicia sesión. |
| POST | `/api/auth/logout` | Sesión | Cierra sesión. |
| POST | `/api/auth/change-password` | Sesión | Cambia contraseña. |
| GET | `/api/admin/me` | Admin | Lista doctores sin hashes. |
| POST | `/api/admin/doctors` | Admin | Crea doctor. |
| PATCH/DELETE | `/api/admin/doctors/:id` | Admin | Edita, restablece o elimina doctor. |
| POST | `/api/nurses` | Admin/Doctor | Crea acceso de enfermería. |
| GET | `/api/doctor/me` | Doctor | Devuelve perfil del doctor. |
| GET | `/api/doctor/summary` | Doctor | Devuelve dashboard, censo, tareas y auditoría. |
| PATCH | `/api/doctor/nurses/:id` | Doctor | Edita enfermera o restablece contraseña. |
| GET/PATCH | `/api/floors` | Sesión / Doctor-Admin | Consulta o edita pisos. |
| GET/POST | `/api/patients` | Sesión / Doctor | Lista o crea pacientes. |
| PATCH | `/api/patients/:id` | Doctor | Asigna cama o da de alta. |
| GET/POST | `/api/shifts` | Sesión / Doctor | Consulta o crea turnos. |
| POST | `/api/medications` | Doctor | Crea medicamento y tareas. |
| GET | `/api/nurse/me` | Enfermera | Devuelve perfil, pacientes y tareas asignadas. |
| PATCH | `/api/tasks/:id` | Enfermera | Completa/salta tarea y registra signos vitales. |
| POST | `/api/chat/propose` | Doctor | Obtiene propuesta del gateway/AGY. |
| POST | `/api/chat/confirm` | Doctor | Valida y aplica propuesta. |
| POST | `/api/chat/close` | Doctor | Borra historial del chat del doctor. |
| POST | `/api/transcribe` | Sesión | Envía audio a Whisper. |
| GET | `/api/demo` | Público si se habilita | Expone datos demo sin información sensible. |

## 9. Pantallas del frontend

- `/login`: formulario de acceso y navegación de sesión.
- `/admin`: administración de doctores, enfermeras y contraseñas.
- `/doctor`: chat, dashboard, estado de pisos, censo, pacientes, enfermeras y turnos.
- `/nurse`: tareas de la enfermera, pacientes del piso, cierre de tareas y signos vitales.
- `/demo`: dashboard público de demostración si `PUBLIC_DEMO=true`.
- `/`: página de entrada que redirige según rol después de autenticación.

El componente `WhisperVoice` solo se monta en `/doctor`. Graba `audio/webm` con `MediaRecorder`, muestra niveles de audio, envía el archivo al backend y coloca el texto transcrito en el textarea del chat.

## 10. Voz con Whisper

El navegador llama a `POST /api/transcribe`. El backend comprueba la sesión, exige un archivo y limita el audio a 20 MB. Después reenvía el archivo a `WHISPER_URL` con timeout de 70 segundos.

El servicio Python:

1. acepta WebM, WAV, MPEG, MP4 u OGG;
2. rechaza archivos mayores de 20 MB;
3. guarda el audio en un archivo temporal;
4. transcribe en español con `faster-whisper` y `vad_filter=True`;
5. concatena los segmentos;
6. elimina el archivo temporal;
7. devuelve `{ "text": "..." }`.

`GET /health` se utiliza en el healthcheck de Docker Compose.

## 11. Ejecución local

### Requisitos

- Node.js 22 o compatible.
- npm.
- Redis opcional.
- AGY instalado si se quieren probar operaciones delegadas a IA.
- Whisper opcional en local; en Compose se levanta como servicio.

### Comandos

```bash
npm install
npm run dev
npm test
npm run build
npm run seed:demo
npm run staff:demo
```

La aplicación se abre en `http://localhost:3000`.

Para persistencia local se necesita que el proceso pueda crear `data/rxlist.json`. En producción se recomienda Redis o un volumen persistente explícito.

## 12. Docker y despliegue

La imagen web usa tres etapas:

1. instala dependencias;
2. construye Next.js;
3. copia el bundle standalone, estáticos, recursos públicos y scripts a una imagen Node Alpine.

Compose levanta:

- `web`, con la aplicación en el puerto interno 3000;
- `whisper`, con FastAPI en el puerto interno 8000 y caché de modelos en el volumen `whisper-cache`.

Antes de desplegar:

1. define un `SESSION_SECRET` aleatorio y largo;
2. configura dominio y HTTPS en el proxy o plataforma;
3. decide si usar Redis y configura `REDIS_URL`;
4. revisa `RESET_DEMO_ON_START`, ya que puede regenerar datos demo al iniciar;
5. configura `WHISPER_MODEL` según CPU y memoria disponibles;
6. restringe el acceso de AGY y del servicio Whisper a red interna;
7. cambia la contraseña inicial del administrador.

## 13. Seguridad y privacidad

### Controles existentes

- contraseñas con `scrypt` y salt;
- sesión en cookie HTTP-only;
- expiración de sesión de 8 horas;
- autorización por rol en backend;
- validación de propuestas con Zod;
- control de revisión optimista;
- validación de camas, pacientes, turnos y tareas;
- auditoría de cambios principales;
- eliminación de UUIDs del texto mostrado por AGY;
- headers `nosniff`, `DENY` y política de referrer en Caddy.

### Riesgos o puntos a reforzar antes de producción

1. `dev-only-change-me-rxlist-session-secret` es un fallback inseguro si no se define `SESSION_SECRET`.
2. Las contraseñas temporales se devuelven en la respuesta y se muestran en pantalla; deben compartirse por un canal controlado y no quedar en logs.
3. `ALLOW_DEMO_LOGIN=true` habilita una contraseña global `1234`; nunca debe activarse en producción.
4. `PUBLIC_DEMO=true` expone datos operativos demo sin autenticación; debe revisarse antes de publicar.
5. La persistencia en JSON no tiene bloqueo transaccional ni historial; Redis es más adecuado para múltiples réplicas.
6. No se observa protección CSRF dedicada para operaciones con cookie; conviene añadir token CSRF u otra estrategia equivalente.
7. No hay rate limiting explícito para login, chat, transcripción o endpoints administrativos.
8. El historial de chat puede contener información clínica; debe tener política de retención y controles de acceso.
9. El prompt de AGY debe considerarse no confiable: la autorización real es la validación del servidor.
10. Caddy está configurado con `:80`; HTTPS debe terminar en Caddy o en la plataforma de despliegue.
11. Hay una discrepancia documental en el texto del prompt: una parte describe turnos 06:00-18:00 y 18:00-06:00, pero las reglas operativas y el código aplican 05:00-17:00 y 17:00-05:00. Debe unificarse.

## 14. Pruebas

La suite actual cubre:

- resolución de alias y movimientos de enfermeras;
- lotes de movimientos;
- rechazo de instrucciones peligrosas;
- aclaraciones por datos faltantes;
- detección de operaciones sin cambio;
- alta determinista de enfermeras;
- manejo de nombres parciales y duplicados;
- consultas locales sin AGY;
- contexto compacto para AGY;
- continuación de alta de paciente.

Resultado observado durante este análisis:

```text
Test Files  4 passed
Tests       21 passed
```

Los tests de AGY intentan ejecutar el binario real. En un entorno restringido pueden generar mensajes de error porque AGY intenta escribir logs o abrir un puerto local; aun así, la suite actual termina pasando por el manejo de error y fallback implementado.

## 15. Flujo de ejemplo: mover una enfermera

1. El doctor escribe: `mueve a Sofía al piso 2`.
2. `routePrompt()` detecta una mutación y la envía a AGY.
3. AGY devuelve una propuesta `update_floor` con `nurseId`, `from` y `to`.
4. El frontend muestra la tarjeta de revisión.
5. El doctor confirma.
6. `POST /api/chat/confirm` comprueba que Sofía siga en el piso indicado en `from`.
7. El servidor cambia el piso, agrega auditoría, incrementa `revision` y guarda.
8. El dashboard se vuelve a cargar.

Si otro usuario ya movió a Sofía, la revisión o el piso esperado no coincidirán y el cambio se rechazará.

## 16. Flujo de ejemplo: registrar paciente y medicamento

1. El doctor solicita el alta del paciente con nombre, fecha, motivo, alergias, contacto y piso.
2. AGY produce `create_patient`.
3. `assignFreeBeds()` encuentra la primera cama libre.
4. El doctor confirma.
5. El servidor valida duplicados y disponibilidad de cama.
6. Se crea el paciente y se audita la operación.
7. El doctor crea un medicamento con `cada 8 horas` o horarios explícitos.
8. `medicationTimes()` normaliza los horarios.
9. Se crea la orden y una tarea por cada horario.
10. `nurseForTask()` asigna las tareas según piso y turno.

## 17. Recomendaciones de evolución

### Prioridad alta

- exigir `SESSION_SECRET` y fallar al arrancar si falta en producción;
- añadir rate limiting, CSRF y validación más estricta de cuerpos JSON;
- separar claramente entorno demo y producción;
- unificar horarios de turnos en código, prompt, UI y documentación;
- usar Redis o una base de datos transaccional para despliegues con varias instancias;
- evitar retornar contraseñas temporales más veces de lo estrictamente necesario.

### Prioridad media

- extraer formularios y modales grandes de las páginas para reducir complejidad;
- crear tipos compartidos para respuestas de API en lugar de varios `any`;
- añadir pruebas de endpoints con store aislado;
- agregar pruebas de concurrencia para `revision` y camas;
- añadir migraciones versionadas en lugar de una migración implícita única;
- registrar métricas de latencia y errores de AGY y Whisper sin incluir datos clínicos.

### Prioridad funcional

- permitir turnos con fechas reales en lugar de `date: "fixed"`;
- soportar cancelación y edición de turnos;
- incorporar historial clínico más completo con permisos específicos;
- añadir exportación controlada de auditoría;
- definir una política formal de retención de pacientes, chat y signos vitales.

## 18. Archivos de referencia

- `README.md`: arranque y prueba rápida.
- `lib/types.ts`: esquema de entidades y plan de operaciones.
- `lib/store.ts`: persistencia y migración.
- `lib/auth.ts`: hashes y JWT.
- `lib/domain.ts`: reglas de dominio.
- `lib/prompt-gateway.ts`: consultas locales y compactación de contexto.
- `lib/agy.ts`: integración, prompt y normalización de AGY.
- `app/api/chat/confirm/route.ts`: validación y aplicación de operaciones.
- `app/api/chat/propose/route.ts`: propuesta, historial y camas automáticas.
- `whisper/main.py`: transcripción.
- `docker-compose.yml`: servicios de despliegue.

## 19. Conclusión

RXList tiene una arquitectura coherente para un MVP: el dominio está separado de las rutas, las operaciones de IA pasan por validación de servidor, existe control optimista y hay cobertura de pruebas para los flujos conversacionales críticos. Antes de tratarlo como sistema clínico de producción, la prioridad debe ser endurecer secretos y acceso, controlar concurrencia y persistencia, cerrar la exposición de demo, formalizar auditoría y resolver la discrepancia de horarios.
