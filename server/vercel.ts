import { getRequestListener } from '@hono/node-server'
import app from './app'

/** The Vercel function: a Node (req, res) handler around the same Hono app. Streaming works through it. */
export default getRequestListener(app.fetch)
