# AORA LIVE — Contexto de Proyecto para Claude Code

## Identidad del Proyecto
- **Nombre:** Aora Live (antes GymTracker)
- **Tipo:** PWA fitness app — mercado LATAM
- **URL producción:** https://lucopio.github.io/aora-live (via GitHub Pages)
- **Repositorio:** https://github.com/Lucopio/aora-live
- **Rama principal:** `main`

## Stack Técnico
- **Arquitectura:** Monolítica — un solo archivo `index.html` (~10,000 líneas)
- **Backend:** Supabase (`edythbvezafpnkslavcv.supabase.co`)
- **Auth:** Supabase Auth (email/password)
- **Storage local:** IndexedDB (offline-first) + localStorage
- **Deploy:** GitHub Pages (automático al hacer push a `main`)
- **Companion:** `watch.html` para Samsung Galaxy Watch
- **Fuentes:** Syne (display), DM Sans (body), JetBrains Mono (mono)

## Design System — Dark Premium UI
```
--bg: #080A0F
--surface: #111318
--surface2: #1A1D24
--primary: #00E5FF        (cyan)
--accent2: #7B61FF        (violet)
--text-primary: #FFFFFF
--text-secondary: #8A8F9E
--success: #00C896
--danger: #FF4D6D
--warning: #FFB800
--radius: 16px
```

## Base de Datos Supabase
| Tabla | Filas | RLS |
|---|---|---|
| `profiles` | 4 | ✅ |
| `workouts` | 5 | ✅ |
| `workout_exercises` | 4 | ✅ |
| `exercise_sets` | 15 | ✅ |
| `custom_exercises` | 2 | ✅ |
| `last_weights` | 9 | ✅ |
| `ai_insights` | 0 | ✅ |

## 4 Entrenadores IA (Diferenciador Principal)
| Entrenador | País | Especialidad | Personalidad |
|---|---|---|---|
| **María** | Colombia 🇨🇴 | HIIT, funcional | Energética, empática |
| **Carlos** | México 🇲🇽 | Fuerza, hipertrofia | Datos-driven, preciso |
| **Andrea** | Argentina 🇦🇷 | Movilidad, wellness | Equilibrada, reflexiva |
| **Diego** | Perú 🇵🇪 | Calistenia, resistencia | Resiliente, sereno |

Los entrenadores son IA — los usuarios lo saben. La confianza se construye por **competencia**, no por transparencia. Las fotos deben verse como personas reales profesionales.

## Segundo Diferenciador: Rest/Recovery Tracking
Sistema inteligente de seguimiento de descanso entre series — gap identificado en JEFIT, Strong y MyFitnessPal. El rest timer es crítico y su estado no debe perderse entre navegaciones.

## Estructura de Pantallas (showScreen)
- `auth` — Login/signup
- `home` — Dashboard principal
- `workout` — Entrenamiento activo
- `history` — Historial de sesiones
- `routines` — Biblioteca de rutinas
- `progress` — Progreso y estadísticas
- `settings` — Configuración y perfil
- `warmup` — Calentamiento pre-entrenamiento

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

## Bugs Conocidos (Prioridad de Implementación)
1. **Rest timer state loss** — el timer pierde estado al navegar (ROOT CAUSE de múltiples bugs)
2. **Back button** — comportamiento inconsistente al volver de workout
3. **Alerta persistente** — notificaciones que no se descartan correctamente
4. **Series evaluation window** — ventana de evaluación de series incorrecta
5. **Unilateral exercise side-switching** — ejercicios unilaterales no alternan lado correctamente

## En Desarrollo / Próximas Features
- Dark Premium UI redesign (seleccionado sobre LATAM-forward y Clean Science)
- Videos de entrenamiento con María (generados con Kling AI — Video O1)
- Sistema de gamificación: streaks, progreso histórico por ejercicio
- Onboarding mejorado: 4 pantallas rediseñadas
- Importación de rutinas
- Perfil de salud/lifestyle
- Check-ins semanales de dolor

## Videos de Entrenadores (Kling AI)
- Modelo: **Kling Video O1** (superior a Kling 3.0 Omni para ejercicios)
- Directorio: `videos/` junto a `index.html`
- María: piel morena, cabello negro ondulado largo, complexión atlética
- Los prompts deben: nombrar el personaje explícitamente, incluir descriptores físicos, especificar ángulo lateral, indicar que imágenes de referencia son solo para técnica
- Ejercicios pendientes: sentadilla trasera (validada), peso muerto, hack squat, leg press

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

# Ver tablas de Supabase
# → Preguntarle directamente a Claude Code usando MCP
```

## Contacto del Proyecto
- **Co-founder:** Andy (lucopio.afd@gmail.com)
- **Cuenta GitHub:** Lucopio
- **Cuenta Supabase:** misma cuenta
