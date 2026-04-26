# AORA LIVE — Contexto de Proyecto para Claude Code

## Identidad del Proyecto
- **Nombre:** Aora Live (antes GymTracker)
- **Tipo:** PWA fitness app — mercado LATAM con ambición global
- **URL producción:** https://app.aoralive.com (GitHub Pages + custom domain)
- **URL preview/staging:** https://aora-live.pages.dev (Cloudflare Pages, sync con `main`)
- **URL legacy:** https://lucopio.github.io/aora-live (redirige a custom domain)
- **Repositorio:** https://github.com/Lucopio/aora-live
- **Rama principal:** `main`
- **Ramas auxiliares:** `gh-pages` (creada por PR preview action — ver sección Infraestructura de Deploys)

## Stack Técnico
- **Arquitectura:** Monolítica — un solo archivo `index.html` (~14,000 líneas)
- **Backend:** Supabase (`edythbvezafpnkslavcv.supabase.co`)
- **Auth:** Supabase Auth (email/password)
- **Storage local:** localStorage (offline-first) — no se usa IndexedDB
- **Deploy producción:** GitHub Pages desde `main` (custom domain `app.aoralive.com` vía CNAME)
- **Deploy preview:** Cloudflare Pages (`aora-live.pages.dev`) — sync automático con `main`
- **PWA:** Service Worker (`sw.js`, cache `gymtracker-v119`) + `manifest.json` + meta tags Apple
- **Companion:** `watch.html` para Samsung Galaxy Watch
- **Fuentes:** Syne (display), DM Sans (body), JetBrains Mono (mono)
- **Iconos:** 40+ SVGs custom en `Icons/SVG/` — referenciados como `<img>` en el nav y UI
- **Ilustraciones de ejercicios:** 60+ PNGs en `Images/exercises/` — filenames snake_case minúscula (Linux case-sensitive)

## Design System — Dark Premium UI
```css
:root {
  /* Backgrounds */
  --bg: #080A0F;
  --surface: #111318;
  --surface2: #1A1D24;
  --surface-raised: #1C2230;

  /* Brand */
  --primary: #00E5FF;         /* cyan */
  --primary-dark: #00B8CC;
  --primary-light: rgba(0,229,255,0.12);
  --accent2: #7B61FF;         /* violet */

  /* Text */
  --text-primary: #FFFFFF;
  --text-secondary: #8A8F9E;
  --text-tertiary: #6B7280;

  /* Semantic */
  --success: #00C896;
  --success-light: rgba(0,200,150,0.12);
  --danger: #FF4D6D;
  --danger-light: rgba(255,77,109,0.12);
  --warning: #FFB800;
  --warning-light: rgba(255,184,0,0.12);

  /* Utility */
  --border: rgba(255,255,255,0.08);
  --shadow-sm: 0 1px 3px rgba(0,0,0,0.3), 0 1px 2px rgba(0,0,0,0.2);
  --shadow-md: 0 4px 12px rgba(0,0,0,0.4);

  /* Radii */
  --radius: 16px;
  --radius-sm: 12px;
  --radius-lg: 20px;
  --radius-full: 9999px;

  /* Typography */
  --font: 'DM Sans', -apple-system, sans-serif;
  --font-display: 'Syne', -apple-system, sans-serif;
  --mono: 'JetBrains Mono', monospace;
}
```

## Identidad del Experto en Diseño

Cuando generes UI para Aora Live, actúas como **diseñador senior de apps fitness 
mobile-first para LATAM**, no como generador genérico de interfaces.

Esto significa:

- **Evita tropes genéricos:** No uses patrones de Material Design, cards con sombra 
  blanca, botones azules por defecto, o layouts de "to-do app". Cada componente debe 
  sentirse parte del Dark Premium system.

- **El coach siempre es protagonista:** Cualquier pantalla que involucre a María, 
  Carlos, Andrea o Diego debe poner su identidad visual primero — foto, nombre, 
  personalidad — antes que las features.

- **Mobile OLED-first:** Diseña asumiendo pantalla AMOLED 390px. El fondo `#080A0F` 
  es negro puro — los elementos flotantes y los glows de `--primary` (`#00E5FF`) 
  deben tener contraste real, no solo diferencia de gris.

