/** Pictures that only make sense in a lesson about computers or technology. */
export const TECH_SPRITES = new Set(['computer', 'chip', 'phone'])

const TECH =
  /\b(comput\w*|cpu|gpu|ram|rom|memory|software|hardware|program\w*|cod(e|ing)|apps?|internet|web\w*|wi-?fi|network\w*|data\w*|phones?|mobile|smart\w*|ai|artificial|robots?|machine|algorithm\w*|pixels?|screens?|keyboards?|mouse|laptops?|tablets?|servers?|cloud|files?|drives?|storage|bits?|bytes?|digital|electronic\w*|chips?|process\w*|batter\w*|signals?|emails?|online|websites?|browsers?|passwords?|cyber\w*|bluetooth|usb|sql|api|linux|windows|android|ios|google|pc|tech\w*)\b/i

/** Is the question about computers or technology? Only then may a lesson draw a computer, chip or phone. */
export const isTechTopic = (question: string): boolean => TECH.test(question)
