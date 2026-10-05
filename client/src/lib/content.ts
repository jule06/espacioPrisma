// Contenido de la landing, tomado del Instagram @miespacioprisma.

export const WHATSAPP_NUMBER = '5491154723994'
export const WHATSAPP_DISPLAY = '11 5472-3994'
export const INSTAGRAM_URL = 'https://www.instagram.com/miespacioprisma/'

export const whatsappLink = (text = 'Hola Pau! Quería consultar por un masaje 🌈') =>
  `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`

/** Promo vigente. Se muestra solo hasta `until` (inclusive). */
export const PROMO = {
  until: '2026-10-31',
  eyebrow: 'Octubre de relax',
  title: '20% off en el Masaje Integral de 50 minutos',
  text: 'Durante todo octubre. Ideal como autoregalo o como Gift Card para mamá. Válido en el gabinete de Liniers.',
  serviceName: 'Masaje Integral',
}

export const PLACES = [
  { name: 'Liniers', detail: 'Gabinete' },
  { name: 'Versalles', detail: 'Gabinete' },
  { name: 'Flores', detail: 'Gabinete' },
  { name: 'A domicilio', detail: 'Preparo el espacio en tu casa para una experiencia sensorial y relajante' },
]

export const APPROACH = [
  {
    title: 'Contacto consciente',
    text: 'No es solo un masaje: es una experiencia sensorial para liberar bloqueos y renovar tu energía.',
  },
  {
    title: 'Técnicas integrales',
    text: 'Masoterapia holística combinada con técnicas milenarias como Shiatsu y Tantra.',
  },
  {
    title: 'Sesiones a tu medida',
    text: 'Cada sesión se diseña para devolverte el equilibrio y la calma que necesitás ese día.',
  },
  {
    title: 'Libre de juicios',
    text: 'Tu cuerpo está vivo y reacciona a la relajación. Acá todo es natural y bienvenido.',
  },
]

export const FAQ = [
  {
    q: '¿Es normal quedarse dormida/o durante el masaje?',
    a: 'Totalmente. Muchas personas se tensionan pensando que su cuerpo tiene que reaccionar de forma "perfecta", pero dormirse, suspirar o emocionarse son reacciones naturales a la relajación. Mi espacio es un lugar libre de juicios.',
  },
  {
    q: '¿Por qué siempre se me contractura el trapecio?',
    a: 'El trapecio responde directamente a tus emociones: con estrés o ansiedad el cuerpo lo tensa de forma refleja, aunque no hagas esfuerzo físico. Respirar conscientemente, estirar el cuello con suavidad y una sesión descontracturante ayudan a liberar esa tensión.',
  },
  {
    q: '¿Cómo reservo mi turno?',
    a: 'Elegís el servicio, el día y el horario online y reservás con una seña del 30% por transferencia, que se descuenta del total. También podés escribirme por WhatsApp.',
  },
  {
    q: '¿Puedo cambiar el día o el horario?',
    a: 'Sí, sin costo hasta 24 horas antes, con el código que te llega al reservar. La seña no se reintegra si cancelás.',
  },
  {
    q: '¿Hacen Gift Cards?',
    a: 'Sí. Son un regalo ideal para que alguien corte con la rutina y se conecte con el relax. Pedila por WhatsApp o por mensaje directo en Instagram.',
  },
]
