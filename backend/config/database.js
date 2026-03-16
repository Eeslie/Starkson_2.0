const mysql = require('mysql2/promise')
const dotenv = require('dotenv')

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' })

// Create a MySQL connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'starkson_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
})

// For SELECT queries (returns rows)
const runQuery = async (sql, params = []) => {
  const [rows] = await pool.execute(sql, params)
  return rows
}

// For INSERT/UPDATE/DELETE (returns raw result with insertId/affectedRows)
const runExec = async (sql, params = []) => {
  const [result] = await pool.execute(sql, params)
  return result
}

const buildWhere = (filters = []) => {
  if (!filters || filters.length === 0) return { clause: '', params: [] }
  const parts = []
  const params = []
  for (const filter of filters) {
    const op = filter.operator || 'eq'
    const col = filter.column
    switch (op) {
      case 'eq':
        parts.push(`${col} = ?`)
        params.push(filter.value)
        break
      case 'neq':
        parts.push(`${col} <> ?`)
        params.push(filter.value)
        break
      case 'gt':
        parts.push(`${col} > ?`)
        params.push(filter.value)
        break
      case 'gte':
        parts.push(`${col} >= ?`)
        params.push(filter.value)
        break
      case 'lt':
        parts.push(`${col} < ?`)
        params.push(filter.value)
        break
      case 'lte':
        parts.push(`${col} <= ?`)
        params.push(filter.value)
        break
      case 'is':
        if (filter.value === null) {
          parts.push(`${col} IS NULL`)
        } else {
          parts.push(`${col} IS NOT NULL`)
        }
        break
      case 'in':
        if (Array.isArray(filter.value) && filter.value.length > 0) {
          const placeholders = filter.value.map(() => '?').join(', ')
          parts.push(`${col} IN (${placeholders})`)
          params.push(...filter.value)
        } else {
          parts.push('1 = 0')
        }
        break
      default:
        parts.push(`${col} = ?`)
        params.push(filter.value)
        break
    }
  }
  return {
    clause: parts.length ? `WHERE ${parts.join(' AND ')}` : '',
    params
  }
}

// Generic helper that roughly mirrors the previous Supabase-based API
const query = async (table, operation = 'select', options = {}) => {
  try {
    switch (operation) {
      case 'select': {
        const columns = options.select || '*'
        const { clause, params } = buildWhere(options.filters)
        let sql = `SELECT ${columns} FROM ${table} ${clause}`

        if (options.orderBy && options.orderBy.column) {
          sql += ` ORDER BY ${options.orderBy.column} ${options.orderBy.ascending === false ? 'DESC' : 'ASC'}`
        }
        if (options.limit) {
          sql += ` LIMIT ${Number(options.limit)}`
        }

        const rows = await runQuery(sql, params)
        if (options.single) {
          return rows[0] || null
        }
        return rows
      }

      case 'insert': {
        const data = options.data
        if (!data) throw new Error('insert operation requires options.data')
        const rows = Array.isArray(data) ? data : [data]
        if (rows.length === 0) return []
        const columns = Object.keys(rows[0])
        const placeholders = `(${columns.map(() => '?').join(', ')})`
        const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES ${rows.map(() => placeholders).join(', ')}`
        const params = rows.flatMap(row => columns.map(col => row[col]))
        const result = await runExec(sql, params)

        // If caller wants raw result (e.g. for bulk ops)
        if (options.rawResult) {
          return result
        }

        // If we inserted a single row and table has an auto-increment `id`, fetch the row back
        if (!Array.isArray(data)) {
          const insertedId = result.insertId
          if (insertedId) {
            const created = await query(table, 'select', {
              filters: [{ column: 'id', value: insertedId }],
              single: true
            })
            return created
          }
        }

        // Fallback: return result object
        return result
      }

      case 'update': {
        const data = options.data || {}
        const setCols = Object.keys(data)
        if (setCols.length === 0) return { affectedRows: 0 }
        const setClause = setCols.map(col => `${col} = ?`).join(', ')
        const setParams = setCols.map(col => data[col])
        const { clause, params: whereParams } = buildWhere(options.filters)
        const sql = `UPDATE ${table} SET ${setClause} ${clause}`
        const result = await runExec(sql, [...setParams, ...whereParams])
        return result
      }

      case 'delete': {
        const { clause, params } = buildWhere(options.filters)
        const sql = `DELETE FROM ${table} ${clause}`
        const result = await runExec(sql, params)
        return result
      }

      case 'count': {
        const { clause, params } = buildWhere(options.filters)
        const sql = `SELECT COUNT(*) as count FROM ${table} ${clause}`
        const rows = await runQuery(sql, params)
        return { count: rows[0]?.count || 0 }
      }

      default:
        throw new Error(`Unknown operation: ${operation}`)
    }
  } catch (error) {
    console.error(`MySQL query error (${table}, ${operation}):`, error)
    throw error
  }
}

module.exports = {
  pool,
  runQuery,
  runExec,
  query
}

