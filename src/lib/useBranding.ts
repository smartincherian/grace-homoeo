import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getBranding,
  readCachedBranding,
  saveBranding,
  writeCachedBranding,
  type Branding,
} from "./branding";

export function useBranding(clinicId: string | undefined) {
  return useQuery({
    queryKey: ["branding", clinicId],
    queryFn: async () => {
      const b = await getBranding(clinicId as string);
      writeCachedBranding(clinicId as string, b);
      return b;
    },
    enabled: !!clinicId,
    initialData: clinicId ? readCachedBranding(clinicId) : undefined,
    initialDataUpdatedAt: 0,
  });
}

export function useSaveBranding(clinicId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ branding, by }: { branding: Branding; by: string }) => {
      await saveBranding(clinicId, branding, by);
      return branding;
    },
    onSuccess: (branding) => {
      qc.setQueryData(["branding", clinicId], branding);
      writeCachedBranding(clinicId, branding);
    },
  });
}
