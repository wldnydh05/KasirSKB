/**
 * Helper cabang untuk Menu.
 * Menu.cabang kini bertipe string[] (bisa Cabang 1 & Cabang 2 sekaligus),
 * tetapi data lama bisa masih berupa string tunggal ('Cabang 1') → dinormalkan di sini.
 */

export function menuCabangList(cabang: string | string[] | undefined | null): string[] {
  if (!cabang) return [];
  if (Array.isArray(cabang)) return cabang.filter(Boolean);
  return [cabang];
}

/** Menu milik cabang tertentu? (string[] maupun string lama tetap terbaca) */
export function menuMilikCabang(
  cabang: string | string[] | undefined | null,
  namaCabang: string
): boolean {
  return menuCabangList(cabang).includes(namaCabang);
}
