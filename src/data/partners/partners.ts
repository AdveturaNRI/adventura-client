export type Partner = {
  id: string;
  name: string;
  href: string;
  /** Короткий текст на «логотипе», если нет картинки */
  mark: string;
  /** Акцент плашки */
  accent: string;
  logoUrl?: string | null;
};
