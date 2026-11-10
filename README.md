# Células Voraces — MVP multijugador

Este repositorio contiene el prototipo Canvas y un servidor Node.js con WebSocket.

## Ejecutar localmente

```bash
npm install
npm start
```

Abrir `http://localhost:10000/`. En el menú, deja vacío el código para crear una sala o escribe el mismo código en dos navegadores para entrar a la misma sala.

## Despliegue en Render

Crear un **Web Service** conectado a este repositorio de GitHub. Render puede usar el `render.yaml` incluido:

- Build command: `npm install`
- Start command: `npm start`
- Health check: `/health`

El cliente se conecta automáticamente a `wss://<tu-servicio>.onrender.com/ws` cuando la página se abre desde Render.

## Estado del MVP

La sala, la conexión WebSocket, el código de acceso, la reconexión básica y la presencia visual de jugadores están implementados. La física todavía se ejecuta en el cliente; el siguiente paso es trasladar el tick de simulación, colisiones y validación de acciones al servidor para que sea autoritativo.
