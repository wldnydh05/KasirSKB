# 🐛 Bug Fixes - Complete Summary

## Issues Fixed

### 1. ✅ Branch Cleanup (Cabang Reference)
**Problem:** Products associated with deleted branches left orphaned branch references.

**Solution:**
- Modified `deleteCabang` to clean up menu branch arrays
- Permanently delete menus that only existed in the deleted branch
- Locations: `src/context/CabangContext.tsx` lines 166-199

### 2. ✅ Deleted Products Reappear After Refresh
**Problem:** Menu deletion wasn't syncing to Supabase, causing deleted items to resurrect on app refresh.

**Solution:**
- Switched to **soft delete** pattern (mark with `deleted_at`)
- All menu queries now filter out `deleted_at` records
- Initial pull and periodic pull filter out deleted records
- All sync operations properly track deletion state

**Locations:**
- `src/db/syncEngine.ts` - Initial pull (line 117), applyRemoteChange (line 268-272)
- `src/components/menu/KelolaMenuView.tsx` - Soft delete (line 196-203)
- `src/context/CabangContext.tsx` - Soft delete on branch removal (line 187-192)
- `src/components/kasir/KasirView.tsx` - Filter deleted menus (line 48)
- `src/components/menu/KelolaMenuView.tsx` - Filter deleted menus (line 66)
- `src/components/owner/PengaturanBiayaView.tsx` - Filter deleted menus (line 23)
- `src/components/pesanan/EditPesananView.tsx` - Filter deleted menus (line 69)

### 3. ✅ Negative Net Profit (Laba Bersih)
**Problem:** Dashboard showed -Rp75k profit when no transactions due to operating costs.

**Solution:**
- Added early return if no transactions exist today
- Returns 0 for all KPIs instead of negative calculation
- Location: `src/components/dashboard/DashboardOwnerView.tsx` lines 125-133

---

## Technical Implementation Details

### Soft Delete Pattern
```typescript
// In db/index.ts
export async function softDeleteRecord<T>(
  table: Dexie.Table<T, number>,
  id: number | undefined
): Promise<void> {
  if (!id) return;
  const nowIso = new Date().toISOString();
  await table.update(id, {
    deleted_at: nowIso,
    synced: false,
    updated_at: nowIso,
  });
}

// Using soft delete
await softDeleteRecord(db.menus, menuToDelete.id);
```

### Deletion Flow
1. User deletes menu in UI
2. `deleted_at` set, `synced: false`, `updated_at` updated
3. Push to Supabase during sync cycle
4. Query-time filtering removes deleted menus
5. Pull from Supabase ignores `deleted_at` records
6. Data persisted across all devices

### Query Filtering Pattern
```typescript
// In all menu-reading places
const allMenus = (await db.menus.toArray()).filter((m) => !m.deleted_at);
```

---

## Testing Checklist

### 🧪 Test Branch Cleanup
- [ ] Create menu "Soto" with branch "Depan Alfa"
- [ ] Verify menu appears in both "Depan Alfa" and "Cabang 1" (if applicable)
- [ ] Delete branch "Depan Alfa"
- [ ] Open menu "Soto": branch list should not contain "Depan Alfa"
- [ ] If menu only had "Depan Alfa", it should be permanently deleted

### 🧪 Test Persistent Deletion
- [ ] Delete menu "Bebek Goreng"
- [ ] Refresh the page (F5 or Ctrl+R)
- [ ] [Expected] Menu "Bebek Goreng" does **not** reappear
- [ ] Check Kelola Menu view: menu is absent
- [ ] Check Kasir view: menu is absent
- [ ] Check Pengaturan Biaya view: menu is absent
- [ ] Edit Order view: menu is absent

**Note:** This may take 1-2 sync cycles (30 seconds) for Supabase sync, or trigger manual sync via syncEngine (if available in UI).

### 🧪 Test Zero Profit Display
- [ ] Open Dashboard Owner
- [ ] Ensure no transactions today exist
- [ ] Laba Bersih card should show **0** (not -Rp75,000)
- [ ] Check all KPI cards: Penjualan, Transaksi, Bahan Baku, Operasional should all be 0

---

## Files Modified

```
src/context/CabangContext.tsx
  - fix deleteCabang to clean menu branch references (2 change blocks)
  - change hard delete to soft delete for menus only in deleted branch

src/db/index.ts
  - add softDeleteRecord helper function

src/db/syncEngine.ts
  - initial pull filters deleted_at IS NULL (line 117)
  - DELETE handler changed from soft to hard delete (line 268-272)

src/components/dashboard/DashboardOwnerView.tsx
  - add zero-transaction early return (lines 125-133)

src/components/menu/KelolaMenuView.tsx
  - change confirmDelete to soft delete (lines 196-203)
  - filter query result to exclude deleted (line 66)

src/components/kasir/KasirView.tsx
  - filter query result to exclude deleted (line 48)

src/components/owner/PengaturanBiayaView.tsx
  - filter query result to exclude deleted (line 23)

src/components/pesanan/EditPesananView.tsx
  - filter query result to exclude deleted (line 69)
```

---

## TypeScript & Compilation

✅ **All compile successfully**
✅ **No TypeScript errors**
✅ **Backward compatible** with existing data (migrations set `deleted_at: null` for all existing records)

---

## Deployment Notes

1. Database migration already exists (v6) that sets `deleted_at = null` for all records
2. No additional migrations needed
3. Existing deleted records in Supabase will be pulled as-is (deleted_at rows ignored)
4. Future local deletions will sync to Supabase and persist

---

## Questions Answered

### Q: Why Laba Bersih shows negative value?
**A:** Previous calculation computed profit even with zero transactions:
```
- 0 (penjualan) - 75000 (operasional) = -75000
```
Fixed to return 0 profit when no transactions exist.

### Q: Why products reappear after refresh?
**A:** Local `delete()` never synced to Supabase. On refresh, initial pull fetched active records from Supabase, resurrecting the deleted item.

### Q: What is soft delete?
**A:** Instead of permanently removing a record, mark it as deleted (`deleted_at` field). This:
- Allows deletion to sync to Supabase
- Persists across devices
- Can be "undeleted" if needed
- Query filters hide the record visibly
- Matches existing sync engine architecture

---

## Rollback Plan

If needed to revert changes:

1. Revert `KelolaMenuView.tsx` confirmDelete to original `db.menus.delete()`
2. Revert `CabangContext.tsx` to original branching logic
3. Revert `DashboardOwnerView.tsx` to original profit calc
4. Revert all `.filter((m) => !m.deleted_at)` changes back to `db.menus.toArray()`

All original code is preserved in separate changes if needed.