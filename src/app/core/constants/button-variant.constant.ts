export const buttonVariants = {
  base: 'flex items-center gap-2 px-4 py-2 rounded-lg transition-colors duration-200',
  // Variantes sólidas
  solid: {
    blue: 'bg-blue-600 hover:bg-blue-700 text-blue-500',
    red: 'bg-red-600 hover:bg-red-700 text-red-500',
    yellow: 'bg-yellow-600 hover:bg-yellow-700 text-yellow-500',
    green: 'bg-green-600 hover:bg-green-700 text-green-500',
    gray: 'bg-neutral-600 hover:bg-neutral-600 text-neutral-500',
  },
  // Variantes outline
  outline: {
    blue: 'bg-transparent text-blue-500',
    red: 'bg-transparent text-red-500',
    yellow: 'bg-transparent text-yellow-500',
    green: 'bg-transparent text-green-500',
    gray: 'bg-transparent text-gray-900',
    neutral: 'bg-transparent text-neutral-500',
    orange: 'bg-transparent text-orange-500',

    //blue: 'border-2 px-3 border-blue-600 text-blue-500',
    //red: 'border-2 px-3 border-red-600 text-red-500',
    //yellow: 'border-2 px-3 border-yellow-600 text-yellow-500',
    //green: 'border-2 px-3 border-green-600 text-green-500',
    //neutral:
    //  'border-2 px-3 border-neutral-600 text-neutral-500 dark:border-neutral-600 dark:text-neutral-500',
    //gray: 'border-2 px-3 border-gray-900 text-gray-900 dark:border-emerald-400 dark:text-emerald-300',
  },
};
