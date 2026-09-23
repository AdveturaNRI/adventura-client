import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  LandingRenderer,
  resolveMarketingSkin,
} from "@/components/marketing/LandingRenderer";
import type {
  MarketingClubCard,
  MarketingGameCard,
  MarketingLandingBlock,
} from "@/components/marketing/types";
import { apiRequest } from "@/services/api/client";
import {
  hitYandexMetrika,
  reachYandexMetrikaGoal,
} from "@/services/analytics/yandex-metrika";
import {
  getMarketingAnonymousId,
  parseMarketingQuery,
  recordMarketingConversion,
  recordMarketingTouch,
} from "@/services/marketing/attribution";
import {
  getPublishedLanding,
  type MarketingLanding,
} from "@/services/marketing/landings";

const landingViewSent = new Set<string>();
const ctaClickSent = new Set<string>();

function dayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function normalizeBlocks(blocks: unknown): MarketingLandingBlock[] {
  if (!Array.isArray(blocks)) return [];
  return blocks.filter(Boolean) as MarketingLandingBlock[];
}

function canOpenInternal(url: string): boolean {
  return url.trim().startsWith("/");
}

function canOpenExternal(url: string): boolean {
  return /^https:\/\//i.test(url.trim()) || url.trim().startsWith("mailto:");
}

function applyWebSeo(landing: MarketingLanding): void {
  if (Platform.OS !== "web" || typeof document === "undefined") return;

  const title = landing.seo?.title?.trim() || landing.name;
  const description =
    landing.seo?.description?.trim() || landing.description?.trim() || "";
  const image = landing.seo?.image?.trim() || "";
  const robots = landing.seo?.robots?.trim() || "";
  const canonical = landing.seo?.canonical?.trim() || "";

  document.title = title;

  const upsertMeta = (
    selector: string,
    attrs: Record<string, string>,
    content: string,
  ) => {
    const nextContent = content.trim();
    if (!nextContent) {
      document
        .querySelector(selector)
        ?.parentNode?.removeChild(document.querySelector(selector)!);
      return;
    }
    let meta = document.querySelector<HTMLMetaElement>(selector);
    if (!meta) {
      meta = document.createElement("meta");
      for (const [key, value] of Object.entries(attrs))
        meta.setAttribute(key, value);
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", nextContent);
  };

  upsertMeta('meta[name="description"]', { name: "description" }, description);
  upsertMeta('meta[property="og:title"]', { property: "og:title" }, title);
  upsertMeta(
    'meta[property="og:description"]',
    { property: "og:description" },
    description,
  );
  upsertMeta('meta[property="og:image"]', { property: "og:image" }, image);
  upsertMeta('meta[name="robots"]', { name: "robots" }, robots);

  if (canonical) {
    let link = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = document.createElement("link");
      link.rel = "canonical";
      document.head.appendChild(link);
    }
    link.href = canonical;
  }
}

async function fetchMarketingGames(
  limit: number,
): Promise<MarketingGameCard[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  return apiRequest<MarketingGameCard[]>(
    `/marketing/feeds/games?${params.toString()}`,
    {
      skipAuth: true,
      skipAuthRefresh: true,
      skipLoading: true,
    },
  );
}

async function fetchMarketingClubs(
  limit: number,
): Promise<MarketingClubCard[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  return apiRequest<MarketingClubCard[]>(
    `/marketing/feeds/clubs?${params.toString()}`,
    {
      skipAuth: true,
      skipAuthRefresh: true,
      skipLoading: true,
    },
  );
}

