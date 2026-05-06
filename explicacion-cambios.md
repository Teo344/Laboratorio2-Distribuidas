# Explicacion de cambios aplicados para el Laboratorio 2

Este documento describe los cambios realizados para transformar el chat grupal inicial en una aplicacion de mensajeria privada en tiempo real con Flask, Flask-SocketIO, Web Components, salas privadas, mensajes temporales y confirmaciones de lectura.

## 1. Cambio de enfoque

El proyecto original funcionaba como un chat grupal global. Todos los usuarios conectados compartian la misma conversacion.

El laboratorio solicita un sistema mas cercano a Signal, por lo que se aplicaron estos cambios:

- Ingreso con usuario y sala privada.
- Mensajes enviados solo a usuarios de la misma sala.
- Mensajes temporales con TTL.
- Confirmaciones de lectura al emisor original.
- Eliminacion de historial persistente de mensajes.
- Interfaz minima enfocada en privacidad.

## 2. Cambios en `app.py`

### Salas privadas

Se importaron funciones de Flask-SocketIO:

```python
from flask_socketio import SocketIO, emit, join_room, leave_room
```

Ahora el servidor usa `join_room(room)` y `leave_room(room)` para separar conversaciones.

Antes el servidor guardaba:

```python
usuarios[request.sid] = username
```

Ahora guarda:

```python
usuarios[request.sid] = {
    'username': username,
    'room': room,
}
```

Esto permite saber en que sala esta cada cliente.

### Evento `join_private_room`

Se reemplazo el ingreso simple por un ingreso privado:

```python
@socketio.on('join_private_room')
def handle_join_private_room(data):
```

El cliente debe enviar:

```json
{
  "username": "Ana",
  "room": "sala1"
}
```

El servidor valida que ambos campos existan, une el socket a la sala y actualiza la lista de usuarios de esa sala.

### Mensajes privados

El evento de mensajes ahora es:

```python
@socketio.on('private_message')
def handle_private_message(data):
```

Cada mensaje incluye:

- `messageId`
- `message`
- `timestamp`
- `ttl`

El servidor valida que el usuario este registrado y que el TTL sea permitido:

```python
TTL_PERMITIDOS = {10, 60, 300}
```

Luego retransmite el mensaje solo a la sala:

```python
emit('private_message', {...}, room=room)
```

### Metadatos temporales

El servidor no guarda historial de mensajes. Solo guarda metadatos temporales para poder enviar confirmaciones de lectura:

```python
mensajes_activos[message_id] = {
    'sender_sid': request.sid,
    'room': room,
    'ttl': ttl,
    'read_by': set(),
}
```

No se guarda el texto del mensaje.

El TTL no se activa al enviar el mensaje. Se activa cuando el receptor emite `message_read`. En ese momento se programa la eliminacion del metadato:

```python
socketio.start_background_task(
    lambda: (socketio.sleep(ttl), olvidar_mensaje(message_id))
)
```

### Confirmacion de lectura

Se agrego:

```python
@socketio.on('message_read')
def handle_message_read(data):
```

Cuando un receptor lee un mensaje, el servidor busca el emisor original y le envia:

```python
emit('message_read', {
    'messageId': message_id,
    'reader': sesion['username'],
    'ttl': metadata['ttl'],
    'expiresAt': expires_at,
}, to=metadata['sender_sid'])
```

La confirmacion no se envia a toda la sala, solo al emisor.

### Salida de sala

El evento `leave_chat` ahora saca al usuario de su sala:

```python
leave_room(room)
```

Luego actualiza la lista de conectados de esa sala.

## 3. Cambios en `static/chat-app.js`

### Web Component

La interfaz sigue implementada como Web Component:

```javascript
class ChatApp extends HTMLElement
customElements.define('chat-app', ChatApp);
```

El componente usa Shadow DOM para encapsular HTML, CSS y comportamiento:

```javascript
this.attachShadow({ mode: 'open' });
```

### Pantalla de ingreso privada

El formulario ahora pide:

