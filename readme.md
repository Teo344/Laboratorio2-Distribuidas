# Laboratorio 2: Mensajeria privada en tiempo real

**Estudiantes:** Mateo Criollo - Eduardo García - Mateo Iza 
**Fecha:** 06/05/2026

## Descripcion

Aplicacion de mensajeria privada en tiempo real desarrollada con Flask, Flask-SocketIO y Web Components. El proyecto implementa salas privadas, mensajes temporales con TTL, confirmaciones de lectura y una interfaz web minima enfocada en privacidad.

El servidor no guarda historial de mensajes en disco ni base de datos. Solo mantiene sesiones activas y metadatos temporales necesarios para enrutar confirmaciones de lectura.

## Funcionalidades implementadas

- Ingreso obligatorio con nombre de usuario y codigo de sala privada.
- Mensajes en tiempo real solo entre usuarios de la misma sala.
- Lista de usuarios conectados filtrada por sala.
- Mensajes temporales con TTL configurable: 10 segundos, 1 minuto o 5 minutos.
- Cuenta regresiva visible en cada burbuja de mensaje despues de ser marcado como leido.
- Eliminacion automatica de mensajes en el cliente al finalizar el TTL contado desde la lectura.
- Confirmacion de lectura enviada solo al emisor original del mensaje, representada con palomitas visuales.
- Boton para salir de la sala privada.
- Restauracion de usuario y sala mediante `localStorage`.
- No persistencia de contenido de mensajes en el servidor.

## Requisitos

- Python 3.10 o superior.
- Node.js y npm.
- Navegador moderno compatible con Web Components.

## Instalacion

Crear y activar entorno virtual:

```powershell
python -m venv venv
venv\Scripts\Activate.ps1
```

Instalar dependencias de Python:

```powershell
pip install -r requirements.txt
```

Instalar dependencias de Node.js:

```powershell
npm install
```

## Ejecucion

Iniciar el servidor:

```powershell
python app.py
```

Abrir en el navegador:

```text
http://localhost:5000
```

Para probar las salas privadas, abrir dos pestanas o dos navegadores e ingresar con diferentes usuarios pero el mismo codigo de sala.

Tambien se puede probar desde consola con Node.js:

```powershell
node client.js
```

El cliente de consola usa el mismo protocolo: usuario, sala privada, mensajes temporales y confirmaciones de lectura.

## Uso de la aplicacion

1. Ingresar un nombre de usuario.
2. Ingresar un codigo de sala privada.
3. Presionar `Entrar`.
4. Elegir el TTL del mensaje: `10s`, `1min` o `5min`.
5. Escribir y enviar mensajes.
6. Observar la cuenta regresiva y el indicador de lectura.
7. Presionar `Salir` para abandonar la sala.

## Arquitectura

El proyecto usa una arquitectura cliente-servidor en tiempo real:

```text
Navegador
  |
  | Socket.IO events
  v
Flask + Flask-SocketIO
  |
  | retransmision por sala
  v
Otros clientes en la misma sala
```

## Archivos principales