- **Animaciones con propósito:** Solo staggered entrances y microinteracciones en 
  feedback de usuario (sets completados, RPE seleccionado, rest timer finalizado). 
  No animaciones decorativas que añadan latencia percibida.

- **Copy mínimo, impacto máximo:** Los labels deben ser 2-4 palabras max. Si 
  necesitas más texto para explicar una feature, la feature está mal diseñada.

Antes de proponer cualquier cambio visual, pregúntate:
**¿Esto se vería en una app de banco o en una app de fitness premium para LATAM?**
Si la respuesta es "banco", rediseña.

## Base de Datos Supabase
| Tabla | RLS | Uso |
|---|---|---|
| `profiles` | ✅ | Perfil de usuario, onboarding data |
| `workouts` | ✅ | Sesiones de entrenamiento |
| `workout_exercises` | ✅ | Ejercicios dentro de cada sesión |
| `exercise_sets` | ✅ | Series individuales con peso/reps/RPE |
| `custom_exercises` | ✅ | Ejercicios creados por el usuario |
| `last_weights` | ✅ | Último peso usado por ejercicio |
| `ai_insights` | ✅ | Insights generados por IA |

## Edge Functions (Supabase)
| Función | Modelo IA | Uso |
|---|---|---|
| `/functions/v1/coach-chat` | Claude Haiku 4.5 | Chat con entrenadores IA |
| `/functions/v1/generate-insights` | Claude Haiku 4.5 | Análisis semanal + tips post-entreno |
| `/functions/v1/tts-coach` | ElevenLabs eleven_multilingual_v2 | Text-to-speech de voces de coaches |

### tts-coach — Detalles
- **Body:** `{ text: string, coachId: 'maria'|'carlos'|'andrea'|'diego' }`
- **Auth:** Supabase JWT requerido (protege quota de ElevenLabs)
- **Respuesta:** `audio/mpeg` binario
- **Voice IDs:** maría `VmejBeYhbrcTPwDniox7`, carlos `dn9HtxgDwCH96MVX9iAO`, andrea `6Mo5ciGH5nWiQacn5FYk`, diego `eklUXgdI2kEgVcRbATIu`
- **Límite texto:** 500 caracteres por llamada

### CORS — Configuración de Orígenes Permitidos
Cada Edge Function tiene un array `ALLOWED_ORIGINS` hardcodeado. La función `getCorsHeaders(req)` refleja el origen del request si está en la lista; si no, fallback a `ALLOWED_ORIGINS[0]` (bloqueando el request).

**Orígenes permitidos actuales** (los 3 functions tienen la misma lista):
```typescript
const ALLOWED_ORIGINS = [
  "https://lucopio.github.io",
  "https://aora-live.pages.dev",    // Cloudflare Pages preview
  "https://app.aoralive.com",       // Producción
  "https://aoralive.com",
  "https://www.aoralive.com",
  "http://localhost:5500",           // dev — Live Server
  "http://127.0.0.1:5500",
];
```

**CRÍTICO:** cambios en `ALLOWED_ORIGINS` requieren `npx supabase functions deploy <nombre>` — el `git push` a `main` NO despliega Edge Functions automáticamente. Ver sección "Comandos Útiles" para deploy-all.

## 4 Entrenadores IA (Diferenciador Principal)
| Entrenador | País | Especialidad | Personalidad |
|---|---|---|---|
| **María** | Colombia 🇨🇴 (Medellín) | HIIT, funcional | Energética, empática |
| **Carlos** | México 🇲🇽 | Fuerza, hipertrofia | Datos-driven, preciso |
| **Andrea** | Argentina 🇦🇷 | Movilidad, wellness | Equilibrada, reflexiva |
| **Diego** | Perú 🇵🇪 | Técnica, resistencia | Resiliente, sereno |

Los entrenadores son IA — los usuarios lo saben. La confianza se construye por **competencia**, no por transparencia. Las fotos deben verse como personas reales profesionales.

### Sistema de Coach Alerts (Implementado)
Alertas hardcodeadas (cero costo IA) en `COACH_ALERTS` (~línea 3503). Cada alerta tiene mensajes por coach:
- **hydration** — Recordatorios de hidratación cada X minutos de entrenamiento
- **warmupSkipped** — Cuando el usuario salta el calentamiento
- Los mensajes se muestran como toasts con avatar del coach seleccionado

