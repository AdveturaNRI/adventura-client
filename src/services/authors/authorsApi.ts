import { Platform } from 'react-native';

import { apiMultipart, apiRequest } from '@/services/api/client';
import type {
  Author,
  AuthorContact,
  AuthorPost,
  AuthorPostFile,
  CreativityCategory,
  CreativityCategoryFilter,
} from '@/data/authors/types';

export type AuthorApiDto = Author;
export type AuthorPostApiDto = AuthorPost;

export type CreateAuthorPostPayload = {
  title: string;
  content: string;
  category: CreativityCategory;
  isForSale: boolean;
  price?: number;
  currency?: string;
  purchaseDescription?: string;
  purchaseUrl?: string;
};

export type UpdateAuthorProfilePayload = {
  description: string;
  categories: CreativityCategory[];
  contacts: AuthorContact[];
};

function isRemoteUri(uri: string) {
  return /^https?:\/\//i.test(uri);
}

async function buildNamedFilesFormData(
  fieldName: string,
  files: { uri: string; name: string; type: string }[],
) {
  const formData = new FormData();

  for (const [index, file] of files.entries()) {
    const fileName = file.name || `file-${index}`;
    if (Platform.OS === 'web') {
      let blob: Blob;
      try {
        const response = await fetch(file.uri);
        blob = await response.blob();
      } catch {
        throw new Error('Не удалось прочитать локальный файл');
      }
      formData.append(fieldName, blob, fileName);
    } else {
      formData.append(
        fieldName,
        {
          uri: file.uri,
          name: fileName,
          type: file.type || 'application/octet-stream',
        } as unknown as Blob,
      );
    }
  }

  return formData;
}

export async function listAuthors() {
  return apiRequest<AuthorApiDto[]>('/authors', { skipLoading: true });
}

export async function listAuthorPosts(category?: CreativityCategoryFilter) {
  const params = new URLSearchParams();
  if (category && category !== 'all') {
    params.set('category', category);
  }
  const query = params.toString();
  return apiRequest<AuthorPostApiDto[]>(
    `/authors/posts${query ? `?${query}` : ''}`,
    { skipLoading: true },
  );
}

export async function getMyAuthor() {
  return apiRequest<AuthorApiDto>('/authors/me', { skipLoading: true });
}

export async function getAuthor(authorId: string) {
  return apiRequest<AuthorApiDto>(`/authors/${encodeURIComponent(authorId)}`, {
    skipLoading: true,
  });
}

export async function getAuthorPostsByAuthor(authorId: string) {
  return apiRequest<AuthorPostApiDto[]>(
    `/authors/${encodeURIComponent(authorId)}/posts`,
    { skipLoading: true },
  );
}

export async function getAuthorPost(postId: string) {
  return apiRequest<AuthorPostApiDto>(
    `/authors/posts/${encodeURIComponent(postId)}`,
    { skipLoading: true },
  );
}

export async function updateMyAuthor(payload: UpdateAuthorProfilePayload) {
  return apiRequest<AuthorApiDto>('/authors/me', {
    method: 'PATCH',
    body: payload,
  });
}

export async function createAuthorPost(payload: CreateAuthorPostPayload) {
  return apiRequest<AuthorPostApiDto>('/authors/me/posts', {
    method: 'POST',
    body: payload,
  });
}

export async function updateAuthorPost(
  postId: string,
  payload: CreateAuthorPostPayload,
) {
  return apiRequest<AuthorPostApiDto>(
    `/authors/me/posts/${encodeURIComponent(postId)}`,
    {
      method: 'PATCH',
      body: payload,
    },
  );
}

export async function deleteAuthorPost(postId: string) {
  return apiRequest<{ ok: true }>(
    `/authors/me/posts/${encodeURIComponent(postId)}`,
    { method: 'DELETE' },
  );
}

export async function toggleAuthorPostLike(postId: string) {
  return apiRequest<{ liked: boolean; likes: number }>(
    `/authors/posts/${encodeURIComponent(postId)}/like`,
    { method: 'POST', skipLoading: true },
  );
}

export async function incrementAuthorPostViews(postId: string) {
  return apiRequest<{ views: number }>(
    `/authors/posts/${encodeURIComponent(postId)}/view`,
    { method: 'POST', skipLoading: true },
  );
}

export async function uploadAuthorPostImages(
  postId: string,
  localFiles: { uri: string; name?: string; type?: string }[],
) {
  const files = localFiles
    .filter((file) => file.uri && !isRemoteUri(file.uri))
    .map((file, index) => ({
      uri: file.uri,
      name: file.name || `image-${index}.jpg`,
      type: file.type || 'image/jpeg',
    }));

  if (files.length === 0) {
    return getAuthorPost(postId);
  }

  return apiMultipart<AuthorPostApiDto>(
    `/authors/me/posts/${encodeURIComponent(postId)}/images`,
    await buildNamedFilesFormData('images', files),
  );
}

export async function uploadAuthorPostFiles(
  postId: string,
  localFiles: AuthorPostFile[],
) {
  const files = localFiles
    .map((file) => {
      const uri = file.previewUrl || file.url;
      if (!uri || isRemoteUri(uri)) {
        return null;
      }
      return {
        uri,
        name: file.name,
        type: file.type || 'application/octet-stream',
      };
    })
    .filter((file): file is { uri: string; name: string; type: string } => Boolean(file));

  if (files.length === 0) {
    return getAuthorPost(postId);
  }

  return apiMultipart<AuthorPostApiDto>(
    `/authors/me/posts/${encodeURIComponent(postId)}/files`,
    await buildNamedFilesFormData('files', files),
  );
}

/** Создать/обновить пост и залить локальные медиа. */
export async function saveAuthorPostWithMedia(options: {
  postId?: string;
  payload: CreateAuthorPostPayload;
  images: string[];
  files: AuthorPostFile[];
}) {
  const post = options.postId
    ? await updateAuthorPost(options.postId, options.payload)
    : await createAuthorPost(options.payload);

  const localImages = options.images
    .filter((uri) => uri && !isRemoteUri(uri))
    .map((uri, index) => ({
      uri,
      name: `image-${index}.jpg`,
      type: 'image/jpeg',
    }));
  const remoteImages = options.images.filter((uri) => uri && isRemoteUri(uri));

  let next = post;

  // Новые локальные картинки — заливка (полная замена набора).
  // Если локальных нет, но и удалённых remotes тоже нет (только remote) — медиа не трогаем.
  // Если картинок не осталось совсем — чистим коллекцию пустым upload.
  if (localImages.length > 0) {
    next = await uploadAuthorPostImages(post.id, localImages);
  } else if (options.images.length === 0 && options.postId) {
    next = await apiMultipart<AuthorPostApiDto>(
      `/authors/me/posts/${encodeURIComponent(post.id)}/images`,
      new FormData(),
    );
  } else if (remoteImages.length > 0 && localImages.length === 0) {
    // оставляем уже залитые remote
    next = post;
  }

  const localFiles = options.files.filter((file) => {
    const uri = file.previewUrl || file.url;
    return Boolean(uri && !isRemoteUri(uri));
  });
  if (localFiles.length > 0) {
    next = await uploadAuthorPostFiles(post.id, localFiles);
  } else if (options.files.length === 0 && options.postId) {
    next = await apiMultipart<AuthorPostApiDto>(
      `/authors/me/posts/${encodeURIComponent(post.id)}/files`,
      new FormData(),
    );
  }

  return next;
}
