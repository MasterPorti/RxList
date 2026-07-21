# Puente aislado de AntiGravity

Este servicio se ejecuta con un usuario dedicado, sin montar el código, secretos, socket Docker ni Redis. La aplicación web debe enviar únicamente el mensaje del doctor, enfermeras de ese doctor y pisos válidos.

Configura `AGY_BIN` y autentica manualmente en el entorno aislado (`agy --help`, `agy models`). La ejecución debe usar argumentos, nunca `shell=True`; la salida se valida con el esquema `Plan` antes de regresar a la aplicación. Si AntiGravity no está autenticado, el proveedor local devuelve una aclaración y no muta datos.
