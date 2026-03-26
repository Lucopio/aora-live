# GymTracker PWA — Contexto para Claude

## Repositorio
- GitHub: https://github.com/Lucopio/gymtracker.git
- Archivo principal: `index.html` (todo el HTML + CSS + JS en un solo archivo, sin build step)
- Service Worker: `sw.js`

---

## Stack y arquitectura
- **PWA** single-file: HTML + CSS embebido + JS embebido en `index.html`
- Sin framework, sin bundler, sin dependencias locales
- Backend: **Supabase** (auth + base de datos de perfiles de usuario)
- Hosting: **GitHub Pages**
- Fuentes: DM Sans (UI) + JetBrains Mono (números/stats)

---

## Sistema de pantallas
Todas las pantallas son `<div class="screen">` toggled con clase `.active`:
```js
showScreen('home')        // homeScreen
showScreen('workout')     // workoutScreen
showScreen('summary')     // summaryScreen
showScreen('history')     // historyScreen
showScreen('insights')    // insightsScreen
showScreen('settings')    // settingsScreen
showScreen('catalog')     // catalogScreen
showScreen('warmup')      // warmupScreen
showScreen('auth')        // authScreen
showScreen('onboarding')  // onboardingScreen
showScreen('welcome')     // welcomeScreen (onboarding visual - nuevo usuarios)
```

---

## CSS Variables clave
```css
--primary: #1A73E8       /* azul principal */
--success: #34A853       /* verde */
--danger:  #EA4335       /* rojo */
--font:    'DM Sans'
--mono:    'JetBrains Mono'
--radius-sm: 12px
```

---

## Estado global de la sesión de entrenamiento
```js
let restSeconds          // segundos configurados de descanso
let workoutStartTime     // timestamp inicio sesión
let timerInterval        // ID del setInterval del timer de descanso
let exerciseCount        // contador de ejercicios completados
let workoutMode          // 'full' | 'rest-only'
let restCount            // rests tomados en la sesión actual
let currentExerciseName  // nombre del ejercicio activo
let currentExerciseSets  // array de sets del ejercicio activo
let completedExercises   // array de ejercicios ya terminados
let pendingExercises     // cola de ejercicios de rutina sugerida
let isUnilateral         // bool - ejercicio bilateral/unilateral
let activeSide           // 'left' | 'right'
let _restTargetSet       // referencia al set que inició el descanso actual
let supersetActive       // bool
let supersetGroupCounter // contador de grupos superset
```

---

## Funciones clave del flujo de entrenamiento
```js
openConfig()          // abre bottom sheet de config de descanso
startWorkout()        // cierra config, muestra modal de selección de modo
selectMode(mode)      // inicia workout con modo 'full' o 'rest-only'
selectExercise(name, equipment)  // abre catálogo → ejercicio
_doSelectExercise(name, equipment)  // lógica real de cambio de ejercicio (NO cancela descanso)
nextExercise()        // guarda ejercicio actual, pasa al siguiente (NO cancela descanso)
addSet()              // registra una serie y arranca el timer de descanso
markRestReady()       // usuario toca "Listo" → guarda duración del descanso en _restTargetSet
skipRest()            // cancela descanso activo
endWorkout()          // guarda sesión + muestra resumen
saveAndExit()         // va al home y actualiza stats
```

---

## Flujo de onboarding (usuarios nuevos)
1. **welcomeScreen** — 4 slides motivacionales (E1, rediseñado 2026-03)
   - Slide 1: Stats (+31% fuerza, 2× recuperación)
   - Slide 2: ¿Qué es GymTracker? (3 features)
   - Slide 3: Cómo funciona (4 pasos)
   - Slide 4: Asistente IA con burbuja de chat simulada + botón verde "¡Empecemos!"
   - Control: `WELCOME_DISMISSED_KEY` en localStorage
2. **onboardingScreen** — recolección de perfil (nombre, edad, peso, altura, sexo, nivel, objetivo, días)
   - 4 pasos (`_obStep` 1-4)
   - Guarda en Supabase tabla `user_profiles`

---

## Calentamiento (warmupScreen)
- `warmupDatabase`: objeto con grupos musculares como clave
- Cada ejercicio puede tener: `gif` (URL externa), `video` (ruta local tipo `'videos/nombre.mp4'`)
- Si tiene `video` → botón azul pill "▶ Ver con María" (`wu-maria-btn`)
- Si solo tiene `gif` → botón rojo "Ver cómo hacerlo" (`wu-yt-btn`)
- Modal: `wuGifSheet` / `wuGifOverlay` — soporta `<img>` para GIFs y `<video autoplay muted playsinline loop>` para MP4
- Funciones: `openWarmupGif(url, name)`, `closeWarmupGif()`

---

## Rutinas sugeridas
- `showRoutinesSheet()` / `closeRoutinesSheet()` — bottom sheet con tabs de nivel y tiempo
- `SCIENCE_ROUTINES` — objeto con rutinas por nivel (beginner/intermediate/advanced) y duración
- `startScienceRoutine(level, time, dayIdx)` — carga ejercicios en `pendingExercises`

---

## Historial y estadísticas
- `savedWorkouts`: array en localStorage — `{ date, duration, exercises, mode, restCount }`
- `renderHistory()` y `updateHomeStats()` distinguen entre `mode === 'rest-only'` y `'full'`

---

## Service Worker
- Archivo: `sw.js`, línea 1: `const CACHE_NAME = 'gymtracker-vXX'`
- **Incrementar la versión en `sw.js` con cada deploy** para que los usuarios reciban los cambios
- Estrategia: network-first para `index.html`, cache-first para assets estáticos

---

## Supabase
- Cliente inicializado en `showScreen` o al cargar: `sb = supabase.createClient(SB_URL, SB_ANON)`
- Tabla principal: `user_profiles` (columnas: id, full_name, age, body_weight, height_cm, sex, experience, training_goal, training_days, activity_level, body_weight_unit)
- Auth flow: email+password o magic link
- **Problema conocido**: el link del correo de confirmación apunta a localhost en algunos entornos — pendiente corregir la Site URL en el dashboard de Supabase

---

## Ejercicios unilaterales
- Toggle `isUnilateral` / `activeSide` ('left'|'right')
- El sheet de edición (`editSetSheet`) muestra selector de lado si `s.side || isUnilateral`
- Al guardar un set, auto-alterna el lado: `setSide(activeSide === 'left' ? 'right' : 'left')`
- Funciones: `toggleUnilateral()`, `setSide(side)`, `selectEditSide(side)`

---

## Convenciones de desarrollo
- **No usar frameworks**: todo vanilla JS
- **No crear archivos adicionales** salvo `videos/` para MP4 de ejercicios
- Incrementar `CACHE_NAME` en `sw.js` en cada commit que cambie assets
- Commit directamente a `main` y hacer `git push` para publicar en GitHub Pages
- Los cambios locales no son visibles en producción hasta hacer push

---

## Trabajo pendiente (Fase E)
- E2: Mejorar paso 4 del onboarding (explicación de tipos de rutina)
- E3: Rediseño de tarjetas de rutina
- E4: Sistema de tooltips contextuales
- E5: Tutorial mode (primera vez en home)
- Fase C: Recomendaciones IA con Claude API vía Supabase Edge Function

---

## Notas de feedback del usuario
- No resumir al final de cada respuesta — ir directo al punto
- Preferir edits concretos sobre explicaciones largas
- Siempre hacer `git push` al terminar cambios (no solo commit local)
- El usuario prueba en móvil (Chrome Android) — priorizar mobile UX