- Nombre de usuario.
- Codigo de sala.

El cliente emite:

```javascript
this.socket.emit('join_private_room', {
    username: this.username,
    room: this.room
});
```

### Selector de TTL

El formulario de mensajes incluye un selector:

```html
<select data-ttl-select>
    <option value="10">10s</option>
    <option value="60">1min</option>
    <option value="300">5min</option>
</select>
```

Al enviar, el cliente incluye el TTL:

```javascript
ttl: Number(this.ttlSelect.value)
```

### IDs unicos por mensaje

Cada mensaje se envia con:

```javascript
messageId: crypto.randomUUID()
```

Ese ID sirve para:

- Identificar el mensaje en la interfaz.
- Asociar confirmaciones de lectura.
- Eliminar el mensaje correcto al expirar.

### Cuenta regresiva

Cuando llega un mensaje, se renderiza una burbuja, pero el temporizador no empieza inmediatamente. El mensaje queda esperando lectura.

En el receptor, despues de renderizar y marcar el mensaje como leido, se inicia:

```javascript
this.startExpirationTimer(data.messageId, Number(data.ttl));
```

En el emisor, el temporizador inicia cuando recibe el evento `message_read`.

Cada segundo se actualiza el texto y una barra de progreso:

```text
Se elimina en 10s
```

Cuando llega a cero, el mensaje se elimina del DOM.

### Confirmacion de lectura

Cuando el cliente recibe un mensaje que no es suyo:

```javascript
this.socket.emit('message_read', { messageId: data.messageId });
```

Cuando el emisor recibe la confirmacion:

```javascript
this.markMessageAsRead(data.messageId, data.reader);
```

El estado visual ya no usa texto. Cambia de un icono de palomita simple a un icono de doble palomita verde:

```text
palomita simple -> doble palomita verde
```

### Privacidad en `localStorage`

Antes existia historial local. Para cumplir mejor con el laboratorio, ya no se guardan mensajes en `localStorage`.

Ahora solo se guardan:

```javascript
chat.username
chat.room
```

Esto permite restaurar la sesion al refrescar, sin conservar contenido de mensajes.

## 4. Cambios en `templates/index.html`

El HTML principal carga:

```html
<script src="{{ url_for('socketio_client') }}"></script>
<script type="module" src="{{ url_for('static', filename='chat-app.js') }}"></script>
```

Luego usa el componente:

```html
<chat-app></chat-app>
```

La interfaz vive dentro del Web Component.

## 5. Eventos Socket.IO actuales

```text
connect
join_private_room
joined_private_room
join_error
room_user_list
user_joined
user_left
private_message
message_read
leave_chat
disconnect
```

## 6. Flujo final

```text
1. Usuario abre la pagina.
2. Cliente conecta con Socket.IO.
3. Usuario ingresa nombre y sala.
4. Cliente emite join_private_room.
5. Servidor une el socket a la sala.
6. Servidor envia lista de usuarios de esa sala.
7. Usuario envia mensaje con TTL.
8. Servidor retransmite solo a esa sala.
9. Clientes renderizan el mensaje sin iniciar todavia el TTL.
10. Receptor emite message_read.
11. Servidor envia confirmacion solo al emisor.
12. Receptor y emisor inician la cuenta regresiva.
13. Al terminar el TTL contado desde lectura, cada cliente elimina el mensaje.
14. Servidor elimina metadatos temporales del mensaje.
```

## 7. Verificaciones realizadas

Se verifico:

- Sintaxis JavaScript con `node --check static/chat-app.js`.
- Entrada de usuarios a salas distintas.
- Aislamiento de mensajes por sala.
- Confirmacion de lectura al emisor original.
- Salida de sala.
- Bloqueo de mensajes despues de salir.

## 8. Resultado

El proyecto quedo adaptado al Laboratorio 2:

- Mensajeria privada por sala.
- Mensajes temporales.
- Read receipts.
- Sin historial de mensajes en servidor.
- Cliente web con Web Components.
- Interfaz minima y enfocada en privacidad.