### Sistema TTS de Coaches (Implementado)
`speakCoach(type)` y `speakCoachText(text)` son **async**. Flujo:
1. Intenta ElevenLabs via Edge Function `tts-coach` (audio de calidad real)
2. Si falla o timeout >5s → fallback automático a `window.speechSynthesis`
3. Cache en memoria `_elAudioCache` (ObjectURL por sesión, key = `coachId::text`)
4. `_elAvailable = false` desactiva ElevenLabs para toda la sesión si hay error

Variables relevantes: `_elAudioCache`, `_elAvailable`, `_ttsVoices`, `COACH_TTS`, `voiceAlertMode`

## Segundo Diferenciador: Rest/Recovery Tracking
Sistema inteligente de seguimiento de descanso entre series — gap identificado en JEFIT, Strong y MyFitnessPal. El rest timer es crítico y su estado no debe perderse entre navegaciones.

## Estructura de Pantallas
El mapa de pantallas está definido en `showScreen()` (~línea 4281):

```javascript
const screenMap = {
  home: 'homeScreen',
  coach: 'coachScreen',
  workout: 'workoutScreen',
  summary: 'summaryScreen',
  history: 'historyScreen',
  insights: 'insightsScreen',
  settings: 'settingsScreen',
  catalog: 'catalogScreen',
  warmup: 'warmupScreen',
  auth: 'authScreen',
  onboarding: 'onboardingScreen',
  welcome: 'welcomeScreen'
};
```

### Pantallas fullscreen (sin bottom nav):
`workout`, `summary`, `catalog`, `warmup`, `auth`, `onboarding`, `welcome`

### Bottom Nav (4 tabs):
| Tab | Pantalla | Icono |
|---|---|---|
| Inicio | `home` | `Icons/SVG/Home.svg` |
| Coach | `coach` | `Icons/SVG/Coach check.svg` |
| Progreso | `insights` | `Icons/SVG/Insigths.svg` |
| Yo | `settings` | `Icons/SVG/Settings.svg` |

## Onboarding (hasta 7 pasos condicionales)
Array base en ~línea 9661:
```javascript
const OB_STEP_IDS_BASE = ['obStep1','obStepCycle','obStepLocation','obStep2','obStep3','obStepCoach','obStep4'];
```

| Paso | ID | Contenido | Condicional |
|---|---|---|---|
| 1 | `obStep1` | Datos personales (nombre, apodo, edad, sexo) | Siempre |
| 2 | `obStepCycle` | Ciclo menstrual (toggle + fecha inicio) | Solo si sexo = female |
| 3 | `obStepLocation` | Lugar de entrenamiento (gym/casa/parque/mixto) | Siempre |
| 4 | `obStep2` | Objetivo (fuerza/estética/resistencia/salud) | Siempre |
| 5 | `obStep3` | Experiencia y frecuencia | Siempre |
| 6 | `obStepCoach` | Selección de entrenador IA | Siempre |
| 7 | `obStep4` | Importar rutina o empezar libre | Siempre |

## Features Implementadas
- **Workout tracking** completo: ejercicios, series, peso, reps, rest timer, RPE
- **Superseries** (toggle en workout activo)
- **Ejercicios unilaterales** con selector de lado
- **Catálogo de ejercicios** (`exerciseDB` ~línea 4736) con grupos musculares + GIFs via ExerciseDB/RapidAPI
- **GIF cache** en localStorage (`aora_gif_cache`) — 500 calls/mes free tier
- **Coach chat** (Edge Function `coach-chat`)
- **Insights/Progreso** renombrado "Mi Semana" con rango de fechas dinámico — (Edge Function `generate-insights` + analytics locales)
- **Warmup inteligente** pre-entrenamiento con ejercicios específicos
- **Coach alerts** (hydration, warmup-skipped) — hardcoded, cero costo IA
- **Coach TTS** — ElevenLabs vía Edge Function `tts-coach` con fallback a speechSynthesis
- **Streak semanal** (badge 🔥 en home y en Workout Hub)
- **Ciclo menstrual** (4 fases con recomendaciones en home pill)
- **Welcome flow** (4 slides explicando la app)
- **Onboarding** (7 pasos con selección de coach)
- **Historial** de entrenamientos pasados
- **Summary post-workout** con RPE promedio, tip IA, y feedback semanal
- **Tutorial system** (coachmarks + hints contextuales)
- **Back button handler** (popstate con cierre de overlays)
- **Rutinas preset** con wizard de 3 pasos (nivel → tiempo → rutina) via `renderRoutines()`
- **Chat counter UX** — aviso solo al alcanzar ≥75% del límite diario

