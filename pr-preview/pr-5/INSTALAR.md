# GymTracker PWA - Guia de Instalacion

## Que necesitas

- Una cuenta de GitHub (gratis): https://github.com/signup
- Un celular Android con Chrome
- 5 minutos

---

## Paso 1: Crear el repositorio en GitHub

1. Ve a https://github.com/new
2. Nombre del repositorio: `gymtracker`
3. Dejalo en **Public**
4. Marca **Add a README file**
5. Click en **Create repository**

## Paso 2: Subir los archivos

1. Dentro del repositorio que acabas de crear, click en **Add file** > **Upload files**
2. Arrastra los 5 archivos de la carpeta `gymtracker-pwa/`:
   - `index.html`
   - `manifest.json`
   - `sw.js`
   - `icon-192.png`
   - `icon-512.png`
3. Click en **Commit changes**

## Paso 3: Activar GitHub Pages

1. Ve a **Settings** (engranaje, en el menu del repositorio)
2. En el menu lateral izquierdo, click en **Pages**
3. En **Source** selecciona **Deploy from a branch**
4. En **Branch** selecciona `main` y carpeta `/ (root)`
5. Click en **Save**
6. Espera 1-2 minutos. Tu app estara en:

   **https://TU-USUARIO.github.io/gymtracker/**

   (reemplaza TU-USUARIO por tu nombre de GitHub)

## Paso 4: Instalar en el celular

1. Abre Chrome en tu celular Android
2. Ve a la URL: `https://TU-USUARIO.github.io/gymtracker/`
3. Deberia aparecer un banner azul abajo que dice **Instalar GymTracker**
4. Toca **Instalar**
5. Si no aparece el banner:
   - Toca los 3 puntos de Chrome (arriba a la derecha)
   - Toca **Instalar app** o **Agregar a pantalla de inicio**
6. Listo! El icono azul de GymTracker aparecera en tu pantalla de inicio

## Paso 5: Repetir en cada celular de la familia

Simplemente comparte la URL por WhatsApp y cada persona repite el Paso 4 en su celular.

---

## Notas importantes

- **Funciona sin internet**: Una vez instalada, la app funciona offline
- **Los datos son locales**: Cada celular guarda sus propios entrenamientos en localStorage
- **Pantalla encendida**: Durante un entrenamiento activo, la pantalla no se apaga
- **Sonido**: Los beeps del countdown usan Web Audio API. El celular debe tener volumen activo
- **Vibracion**: Funciona en Android Chrome. Se puede desactivar desde Ajustes de la app

## Si necesitas actualizar la app

1. Sube los archivos nuevos al repositorio de GitHub (reemplazando los anteriores)
2. En cada celular: abre la app, cierra, y vuelve a abrir. El Service Worker cargara la version nueva
