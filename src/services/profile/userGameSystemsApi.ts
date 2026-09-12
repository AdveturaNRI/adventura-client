import { apiRequest } from '@/services/api/client';
import type { UserGameSystemItem } from '@/services/api/types';

export function fetchUserGameSystems() {
  return apiRequest<UserGameSystemItem[]>('/users/me/game-systems', {
    skipLoading: true,
  });
}

export function createUserGameSystem(name: string) {
  return apiRequest<UserGameSystemItem>('/users/me/game-systems', {
    method: 'POST',
    body: { name },
  });
}

export function updateUserGameSystem(id: string, name: string) {
  return apiRequest<UserGameSystemItem>(`/users/me/game-systems/${id}`, {
    method: 'PATCH',
    body: { name },
  });
}

export function deleteUserGameSystem(id: string) {
  return apiRequest<void>(`/users/me/game-systems/${id}`, {
    method: 'DELETE',
  });
}
