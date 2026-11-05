import { createClient } from '@supabase/supabase-js';
import type { DesignInput } from '../core/calculationEngine';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

/** null when the env vars are missing: the app then runs without cloud saves. */
export const supabase = url && key ? createClient(url, key) : null;

export interface DesignRow {
  id: string;
  name: string;
  input: DesignInput;
  updated_at: string;
}

export function isDesignInput(v: unknown): v is DesignInput {
  const o = v as Partial<DesignInput> | null;
  return !!o && !!o.material && !!o.load && !!o.detailing && !!o.geometry && Array.isArray(o.geometry.piles);
}
