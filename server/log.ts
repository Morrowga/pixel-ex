const time = () => new Date().toLocaleTimeString('en-GB')

/** Dev logging for the API terminal. Set LOG_PLAN=1 to also dump each raw plan. */
export const log = (msg: string, ...rest: unknown[]) => console.log(`[${time()}] ${msg}`, ...rest)
export const logPlans = process.env.LOG_PLAN === '1'
