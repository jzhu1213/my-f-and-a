// ============================================================================
// Spanish (es) — initial second language
// ============================================================================
//
// Task 197.1 — i18n scaffolding (Group 28: Internationalization).
//
// Typed as a PartialTranslationResource: every key is optional, so Spanish can
// ship incrementally and any missing key falls back to English at lookup time.
// This bundle covers the same representative starter set as English.
//
// Tone (Task 124 — warm, shame-free): the Spanish copy preserves the kind,
// encouraging, jargon-free voice. Nothing is judgmental. "Mañana empieza de
// nuevo" over "gastaste de más." Warmth carries across the translation.

import type { PartialTranslationResource } from '../types'

export const es: PartialTranslationResource = {
  // --------------------------------------------------------------------------
  // Common UI labels
  // --------------------------------------------------------------------------
  'common.save': 'Guardar',
  'common.cancel': 'Cancelar',
  'common.done': 'Listo',
  'common.edit': 'Editar',
  'common.delete': 'Eliminar',
  'common.undo': 'Deshacer',
  'common.back': 'Atrás',
  'common.next': 'Siguiente',
  'common.skip': 'Omitir',
  'common.gotIt': 'Entendido',
  'common.today': 'Hoy',
  'common.yesterday': 'Ayer',

  'nav.home': 'Inicio',
  'nav.history': 'Historial',
  'nav.tools': 'Herramientas',
  'nav.settings': 'Ajustes',

  // --------------------------------------------------------------------------
  // Onboarding
  // --------------------------------------------------------------------------
  'onboarding.welcomeTitle': 'Bienvenido a Folio',
  'onboarding.welcomeSubtitle': 'Veamos cuánto puedes gastar hoy: sin estrés y sin configuración obligatoria.',
  'onboarding.coreQuestion': '¿Puedo permitirme esto hoy?',
  'onboarding.getStarted': 'Empezar',
  'onboarding.skipForNow': 'Lo configuro más tarde',
  'onboarding.incomePrompt': '¿Con cuánto dinero cuentas más o menos?',
  'onboarding.incomeHelp': 'Un número aproximado es perfecto. Siempre puedes cambiarlo después.',
  'onboarding.allSet': '¡Todo listo!',
  'onboarding.allSetSubtitle': 'Este es tu margen para gastar hoy. Ve registrando sobre la marcha.',

  // --------------------------------------------------------------------------
  // Daily allowance hero
  // --------------------------------------------------------------------------
  'allowance.leftToday': 'para gastar hoy',
  'allowance.spentToday': 'gastado hoy',
  'allowance.statusHealthy': 'Todo bien',
  'allowance.statusCaution': 'Ojo',
  'allowance.statusWarning': 'Casi ahí',
  'allowance.statusOver': 'Hoy va un poco justo',

  'allowance.msgHealthyHigh': '¡Bien! Te quedan {amount} hoy.',
  'allowance.msgHealthyMid': 'Vas muy bien: {amount} por delante.',
  'allowance.msgHealthyLow': 'Aún te quedan {amount}. ¡Vas por buen camino!',
  'allowance.msgCaution': 'Ojo: te quedan {amount} hoy.',
  'allowance.msgCautionLow': 'Ya casi: te quedan {amount}. Tú puedes.',
  'allowance.msgWarning': 'Casi ahí: solo {amount} hoy.',
  'allowance.msgAtLimit': 'Justo en tu límite. Buen trabajo manteniéndote.',
  'allowance.msgOverSmall': 'Hoy va un poco justo: mañana empieza de nuevo.',
  'allowance.msgOverMid': 'Hoy te pasaste, pero tranqui. Mañana es un nuevo comienzo.',
  'allowance.msgOverLarge': 'Día movidito: mañana empiezas de cero.',
  'allowance.usuallyBand': 'normalmente {low}–{high}',

  // --------------------------------------------------------------------------
  // Quick log
  // --------------------------------------------------------------------------
  'quicklog.addExpense': 'Agregar gasto',
  'quicklog.addIncome': 'Agregar ingreso',
  'quicklog.amount': 'Monto',
  'quicklog.category': 'Categoría',
  'quicklog.note': 'Nota',
  'quicklog.notePlaceholder': '¿Para qué fue? (opcional)',
  'quicklog.saved': 'Registrado {amount}',
  'quicklog.savedUndoHint': 'Registrado: toca para deshacer',

  // --------------------------------------------------------------------------
  // Contextual tips
  // --------------------------------------------------------------------------
  'tip.titleCelebration': '¡Vas increíble!',
  'tip.titleGentleNudge': 'Ojo',
  'tip.titleDidYouKnow': 'Consejo rápido',
  'tip.titleSmartSuggestion': 'Prueba esto',
  'tip.pacingOnTrack': 'Vas a buen ritmo esta semana.',
  'tip.pacingEasy': 'Te queda margen de sobra esta semana: gasta con calma.',
  'tip.anomalyGentle': 'Es un poco más de lo habitual para ti: todo bien si fue a propósito.',
  'tip.billReminder': '{name} llega pronto.',
  'tip.dismiss': 'Descartar',

  // --------------------------------------------------------------------------
  // Categories
  // --------------------------------------------------------------------------
  'category.food': 'Comida',
  'category.rent': 'Renta',
  'category.transport': 'Transporte',
  'category.school': 'Escuela',
  'category.fun': 'Ocio',
  'category.health': 'Salud',
  'category.subscriptions': 'Suscripciones',
  'category.other': 'Otro',
  'category.gig': 'Trabajo extra',
  'category.income': 'Ingreso',

  // --------------------------------------------------------------------------
  // Settings
  // --------------------------------------------------------------------------
  'settings.language': 'Idioma',
  'settings.languageHelp': 'Elige el idioma de las etiquetas y los mensajes.',
  'settings.languageEnglish': 'English',
  'settings.languageSpanish': 'Español',

  // --------------------------------------------------------------------------
  // Home screen
  // --------------------------------------------------------------------------
  'home.logExpense': 'Registrar gasto',
  'home.logIncome': 'Registrar ingreso',
  'home.logFirstExpense': 'Registra tu primer gasto',
  'home.sectionRecent': 'Recientes',
  'home.sectionCategories': 'Categorías',
  'home.seeAll': 'Ver todo →',
  'home.split': '🤝 Dividir',
  'home.canIAfford': '🤔 ¿Me alcanza?',
  'home.addWish': '⭐ + Deseo',
  'home.logIncomeArrow': 'Registrar ingreso →',
  'home.overBudgetGentle': 'Hoy gastaste un poco más — mañana empieza de nuevo ✨',
  'home.overBudgetStrip': 'El presupuesto de mañana se reinicia — o registra un ingreso hoy.',
  'home.estimateNudge': '✨ Estimado — registra un ingreso para mayor precisión →',
  'home.zeroSpendMark': '🎯 ¿Nada gastado? Marcar como día $0',
  'home.zeroSpendConfirm': '✓ Día registrado — la racha continúa',
  'home.spendDownOnTrack': 'En buen camino ✓',
  'home.spendDownAhead': 'Un poco adelantado',
  'home.emptyFirstRunTitle': 'Aquí aparecerán tus gastos.',
  'home.emptyFirstRunSubtitle': 'Registra tu primer gasto y mira cómo toma forma tu día.',
  'home.emptyTitle': 'Listo cuando quieras',
  'home.emptySubtitle': 'Registra tu primer gasto y Folio empieza a aprender tus hábitos',
  'home.emptyAction': 'Registrar gasto →',
  'home.categoryEmptyTitle': 'Todo listo para empezar — los límites son opcionales',
  'home.categoryEmptySubtitle': 'Agrega límites por categoría en cualquier momento para un número diario más preciso',
  'home.categoryEmptyAction': 'Configurar límites →',
  'home.viewAllSplits': 'Ver todo ({count}) →',

  // --------------------------------------------------------------------------
  // History screen
  // --------------------------------------------------------------------------
  'history.title': 'Historial',
  'history.showing': 'Mostrando {count} {noun} de {total} en total',
  'history.transaction': 'transacción',
  'history.transactions': 'transacciones',

  // --------------------------------------------------------------------------
  // Quick log — validation & actions
  // --------------------------------------------------------------------------
  'quicklog.logExpense': 'Registrar gasto',
  'quicklog.cancel': 'Cancelar',
  'quicklog.validationInvalid': 'Ingresa un monto válido',
  'quicklog.validationPositive': 'El monto debe ser mayor a $0',
  'quicklog.validationMax': 'El monto no puede exceder ${max}',
  'quicklog.notePlaceholderShort': 'Nota (opcional)',
}