## ExerciseDB & GIFs
- **API:** RapidAPI endpoint `exercisedb.p.rapidapi.com/exercises/name/{name}?limit=1`
- **Cache:** localStorage key `aora_gif_cache` — cada GIF se busca una vez y se almacena permanentemente
- **Quota:** 500 calls/mes en free tier
- **Ubicación del array:** `grep -n "exerciseDB\s*=" index.html` (~línea 8263)
- **Grupos:** Pecho, Espalda, Hombros, Bíceps, Tríceps, Piernas, Glúteos, Abdomen, Cardio (Calistenia ELIMINADO en commit `cf17b41`)
- **`filter: invert(1)`** aplicado a `#exGifImg` — las imágenes de AscendAPI tienen fondo blanco; invertir las hace correctas sobre el dark UI

### Ilustraciones estáticas (`Images/exercises/`)
- 60+ PNGs con ilustraciones de ejercicios — se muestran en el catálogo junto al chip de equipo
- Filenames en **snake_case minúscula** (Linux es case-sensitive — GitHub Pages falla silenciosamente con mayúsculas)
- Mapa `EXERCISE_ILLUSTRATIONS` (~línea 9665) relaciona nombre del ejercicio → path del PNG
- Si un ejercicio existe pero no tiene imagen: entrada comentada con `// 'Nombre' — imagen no disponible`
- Cobertura actual: ~60/83 ejercicios del catálogo tienen ilustración

### Mapas de traducción de ejercicios
- **`EXERCISE_EN`** — mapa Español→Inglés. Incluye aliases sin tilde (exerciseDB almacena nombres SIN acentos). Si un ejercicio no aparece, agregar alias aquí.
- **`EXERCISE_IDS`** — mapa Inglés→AscendAPI ID (33 entradas). AscendAPI devuelve imágenes de ejercicios; su endpoint de búsqueda está roto — solo funciona browse por ID hardcodeado.
- Cobertura actual de GIFs: ~26 ejercicios con animación.

## Pantallas Rediseñadas (UI actual)

### Workout Hub (`workoutHubScreen`)
- Header: "Entrenar" + `hubStreakLabel` badge con racha semanal
- 3 botones full-width: Nuevo entreno (gradient, `openConfig()`), Entreno rápido (verde, `openQuickWorkout()`), Ver rutinas (surface, `showRoutinesSheet()`)
- Stats en 2 columnas: `hubWeekSessions` + `hubWeekTime`
- 1 entrenamiento reciente en `hubRecentsList`
- IDs legacy preservados en `<div style="display:none">` para compatibilidad con JS

### Home (`homeScreen`)
- Bloque Racha arriba del mapa muscular (fondo gradient, número grande en `streakBadgeNew`)
- `muscleFatigueSection` con header de leyenda (3 puntos de color)
- Coach spotlight: avatar 42px, padding compacto

### Insights (`insightsScreen`)
- Renombrado a **"Mi Semana"** (h1)
- Subtítulo dinámico con rango de fechas (`insightsDateRange`): e.g. "14 abr – 16 abr · 2026"

## Reglas de Implementación CRÍTICAS

### 1. Arquitectura monolítica — no crear archivos separados
Todo el código vive en `index.html`. No crear archivos `.js`, `.css` separados salvo que se solicite explícitamente.

### 2. El rest timer es el core — no romperlo
El estado del rest timer debe persistir al navegar entre pantallas. Este fue identificado como root cause de múltiples bugs UX.

### 3. Offline-first
Toda funcionalidad debe funcionar sin conexión. Supabase es para sync, no para operación principal.

### 4. Mobile-first, max-width 480px
La app es exclusivamente móvil. No optimizar para desktop.

### 5. Preservar el design system
Usar siempre las variables CSS definidas en `:root`. No hardcodear colores.

