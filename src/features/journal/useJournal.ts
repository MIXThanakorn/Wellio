import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../auth/AuthProvider";
import { supabase } from "../../lib/supabase";
import { tables, type Journal, type Preferences } from "../../lib/types";
import { makeDemo } from "./demo";
import { removeMealPhoto } from "../meals/photos";
type Collection = Exclude<keyof Journal, "preferences">;
const demoKey = "fitlog-demo-data-v1";
function readDemo(): Journal {
  try {
    const value = localStorage.getItem(demoKey);
    if (value) return JSON.parse(value) as Journal;
  } catch {
    localStorage.removeItem(demoKey);
  }
  const data = makeDemo();
  localStorage.setItem(demoKey, JSON.stringify(data));
  return data;
}
async function allRows(table: string, owner: string): Promise<unknown[]> {
  const rows: unknown[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase!
      .from(table)
      .select("*")
      .eq("owner_user_id", owner)
      .order("id")
      .range(offset, offset + 999);
    if (error) throw error;
    rows.push(...data);
    if (data.length < 1000) return rows;
  }
}
export function useJournal() {
  const { profile, demo } = useAuth();
  const owner = profile?.user_id;
  const client = useQueryClient();
  const key = ["journal", demo ? "demo" : owner];
  const query = useQuery({
    queryKey: key,
    enabled: Boolean(owner),
    queryFn: async (): Promise<Journal> => {
      if (demo) return readDemo();
      if (!supabase || !owner) throw new Error("ยังไม่ได้เชื่อมต่อ Supabase");
      const names: Collection[] = [
        "meals",
        "activities",
        "checkins",
        "water",
        "plans",
        "completions",
        "favorites",
      ];
      const values = await Promise.all(
        names.map((name) => allRows(tables[name], owner)),
      );
      const { data, error } = await supabase
        .from("reminder_preferences")
        .select("*")
        .eq("owner_user_id", owner)
        .maybeSingle();
      if (error) throw error;
      return {
        ...Object.fromEntries(names.map((name, i) => [name, values[i]])),
        preferences: data || {
          owner_user_id: owner,
          enabled: false,
          meal_gap_minutes: 300,
          quiet_start: "22:00",
          quiet_end: "07:00",
          timezone: "Asia/Bangkok",
          snoozed_until: null,
        },
      } as Journal;
    },
    staleTime: 30000,
    refetchInterval: demo ? false : 60000,
    refetchOnWindowFocus: true,
    retry: 1,
  });
  const mutation = useMutation({
    mutationFn: async (input: {
      collection: Collection | "preferences";
      action: "save" | "delete";
      value: Record<string, unknown>;
    }) => {
      if (!owner) throw new Error("กรุณาเลือกชื่อมิกหรือเนมก่อนบันทึก");
      if (!navigator.onLine && !demo)
        throw new Error(
          "ออฟไลน์อยู่ ข้อมูลในฟอร์มยังอยู่ กรุณาเชื่อมต่อแล้วบันทึกอีกครั้ง",
        );
      if (demo) {
        const data = readDemo();
        if (input.collection === "preferences")
          data.preferences = {
            ...data.preferences,
            ...input.value,
            owner_user_id: owner,
          } as Preferences;
        else {
          const list = data[input.collection] as unknown as Record<
            string,
            unknown
          >[];
          const id = input.value.id;
          if (input.action === "delete" && input.collection === "meals") {
            const removed = list.find((row) => row.id === id);
            if (typeof removed?.photo_path === "string")
              await removeMealPhoto(removed.photo_path, owner, true);
          }
          if (input.action === "delete")
            data[input.collection] = list.filter((r) => r.id !== id) as never;
          else {
            const row = {
              ...input.value,
              id: id || crypto.randomUUID(),
              owner_user_id: owner,
            };
            const index = list.findIndex((r) => r.id === id);
            if (index >= 0) list[index] = row;
            else list.push(row);
          }
        }
        localStorage.setItem(demoKey, JSON.stringify(data));
        return;
      }
      let request;
      const table = tables[input.collection];
      if (input.action === "delete")
        request = supabase!
          .from(table)
          .delete()
          .eq("id", input.value.id)
          .eq("owner_user_id", owner)
          .select("id");
      else if (input.collection === "preferences")
        request = supabase!
          .from(table)
          .upsert(
            { ...input.value, owner_user_id: owner },
            { onConflict: "owner_user_id" },
          )
          .select("owner_user_id");
      else if (input.value.id) {
        const { id, ...rest } = input.value;
        request = supabase!
          .from(table)
          .update({ ...rest, owner_user_id: owner })
          .eq("id", id)
          .eq("owner_user_id", owner)
          .select("id");
      } else
        request = supabase!
          .from(table)
          .insert({ ...input.value, owner_user_id: owner })
          .select("id");
      const { data, error } = await request;
      if (error)
        throw new Error(
          error.code === "23505"
            ? "มีบันทึกสำหรับวันนี้แล้ว กรุณาแก้ไขรายการเดิม"
            : "บันทึกไม่สำเร็จ กรุณาตรวจอินเทอร์เน็ตแล้วลองอีกครั้ง ข้อมูลในฟอร์มยังอยู่",
        );
      if (!data?.length)
        throw new Error("บันทึกไม่สำเร็จ อาจไม่มีสิทธิ์หรือรายการถูกลบแล้ว");
    },
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: key });
    },
  });
  return {
    ...query,
    save: (
      collection: Collection | "preferences",
      value: Record<string, unknown>,
    ) => mutation.mutateAsync({ collection, action: "save", value }),
    remove: (collection: Collection, id: string) =>
      mutation.mutateAsync({ collection, action: "delete", value: { id } }),
    saving: mutation.isPending,
  };
}
