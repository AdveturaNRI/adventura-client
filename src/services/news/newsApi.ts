import { apiRequest } from '@/services/api/client';

export type NewsItem = {
  id: string;
  title: string;
  body: string;
  imageUrl: string | null;
  actionLabel: string | null;
  actionUrl: string | null;
  publicationVersion: number;
  publishedAt: string | null;
  views: number;
  likes: number;
  liked: boolean;
  unread: boolean;
};

export async function listNews(): Promise<NewsItem[]> {
  return apiRequest<NewsItem[]>('/announcements', { skipLoading: true });
}

export async function getNewsItem(id: string): Promise<NewsItem | null> {
  try {
    return await apiRequest<NewsItem>(`/announcements/${encodeURIComponent(id)}`, {
      skipLoading: true,
    });
  } catch {
    return null;
  }
}

export async function toggleNewsLike(
  id: string,
): Promise<{ liked: boolean; likes: number }> {
  return apiRequest(`/announcements/${encodeURIComponent(id)}/like`, {
    method: 'POST',
    skipLoading: true,
  });
}

export async function incrementNewsViews(id: string): Promise<{ views: number }> {
  return apiRequest(`/announcements/${encodeURIComponent(id)}/view`, {
    method: 'POST',
    skipLoading: true,
  });
}
