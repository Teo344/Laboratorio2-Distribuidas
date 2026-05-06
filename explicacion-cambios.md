# Explicacion de los cambios del chat con Flask-SocketIO y Web Components

Este documento resume el proceso de correccion y mejora del proyecto de chat. La aplicacion quedo compuesta por un servidor Flask con Flask-SocketIO y un cliente web hecho con Web Components nativos.

## 1. Problema inicial

El servicio tenia varios problemas:

- El servidor no arrancaba correctamente con la configuracion anterior.
- El cliente web intentaba cargar Socket.IO desde `/socket.io/socket.io.js`, lo que provocaba un error `400`.
- No existia una opcion para salir del chat desde la interfaz.
- Al refrescar el navegador se perdia el usuario y el historial visual.
- El diseno era funcional, pero podia hacerse mas minimalista y enfocado al chat.

## 2. Cambios en dependencias

En `requirements.txt` se reemplazo `eventlet` por `simple-websocket`.

Antes:

```text
eventlet==0.33.3
```

Ahora:

```text
simple-websocket>=1.0.0
```

Esto se hizo porque el entorno usa Python 3.14 y `eventlet` presentaba problemas de compatibilidad. Para desarrollo local, `simple-websocket` junto con el modo `threading` funciona correctamente.

## 3. Cambios en el servidor Flask

El servidor esta en `app.py`.

La aplicacion Flask se crea asi:

```python
app = Flask(__name__)
app.config['SECRET_KEY'] = 'tu_clave_secreta_aqui'
CORS(app)
```

Despues se inicializa Socket.IO:

```python
socketio = SocketIO(app, cors_allowed_origins="*", async_mode="threading")
```

El cambio importante es `async_mode="threading"`. Esto evita depender de `eventlet` y permite que el servidor funcione en el entorno actual.

## 4. Ruta principal

La ruta `/` entrega la interfaz web:

```python
@app.route('/')
def index():
    return render_template('index.html')
```

Cuando el usuario abre:

```text
http://localhost:5000
```

Flask responde con `templates/index.html`.

## 5. Correccion del cliente Socket.IO en el navegador

El navegador necesita cargar la libreria cliente de Socket.IO para poder usar la funcion global `io()`.

Inicialmente se usaba:

```html
<script src="/socket.io/socket.io.js"></script>
```

Esto causo el error:

```text
The client is using an unsupported version of the Socket.IO or Engine.IO protocols
```

El motivo es que, en Flask-SocketIO, `/socket.io/...` no es una ruta para servir archivos JavaScript. Esa ruta pertenece al protocolo interno de Socket.IO.

Para solucionarlo, se agrego esta ruta en `app.py`:

```python
@app.route('/vendor/socket.io.min.js')
def socketio_client():
    return send_from_directory(
        'node_modules/socket.io-client/dist',
        'socket.io.min.js',
    )
```

Y en `templates/index.html` ahora se carga asi:

```html
<script src="{{ url_for('socketio_client') }}"></script>
```

De esta manera el navegador carga correctamente el cliente Socket.IO desde `node_modules`.

## 6. Eventos Socket.IO del servidor

El servidor guarda los usuarios conectados en memoria:

```python
usuarios = {}
```

La clave es `request.sid`, que identifica una conexion Socket.IO. El valor es el nombre del usuario.

Ejemplo conceptual:

```python
{
    "id_de_socket_1": "Ana",
    "id_de_socket_2": "Luis"
}
```

## 7. Conexion de clientes

Cuando un cliente abre la conexion:

```python
@socketio.on('connect')
def handle_connect():
    print(f'Cliente conectado: {request.sid}')
```

Aqui todavia no se guarda usuario, porque el navegador primero debe enviar el nombre.

## 8. Registro de nombre

Cuando el cliente envia su nombre:

```python
@socketio.on('set_username')
def handle_set_username(data):
    username = str(data.get('username', '')).strip() or 'Anonimo'
    usuarios[request.sid] = username

    emit('user_joined', {'username': username}, broadcast=True, include_self=False)
    emit('user_list', list(usuarios.values()), broadcast=True)
```

Este evento hace tres cosas:

1. Limpia el nombre recibido.
2. Guarda el usuario asociado al `request.sid`.
3. Notifica a los demas usuarios y actualiza la lista de conectados.

