/**
 * useAlertRules Hook
 *
 * TanStack Query hook for fetching & toggling per-user alert rule subscriptions
 * from the backend API. Only active when the user is authenticated.
 *
 * Falls back gracefully when unauthenticated — returns empty rules with
 * isAuthenticated: false so the UI can use local (Zustand) state instead.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { backendApi } from '@/services/backendApi'
import type { FuturesAlertType } from '@/types/alert'

/** Shape returned by GET /api/alert-rules */
export interface AlertRuleEntry {
  rule_type: string
  description: string
  enabled: boolean
  category: 'original' | 'optimized' | 'whale'
}

const QUERY_KEY = ['alertRules'] as const

export function useAlertRules() {
  const { isAuthenticated } = useAuth()
  const queryClient = useQueryClient()

  // ── Fetch all rules with user overrides ──────────────────────────
  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const res = await backendApi.getAlertRules()
      return res.rules
    },
    enabled: isAuthenticated,
    staleTime: 30_000, // 30 s — rules don't change often
    refetchOnWindowFocus: false,
  })

  // ── Toggle mutation ──────────────────────────────────────────────
  const toggleMutation = useMutation({
    mutationFn: async ({
      ruleType,
      enabled,
    }: {
      ruleType: string
      enabled: boolean
    }) => {
      return backendApi.toggleAlertRule(ruleType, enabled)
    },
    // Optimistic update
    onMutate: async ({ ruleType, enabled }) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEY })
      const previous = queryClient.getQueryData<AlertRuleEntry[]>(QUERY_KEY)

      queryClient.setQueryData<AlertRuleEntry[]>(QUERY_KEY, (old) =>
        old?.map((r) =>
          r.rule_type === ruleType ? { ...r, enabled } : r
        )
      )

      return { previous }
    },
    onError: (_err, _vars, context) => {
      // Roll back on failure
      if (context?.previous) {
        queryClient.setQueryData(QUERY_KEY, context.previous)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY })
    },
  })

  // ── Helpers ──────────────────────────────────────────────────────

  const rules: AlertRuleEntry[] = data ?? []

  /** Check if a specific rule_type is enabled (defaults to true if no data) */
  const isRuleEnabled = (ruleType: FuturesAlertType | string): boolean => {
    if (!isAuthenticated || rules.length === 0) return true // default: enabled
    const rule = rules.find((r) => r.rule_type === ruleType)
    return rule?.enabled ?? true
  }

  /** Toggle a rule on/off */
  const toggleRule = (ruleType: string, enabled: boolean) => {
    toggleMutation.mutate({ ruleType, enabled })
  }

  /** Rules grouped by category */
  const grouped = {
    original: rules.filter((r) => r.category === 'original'),
    optimized: rules.filter((r) => r.category === 'optimized'),
    whale: rules.filter((r) => r.category === 'whale'),
  }

  return {
    rules,
    grouped,
    isLoading,
    isError,
    error,
    isAuthenticated,
    isRuleEnabled,
    toggleRule,
    isToggling: toggleMutation.isPending,
    refetch,
  }
}
