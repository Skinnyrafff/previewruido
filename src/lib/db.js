import { neon } from '@neondatabase/serverless'

const databaseUrl =
  import.meta.env?.VITE_DATABASE_URL ||
  globalThis.process?.env?.VITE_DATABASE_URL ||
  globalThis.process?.env?.DATABASE_URL

if (!databaseUrl) {
  throw new Error('Falta configurar VITE_DATABASE_URL o DATABASE_URL.')
}

const sql = neon(databaseUrl)

export default sql