## 9. Envio de mensajes

Cuando un usuario manda un mensaje:

```python
@socketio.on('chat_message')
def handle_chat_message(data):
    username = usuarios.get(request.sid)
    mensaje = str(data.get('message', '')).strip()

    if not username or not mensaje:
        return

    emit('chat_message', {
        'username': username,
        'message': mensaje,
        'timestamp': data.get('timestamp', '')
    }, broadcast=True)
```

El servidor valida que:

- El usuario este registrado.
- El mensaje no este vacio.

Si todo esta bien, retransmite el mensaje a todos los clientes conectados.

## 10. Salida manual del chat

Se agrego un evento nuevo:

```python
@socketio.on('leave_chat')
def handle_leave_chat():
    username = usuarios.pop(request.sid, None)

    if not username:
        return

    emit('user_left', {'username': username}, broadcast=True, include_self=False)
    emit('user_list', list(usuarios.values()), broadcast=True)
```

Este evento permite salir del chat sin cerrar la pagina. El servidor elimina al usuario de la lista y avisa a los demas clientes.

## 11. Desconexion

Si el usuario cierra la pestana, refresca la pagina o pierde conexion:

```python
@socketio.on('disconnect')
def handle_disconnect():
    username = usuarios.pop(request.sid, None)
    print(f'Cliente desconectado: {request.sid} ({username})')

    if username:
        emit('user_left', {'username': username}, broadcast=True)
        emit('user_list', list(usuarios.values()), broadcast=True)
```

Esto limpia el usuario del diccionario `usuarios`.

## 12. HTML principal

El archivo `templates/index.html` quedo muy simple:

```html
<!doctype html>
<html lang="es">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Chat con WebSockets</title>
    <script src="{{ url_for('socketio_client') }}"></script>
    <script type="module" src="{{ url_for('static', filename='chat-app.js') }}"></script>
</head>
<body>
    <chat-app></chat-app>
</body>
</html>
```

La pagina solo carga:

- El cliente Socket.IO.
- El modulo JavaScript del Web Component.
- La etiqueta personalizada `<chat-app>`.

## 13. Que es el Web Component

El cliente web esta en `static/chat-app.js`.

Se usa un Web Component para encapsular toda la interfaz y comportamiento del chat dentro de una etiqueta personalizada:

```html
<chat-app></chat-app>
```

En JavaScript se registra asi:

```javascript
customElements.define('chat-app', ChatApp);
```

La clase principal es:

```javascript
class ChatApp extends HTMLElement {
```

Esto le dice al navegador que `ChatApp` es un elemento HTML personalizado.

## 14. Template y Shadow DOM

El componente crea una plantilla:

```javascript
const template = document.createElement('template');
template.innerHTML = `...`;
```

Dentro de esa plantilla estan:

- Los estilos CSS.
- El panel de mensajes.
- El formulario de envio.
- El formulario de usuario.
- La lista de conectados.
- El boton `Salir`.
- El boton `Limpiar historial`.

En el constructor se crea el Shadow DOM:

```javascript
this.attachShadow({ mode: 'open' });
this.shadowRoot.appendChild(template.content.cloneNode(true));
```

El Shadow DOM encapsula el componente. Sus estilos viven dentro del componente y no se mezclan con CSS externo.

## 15. Estado interno del componente

El componente guarda referencias importantes:

```javascript
this.socket = null;
this.username = this.loadStoredUsername();
this.messages = this.shadowRoot.querySelector('[data-messages]');
this.users = this.shadowRoot.querySelector('[data-users]');
this.usernameInput = this.shadowRoot.querySelector('[data-username-input]');
this.leaveButton = this.shadowRoot.querySelector('[data-leave-button]');
```

Esto permite manipular la interfaz sin buscar elementos repetidamente.

## 16. Ciclo de vida del componente

Cuando el componente aparece en pantalla, se ejecuta:

```javascript
connectedCallback() {
    this.usernameForm.addEventListener('submit', this.handleUsernameSubmit);
    this.messageForm.addEventListener('submit', this.handleMessageSubmit);
    this.leaveButton.addEventListener('click', this.handleLeaveClick);
    this.clearHistoryButton.addEventListener('click', this.handleClearHistoryClick);
    this.renderStoredHistory();
    this.connectSocket();
}
```

