// Detalle de cada servicio para la ventana "+ info" de la landing.
// Borrador para que Paula lo revise y ajuste.

export interface ServiceDetail {
  details: string;
  benefits: string[];
  idealFor: string;
}

export const SERVICE_DETAILS: Record<string, ServiceDetail> = {
  'Masaje Descontracturante': {
    details:
      'Un trabajo focalizado en espalda, cuello, hombros y cráneo, las zonas donde más se acumula la tensión. Con maniobras de presión y amasamiento voy soltando las contracturas, adaptando la intensidad a lo que tu cuerpo necesita ese día.',
    benefits: [
      'Alivia contracturas y rigidez muscular',
      'Afloja la tensión de cuello y hombros',
      'Mejora la movilidad',
      'Ayuda con los dolores de cabeza por tensión',
    ],
    idealFor: 'Quienes pasan muchas horas sentados o frente a la compu, o sienten que cargan una mochila en los hombros.',
  },
  'Masaje Circulatorio': {
    details:
      'Movimientos suaves, rítmicos y ascendentes en las piernas, desde los pies hacia arriba, que acompañan el retorno de la circulación. Una sesión liviana y muy agradable.',
    benefits: [
      'Alivia la sensación de piernas pesadas y cansadas',
      'Ayuda a reducir la hinchazón',
      'Favorece la circulación',
      'Deja una sensación de liviandad',
    ],
    idealFor: 'Quienes pasan muchas horas de pie o sentados, o terminan el día con las piernas cargadas.',
  },
  'Relajante Profundo': {
    details:
      'Maniobras lentas, envolventes y continuas en todo el cuerpo, con un ritmo pausado que invita a soltar y desconectar. Es un espacio para bajar un cambio y dejar que el cuerpo descanse.',
    benefits: [
      'Reduce el estrés y la ansiedad',
      'Favorece un descanso más profundo',
      'Relaja toda la musculatura',
      'Deja una sensación de calma que dura',
    ],
    idealFor: 'Momentos de mucho estrés o cansancio mental, o cuando simplemente necesitás desconectar.',
  },
  'Masaje Integral': {
    details:
      'Combina lo mejor de las técnicas relajantes y descontracturantes en una sesión completa de todo el cuerpo. Trabajo en profundidad las zonas con más tensión y lo integro con maniobras suaves para cerrar en un estado de calma.',
    benefits: [
      'Libera contracturas y relaja al mismo tiempo',
      'Trabajo completo de todo el cuerpo',
      'Renueva la energía',
      'Equilibrio físico y emocional',
    ],
    idealFor: 'Quienes quieren una sesión completa: aliviar tensiones y relajarse en un mismo encuentro.',
  },
  'Reflexología podal o palmar': {
    details:
      'Presión suave en puntos específicos de los pies o de las manos que, según la reflexología, se relacionan con distintas zonas del cuerpo. Una técnica tranquila y muy relajante.',
    benefits: [
      'Relajación profunda',
      'Alivia el cansancio de pies o manos',
      'Ayuda a liberar tensiones',
      'Un momento de conexión con tu cuerpo',
    ],
    idealFor: 'Quienes buscan una experiencia relajante y distinta, o prefieren una alternativa al masaje de cuerpo completo.',
  },
};
