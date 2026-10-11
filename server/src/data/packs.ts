// Packs mensuales de Espacio Prisma (carga inicial; después se editan desde el panel).

export interface PackData {
  name: string;
  subtitle: string;
  sessions: string;
  includes: string;
  regularPrice: number;
  price: number;
  idealFor: string;
  order: number;
}

export const PACKS: PackData[] = [
  {
    name: 'Quincenal Masaje Integral',
    subtitle: '',
    sessions: '2 sesiones al mes',
    includes: '',
    regularPrice: 90000,
    price: 79000,
    idealFor:
      'Personas que buscan mantener un equilibrio mensual, resetear el cuerpo del estrés y regalarse un mimo profundo cada 15 días.',
    order: 1,
  },
  {
    name: 'Semanal Masaje Integral',
    subtitle: '',
    sessions: '4 sesiones al mes',
    includes: '',
    regularPrice: 180000,
    price: 149000,
    idealFor:
      'Quienes eligen el bienestar como un estilo de vida y quieren una sesión fija por semana para vivir con total ligereza y desconexión total.',
    order: 2,
  },
  {
    name: 'Quincenal Masaje Descontracturante',
    subtitle: '',
    sessions: '2 sesiones al mes',
    includes: '',
    regularPrice: 60000,
    price: 52000,
    idealFor:
      'Quienes sufren de dolores crónicos o tensión acumulada en espalda y cuello, y necesitan alivio constante sin dejar que las contracturas avancen.',
    order: 3,
  },
  {
    name: 'Semanal Masaje Descontracturante',
    subtitle: '',
    sessions: '4 sesiones al mes',
    includes: '',
    regularPrice: 120000,
    price: 99000,
    idealFor:
      'Personas con alta carga de estrés laboral, malas posturas frente a la pantalla o dolores intensos que requieren un seguimiento semanal para liberar el cuerpo.',
    order: 4,
  },
  {
    name: 'Alivio & Ligereza',
    subtitle: 'Masaje Integral + Circulatorio',
    sessions: 'Semanal · 4 sesiones al mes',
    includes: '2 sesiones de Masaje Integral (50 min) + 2 sesiones de Masaje Circulatorio para "Piernas Cansadas" (30 min).',
    regularPrice: 150000,
    price: 125000,
    idealFor:
      'Quienes combinan la necesidad de una relajación profunda en todo el cuerpo con el alivio de la pesadez y retención de líquidos en las piernas.',
    order: 5,
  },
  {
    name: 'Recuperación Activa',
    subtitle: 'Masaje Descontracturante + Circulatorio',
    sessions: 'Semanal · 4 sesiones al mes',
    includes:
      '2 sesiones de Masaje Descontracturante (30 min) de espalda, cuello y cráneo + 2 sesiones de Masaje Circulatorio (30 min).',
    regularPrice: 120000,
    price: 99000,
    idealFor:
      'Deportistas, personas que entrenan duro o trabajadores que pasan muchas horas de pie y necesitan recuperar tanto la espalda como las piernas.',
    order: 6,
  },
  {
    name: 'Combo Quincenal Reflexología',
    subtitle: '',
    sessions: '2 sesiones al mes',
    includes: '',
    regularPrice: 60000,
    price: 52000,
    idealFor:
      'Quienes buscan un cable a tierra constante para equilibrar su energía, liberar tensiones acumuladas y mejorar el bienestar general cada quince días.',
    order: 7,
  },
  {
    name: 'Pack Mensual Reflexología Intensiva',
    subtitle: '',
    sessions: '4 sesiones al mes',
    includes: '',
    regularPrice: 120000,
    price: 99000,
    idealFor:
      'Personas con altos niveles de ansiedad, insomnio o problemas circulatorios y digestivos que necesitan un estímulo semanal para notar resultados profundos.',
    order: 8,
  },
];