export default function PublicLandingRoute() {
  const params = useLocalSearchParams<Record<string, unknown>>();
  const slug = params.slug;
  const router = useRouter();

  const landingSlug = useMemo(() => {
    if (typeof slug === "string") return slug;
    if (Array.isArray(slug)) return slug[0] ?? "";
    return "";
  }, [slug]);

  const marketingQueryKey = useMemo(() => {
    try {
      if (Platform.OS === "web" && typeof window !== "undefined") {
        return window.location.search || "";
      }
    } catch {
      // ignore
    }
    const keys = [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_content",
      "utm_term",
      "yclid",
      "adv_variant",
    ] as const;
    return keys.map((k) => `${k}=${String(params[k] ?? "")}`).join("&");
  }, [
    params.utm_source,
    params.utm_medium,
    params.utm_campaign,
    params.utm_content,
    params.utm_term,
    params.yclid,
    params.adv_variant,
  ]);

  const marketingQuery = useMemo(() => {
    try {
      if (Platform.OS === "web" && typeof window !== "undefined") {
        return parseMarketingQuery(
          new URLSearchParams(window.location.search || ""),
        );
      }
    } catch {
      // ignore
    }
    return parseMarketingQuery(params as unknown as Record<string, unknown>);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marketingQueryKey]);

  const [landing, setLanding] = useState<MarketingLanding | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [games, setGames] = useState<MarketingGameCard[] | null>(null);
  const [clubs, setClubs] = useState<MarketingClubCard[] | null>(null);
  const [feedsLoading, setFeedsLoading] = useState(false);

  const queryRef = useRef<{ variantId: string | null }>({ variantId: null });

  const blocks = useMemo(
    () => normalizeBlocks(landing?.content?.blocks),
    [landing?.content?.blocks],
  );

  const skin = useMemo(
    () => resolveMarketingSkin(landing?.content?.theme),
    [landing?.content?.theme],
  );

  useEffect(() => {
    if (!landingSlug) return;
    let cancelled = false;
    // Fetch landing + attribution; sync flags before async work.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional load lifecycle
    setIsLoading(true);
    setError("");
    setLanding(null);

    const query = marketingQuery;
    queryRef.current.variantId = marketingQuery.adv_variant?.trim() || null;

    void (async () => {
      try {
        const [landingPayload, anonymousId] = await Promise.all([
          getPublishedLanding(String(landingSlug)),
          getMarketingAnonymousId(),
        ]);
        if (cancelled) return;
        setLanding(landingPayload);
        const variantKey = query.adv_variant?.trim() || "direct";
        const touchKey = `touch:${anonymousId}:${landingSlug}:${variantKey}:${dayKey()}`;
        await recordMarketingTouch({
          anonymousId,
          query,
          landingSlug: String(landingSlug),
          idempotencyKey: touchKey,
        });
        const key = `landing_view:${anonymousId}:${landingSlug}:${variantKey}:${dayKey()}`;
        if (!landingViewSent.has(key)) {
          landingViewSent.add(key);
          void recordMarketingConversion({
            type: "LANDING_VIEW",
            anonymousId,
            landingSlug: String(landingSlug),
            variantId: query.adv_variant?.trim() || null,
            idempotencyKey: key,
          });
          hitYandexMetrika("landing_view", { slug: landingSlug });
        }
      } catch (e) {
        if (!cancelled) {
          setError(
            e instanceof Error ? e.message : "Не удалось загрузить лендинг",
          );
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [landingSlug, marketingQuery]);

  useEffect(() => {
    if (!landing) return;
    applyWebSeo(landing);
  }, [landing]);

  useEffect(() => {
    const needsGames = blocks.some((b) => b.type === "gameFeed");
    const needsClubs = blocks.some((b) => b.type === "clubFeed");
    if (!needsGames && !needsClubs) return;

    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- feed load lifecycle
    setFeedsLoading(true);
    void (async () => {
      try {
        const gameLimit =
          blocks.find((b) => b.type === "gameFeed" && "limit" in b)?.limit || 4;
        const clubLimit =
          blocks.find((b) => b.type === "clubFeed" && "limit" in b)?.limit || 4;
        const [g, c] = await Promise.all([
          needsGames
            ? fetchMarketingGames(Number(gameLimit) || 4)
            : Promise.resolve(null),
          needsClubs
            ? fetchMarketingClubs(Number(clubLimit) || 4)
            : Promise.resolve(null),
        ]);
        if (cancelled) return;
        if (g) setGames(g);
        if (c) setClubs(c);
      } catch {
        if (!cancelled) {
          if (needsGames) setGames([]);
          if (needsClubs) setClubs([]);
        }
      } finally {
        if (!cancelled) setFeedsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [blocks]);

  const openCta = (url: string, blockKey: string) => {
    const trimmed = url.trim();
    if (!trimmed) return;

    void (async () => {
      try {
        const anonymousId = await getMarketingAnonymousId();
        const variantKey = queryRef.current.variantId || "direct";
        const key = `cta:${anonymousId}:${landingSlug}:${variantKey}:${blockKey}:${dayKey()}`;
        if (!ctaClickSent.has(key)) {
          ctaClickSent.add(key);
          void recordMarketingConversion({
            type: "CTA_CLICK",
            anonymousId,
            landingSlug: String(landingSlug),
            variantId: queryRef.current.variantId,
            idempotencyKey: key,
          });
          reachYandexMetrikaGoal("landing_cta_click");
        }
      } catch {
        // ignore analytics failures
      }
    })();

    if (canOpenInternal(trimmed)) {
      router.push(trimmed as never);
      return;
    }
    if (canOpenExternal(trimmed)) {
      void Linking.openURL(trimmed);
    }
  };

  if (!landingSlug) {
    return (
      <View style={[styles.center, { backgroundColor: skin.pageBackground }]}>
        <Text style={{ color: skin.text }}>Лендинг не найден</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.center, { backgroundColor: skin.pageBackground }]}>
        <Text style={[styles.errorTitle, { color: skin.text }]}>{error}</Text>
        <Pressable onPress={() => router.replace("/" as never)}>
          <Text style={{ color: skin.accentColor, fontWeight: "700" }}>
            На главную
          </Text>
        </Pressable>
      </View>
    );
  }

  if (isLoading || !landing) {
    return (
      <View style={[styles.center, { backgroundColor: skin.pageBackground }]}>
        <ActivityIndicator color={skin.accentColor} />
        <Text style={{ color: skin.textSecondary }}>Загрузка…</Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: String(landing.seo?.title ?? landing.name),
          headerShown: false,
        }}
      />
      <ScrollView
        style={{ flex: 1, backgroundColor: skin.pageBackground }}
        contentContainerStyle={{ flexGrow: 1 }}
      >
        <LandingRenderer
          theme={landing.content?.theme}
          blocks={blocks}
          games={games}
          clubs={clubs}
          feedsLoading={feedsLoading}
          onCta={openCta}
          onOpenGame={(id) =>
            router.push(`/games/${encodeURIComponent(id)}` as never)
          }
          onOpenClub={(id) =>
            router.push(`/clubs/${encodeURIComponent(id)}` as never)
          }
        />
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 24,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
  },
});
