export const LOCALE_COOKIE_NAME = 'lifemetric';
export const LOCALE_EXPLICIT_COOKIE_NAME = 'lifemetric_locale_explicit';

export type Locale = 'es' | 'en';

type LocaleResolutionInput = {
  cookieLocale?: string | null;
  explicitCookie?: string | null;
  acceptLanguage?: string | null;
  country?: string | null;
  city?: string | null;
};

export const defaultLocale: Locale = 'en';

const supportedLocales = new Set<Locale>(['es', 'en']);
const spanishSpeakingCountries = new Set([
  'AR', 'BO', 'CL', 'CO', 'CR', 'CU', 'DO', 'EC', 'ES', 'GQ', 'GT', 'HN', 'MX', 'NI', 'PA', 'PE', 'PR', 'PY', 'SV', 'UY', 'VE',
]);
const spanishSpeakingCities = new Set([
  'barcelona', 'bogota', 'buenos aires', 'caracas', 'cdmx', 'guadalajara', 'guayaquil', 'lima', 'madrid', 'medellin', 'mexico city', 'monterrey', 'montevideo', 'quito', 'rosario', 'san jose', 'santiago', 'santo domingo', 'sevilla', 'valencia',
]);

const messages = {
  es: {
    common: {
      appDescription: 'Monitoreo metabólico avanzado y preciso.',
      appDescriptionDetail: 'Cuida tu salud con datos clínicos en tiempo real.',
      language: 'Idioma',
      languageHelper: 'También podemos elegirlo automáticamente según tu ciudad.',
      languageAuto: 'Automático por ubicación',
      spanish: 'Español',
      english: 'Inglés',
      back: 'Volver',
      save: 'Guardar',
      saving: 'Guardando...',
      today: 'Hoy',
      optional: 'Opcional',
      close: 'Cerrar',
      select: 'Seleccione',
      yes: 'Sí',
      no: 'No',
    },
    navigation: {
      home: 'Inicio',
      food: 'Comida',
      glucose: 'Glucosa',
      habits: 'Hábitos',
      patients: 'Pacientes',
      summary: 'Resumen',
      medication: 'Medicación',
      labs: 'Laboratorios',
      logout: 'Cerrar sesión',
    },
    auth: {
      login: {
        title: 'Bienvenido',
        subtitle: 'Ingresa a tu portal de monitoreo',
        email: 'Correo electrónico',
        password: 'Contraseña',
        forgotPassword: '¿Olvidaste tu contraseña?',
        submit: 'Ingresar',
        submitting: 'Ingresando...',
        noAccount: '¿No tienes cuenta?',
        registerLink: 'Regístrate como paciente',
        metricsToday: 'Métricas de hoy',
      },
      register: {
        heroTitle: 'Regístrate',
        heroSubtitle: 'Únete a {appName} y toma el control de tu metabolismo y salud con herramientas avanzadas.',
        title: 'Crea tu cuenta',
        subtitle: 'Completa tus datos iniciales de paciente',
        firstName: 'Nombre',
        lastName: 'Apellido',
        email: 'Correo electrónico',
        password: 'Contraseña',
        passwordPlaceholder: 'Mín. 6 caracteres',
        age: 'Edad',
        biologicalSex: 'Sexo biológico',
        male: 'Masculino',
        female: 'Femenino',
        diagnosis: 'Diagnóstico principal (inicial)',
        diagnosisPlaceholder: 'Ej. Prediabetes, control metabólico...',
        submit: 'Registrarme',
        submitting: 'Creando cuenta...',
        alreadyHaveAccount: '¿Ya tienes una cuenta?',
        loginLink: 'Inicia sesión',
        newsletterOptIn: 'Deseo suscribirme y recibir correos informativos.',
      },
      recover: {
        title: 'Recuperar contraseña',
        subtitle: 'Ingresa el correo asociado a tu cuenta para recibir las instrucciones de recuperación.',
        email: 'Correo electrónico',
        submit: 'Enviar instrucciones',
        submitting: 'Procesando...',
        backToLogin: '← Volver al login',
        backToHome: 'Volver al inicio',
      },
      messages: {
        invalidCaptcha: 'Captcha inválido',
        invalidCredentials: 'Credenciales inválidas',
        invalidData: 'Datos no válidos',
        invalidRegisterData: 'Datos de registro no válidos',
        registerEmailUnavailable: 'Este correo electrónico no está disponible.',
        recoverSuccess: 'Si el correo existe, recibirás instrucciones para recuperar tu contraseña.',
        serverError: 'Ocurrió un error en el servidor.',
        registerError: 'Error al registrar al paciente.',
        recoveryError: 'Ocurrió un error al procesar la solicitud.',
      },
    },
    home: {
      greeting: 'Hola, {name} 👋',
      subtitle: 'Recomendaciones clínicas activas para ti hoy.',
      foodTitle: 'Registrar comida',
      foodSubtitle: 'Lleva el control de tu alimentación',
      glucoseTitle: 'Registrar glucosa',
      glucoseSubtitle: 'Lleva el control de tus niveles',
      habitsTitle: 'Hábitos diarios',
      habitsSubtitle: 'Sueño, agua y actividad',
      medicationTitle: 'Mi medicación',
      medicationSubtitle: 'Dosis programadas para hoy',
      labsTitle: 'Laboratorios',
      labsSubtitle: 'Sube resultados de análisis',
      quickActions: 'Acciones Rápidas',
      healthOverview: 'Resumen de Salud',
    },
    summary: {
      title: 'Resumen semanal',
      last7Days: 'Últimos 7 días',
      customRange: 'Rango personalizado',
      rangeFrom: 'Desde',
      rangeTo: 'Hasta',
      patientReport: 'Paciente / Reporte de progreso',
      averageGlucose: 'Promedio glucosa (7d)',
      lastHbA1c: 'Última HbA1c',
      mainAlert: 'Alerta principal',
      detectedPattern: 'Patrón detectado',
      detailedAnalysis: 'Análisis detallado',
      mealsLogged: 'Comidas reg.',
      inadequate: 'Inadecuadas',
      exerciseDays: 'Días ejercicio',
      sleepAverage: 'Prom. sueño',
      waterPerDay: 'Vasos / día',
      medicationAdherence: 'Adherencia meds',
      medicationsSectionTitle: 'Medicamentos reportados',
      medicationsSectionSubtitle: 'Resumen de lo que tomaste en el rango seleccionado.',
      medicationsTakenLabel: 'Registros',
      noMedicationData: 'Aún no hay registros de medicación en este período.',
      aiSuggestionsTitle: 'Sugerencias inteligentes',
      aiSuggestionsSubtitle: 'Resumen y recomendaciones basadas en comidas, hábitos, glucosa, laboratorios y medicación.',
      aiSuggestionsFallback: 'No hay suficiente información para generar sugerencias clínicas precisas por ahora.',
      aiSuggestionsDisclaimer: 'Estas sugerencias son orientativas y no reemplazan la evaluación médica profesional.',
      glucosePeaks: 'Se detectaron picos de glucosa recientes.',
      glucoseInRange: 'Tus niveles están en rango.',
      keepTracking: 'Sigue registrando para identificar patrones.',
      laboratorySection: 'Laboratorios',
      latestResults: 'Resultados mÃ¡s recientes',
      studyDate: 'Fecha del estudio',
      glycemicProfile: 'Perfil glucÃ©mico',
      lipidProfile: 'Perfil lipÃ­dico',
      fastingGlucose: 'Glucosa ayuno',
      triglycerides: 'TriglicÃ©ridos',
      hdl: 'HDL',
      ldl: 'LDL',
      viewAttachment: 'Ver archivo adjunto',
      noAttachment: 'Sin archivo adjunto',
      historyTitle: 'Historial de laboratorios',
      historySubtitle: 'Consulta los Ãºltimos estudios registrados.',
      noLabs: 'AÃºn no hay laboratorios registrados.',
      uploadLabs: 'Registrar laboratorios',
    },
    foodHistory: {
      title: 'Historial de alimentación',
      subtitle: 'Consulta lo que has registrado cada día',
      enlargedFood: 'Comida ampliada',
      noDescription: 'Sin descripción detallada',
      viewMealPhoto: 'Ver foto de la comida',
      noRecordsTitle: 'Día sin registros',
      noRecordsQuote: 'La constancia es la base del éxito metabólico',
      registerMeal: 'Registrar comida',
      selectDayWithData: 'Días con registros',
      selectMonth: 'Mes',
      selectYear: 'Año',
      normal: 'Normal',
      poor: 'Deficiente',
      bad: 'Mala',
    },
    foodForm: {
      title: 'Registrar comida',
      healthyFoodAlt: 'Comida saludable',
      breakfast: 'Desayuno',
      lunch: 'Comida',
      dinner: 'Cena',
      snack: 'Colación',
      date: 'Fecha',
      time: 'Hora',
      mealPhoto: 'Foto de la comida',
      dragAndDrop: 'Arrastra y suelta tu imagen aquí',
      clickToSelect: 'o haz clic para seleccionar',
      mainFoodAndNotes: 'Alimento principal / notas',
      mainFoodPlaceholder: 'Ej. Pollo con vegetales',
      notePlaceholder: '¿Cómo te sentiste? (opcional)',
      submit: 'Guardar registro',
      submitting: 'Guardando...',
      imageOnly: 'Por favor, selecciona una imagen.',
      saveSuccess: 'Comida registrada exitosamente',
      saveError: 'Hubo un error al guardar la comida',
      virusScanning: 'Escaneando archivo en VirusTotal. Si pasa, lo subiremos automáticamente...',
      virusPassed: 'Verificación completada. Archivo seguro, iniciando subida.',
      virusBlocked: 'Subida bloqueada.',
      virusFallback: 'VirusTotal no está disponible en este momento. Continuamos de forma resiliente.',
    },
    glucoseForm: {
      title: 'Registrar glucosa',
      glucoseLevel: 'Nivel de glucosa (mg/dL)',
      date: 'Fecha',
      time: 'Hora',
      momentOfDay: 'Momento del día',
      fasting: 'Ayuno',
      beforeMeal: 'Antes de comer',
      oneHourAfterMeal: '1h post-comida',
      twoHoursAfterMeal: '2h post-comida',
      linkMeal: 'Relacionar con comida',
      noMealLink: '(No relacionar / opcional)',
      todayAt: 'Hoy',
      linkMealHelper: 'Seleccionar una comida nos ayuda a calcular su respuesta metabólica.',
      submit: 'Guardar glucosa',
      submitting: 'Registrando nivel...',
      success: 'Glucosa registrada con éxito',
    },
    habitsForm: {
      title: 'Mis hábitos',
      heading: '¿Cómo te fue hoy?',
      subtitle: 'Registra tus métricas para encontrar patrones de bienestar.',
      water: 'Agua (vasos)',
      waterHint: '250 ml aprox por vaso',
      sleep: 'Sueño (horas)',
      sleepHint: 'Tiempo de descanso nocturno',
      exercise: 'Ejercicio (minutos)',
      exerciseHint: 'Actividad física del día',
      vitals: 'Signos vitales y peso',
      vitalsHint: 'Opcional pero recomendado',
      systolic: 'PA sistólica',
      diastolic: 'PA diastólica',
      pulse: 'Pulso (bpm)',
      weight: 'Peso (kg)',
      submit: 'Guardar hábitos',
      submitting: 'Guardando...',
      success: 'Hábitos registrados (simulación)',
    },
    labsForm: {
      title: 'Laboratorios',
      heading: 'Añadir resultados de laboratorio',
      subtitle: 'Sube tus análisis y registra los principales biomarcadores metabólicos.',
      studyDate: 'Fecha del estudio',
      glycemicProfile: 'Perfil glucémico',
      fastingGlucose: 'Glucosa ayuno (mg/dL)',
      lipidProfile: 'Perfil lipídico',
      triglycerides: 'Triglicéridos',
      hdl: 'HDL (bueno)',
      ldl: 'LDL (malo)',
      attachResults: 'Adjuntar PDF/foto de los resultados',
      clickToUpload: 'Haz clic para subir archivo',
      uploadHint: 'PDF, JPG o PNG máximo 10MB',
      submit: 'Guardar laboratorios',
      submitting: 'Procesando análisis...',
      success: 'Laboratorios registrados exitosamente',
      autoCompleting: 'Analizando archivo con IA...',
      autoCompleted: 'Campos de laboratorio autocompletados con IA.',
      autoCompleteError: 'No fue posible autocompletar los resultados con IA.',
      virusScanning: 'Escaneando archivo en VirusTotal. Si pasa, lo subiremos automáticamente...',
      virusPassed: 'Verificación completada. Archivo seguro, iniciando subida.',
      virusBlocked: 'Subida bloqueada.',
      virusFallback: 'VirusTotal no está disponible en este momento. Continuamos de forma resiliente.',
    },
    medicationForm: {
      title: 'Mi medicación',
      heading: 'Dosis de hoy',
      subtitle: '¿Tomaste tu medicamento como fue prescrito?',
      medication: 'Medicamento',
      dose: 'Dosis',
      date: 'Fecha',
      intakeTime: 'Hora de toma',
      intakeStatus: 'Estado de la toma',
      taken: 'Tomada',
      delayed: 'Retrasada',
      forgotten: 'Olvidada',
      omittedEffects: 'Omitida (efectos)',
      commentPlaceholder: '¿Por qué la omites? Breve comentario...',
      submit: 'Registrar dosis',
      submitting: 'Guardando...',
      success: 'Registro de medicación guardado',
    },
    patientForm: {
      title: 'Alta de paciente',
      subtitle: 'Danos los datos iniciales para el seguimiento.',
      firstName: 'Nombre',
      lastName: 'Apellido',
      email: 'Correo electrónico',
      age: 'Edad',
      sex: 'Sexo',
      male: 'Masculino',
      female: 'Femenino',
      other: 'Otro',
      diagnosis: 'Diagnóstico principal',
      usesGlucoseMeter: '¿Usa glucómetro?',
      baselineMedication: 'Medicación base',
      initialWeight: 'Peso inicial (kg)',
      initialWaist: 'Cintura inicial (cm)',
      clinicalGoal: 'Objetivo clínico',
      submit: 'Registrar paciente',
      submitting: 'Guardando...',
      success: 'Paciente guardado exitosamente',
      saveError: 'Error al guardar el paciente',
      unexpectedError: 'Ocurrió un error inesperado',
      emailTaken: 'El correo electrónico ya está registrado.',
    },
    settings: {
      title: 'Ajustes de perfil',
      changePassword: 'Cambiar contraseña',
      newPassword: 'Nueva contraseña',
      deleteEmailConfirm: 'Escribe tu correo para confirmar',
      deleteAccount: 'Eliminar cuenta',
      deleteAccountConfirm: '¿Estás seguro? Esta acción no se puede deshacer y eliminará todos tus registros médicos.',
      deleteAccountSubmit: 'Eliminar permanentemente',
      passwordChanged: 'Contraseña actualizada con éxito',
      accountDeleted: 'Cuenta eliminada. Lamentamos verte partir.',
      profileUpdated: 'Perfil actualizado con éxito',
      emailSubscriptionTitle: 'Suscripción por correo',
      emailSubscriptionDescription: 'Administra si quieres recibir novedades por email.',
      emailSubscriptionToggle: 'Mantener suscripción activa',
      emailSubscriptionSuccess: 'Preferencia de suscripción actualizada.',
      virusScanning: 'Escaneando archivo en VirusTotal. Si pasa, lo subiremos automáticamente...',
      virusPassed: 'Verificación completada. Archivo seguro, iniciando subida.',
      virusBlocked: 'Subida bloqueada.',
      virusFallback: 'VirusTotal no está disponible en este momento. Continuamos de forma resiliente.',
      fields: {
        firstName: 'Nombre',
        lastName: 'Apellido',
        email: 'Correo electrónico',
        avatar: 'Imagen de perfil',
        birthday: 'Fecha de nacimiento',
        gender: 'Sexo',
        genderMale: 'Masculino',
        genderFemale: 'Femenino',
      }
    },
  },
  en: {
    common: {
      appDescription: 'Advanced and accurate metabolic monitoring.',
      appDescriptionDetail: 'Take care of your health with real-time clinical data.',
      language: 'Language',
      languageHelper: 'We can also choose it automatically based on your city.',
      languageAuto: 'Automatic by location',
      spanish: 'Spanish',
      english: 'English',
      back: 'Back',
      save: 'Save',
      saving: 'Saving...',
      today: 'Today',
      optional: 'Optional',
      close: 'Close',
      select: 'Select',
      yes: 'Yes',
      no: 'No',
    },
    navigation: {
      home: 'Home',
      food: 'Food',
      glucose: 'Glucose',
      habits: 'Habits',
      patients: 'Patients',
      summary: 'Summary',
      medication: 'Medication',
      labs: 'Labs',
      logout: 'Sign out',
    },
    auth: {
      login: {
        title: 'Welcome back',
        subtitle: 'Access your monitoring portal',
        email: 'Email address',
        password: 'Password',
        forgotPassword: 'Forgot your password?',
        submit: 'Sign in',
        submitting: 'Signing in...',
        noAccount: "Don't have an account?",
        registerLink: 'Register as patient',
        metricsToday: 'Today metrics',
      },
      register: {
        heroTitle: 'Create account',
        heroSubtitle: 'Join {appName} and take control of your metabolism and health with advanced tools.',
        title: 'Create your account',
        subtitle: 'Complete your initial patient data',
        firstName: 'First name',
        lastName: 'Last name',
        email: 'Email address',
        password: 'Password',
        passwordPlaceholder: 'Min. 6 characters',
        age: 'Age',
        biologicalSex: 'Biological sex',
        male: 'Male',
        female: 'Female',
        diagnosis: 'Primary diagnosis (initial)',
        diagnosisPlaceholder: 'E.g. Prediabetes, metabolic control...',
        submit: 'Create account',
        submitting: 'Creating account...',
        alreadyHaveAccount: 'Already have an account?',
        loginLink: 'Sign in',
        newsletterOptIn: 'I want to subscribe and receive informational emails.',
      },
      recover: {
        title: 'Recover password',
        subtitle: 'Enter the email linked to your account to receive recovery instructions.',
        email: 'Email address',
        submit: 'Send instructions',
        submitting: 'Processing...',
        backToLogin: '← Back to login',
        backToHome: 'Back to home',
      },
      messages: {
        invalidCaptcha: 'Invalid captcha',
        invalidCredentials: 'Invalid credentials',
        invalidData: 'Invalid data',
        invalidRegisterData: 'Invalid registration data',
        registerEmailUnavailable: 'This email address is not available.',
        recoverSuccess: 'If the email exists, you will receive instructions to recover your password.',
        serverError: 'A server error occurred.',
        registerError: 'Error while registering the patient.',
        recoveryError: 'An error occurred while processing the request.',
      },
    },
    home: {
      greeting: 'Hi, {name} 👋',
      subtitle: 'Active clinical recommendations for you today.',
      foodTitle: 'Log meal',
      foodSubtitle: 'Track your daily nutrition',
      glucoseTitle: 'Log glucose',
      glucoseSubtitle: 'Track your levels',
      habitsTitle: 'Daily habits',
      habitsSubtitle: 'Sleep, water and activity',
      medicationTitle: 'My medication',
      medicationSubtitle: 'Doses scheduled for today',
      labsTitle: 'Labs',
      labsSubtitle: 'Upload test results',
      quickActions: 'Quick Actions',
      healthOverview: 'Health Overview',
    },
    summary: {
      title: 'Weekly summary',
      last7Days: 'Last 7 days',
      customRange: 'Custom range',
      rangeFrom: 'From',
      rangeTo: 'To',
      patientReport: 'Patient / Progress report',
      averageGlucose: 'Average glucose (7d)',
      lastHbA1c: 'Last HbA1c',
      mainAlert: 'Main alert',
      detectedPattern: 'Detected pattern',
      detailedAnalysis: 'Detailed analysis',
      mealsLogged: 'Meals logged',
      inadequate: 'Inadequate',
      exerciseDays: 'Exercise days',
      sleepAverage: 'Avg. sleep',
      waterPerDay: 'Glasses / day',
      medicationAdherence: 'Med adherence',
      medicationsSectionTitle: 'Medication records',
      medicationsSectionSubtitle: 'Summary of medications taken in the selected range.',
      medicationsTakenLabel: 'Entries',
      noMedicationData: 'No medication records yet for this period.',
      aiSuggestionsTitle: 'Smart suggestions',
      aiSuggestionsSubtitle: 'Summary and recommendations based on meals, habits, glucose, labs, and medication.',
      aiSuggestionsFallback: 'There is not enough information yet to generate precise clinical suggestions.',
      aiSuggestionsDisclaimer: 'These suggestions are educational and do not replace professional medical evaluation.',
      glucosePeaks: 'Recent glucose peaks were detected.',
      glucoseInRange: 'Your levels are within range.',
      keepTracking: 'Keep tracking to identify patterns.',
      laboratorySection: 'Labs',
      latestResults: 'Latest results',
      studyDate: 'Study date',
      glycemicProfile: 'Glycemic profile',
      lipidProfile: 'Lipid profile',
      fastingGlucose: 'Fasting glucose',
      triglycerides: 'Triglycerides',
      hdl: 'HDL',
      ldl: 'LDL',
      viewAttachment: 'View attachment',
      noAttachment: 'No attachment',
      historyTitle: 'Lab history',
      historySubtitle: 'Review the most recent recorded studies.',
      noLabs: 'No labs have been recorded yet.',
      uploadLabs: 'Log labs',
    },
    foodHistory: {
      title: 'Meal history',
      subtitle: 'Review what you logged each day',
      enlargedFood: 'Enlarged meal',
      noDescription: 'No detailed description',
      viewMealPhoto: 'View meal photo',
      noRecordsTitle: 'No records for this day',
      noRecordsQuote: 'Consistency is the foundation of metabolic success',
      registerMeal: 'Log meal',
      selectDayWithData: 'Days with entries',
      selectMonth: 'Month',
      selectYear: 'Year',
      normal: 'Normal',
      poor: 'Poor',
      bad: 'Bad',
    },
    foodForm: {
      title: 'Log meal',
      healthyFoodAlt: 'Healthy meal',
      breakfast: 'Breakfast',
      lunch: 'Lunch',
      dinner: 'Dinner',
      snack: 'Snack',
      date: 'Date',
      time: 'Time',
      mealPhoto: 'Meal photo',
      dragAndDrop: 'Drag and drop your image here',
      clickToSelect: 'or click to choose',
      mainFoodAndNotes: 'Main food / notes',
      mainFoodPlaceholder: 'E.g. Chicken with vegetables',
      notePlaceholder: 'How did you feel? (optional)',
      submit: 'Save entry',
      submitting: 'Saving...',
      imageOnly: 'Please select an image.',
      saveSuccess: 'Meal logged successfully',
      saveError: 'There was an error while saving the meal',
      virusScanning: 'Scanning file with VirusTotal. If it passes, we will upload it automatically...',
      virusPassed: 'Verification completed. File is safe, starting upload.',
      virusBlocked: 'Upload blocked.',
      virusFallback: 'VirusTotal is currently unavailable. Continuing in resilient mode.',
    },
    glucoseForm: {
      title: 'Log glucose',
      glucoseLevel: 'Glucose level (mg/dL)',
      date: 'Date',
      time: 'Time',
      momentOfDay: 'Time of day',
      fasting: 'Fasting',
      beforeMeal: 'Before meal',
      oneHourAfterMeal: '1h post-meal',
      twoHoursAfterMeal: '2h post-meal',
      linkMeal: 'Link to meal',
      noMealLink: '(Do not link / optional)',
      todayAt: 'Today',
      linkMealHelper: 'Selecting a meal helps us estimate its metabolic response.',
      submit: 'Save glucose',
      submitting: 'Logging level...',
      success: 'Glucose logged successfully',
    },
    habitsForm: {
      title: 'My habits',
      heading: 'How did it go today?',
      subtitle: 'Log your metrics to find wellness patterns.',
      water: 'Water (glasses)',
      waterHint: 'About 250 ml per glass',
      sleep: 'Sleep (hours)',
      sleepHint: 'Night resting time',
      exercise: 'Exercise (minutes)',
      exerciseHint: 'Physical activity of the day',
      vitals: 'Vitals and weight',
      vitalsHint: 'Optional but recommended',
      systolic: 'Systolic BP',
      diastolic: 'Diastolic BP',
      pulse: 'Pulse (bpm)',
      weight: 'Weight (kg)',
      submit: 'Save habits',
      submitting: 'Saving...',
      success: 'Habits logged (simulation)',
    },
    labsForm: {
      title: 'Labs',
      heading: 'Add lab results',
      subtitle: 'Upload your tests and record the main metabolic biomarkers.',
      studyDate: 'Study date',
      glycemicProfile: 'Glycemic profile',
      fastingGlucose: 'Fasting glucose (mg/dL)',
      lipidProfile: 'Lipid profile',
      triglycerides: 'Triglycerides',
      hdl: 'HDL (good)',
      ldl: 'LDL (bad)',
      attachResults: 'Attach PDF/photo of results',
      clickToUpload: 'Click to upload file',
      uploadHint: 'PDF, JPG or PNG up to 10MB',
      submit: 'Save labs',
      submitting: 'Processing analysis...',
      success: 'Labs saved successfully',
      autoCompleting: 'Analyzing file with AI...',
      autoCompleted: 'Lab fields were auto-filled with AI.',
      autoCompleteError: 'Unable to auto-fill results with AI.',
      virusScanning: 'Scanning file with VirusTotal. If it passes, we will upload it automatically...',
      virusPassed: 'Verification completed. File is safe, starting upload.',
      virusBlocked: 'Upload blocked.',
      virusFallback: 'VirusTotal is currently unavailable. Continuing in resilient mode.',
    },
    medicationForm: {
      title: 'My medication',
      heading: "Today's dose",
      subtitle: 'Did you take your medication as prescribed?',
      medication: 'Medication',
      dose: 'Dose',
      date: 'Date',
      intakeTime: 'Intake time',
      intakeStatus: 'Dose status',
      taken: 'Taken',
      delayed: 'Delayed',
      forgotten: 'Forgotten',
      omittedEffects: 'Skipped (side effects)',
      commentPlaceholder: 'Why did you skip it? Short comment...',
      submit: 'Log dose',
      submitting: 'Saving...',
      success: 'Medication entry saved',
    },
    patientForm: {
      title: 'New patient',
      subtitle: 'Share the initial data for follow-up.',
      firstName: 'First name',
      lastName: 'Last name',
      email: 'Email address',
      age: 'Age',
      sex: 'Sex',
      male: 'Male',
      female: 'Female',
      other: 'Other',
      diagnosis: 'Primary diagnosis',
      usesGlucoseMeter: 'Uses glucose meter?',
      baselineMedication: 'Baseline medication',
      initialWeight: 'Initial weight (kg)',
      initialWaist: 'Initial waist (cm)',
      clinicalGoal: 'Clinical goal',
      submit: 'Register patient',
      submitting: 'Saving...',
      success: 'Patient saved successfully',
      saveError: 'Error while saving the patient',
      unexpectedError: 'An unexpected error occurred',
      emailTaken: 'This email address is already registered.',
    },
    settings: {
      title: 'Profile Settings',
      changePassword: 'Change password',
      newPassword: 'New password',
      deleteEmailConfirm: 'Type your email to confirm',
      deleteAccount: 'Delete account',
      deleteAccountConfirm: 'Are you sure? This action cannot be undone and will delete all your medical records.',
      deleteAccountSubmit: 'Permanently delete',
      passwordChanged: 'Password updated successfully',
      accountDeleted: 'Account deleted. We are sorry to see you go.',
      profileUpdated: 'Profile updated successfully',
      emailSubscriptionTitle: 'Email subscription',
      emailSubscriptionDescription: 'Manage whether you want to receive email updates.',
      emailSubscriptionToggle: 'Keep subscription active',
      emailSubscriptionSuccess: 'Subscription preference updated.',
      virusScanning: 'Scanning file with VirusTotal. If it passes, we will upload it automatically...',
      virusPassed: 'Verification completed. File is safe, starting upload.',
      virusBlocked: 'Upload blocked.',
      virusFallback: 'VirusTotal is currently unavailable. Continuing in resilient mode.',
      fields: {
        firstName: 'First Name',
        lastName: 'Last Name',
        email: 'Email address',
        avatar: 'Profile Picture',
        birthday: 'Date of Birth',
        gender: 'Gender',
        genderMale: 'Male',
        genderFemale: 'Female',
      }
    },
  },
} as const;

