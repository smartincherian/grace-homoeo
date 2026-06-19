import { useQuery } from "@tanstack/react-query";
import { listPricedItems } from "./calculatorRepo";

export function usePricedItems() {
  return useQuery({
    queryKey: ["calculator", "pricedItems"],
    queryFn: listPricedItems,
  });
}
