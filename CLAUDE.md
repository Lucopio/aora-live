# AORA LIVE — Contexto de Proyecto para Claude Code

## Identidad del Proyecto
- **Nombre:** Aora Live (antes GymTracker)
- **Tipo:** PWA fitness app — mercado LATAM con ambición global
- **URL producción:** https://lucopio.github.io/aora-live (via GitHub Pages)
- **Repositorio:** https://github.com/Lucopio/aora-live
- **Rama principal:** `main`

## Stack Técnico
- **Arquitectura:** Monolítica — un solo archivo `index.html` (~10,050 líneas)
- **Backend:** Supabase (`edythbvezafpnkslavcv.supabase.co`)
- **Auth:** Supabase Auth (email/password)
- **Storage local:** localStorage (offline-first) — no se usa IndexedDB
- **Deploy:** GitHub Pages (automático al hacer push a `main`)
- **PWA:** Service Worker (`sw.js`) + `manifest.json` + meta tags Apple
- **Companion:** `watch.html` para Samsung Galaxy Watch
- **Fuentes:** Syne (display), DM Sans (body), JetBrains Mono (mono)
- **Iconos:** 40+ SVGs custom en `Icons/SVG/` — referenciados como `<img>` en el nav y UI

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

## 4 Entrenadores IA (Diferenciador Principal)
| Entrenador | País | Especialidad | Personalidad |
|---|---|---|---|
| **María** | Colombia 🇨🇴 | HIIT, funcional | Energética, empática |
| **Carlos** | México 🇲🇽 | Fuerza, hipertrofia | Datos-driven, preciso |
| **Andrea** | Argentina 🇦🇷 | Movilidad, wellness | Equilibrada, reflexiva |
| **Diego** | Perú 🇵🇪 | Calistenia, resistencia | Resiliente, sereno |

Los entrenadores son IA — los usuarios lo saben. La confianza se construye por **competencia**, no por transparencia. Las fotos deben verse como personas reales profesionales.

### Sistema de Coach Alerts (Implementado)
Alertas hardcodeadas (cero costo IA) en `COACH_ALERTS` (~línea 3503). Cada alerta tiene mensajes por coach:
- **hydration** — Recordatorios de hidratación cada X minutos de entrenamiento
- **warmupSkipped** — Cuando el usuario salta el calentamiento
- Los mensajes se muestran como toasts con avatar del coach seleccionado

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
- **Insights/Progreso** (Edge Function `generate-insights` + analytics locales)
- **Warmup inteligente** pre-entrenamiento con ejercicios específicos
- **Coach alerts** (hydration, warmup-skipped) — hardcoded, cero costo IA
- **Streak semanal** (badge 🔥 en home)
- **Ciclo menstrual** (4 fases con recomendaciones en home pill)
- **Welcome flow** (4 slides explicando la app)
- **Onboarding** (7 pasos con selección de coach)
- **Historial** de entrenamientos pasados
- **Summary post-workout** con RPE promedio, tip IA, y feedback semanal
- **Tutorial system** (coachmarks + hints contextuales)
- **Back button handler** (popstate con cierre de overlays)
- **Rutinas preset** con wizard de 3 pasos (nivel → tiempo → rutina) via `renderRoutines()`

## ExerciseDB & GIFs
- **API:** RapidAPI endpoint `exercisedb.p.rapidapi.com/exercises/name/{name}?limit=1`
- **Cache:** localStorage key `aora_gif_cache` — cada GIF se busca una vez y se almacena permanentemente
- **Quota:** 500 calls/mes en free tier
- **Ubicación del array:** `grep -n "exerciseDB\s*=" index.html` (~línea 4736)
- **Grupos:** Pecho, Espalda, Hombros, Bíceps, Tríceps, Core, Piernas, Glúteos, Cardio, Calistenia

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
3. **Alerta persistente** — notificaciones que no se descartan correctamente
4. **Series evaluation window** — ventana de evaluación de series incorrecta
5. **Unilateral exercise side-switching** — ejercicios unilaterales no alternan lado correctamente

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

## MCPs Configurados en Este Proyecto
- **supabase** — consultas y modificaciones de BD
- **github** — commits, PRs, estado del repo
- **playwright** — testing visual de la app en browser

## Comandos Útiles
```bash
# Ver estado del deploy
git log --oneline -5

# Push a producción
git add . && git commit -m "feat: descripción" && git push origin main

# Encontrar exerciseDB array
grep -n "exerciseDB\s*=" index.html

# Encontrar COACH_ALERTS
grep -n "COACH_ALERTS" index.html

# Encontrar showScreen map
grep -n "const screenMap" index.html

# Ver tablas de Supabase
# → Preguntarle directamente a Claude Code usando MCP
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
