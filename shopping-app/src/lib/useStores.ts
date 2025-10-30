// lib/useStores.ts
import { useEffect, useMemo, useState } from "react";
import type { Store } from "./types";

export type StoreListItem = { id: string; name: string; cover?: string };

type StoresIndex = {
  title?: string;
  classes?: string[];
  stores?: StoreListItem[];
  gst?: number; // e.g. 0.09
};

export function useStoresList() {
  const [stores, setStores] = useState<StoreListItem[]>([]);
  const [siteTitle, setSiteTitle] = useState("School Cart");
  const [classes, setClasses] = useState<string[]>([]);
  const [gstRate, setGstRate] = useState<number>(0.09); // default 9%

  useEffect(() => {
    const ac = new AbortController();
    (async () => {
      try {
        const res = await fetch("/stores/index.json", { signal: ac.signal });
        if (!res.ok)
          throw new Error(`Failed to load index.json (${res.status})`);
        const json: StoresIndex | StoreListItem[] = await res.json();

        if (Array.isArray(json)) {
          // legacy format
          setStores(json);
          setSiteTitle("School Cart");
          setClasses([]);
          setGstRate(0.09);
        } else {
          setStores(json.stores ?? []);
          setSiteTitle(json.title ?? "School Cart");
          setClasses(json.classes ?? []);
          setGstRate(typeof json.gst === "number" ? json.gst : 0.09);
        }
      } catch (e) {
        if ((e as any)?.name !== "AbortError") {
          console.error(e);
          setStores([]);
          setSiteTitle("School Cart");
          setClasses([]);
          setGstRate(0.09);
        }
      }
    })();
    return () => ac.abort();
  }, []);

  return { stores, siteTitle, classes, gstRate };
}

export function useStore(id?: string) {
  const [store, setStore] = useState<Store | null>(null);
  const [error, setError] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!id) return;
    const ac = new AbortController();
    setLoading(true);
    setError(undefined);
    setStore(null);
    (async () => {
      try {
        const res = await fetch(`/stores/${id}.json`, { signal: ac.signal });
        if (!res.ok) {
          setError(`Store "${id}" not found (HTTP ${res.status})`);
          setLoading(false);
          return;
        }
        const json = (await res.json()) as Store;
        setStore(json);
        setLoading(false);
      } catch (e: any) {
        if (e?.name !== "AbortError") {
          setError(e?.message || "Failed to load store");
          setLoading(false);
        }
      }
    })();
    return () => ac.abort();
  }, [id]);

  const productsBySku = useMemo(() => {
    const map: Record<string, Store["products"][number]> = {};
    if (store) for (const p of store.products) map[p.sku] = p;
    return map;
  }, [store]);

  return { store, productsBySku, loading, error };
}