### 6. RLS en todas las tablas
Cualquier tabla nueva en Supabase debe tener Row Level Security activado.

### 7. Ediciones quirúrgicas
El monolito tiene convenciones estructurales con comment markers (`// ─── Sección ───`). Las ediciones deben ser targeted a funciones específicas — nunca refactoring amplio.

### 8. No tocar lógica adyacente
Los prompts a Claude Code deben prohibir explícitamente tocar JS logic, DOM structure, IDs, auth, y data persistence fuera del scope del cambio.

## Bugs Conocidos (Prioridad de Implementación)
1. **Rest timer state loss** — el timer pierde estado al navegar (ROOT CAUSE de múltiples bugs)
2. **Back button** — comportamiento inconsistente al volver de workout
3. **Series evaluation window** — ventana de evaluación de series incorrecta
4. **Unilateral exercise side-switching** — ejercicios unilaterales no alternan lado correctamente

### Bugs fixeados recientes (historia)
- ~~**Alerta persistente**~~ — fixeado: auto-clear `_pendingSetFeedbackMsg` tras 5s en `openConfig()` + `warmupAlertFiredThisVisit` per-visit (commits `a3fd7f6`, `9dcf4fd`)
- ~~**Mensaje coach perdido al navegar**~~ — fixeado: `sendCoachMessage` persiste inmediatamente en localStorage (commit `9dcf4fd`)
- ~~**warmupSkipped alert no disparaba**~~ — fixeado: slot `_pendingSetFeedbackMsg` ya no bloquea (commit `a3fd7f6`)
- ~~**Nombres de ejercicios duplicados (`Press con mancuernas`)**~~ — eliminado del catálogo, reemplazado por `Press de banca` en 6 presets (commit `cf17b41`)
- ~~**Grupo Calistenia redundante**~~ — eliminado completamente (12 puntos del código) (commit `cf17b41`)
- ~~**SW interceptando Edge Functions con CORS cacheado**~~ — fixeado: early-return para URLs con `supabase.co` (commit `4540d80`)

## En Desarrollo / Próximas Features
- Videos de entrenamiento con María (generados con Kling AI — Video O1)
- Sistema de gamificación avanzado: progreso histórico por ejercicio
- Importación de rutinas
- Perfil de salud/lifestyle
- Check-ins semanales de dolor
- Multimedia content + social features (Web Share API only — no internal feed)
- Modelo de precios: Freemium + Pro ($4.99/mes o $39.99/año)

## Videos de Entrenadores (Kling AI)
- Modelo: **Kling Video O1** (superior a Kling 3.0 Omni para ejercicios)
- Directorio: `videos/` junto a `index.html`
- María: piel morena, cabello negro ondulado largo, complexión atlética
- Los prompts deben: nombrar el personaje explícitamente, incluir descriptores físicos, especificar ángulo lateral, indicar que imágenes de referencia son solo para técnica
- Ejercicios pendientes: sentadilla trasera (validada), peso muerto, hack squat, leg press
- 1 video implementado: `videos/maria_rotaciones_brazos.mp4` (warmup)

## Infraestructura de Deploys

### Producción — GitHub Pages
- **URL:** https://app.aoralive.com
- **Source:** branch `main`, directorio raíz `/`
- **Custom domain:** `app.aoralive.com` — configurado vía archivo `CNAME` en la raíz del repo
- **Auto-deploy:** en cada `git push origin main`, GitHub Pages reconstruye y publica (1-3 min)
- **Legacy URL:** `lucopio.github.io/aora-live` redirige automáticamente al custom domain

### Preview — Cloudflare Pages
- **URL:** https://aora-live.pages.dev
- **Source:** branch `main` (mismo que producción)
- **Uso:** entorno de preview/staging para verificar cambios sin pasar por el custom domain
- **Deploy automático:** en cada push a `main` (paralelo al deploy de GitHub Pages)
- **Requiere CORS en Edge Functions** — el dominio `aora-live.pages.dev` debe estar en `ALLOWED_ORIGINS`