Aqui se conectan los eventos de la interfaz, se restaura el historial local y se abre la conexion Socket.IO.

Cuando el componente se retira de la pagina, se ejecuta:

```javascript
disconnectedCallback()
```

Alli se eliminan los listeners y se desconecta el socket.

## 17. Entrada al chat desde el navegador

Cuando el usuario escribe su nombre y presiona `Entrar`, se ejecuta:

```javascript
handleUsernameSubmit = (event) => {
    event.preventDefault();

    const username = this.usernameInput.value.trim();
    if (!username || !this.socket?.connected) {
        return;
    }

    this.username = username;
    this.saveStoredUsername(username);
    this.socket.emit('set_username', { username });
    this.setChatActive(true);
    this.messageInput.focus();
    this.addNotice(`Bienvenido, ${username}`);
};
```

Este proceso:

1. Evita que el formulario recargue la pagina.
2. Toma el nombre del input.
3. Guarda el nombre en memoria.
4. Guarda el nombre en `localStorage`.
5. Envia el evento `set_username` al servidor.
6. Activa el formulario de mensajes.

## 18. Envio de mensajes desde el navegador

Cuando el usuario envia un mensaje:

```javascript
handleMessageSubmit = (event) => {
    event.preventDefault();

    const message = this.messageInput.value.trim();
    if (!message || !this.username || !this.socket?.connected) {
        return;
    }

    this.socket.emit('chat_message', {
        message,
        timestamp: new Date().toLocaleTimeString()
    });
    this.messageInput.value = '';
    this.messageInput.focus();
};
```

El mensaje no se pinta directamente al enviarlo. Primero se manda al servidor. Luego el servidor lo retransmite y el cliente lo recibe por el evento `chat_message`.

Esto mantiene el mismo flujo para todos los clientes.

## 19. Conexion Socket.IO en el cliente

El metodo `connectSocket()` crea la conexion:

```javascript
this.socket = io({
    transports: ['websocket', 'polling']
});
```

Luego registra eventos:

```javascript
this.socket.on('connect', () => { ... });
this.socket.on('disconnect', () => { ... });
this.socket.on('user_joined', (data) => { ... });
this.socket.on('user_left', (data) => { ... });
this.socket.on('user_list', (users) => { ... });
this.socket.on('chat_message', (data) => { ... });
```

Estos eventos mantienen sincronizada la interfaz con el servidor.

## 20. Restauracion al refrescar

Al refrescar el navegador, la conexion anterior se pierde. Eso es normal.

Para mejorar la experiencia, se guarda el nombre en `localStorage`:

```javascript
const STORAGE_KEYS = {
    username: 'chat.username',
    history: 'chat.history'
};
```

Cuando el componente se crea:

```javascript
this.username = this.loadStoredUsername();
this.usernameInput.value = this.username;
```

Cuando Socket.IO conecta:

```javascript
if (this.username) {
    this.socket.emit('set_username', { username: this.username });
    this.setChatActive(true);
    this.addNotice(`Sesion restaurada como ${this.username}`);
}
```

Asi, si el usuario refresca la pagina, el navegador vuelve a registrarse automaticamente con el nombre guardado.

## 21. Historial local

El historial se guarda en el navegador usando `localStorage`.

La cantidad maxima de mensajes guardados es:

```javascript
const MAX_STORED_MESSAGES = 100;
```

Cuando llega un mensaje, se pinta con `addMessage()` y se guarda:

```javascript
if (options.persist !== false) {
    this.rememberMessage(data);
}
```

El metodo `rememberMessage()` agrega el mensaje al historial:

```javascript
rememberMessage(data) {
    const history = this.loadStoredHistory();
    history.push({
        username: data.username || 'Desconocido',
        message: data.message || '',
        timestamp: data.timestamp || ''
    });
    this.saveStoredHistory(history.slice(-MAX_STORED_MESSAGES));
}
```

El uso de `slice(-MAX_STORED_MESSAGES)` evita guardar mensajes infinitamente.

## 22. Limpiar historial

Se agrego el boton:

```html
<button class="secondary" type="button" data-clear-history-button>Limpiar historial</button>
```

Cuando se presiona:

