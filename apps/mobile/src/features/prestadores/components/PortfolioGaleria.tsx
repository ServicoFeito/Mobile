import { Image, ScrollView } from "react-native";
import type { ItemPortfolio } from "@/features/prestadores/types/prestador.types";

export function PortfolioGaleria({ itens }: { itens: ItemPortfolio[] }) {
  if (itens.length === 0) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-1">
      {itens.map((i) => (
        <Image
          key={i.id}
          source={{ uri: i.urlMedia }}
          className="w-32 h-32 rounded-lg mx-1 bg-sf-surface-variant"
          resizeMode="cover"
        />
      ))}
    </ScrollView>
  );
}
