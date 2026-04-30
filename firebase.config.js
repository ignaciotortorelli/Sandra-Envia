// ══════════════════════════════════════════
//  CONFIGURACIÓN DE FIREBASE
//  Completá estos valores con los de tu proyecto en:
//  https://console.firebase.google.com → Tu proyecto → Configuración → Tus apps
// ══════════════════════════════════════════
export const firebaseConfig = {
  apiKey:            "AIzaSyDKBlwaeKUj5-poHYwGkDr6o_gngbS1LnM",
  authDomain:        "sandra-envia.firebaseapp.com",
  projectId:         "sandra-envia",
  storageBucket:     "sandra-envia.firebasestorage.app",
  messagingSenderId: "15633533345",
  appId:             "1:15633533345:web:181e8fc7fdf48cc5f8a3e0",
};

// Client ID de Google Cloud Console (OAuth 2.0)
// Conseguilo en: console.cloud.google.com → APIs & Services → Credentials
export const googleClientId = "15633533345-abapar4f75mm3e0qh7bn0rh3787hu9m8.apps.googleusercontent.com";

// Cuentas de Google autorizadas para acceder al panel de admin
// Para agregar una nueva: añadí el email abajo y guardá el archivo
export const allowedAdmins = [
  'ignaciotortorelli55@gmail.com',
  // 'segunda-admin@gmail.com',
];

// ID de la carpeta de Google Drive donde se guardan las imágenes
// Conseguilo abriendo la carpeta en Drive y copiando el ID de la URL
export const driveFolderId = '13fY7GR4qNWTvp08pl7HrVGVFfGAEDQ0C';
