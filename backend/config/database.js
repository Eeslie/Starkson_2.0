const { createClient } = require('@supabase/supabase-js')
const dotenv = require('dotenv')

dotenv.config()

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Helper function to handle Supabase queries
const query = async (table, operation = 'select', options = {}) => {
  try {
    let query = supabase.from(table)

    // Handle different operations
    switch (operation) {
      case 'select':
        // Handle select with joins using foreign table syntax
        if (options.select) {
          query = query.select(options.select)
        } else {
          query = query.select('*')
        }
        
        // Apply filters
        if (options.filters) {
          options.filters.forEach(filter => {
            const operator = filter.operator || 'eq'
            if (operator === 'in') {
              query = query.in(filter.column, filter.value)
            } else if (operator === 'is') {
              query = query.is(filter.column, filter.value)
            } else if (operator === 'or') {
              // Handle OR conditions
              const orConditions = filter.value.map(cond => `${cond.column}.${cond.operator || 'eq'}.${cond.value}`).join(',')
              query = query.or(orConditions)
            } else {
              query = query[operator](filter.column, filter.value)
            }
          })
        }
        
        // Apply ordering
        if (options.orderBy) {
          query = query.order(options.orderBy.column, { ascending: options.orderBy.ascending !== false })
        }
        
        // Apply limit
        if (options.limit) {
          query = query.limit(options.limit)
        }
        
        // Execute query
        if (options.single) {
          // Use maybeSingle() to return null instead of throwing error when not found
          const { data, error } = await query.maybeSingle()
          if (error) {
            console.error(`Query error (${table}, single):`, error)
            throw error
          }
          return data || null
        }
        
        const { data, error } = await query
        if (error) {
          console.error(`Query error (${table}):`, error)
          throw error
        }
        return data

      case 'insert':
        const { data: insertData, error: insertError } = await supabase
          .from(table)
          .insert(options.data)
          .select()
        if (insertError) throw insertError
        return Array.isArray(insertData) && insertData.length === 1 ? insertData[0] : insertData

      case 'update':
        let updateQuery = supabase.from(table).update(options.data)
        if (options.filters) {
          options.filters.forEach(filter => {
            const operator = filter.operator || 'eq'
            if (operator === 'is') {
              updateQuery = updateQuery.is(filter.column, filter.value)
            } else {
              updateQuery = updateQuery[operator](filter.column, filter.value)
            }
          })
        }
        const { data: updateData, error: updateError } = await updateQuery.select()
        if (updateError) throw updateError
        return Array.isArray(updateData) && updateData.length === 1 ? updateData[0] : updateData

      case 'delete':
        let deleteQuery = supabase.from(table).delete()
        if (options.filters) {
          options.filters.forEach(filter => {
            deleteQuery = deleteQuery[filter.operator || 'eq'](filter.column, filter.value)
          })
        }
        const { error: deleteError } = await deleteQuery
        if (deleteError) throw deleteError
        return { success: true }

      case 'count':
        let countQuery = supabase.from(table).select('*', { count: 'exact', head: true })
        if (options.filters) {
          options.filters.forEach(filter => {
            const operator = filter.operator || 'eq'
            if (operator === 'in') {
              countQuery = countQuery.in(filter.column, filter.value)
            } else if (operator === 'is') {
              countQuery = countQuery.is(filter.column, filter.value)
            } else if (operator === 'gte') {
              countQuery = countQuery.gte(filter.column, filter.value)
            } else if (operator === 'lte') {
              countQuery = countQuery.lte(filter.column, filter.value)
            } else if (operator === 'gt') {
              countQuery = countQuery.gt(filter.column, filter.value)
            } else if (operator === 'lt') {
              countQuery = countQuery.lt(filter.column, filter.value)
            } else {
              countQuery = countQuery[operator](filter.column, filter.value)
            }
          })
        }
        const { count, error: countError } = await countQuery
        if (countError) throw countError
        return { count: count || 0 }

      default:
        throw new Error(`Unknown operation: ${operation}`)
    }
  } catch (error) {
    console.error(`Supabase query error (${table}, ${operation}):`, error)
    throw error
  }
}

// Raw SQL query helper (for complex queries via RPC)
const rpc = async (functionName, params = {}) => {
  const { data, error } = await supabase.rpc(functionName, params)
  if (error) throw error
  return data
}

module.exports = {
  supabase,
  query,
  rpc
}