```text
websockets/
|-- app.py
|-- templates/
|   `-- index.html
|-- static/
|   `-- chat-app.js
|-- requirements.txt
|-- package.json
|-- package-lock.json
`-- readme.md
```

## Servidor: `app.py`

El servidor crea la aplicacion Flask y habilita Socket.IO:

```python
socketio = SocketIO(app, cors_allowed_origins="*", async_mode="threading")
```

Se usa `threading` para evitar depender de `eventlet` y permitir el uso de `simple-websocket` en desarrollo.

El servidor conserva dos estructuras en memoria:

```python
usuarios = {}
mensajes_activos = {}
```

`usuarios` almacena sesiones activas:

```python
{
    sid: {
        "username": "Ana",
        "room": "sala1"
    }
}
```

`mensajes_activos` almacena solo metadatos temporales:

```python
{
    message_id: {
        "sender_sid": "...",
        "room": "sala1",
        "ttl": 60,
        "read_by": set()
    }
}
```

No se guarda el contenido del mensaje en esta estructura.

## Cliente web: `static/chat-app.js`

El cliente esta construido como Web Component nativo:

```javascript
class ChatApp extends HTMLElement
```

El componente se registra con:

```javascript
customElements.define('chat-app', ChatApp);
```

En `templates/index.html` se usa como una etiqueta normal:

```html
<chat-app></chat-app>
```

El componente usa Shadow DOM:

```javascript
this.attachShadow({ mode: 'open' });
```

Esto encapsula la interfaz y los estilos del chat.

## Eventos Socket.IO utilizados

| Evento | Direccion | Proposito |
|---|---|---|
| `connect` | Cliente -> Servidor | Abre conexion Socket.IO. |
| `join_private_room` | Cliente -> Servidor | Entra con usuario y sala privada. |
| `joined_private_room` | Servidor -> Cliente | Confirma entrada a la sala. |
| `join_error` | Servidor -> Cliente | Informa errores de ingreso. |
| `room_user_list` | Servidor -> Cliente | Envia usuarios conectados en la sala actual. |
| `user_joined` | Servidor -> Cliente | Avisa que un usuario entro a la sala. |
| `user_left` | Servidor -> Cliente | Avisa que un usuario salio de la sala. |
| `private_message` | Cliente <-> Servidor | Envia y retransmite mensajes privados por sala. |
| `message_read` | Cliente <-> Servidor | Confirma lectura al emisor original. |
| `leave_chat` | Cliente -> Servidor | Sale de la sala privada. |
| `disconnect` | Cliente -> Servidor | Limpia la sesion al cerrar o refrescar. |

## Flujo de eventos

```text
1. Cliente abre la pagina
2. Cliente conecta con Socket.IO
3. Cliente emite join_private_room
4. Servidor ejecuta join_room(room)
5. Servidor emite room_user_list
6. Cliente emite private_message
7. Servidor retransmite private_message solo a esa sala
8. Receptor renderiza el mensaje como leido
9. Receptor emite message_read
10. Servidor envia message_read solo al emisor original
11. Receptor y emisor inician la cuenta regresiva
12. Cada cliente elimina el mensaje al finalizar su TTL contado desde la lectura
```

## Mensajes temporales

Cada mensaje incluye un TTL:

```javascript
{
    messageId: crypto.randomUUID(),
    message: "Hola",
    timestamp: "10:30:00",
    ttl: 60
}
```

Los TTL permitidos son:

```text
10 segundos
60 segundos
300 segundos
```

El TTL no empieza cuando el mensaje se envia. El mensaje queda visible como pendiente hasta que el receptor lo visualiza y se emite `message_read`.

Cuando el cliente receptor marca el mensaje como leido, inicia su cuenta regresiva local con `setInterval`. Cuando el emisor recibe `message_read`, tambien inicia la cuenta regresiva para su copia del mensaje. Al llegar a cero, la burbuja se elimina del DOM.

El servidor elimina los metadatos temporales del mensaje despues de recibir la confirmacion de lectura:

```python
socketio.start_background_task(
    lambda: (socketio.sleep(ttl), olvidar_mensaje(message_id))
)
```

## Confirmacion de lectura

Cada mensaje tiene un `messageId`. Cuando un receptor visualiza el mensaje, emite:

```javascript
this.socket.emit('message_read', { messageId: data.messageId });
```

El servidor busca el emisor original en `mensajes_activos` y envia la confirmacion solamente a ese socket:

```python
emit('message_read', {
    'messageId': message_id,
    'reader': sesion['username'],
    'ttl': metadata['ttl'],
    'expiresAt': expires_at,
}, to=metadata['sender_sid'])
```

En el cliente del emisor se actualiza el indicador visual con iconos:

```text
palomita simple -> doble palomita verde
```

La duracion del mensaje se muestra como una etiqueta de estado y una barra de progreso. Antes de la lectura, la interfaz indica que el TTL iniciara cuando el mensaje sea leido. Despues de la lectura, cambia a `Se elimina en ...` y la barra se reduce hasta que el mensaje desaparece.

## Privacidad

La aplicacion aplica privacidad basica de las siguientes maneras:

- No se permite entrar sin usuario y sala.
- Los mensajes se envian solo a usuarios de la misma sala.
- El servidor no guarda historial de mensajes.
- El servidor solo conserva metadatos temporales para read receipts.
- Los mensajes desaparecen automaticamente del cliente.
- `localStorage` solo guarda usuario y sala, no guarda mensajes.

## Limitaciones

- No hay autenticacion real de usuarios.
- No hay cifrado extremo a extremo.
- Los mensajes desaparecen visualmente del cliente, pero no se implementa borrado remoto verificable.
- Las confirmaciones de lectura se emiten cuando el mensaje se renderiza en pantalla.
- La memoria del servidor se pierde al reiniciar la aplicacion.

## Posibles mejoras

- Agregar autenticacion.
- Implementar cifrado de mensajes en cliente.
- Crear salas con contrasena.
- Agregar indicador de escritura.
- Agregar pruebas automatizadas.
- Agregar capturas de pantalla al README.
