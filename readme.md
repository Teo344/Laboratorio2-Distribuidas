# Chat usando WebSockets

Este proyecto crea un chat en tiempo real con:

- **Flask**: servidor web en Python.
- **Flask-SocketIO**: comunicacion en tiempo real entre servidor y clientes.
- **Web Components**: cliente web nativo usando el componente `<chat-app>`.
- **Socket.IO**: protocolo usado por el navegador y el servidor para enviar eventos.

## 1. Crear y activar el entorno virtual

```powershell
python -m venv venv
venv\Scripts\Activate.ps1
```

Si usas CMD:

```cmd
venv\Scripts\activate.bat
```

## 2. Instalar dependencias de Python

```powershell
pip install -r requirements.txt
```

Las dependencias principales son:

- `Flask`: crea el servidor web.
- `Flask-SocketIO`: agrega soporte para eventos WebSocket/Socket.IO.
- `simple-websocket`: soporte WebSocket compatible con el modo de desarrollo.
- `Flask-Cors`: permite conexiones desde otros origenes durante desarrollo.

## 3. Ejecutar el servidor

```powershell
python app.py
```

Luego abre el navegador en:

```text
http://localhost:5000
```

Para probar el chat abre dos pestanas del navegador, entra con nombres distintos y envia mensajes.

## 4. Estructura del proyecto

```text
websockets/
|-- app.py
|-- templates/
|   `-- index.html
|-- static/
|   `-- chat-app.js
|-- client.js
|-- requirements.txt
|-- package.json
`-- readme.md
```

## 5. Que realiza cada archivo

### `app.py`

Es el servidor principal.

```python
app = Flask(__name__)
socketio = SocketIO(app, cors_allowed_origins="*", async_mode="threading")
usuarios = {}
```

Esta seccion crea la aplicacion Flask, activa Socket.IO y guarda en memoria los usuarios conectados.

```python
@app.route('/')
def index():
    return render_template('index.html')
```

Cuando visitas `http://localhost:5000`, Flask entrega el archivo `templates/index.html`.

```python
@socketio.on('connect')
def handle_connect():
    print(f'Cliente conectado: {request.sid}')
```

Se ejecuta cuando un navegador se conecta al servidor.

```python
@socketio.on('set_username')
def handle_set_username(data):
    username = data.get('username', 'Anonimo')
    usuarios[request.sid] = username
```

Recibe el nombre enviado desde el cliente web y lo asocia con el id de sesion del navegador.

```python
@socketio.on('chat_message')
def handle_chat_message(data):
    emit('chat_message', {...}, broadcast=True)
```

Recibe un mensaje de un usuario y lo reenvia a todos los clientes conectados.

```python
@socketio.on('disconnect')
def handle_disconnect():
    usuarios.pop(request.sid, 'Alguien')
```

Se ejecuta cuando un cliente cierra la pestana o pierde la conexion. Tambien actualiza la lista de conectados.

### `templates/index.html`

Es la pagina HTML que carga el chat.

```html
<script src="/socket.io/socket.io.js"></script>
```

Carga el cliente JavaScript de Socket.IO servido por Flask-SocketIO.

```html
<script type="module" src="{{ url_for('static', filename='chat-app.js') }}"></script>
```

Carga el componente web desde la carpeta `static`.

```html
<chat-app></chat-app>
```

Inserta el componente personalizado que contiene toda la interfaz del chat.

### `static/chat-app.js`

Es el cliente web construido con Web Components.

```javascript
const template = document.createElement('template');
```

Define una plantilla HTML y CSS reutilizable para el componente.

```javascript
class ChatApp extends HTMLElement {
```

Crea una nueva etiqueta HTML personalizada llamada `<chat-app>`.

```javascript
this.attachShadow({ mode: 'open' });
```

Usa Shadow DOM para encapsular estilos y estructura. Esto evita que el CSS del componente choque con otros estilos de la pagina.

```javascript
connectedCallback() {
    this.connectSocket();
}
```

Se ejecuta automaticamente cuando `<chat-app>` aparece en la pagina. Aqui se registran formularios y se abre la conexion Socket.IO.

```javascript
this.socket = io({
    transports: ['websocket', 'polling']
});
```

Conecta el navegador con el servidor Socket.IO actual.

```javascript
this.socket.emit('set_username', { username });
```

Envia el nombre del usuario al servidor.

```javascript
this.socket.emit('chat_message', {
    message,
    timestamp: new Date().toLocaleTimeString()
});
```

Envia un mensaje al servidor para que este lo retransmita.

```javascript
this.socket.on('chat_message', (data) => {
    this.addMessage(data, data.username === this.username);
});
```

Escucha mensajes entrantes y los pinta en pantalla.

```javascript
customElements.define('chat-app', ChatApp);
```

Registra oficialmente el componente para que el navegador entienda la etiqueta `<chat-app>`.

## 6. Flujo completo del chat

1. El usuario abre `http://localhost:5000`.
2. Flask entrega `index.html`.
3. `index.html` carga Socket.IO y `chat-app.js`.
4. El navegador crea `<chat-app>`.
5. `<chat-app>` se conecta al servidor con `io()`.
6. El usuario escribe su nombre.
7. El cliente emite `set_username`.
8. El servidor guarda el usuario y envia `user_list`.
9. El usuario escribe un mensaje.
10. El cliente emite `chat_message`.
11. El servidor retransmite `chat_message` a todos.
12. Cada navegador muestra el mensaje recibido.

## 7. Cliente de consola opcional

El archivo `client.js` sigue funcionando como cliente de terminal con Node.js.

```powershell
npm install
node client.js
```

Puedes usarlo junto con el cliente web para probar que ambos clientes hablan con el mismo servidor.
