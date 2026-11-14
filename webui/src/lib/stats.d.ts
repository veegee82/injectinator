export function wilson(k: number, n: number, z?: number): [number, number];
export function floorCeiling(values: number[]): "floor" | "ceiling" | null;
export function weighted<T extends { n: number }>(cells: T[], key: keyof T): number;
export function median(xs: number[]): number | null;
export function pct(x: number, d?: number): string;
