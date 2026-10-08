'use client'

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  adminApi,
  AdminPayoutState,
  AdminUserSortField,
  AdminUserStatusFilter,
  AdminVehicleState,
  getApiErrorMessage,
} from '@/lib/api'
import { showError } from '@/lib/app-feedback'

export interface AdminUsersParams {
  page: number
  limit: number
  search?: string
  status: AdminUserStatusFilter
  country?: string
  dlVerified?: boolean
  pending?: boolean
  name?: string
  email?: string
  phone?: string
  language?: string
  joinedFrom?: string
  joinedTo?: string
  vehicleState?: AdminVehicleState
  payoutState?: AdminPayoutState
  sortBy?: AdminUserSortField
  sortDir?: 'asc' | 'desc'
}

const USERS_KEY = ['admin', 'users'] as const

export function useAdminUsers(params: AdminUsersParams) {
  return useQuery({
    queryKey: [...USERS_KEY, 'list', params],
    queryFn: async () => (await adminApi.getUsers(params)).data,
    // Keep the current page on screen while the next one loads, so the table does not flash.
    placeholderData: keepPreviousData,
  })
}

// Offer only countries that have users in the current status, so no option leads to an empty list.
export function useAdminUserCountries(status: AdminUserStatusFilter) {
  return useQuery({
    queryKey: [...USERS_KEY, 'countries', status],
    queryFn: async () => (await adminApi.getUserCountries({ status })).data.countries,
  })
}

export function useBanUserMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ userId, ban }: { userId: string; ban: boolean }) =>
      ban ? adminApi.banUser(userId) : adminApi.unbanUser(userId),
    onError: (err, { ban }) => {
      showError(
        ban ? 'Could not ban user' : 'Could not unban user',
        getApiErrorMessage(err, ban ? 'Failed to ban user' : 'Failed to unban user'),
      )
    },
    // Banning moves the user between the Active and Banned tabs, so the list is refetched.
    onSettled: () => queryClient.invalidateQueries({ queryKey: USERS_KEY }),
  })
}

export function useInvalidateAdminUsers() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: USERS_KEY })
}
