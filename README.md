# RXList

MVP seguro para distribución de enfermería por pisos. El doctor propone movimientos desde el chat; la aplicación valida el alcance, muestra una tarjeta editable y aplica el lote solo después de confirmación y revisión optimista.

## Arranque local

```bash
npm install
cp .env.example .env.local
npm run dev
```

Abre http://localhost:3000. Acceso inicial: `admin@rxlist.local` / `RXList-Admin-2026!`. En producción sustituye la contraseña y `SESSION_SECRET`.

En desarrollo, si `REDIS_URL` no está definido se usa `data/rxlist.json` (no se versiona). En Docker Compose se usa Redis con AOF, Whisper CPU INT8 y Caddy. Antes de exponerlo en un VPS, configura TLS/hostname en Caddy, un secreto aleatorio y el usuario aislado del puente AntiGravity.

## Prueba rápida

1. Entra como admin y crea un doctor.
2. Inicia sesión con sus credenciales.
3. Escribe `mueve a Sofía al piso 2`.
4. Edita el selector si hace falta y confirma.

La aceptación no vuelve a consultar a la IA: `confirm` valida el plan guardado en la tarjeta y el `revision` antes de aplicar operaciones y auditoría.
