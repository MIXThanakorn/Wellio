import { useEffect, useState } from "react";
import { ImageOff, ImageIcon } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../auth/AuthProvider";
import { mealPhotoUrl } from "./photos";
import { Modal } from "../../components/ui";
export function MealPhoto({
  path,
  name,
  compact = false,
}: {
  path: string;
  name: string;
  compact?: boolean;
}) {
  const { profile, demo } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const [broken, setBroken] = useState(false);
  const photo = useQuery({
    queryKey: ["meal-photo", profile?.user_id, path],
    queryFn: () => mealPhotoUrl(path, demo),
    staleTime: 240000,
    refetchInterval: demo ? false : 240000,
    retry: 1,
  });
  useEffect(() => setBroken(false), [photo.data]);
  if (photo.isPending)
    return (
      <div className="meal-photo-loading" aria-label="กำลังโหลดรูปอาหาร">
        <ImageIcon size={22} />
      </div>
    );
  if (photo.isError || broken)
    return (
      <button
        type="button"
        className="meal-photo-retry"
        onClick={() => {
          setBroken(false);
          void photo.refetch();
        }}
      >
        <ImageOff size={17} />
        โหลดรูปอีกครั้ง
      </button>
    );
  return (
    <>
      <button
        type="button"
        className={`meal-photo-button ${compact ? "compact" : ""}`}
        aria-label={`ดูรูป ${name}`}
        onClick={() => setExpanded(true)}
      >
        <img
          src={photo.data}
          alt={`รูปอาหาร ${name}`}
          loading="lazy"
          onError={() => setBroken(true)}
        />
        <span>ดูรูป</span>
      </button>
      {expanded && (
        <Modal title={`รูปอาหาร · ${name}`} onClose={() => setExpanded(false)}>
          <img
            className="meal-photo-expanded"
            src={photo.data}
            alt={`รูปขยาย ${name}`}
            onError={() => setBroken(true)}
          />
        </Modal>
      )}
    </>
  );
}