### PR Previews (EN DISEÑO — NO FUNCIONAL)
- Workflow creado: `.github/workflows/preview.yml` usando `rossjrw/pr-preview-action@v1`
- **Problema detectado:** la action despliega a branch `gh-pages`, pero GitHub Pages sirve desde `main` → los previews no son accesibles (404 en `app.aoralive.com/pr-preview/pr-N/`)
- **Rama `gh-pages`:** existe (creada por la action en la validación del PR #2), contiene `pr-preview/pr-2/` orphan
- **Decisión pendiente (Camino A vs B):**
  - **A:** Migrar Pages source a `gh-pages` + workflow que sincroniza `main` → raíz de `gh-pages`
  - **B:** Abandonar workflow, usar Cloudflare Pages para previews por PR (servicio separado)
- **Estado:** workflow desactivado funcionalmente, commit `preview.yml` se mantiene en repo
- **No borrar** la rama `gh-pages` ni el workflow hasta decidir el camino

## Service Worker (`sw.js`)
- **Cache version actual:** `gymtracker-v119`
- **Assets precacheados:** `./`, `./index.html`, `./manifest.json`, `./icon-192.png`, `./icon-512.png`
- **Estrategia HTML:** network-first con fallback a cache (siempre intenta fresh version)
- **Estrategia assets estáticos:** cache-first (imágenes, iconos, etc.)
- **Excepción crítica:** peticiones a `supabase.co` (Edge Functions) usan **early-return** — el SW NO las intercepta, pasan directo a la red. Esto evita que respuestas con CORS cacheado antiguo bloqueen nuevos orígenes (bug fixeado en commit `4540d80`).
- **Activación:** NO llamar `skipWaiting()` en install — rompería workouts activos. El nuevo SW se activa naturalmente cuando no hay clientes con el SW anterior (próxima apertura de app).
- **Bump de versión:** cambiar `CACHE_NAME = 'gymtracker-vXXX'` solo cuando hay cambios estructurales en cache (nuevos assets, reorganización). Cambios solo de código en `sw.js` activan el nuevo SW automáticamente por diff de bytes.

## MCPs Configurados en Este Proyecto
- **supabase** — consultas y modificaciones de BD
- **github** — commits, PRs, estado del repo
- **playwright** — testing visual de la app en browser

## Archivos del Proyecto (Estructura Relevante)
```
aora-live/
├── index.html              # App completa (~14,000 líneas)
├── sw.js                   # Service Worker (v119, early-return para supabase.co)
├── manifest.json           # PWA manifest
├── watch.html              # Companion para Samsung Galaxy Watch
├── CNAME                   # app.aoralive.com (GitHub Pages custom domain)
├── CLAUDE.md               # Este archivo — contexto del proyecto
├── .gitignore              # Excluye mcp_config*.json (tienen API keys)
├── .github/
│   └── workflows/
│       └── preview.yml     # PR preview action (EN DISEÑO — incompatible con Pages=main)
├── supabase/
│   ├── config.toml
│   ├── migrations/
│   │   └── 20260413165041_remote_schema.sql
│   └── functions/
│       ├── coach-chat/     # Chat IA con coaches
│       ├── generate-insights/ # Análisis semanal IA
│       └── tts-coach/      # ElevenLabs TTS
├── Images/
│   ├── coaches/            # Fotos de coaches (maria1.png, etc.)
│   └── exercises/          # 60+ ilustraciones PNG en snake_case minúscula
├── Icons/SVG/              # 40+ iconos SVG del design system
└── videos/                 # Videos generados con Kling AI
    └── maria_rotaciones_brazos.mp4
```

**Ramas del repo:**
- `main` — producción, deploya a GitHub Pages + Cloudflare Pages
- `gh-pages` — creada por `rossjrw/pr-preview-action` en validación; contiene `pr-preview/pr-2/` (orphan, no servido actualmente). No borrar hasta decidir Camino A vs B de PR Previews.

**Archivos ignorados por git** (contienen API keys o son locales):
- `mcp_config.json`, `mcp_config_min.json` — RapidAPI key
- `serve3001.js` — dev server local
- `.claude/agents/`, `.claude/skills/`, `.claude/settings.local.json.bak`

## Comandos Útiles
```bash
# Ver estado del deploy
git log --oneline -5

# Push a producción (deploya a app.aoralive.com Y aora-live.pages.dev)
git add . && git commit -m "feat: descripción" && git push origin main

# Encontrar exerciseDB array
grep -n "exerciseDB\s*=" index.html

# Encontrar COACH_ALERTS
grep -n "COACH_ALERTS" index.html

# Encontrar showScreen map
grep -n "const screenMap" index.html

# Encontrar mapas de ejercicios
grep -n "EXERCISE_EN\|EXERCISE_IDS\|EXERCISE_ILLUSTRATIONS" index.html | head -10

# Encontrar funciones TTS
grep -n "function speakCoach\|function _speakElevenLabs\|_elAvailable\|voiceAlertMode" index.html | head -15

# ── Edge Functions ────────────────────────────────────────────
# Deploy de UNA Edge Function
npx supabase functions deploy <nombre-funcion> --project-ref edythbvezafpnkslavcv

# Deploy de TODAS las Edge Functions (usar tras cambios en CORS)
npx supabase functions deploy coach-chat --project-ref edythbvezafpnkslavcv && \
npx supabase functions deploy generate-insights --project-ref edythbvezafpnkslavcv && \
npx supabase functions deploy tts-coach --project-ref edythbvezafpnkslavcv

# Verificar CORS configurado en las 3 Edge Functions
grep -n "ALLOWED_ORIGINS\|aora-live.pages.dev" supabase/functions/*/index.ts

# ── Service Worker ────────────────────────────────────────────
# Ver versión actual del cache
grep -n "CACHE_NAME" sw.js

# Bump de versión del SW (solo si hay cambios en ASSETS[])
# Editar sw.js línea 1: const CACHE_NAME = 'gymtracker-vXXX';

# ── Ver tablas de Supabase ────────────────────────────────────
# → Preguntarle directamente a Claude Code usando MCP supabase
```

## Contacto del Proyecto
- **Co-founder:** Andy (lucopio.afd@gmail.com)
- **Cuenta GitHub:** Lucopio
- **Cuenta Supabase:** misma cuenta

## gstack — Skills de Claude Code

Skills instaladas en `C:\Users\adomi\.claude\skills\gstack`.

### Skills activas para Aora Live

| Skill | Cuándo usarla |
|---|---|
| `/investigate` | Antes de tocar cualquier bug — root-cause primero, código después |
| `/careful` | Activar antes de cambios destructivos (borrar secciones del monolito, reset de localStorage, DROP TABLE) |
| `/freeze` | Bloquear edits fuera del scope durante una tanda — evita que Claude Code "arregle" JS adyacente |
| `/guard` | `/careful` + `/freeze` juntos — para tandas de alto riesgo |
| `/review` | Antes de hacer merge/push a `main` — detecta bugs que pasan el ojo humano |
| `/supabase` | Para cambios en Edge Functions o schema de BD |

### Skills disponibles pero no prioritarias

`/retro`, `/document-release`, `/cso`, `/plan-eng-review`, `/design-review`

### Skills NO relevantes para este proyecto

`/browse`, `/qa` (requieren browser headless — no funciona en Windows sin display), `/ship` (deploy es `git push` directo), `/plan-ceo-review`, `/office-hours` (visión ya definida)

### Regla de uso

**Siempre correr `/investigate` antes de implementar cualquier bug fix.** El monolito de 10K+ líneas tiene dependencias no obvias — nunca asumir el root cause sin trazar el flujo primero.

**Activar `/freeze` al inicio de cada tanda** con el directorio o función objetivo para evitar cambios accidentales fuera del scope.
## Skill routing

When the user's request matches an available skill, ALWAYS invoke it using the Skill
tool as your FIRST action. Do NOT answer directly, do NOT use other tools first.
The skill has specialized workflows that produce better results than ad-hoc answers.

Key routing rules:
- Product ideas, "is this worth building", brainstorming → invoke office-hours
- Bugs, errors, "why is this broken", 500 errors → invoke investigate
- Ship, deploy, push, create PR → invoke ship
- QA, test the site, find bugs → invoke qa
- Code review, check my diff → invoke review
- Update docs after shipping → invoke document-release
- Weekly retro → invoke retro
- Design system, brand → invoke design-consultation
- Visual audit, design polish → invoke design-review
- Architecture review → invoke plan-eng-review
- Save progress, checkpoint, resume → invoke checkpoint
- Code quality, health check → invoke health