```javascript
handleClearHistoryClick = () => {
    this.saveStoredHistory([]);
    this.messages.replaceChildren();
    this.addNotice('Historial local limpiado');
};
```

Esto borra el historial guardado y limpia la pantalla de mensajes.

## 23. Salir del chat desde el cliente web

El boton:

```html
<button class="secondary" type="button" data-leave-button disabled>Salir</button>
```

ejecuta:

```javascript
handleLeaveClick = () => {
    if (!this.username || !this.socket?.connected) {
        return;
    }

    const username = this.username;
    this.socket.emit('leave_chat');
    this.username = '';
    this.removeStoredUsername();
    this.setChatActive(false);
    this.users.replaceChildren();
    this.addNotice(`${username} salio del chat`);
    this.usernameInput.focus();
};
```

Esto:

1. Envia `leave_chat` al servidor.
2. Borra el usuario en memoria.
3. Borra el usuario guardado en `localStorage`.
4. Desactiva el chat.
5. Limpia la lista local de conectados.
6. Permite volver a entrar con otro nombre.

## 24. Control de estado visual

El metodo `setChatActive()` centraliza la activacion y desactivacion de controles:

```javascript
setChatActive(isActive, options = {}) {
    if (!isActive && !options.keepUsername) {
        this.usernameInput.value = '';
    }

    this.usernameInput.disabled = isActive;
    this.usernameButton.disabled = isActive || !this.socket?.connected;
    this.leaveButton.disabled = !isActive;
    this.messageInput.disabled = !isActive;
    this.messageButton.disabled = !isActive;
}
```

Esto evita repetir logica en varios lugares.

## 25. Diseno minimalista

El diseno se definio dentro del Web Component, en el bloque `<style>`.

Se aplicaron estos criterios:

- Fondo claro y neutro.
- Paneles blancos con borde suave.
- Menos sombras.
- Mensajes propios alineados a la derecha.
- Mensajes ajenos alineados a la izquierda.
- Punto visual para estado conectado/desconectado.
- Sidebar simple con usuario, acciones y conectados.
- Vista responsive para pantallas pequenas.

## 26. Flujo completo actual

El flujo final es:

1. El usuario abre `http://localhost:5000`.
2. Flask entrega `index.html`.
3. El HTML carga el cliente Socket.IO desde `/vendor/socket.io.min.js`.
4. El HTML carga `static/chat-app.js`.
5. El navegador registra el Web Component `<chat-app>`.
6. El componente crea su Shadow DOM.
7. El componente restaura nombre e historial desde `localStorage`.
8. El componente abre conexion Socket.IO.
9. Si habia usuario guardado, se registra automaticamente.
10. El servidor guarda el usuario en `usuarios`.
11. El servidor emite la lista de conectados.
12. El usuario envia mensajes.
13. El servidor retransmite los mensajes.
14. El cliente pinta mensajes y guarda historial local.
15. Si el usuario refresca, se restaura el nombre y el historial local.
16. Si el usuario presiona `Salir`, se elimina del servidor y se borra el usuario guardado.

## 27. Limitaciones actuales

El historial actual es local por navegador. Esto significa:

- No se comparte entre usuarios.
- No se conserva si se borran los datos del navegador.
- No se conserva entre distintos navegadores o dispositivos.
- No sobrevive como historial global si se reinicia el servidor.

Para un chat mas avanzado, se podria agregar:

- Historial en memoria del servidor.
- Persistencia en una base de datos.
- Salas de chat.
- Autenticacion real de usuarios.
- Confirmacion de entrega de mensajes.
- Indicador de escritura.

## 28. Resumen

El proyecto paso de ser un chat basico con problemas de arranque y carga del cliente Socket.IO a una aplicacion mas estable y completa:

- Servidor Flask-SocketIO funcionando en modo `threading`.
- Cliente Socket.IO cargado correctamente desde una ruta Flask.
- Web Component nativo para encapsular interfaz, estilos y comportamiento.
- Boton para salir del chat.
- Diseno mas minimalista.
- Restauracion de nombre con `localStorage`.
- Historial local limitado a 100 mensajes.
- Boton para limpiar historial.

La arquitectura actual es simple, entendible y adecuada para una practica de WebSockets/Socket.IO con Flask y cliente web moderno.
