import type { SupabaseClient } from "npm:@supabase/supabase-js@2.118.0";
const bucket = "meal-photos";
export async function maintainMealPhotos(db: SupabaseClient) {
  let removed = 0;
  try {
    const {error:purgeError}=await db.rpc('purge_expired_journal_entries');
    if(purgeError)throw new Error('Cannot purge expired journal trash');
    const { data: queued, error } = await db.rpc("pending_meal_photo_cleanup");
    if (error) throw new Error("Cannot read photo cleanup queue");
    const paths = (queued || []).map(
      (row: { photo_path: string }) => row.photo_path,
    );
    if (paths.length) {
      const { error: removeError } = await db.storage
        .from(bucket)
        .remove(paths);
      if (removeError) throw new Error("Cannot remove queued photos");
      const { error: completeError } = await db.rpc(
        "complete_meal_photo_cleanup",
        { p_paths: paths },
      );
      if (completeError) throw new Error("Cannot complete photo cleanup");
      removed += paths.length;
    }
    // Recover uploads abandoned before a meal row was saved. Never touch recent uploads.
    const cutoff = Date.now() - 24 * 3600000;
    const { data: profiles, error: profileError } = await db
      .from("profiles")
      .select("user_id");
    if (profileError) throw new Error("Cannot inspect photo owners");
    for (const profile of profiles || []) {
      const referenced = new Set<string>();
      for (let offset = 0; ; offset += 1000) {
        const { data: meals, error: mealError } = await db
          .from("meal_entries")
          .select("photo_path")
          .eq("owner_user_id", profile.user_id)
          .not("photo_path", "is", null)
          .order("id")
          .range(offset, offset + 999);
        if (mealError) throw new Error("Cannot inspect photo references");
        for (const meal of meals || []) referenced.add(meal.photo_path);
        if (!meals || meals.length < 1000) break;
      }
      const orphans: string[] = [];
      for (let offset = 0; ; offset += 100) {
        const { data: files, error: listError } = await db.storage
          .from(bucket)
          .list(profile.user_id, {
            limit: 100,
            offset,
            sortBy: { column: "name", order: "asc" },
          });
        if (listError) throw new Error("Cannot inspect stored photos");
        for (const file of files || []) {
          const path = `${profile.user_id}/${file.name}`;
          if (
            file.id &&
            !referenced.has(path) &&
            new Date(file.created_at).getTime() < cutoff
          )
            orphans.push(path);
        }
        if (!files || files.length < 100) break;
      }
      for (let offset = 0; offset < orphans.length; offset += 100) {
        const batch = orphans.slice(offset, offset + 100);
        const { error: orphanError } = await db.storage
          .from(bucket)
          .remove(batch);
        if (orphanError) throw new Error("Cannot remove abandoned photos");
        removed += batch.length;
      }
    }
    return { removed, failed: false };
  } catch (error) {
    console.error(
      "Meal photo maintenance failed:",
      error instanceof Error ? error.message : "Unknown error",
    );
    return { removed, failed: true };
  }
}