export function normalizeLocale(value?: string | null): Locale {
  const candidate = value?.toLowerCase().slice(0, 2) as Locale | undefined;
  return candidate && supportedLocales.has(candidate) ? candidate : defaultLocale;
}

export function isExplicitLocaleSelection(value?: string | null): boolean {
  return value === '1' || value === 'true';
}

export function inferLocaleFromRequest({
  cookieLocale,
  explicitCookie,
  acceptLanguage,
  country,
  city,
}: LocaleResolutionInput): Locale {
  const normalizedCookieLocale = cookieLocale ? normalizeLocale(cookieLocale) : undefined;

  if (isExplicitLocaleSelection(explicitCookie) && normalizedCookieLocale) {
    return normalizedCookieLocale;
  }

  if (country && spanishSpeakingCountries.has(country.toUpperCase())) {
    return 'es';
  }

  if (city && spanishSpeakingCities.has(city.trim().toLowerCase())) {
    return 'es';
  }

  if (acceptLanguage) {
    const requestedLocale = acceptLanguage
      .split(',')
      .map((entry) => entry.split(';')[0]?.trim())
      .filter(Boolean)
      .map((entry) => normalizeLocale(entry))
      .find((entry) => supportedLocales.has(entry));

    if (requestedLocale) {
      return requestedLocale;
    }
  }

  return normalizedCookieLocale ?? defaultLocale;
}

