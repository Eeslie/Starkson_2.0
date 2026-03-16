'use client'

import { useState, useEffect } from 'react'
import api from './api'
import { BRANCHES, REAL_BRANCHES, ALL_BRANCHES_ACRONYM } from './branches'

export type Branch = { acronym: string; name: string }

export function useBranches() {
  const [branches, setBranches] = useState<Branch[]>(() => [...BRANCHES] as Branch[])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api
      .get<Branch[]>('/branches')
      .then((res) => {
        if (res.data && res.data.length > 0) {
          setBranches(res.data)
        }
      })
      .catch(() => {
        // Keep constants fallback
      })
      .finally(() => setLoading(false))
  }, [])

  const realBranches = branches.filter((b) => b.acronym !== ALL_BRANCHES_ACRONYM)
  return { branches, realBranches, loading, ALL_BRANCHES_ACRONYM }
}
