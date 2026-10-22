import { apiRequest } from '@/services/api/client';

export type AnnouncementTheme = {
  themeMode: 'light' | 'dark';
  backgroundColor: string;
  titleColor: string;
  bodyColor: string;
  buttonColor: string;
  accentColor: string;
  imageLayout: 'top' | 'side';
  imageAspect: '16:9' | '4:3' | '1:1' | 'auto';
  imageFocusX: number;
  imageFocusY: number;
  modalWidth: number;
  borderRadius: number;
  buttonStyle: 'filled' | 'outline';
  showImage: boolean;
  showActionButton: boolean;
  animationEnabled: boolean;
};

export type SiteAnnouncement = {
  id: string;
  title: string;
  body: string;
  imageUrl: string | null;
  actionLabel: string | null;
  actionUrl: string | null;
  publicationVersion: number;
  publishedAt: string | null;
  views?: number;
  likes?: number;
  theme: AnnouncementTheme;
};

export type AnnouncementPublishedEvent = {
  id: string;
  publicationVersion: number;
};

export async function fetchPendingAnnouncements(): Promise<SiteAnnouncement[]> {
  try {
    return await apiRequest<SiteAnnouncement[]>('/announcements/pending', {
      skipLoading: true,
    });
  } catch {
    return [];
  }
}

export async function dismissAnnouncement(
  id: string,
  publicationVersion: number,
): Promise<void> {
  await apiRequest(`/announcements/${encodeURIComponent(id)}/dismiss`, {
    method: 'POST',
    body: { publicationVersion },
    skipLoading: true,
  });
}