export function getMessages(locale: Locale) {
  return messages[locale];
}

export function getBrowserLocale(fallback: Locale = defaultLocale): Locale {
  if (typeof document === 'undefined') {
    return fallback;
  }

  const cookieLocale = readCookie(LOCALE_COOKIE_NAME);
  if (cookieLocale) {
    return normalizeLocale(cookieLocale);
  }

  if (typeof navigator !== 'undefined') {
    return normalizeLocale(navigator.language);
  }

  return fallback;
}

export function persistLocale(locale: Locale, explicit = true) {
  if (typeof document === 'undefined') {
    return;
  }

  const maxAge = 60 * 60 * 24 * 365;
  document.cookie = `${LOCALE_COOKIE_NAME}=${locale}; path=/; max-age=${maxAge}; SameSite=Lax`;
  document.cookie = `${LOCALE_EXPLICIT_COOKIE_NAME}=${explicit ? '1' : '0'}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

export function translateTemplate(template: string, values: Record<string, string | number>) {
  const result = Object.entries(values).reduce((acc, [key, value]) => {
    return acc.replaceAll(`{${key}}`, String(value));
  }, template);
  return result;
}

export function translateMealType(value: string, locale: Locale): string {
  const normalized = value.trim().toLowerCase();

  if (normalized === 'desayuno') return messages[locale].foodForm.breakfast;
  if (normalized === 'comida' || normalized === 'almuerzo') return messages[locale].foodForm.lunch;
  if (normalized === 'cena') return messages[locale].foodForm.dinner;
  if (normalized === 'colacion' || normalized === 'colación' || normalized === 'snack' || normalized === 'merienda') {
    return messages[locale].foodForm.snack;
  }

  return value;
}

export function translateFoodClassification(value: string | null | undefined, locale: Locale): string {
  const normalized = value?.trim().toLowerCase();

  if (!normalized) {
    return messages[locale].foodHistory.normal;
  }

  if (normalized === 'pobre' || normalized === 'poor') {
    return messages[locale].foodHistory.poor;
  }

  if (normalized === 'malo' || normalized === 'bad') {
    return messages[locale].foodHistory.bad;
  }

  if (normalized === 'regular') {
    return 'Regular';
  }

  if (normalized === 'saludable (bajo índice)') {
    return locale === 'es' ? 'Saludable (bajo índice)' : 'Healthy (low index)';
  }

  if (normalized === 'inadecuada (pico de glucosa)') {
    return locale === 'es' ? 'Inadecuada (pico de glucosa)' : 'Inadequate (glucose spike)';
  }

  return value ?? messages[locale].foodHistory.normal;
}

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') {
    return null;
  }

  const value = document.cookie
    .split('; ')
    .find((entry) => entry.startsWith(`${name}=`))
    ?.split('=')
    .slice(1)
    .join('=');

  return value ?? null;
}
