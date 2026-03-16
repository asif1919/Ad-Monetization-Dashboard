 "use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";

export function PublishersSearchInput() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const [value, setValue] = useState(searchParams.get("q") ?? "");

  useEffect(() => {
    const handler = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (value.trim()) {
        params.set("q", value);
      } else {
        params.delete("q");
      }
      const query = params.toString();
      router.push(query ? `${pathname}?${query}` : pathname);
    }, 300);

    return () => clearTimeout(handler);
  }, [value, pathname, router, searchParams]);

  return (
    <div className="flex flex-1 max-w-md gap-2">
      <input
        type="text"
        value={value}
        onChange={(e) => {
          const next = e.target.value;
          setValue(next);
        }}
        placeholder="Search by name or email"
        className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm bg-white text-gray-900 placeholder:text-gray-500"
      />
      {value.trim() && (
        <Link
          href={pathname}
          onClick={() => setValue("")}
          className="rounded border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
        >
          Clear
        </Link>
      )}
    </div>
  );
}

