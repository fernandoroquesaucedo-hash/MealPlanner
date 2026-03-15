# 🥑 NutriLiz — Planificador de Menú Semanal (con sincronización)

Tus platillos y menú se sincronizan automáticamente entre todos tus dispositivos.

---

## Guía paso a paso (30 minutos total)

Hay 3 pasos grandes: crear Firebase, subir a GitHub, desplegar en Vercel.

---

## PARTE 1: Crear proyecto en Firebase (~10 min)

### Paso 1.1: Crear el proyecto

1. Ve a https://console.firebase.google.com
2. Inicia sesión con tu cuenta de Google
3. Clic en **"Crear un proyecto"** (o "Add project")
4. Nombre: `nutriliz` → clic en **Continuar**
5. Google Analytics: desactívalo (no lo necesitas) → **Crear proyecto**
6. Espera ~30 segundos → clic en **Continuar**

### Paso 1.2: Agregar app web

1. En la página principal de tu proyecto, busca el ícono `</>` (Web) y dale clic
2. Nombre de la app: `nutriliz-web`
3. **NO** marques Firebase Hosting
4. Clic en **"Registrar app"**
5. Te va a mostrar un bloque de código con `firebaseConfig`. **Copia estos valores:**
   ```
   apiKey: "AIzaSy..."
   authDomain: "nutriliz-XXXXX.firebaseapp.com"
   projectId: "nutriliz-XXXXX"
   storageBucket: "nutriliz-XXXXX.firebasestorage.app"
   messagingSenderId: "123..."
   appId: "1:123...:web:abc..."
   ```
6. Clic en **"Continuar a la consola"**

### Paso 1.3: Activar inicio de sesión con Google

1. En el menú de la izquierda: **Authentication** (o Build → Authentication)
2. Clic en **"Comenzar"** (Get started)
3. En la pestaña **"Sign-in method"**, busca **Google** y dale clic
4. Actívalo con el toggle → **Enable**
5. Agrega tu correo como **Support email**
6. Clic en **Guardar**

### Paso 1.4: Crear la base de datos Firestore

1. En el menú de la izquierda: **Firestore Database** (o Build → Firestore Database)
2. Clic en **"Crear base de datos"** (Create database)
3. Ubicación: selecciona la más cercana a ti (ej: `us-central1` o `southamerica-east1`)
4. Selecciona **"Iniciar en modo de prueba"** (Start in test mode)
5. Clic en **Crear**

### Paso 1.5: Configurar reglas de seguridad

1. En Firestore, ve a la pestaña **"Reglas"** (Rules)
2. Reemplaza todo el contenido con esto:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

3. Clic en **"Publicar"** (Publish)

> Esto hace que cada usuario solo pueda leer/escribir SUS propios datos.

### Paso 1.6: Agregar tu dominio de Vercel a Firebase

⚠️ **Este paso lo harás DESPUÉS de desplegar en Vercel** (cuando tengas tu URL).

1. En Firebase → Authentication → **Settings** → **Authorized domains**
2. Clic en **"Add domain"**
3. Escribe tu dominio de Vercel, por ejemplo: `nutriliz.vercel.app`
4. Clic en **Add**

---

## PARTE 2: Poner tus datos de Firebase en el código

1. Abre el archivo `src/firebase.js`
2. Reemplaza los valores de `firebaseConfig` con los que copiaste en el Paso 1.2:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSy...(tu valor real)",
  authDomain: "nutriliz-XXXXX.firebaseapp.com",
  projectId: "nutriliz-XXXXX",
  storageBucket: "nutriliz-XXXXX.firebasestorage.app",
  messagingSenderId: "123456789",
  appId: "1:123...:web:abc...",
};
```

> No te preocupes por exponer el API key — Firebase lo diseñó así. La seguridad real está en las reglas de Firestore que ya configuraste.

---

## PARTE 3: Subir a GitHub y Vercel (~10 min)

### Paso 3.1: Subir a GitHub

1. Ve a https://github.com/new
2. Nombre: `nutriliz` → **Create repository**
3. Clic en **"uploading an existing file"**
4. Arrastra todos los archivos y carpetas del proyecto
5. Clic en **"Commit changes"**

### Paso 3.2: Desplegar en Vercel

1. Ve a https://vercel.com/new
2. Conecta tu GitHub → Importa `nutriliz`
3. Framework: **Vite** (se detecta automático)
4. Clic en **"Deploy"**
5. En ~1 minuto tendrás tu URL (ej: `nutriliz-abc.vercel.app`)

### Paso 3.3: Registrar dominio en Firebase

1. Copia tu URL de Vercel
2. Regresa a Firebase → Authentication → Settings → Authorized domains
3. Agrega tu dominio de Vercel (sin https://)
4. También agrega `localhost` si quieres probar en tu compu

---

## PARTE 4: Instalar como app en tu celular

### iPhone:
1. Abre tu URL de Vercel en **Safari**
2. Toca el botón de compartir (⬆️)
3. **"Agregar a pantalla de inicio"**
4. Listo — se abre como app

### Android:
1. Abre tu URL en **Chrome**
2. Menú (⋮) → **"Instalar app"** o **"Agregar a pantalla de inicio"**
3. Listo

---

## ¿Cómo funciona la sincronización?

- Inicias sesión con tu cuenta de Google
- Todos tus platillos y tu menú se guardan en Firebase (la nube de Google)
- Si abres la app en otro dispositivo y entras con la misma cuenta, ves los mismos datos
- Los cambios se sincronizan en tiempo real (~1 segundo)
- El indicador en el header te dice: "Sincronizado ✓", "Guardando...", o "Error"

---

## Estructura del proyecto

```
nutriliz/
├── index.html
├── package.json
├── vite.config.js
├── public/
│   ├── manifest.json
│   ├── sw.js
│   ├── icon-192.png
│   └── icon-512.png
└── src/
    ├── main.jsx
    ├── firebase.js      ← Tu configuración Firebase (editar aquí)
    └── App.jsx           ← Toda la aplicación
```

---

## Solución de problemas

**"Error de sync"**: Revisa que las reglas de Firestore estén bien configuradas (Paso 1.5).

**No me deja iniciar sesión**: Verifica que tu dominio de Vercel esté en la lista de dominios autorizados en Firebase (Paso 1.6).

**Popup de Google se bloquea**: En Safari, desactiva el bloqueador de popups para tu sitio. En iPhone: Ajustes → Safari → Bloquear ventanas emergentes → desactivar.
