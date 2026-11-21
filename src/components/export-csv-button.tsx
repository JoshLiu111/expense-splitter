"use client";

import { Download } from "lucide-react";
import { groupCsv, groupCsvFileName, type GroupSnapshot } from "@/domain";
import { Button } from "@/components/ui/button";

/**
 * Download every Expense and Settlement in the Group, with each Member's
 * Share in the Group Currency, as a CSV file named after it. Built in the
 * browser from the Group already shown, for Guests, signed-in Users and
 * read-only Former Members alike. Filters don't narrow it.
 */
export function ExportCsvButton({ group }: { group: GroupSnapshot }) {
  function download() {
    const blob = new Blob([groupCsv(group)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = groupCsvFileName(group);
    link.click();
    // Let the download start before the URL goes.
    setTimeout(() => URL.revokeObjectURL(url));
  }

  return (
    <Button variant="quiet" onClick={download}>
      <Download aria-hidden /> Export CSV
    </Button>
  );
}
